import { clamp, rad } from '../../core/math';
import { mulberry32 } from '../../core/prng';
import type { Microdetail } from '../../schema/eye-microdetail';
import type { OpeningGeometry } from './opening';
import { lowerFrame, upperFrame } from './opening';
import type { Vec } from './primitives';

/**
 * EYE-07G — Petits plis des canthi (pure, déterministe). Deux familles de plis cutanés, HORS de l'ouverture :
 *  - EXTERNE : les ridules du canthus latéral (« pattes d'oie ») rayonnent en éventail depuis le coin externe, dans le prolongement de la tangente du bord supérieur, avec un léger biais vers le bas
 *    (la peau se plisse sous l'effet de l'orbiculaire). `outer` = force (longueur et opacité), `count` = nombre, `spread` = ouverture de l'éventail (0 = parallèles, 1 = ± 40°) ;
 *  - INTERNE : le pli naso-jugal naissant — un à deux arcs courts sous le canthus interne, vers le nez. `inner` = force.
 * Chaque ride est une pointe effilée (largeur à la racine, 0 à la pointe) ; le tirage est FIXE (3 appels par ride) : ni le LOD ni `count` ne déplacent les rides conservées.
 */
export interface CanthusStroke {
  /** Racine, contrôle, pointe d'une quadratique. */
  readonly root: Vec;
  readonly ctrl: Vec;
  readonly tip: Vec;
  /** Largeur à la racine (unités locales). */
  readonly width: number;
  /** Opacité 0..1. */
  readonly alpha: number;
  readonly side: 'outer' | 'inner';
  /** Angle de la ride par rapport à la direction de référence de son côté (degrés) — contrôlé par la vérification. */
  readonly angleDeg: number;
}
export const CANTHUS_MAX_LENGTH = 0.22;   // × largeur d'enveloppe
export const CANTHUS_FAN_MAX_DEG = 70;
const MAX_COUNT = 6;

const rot = (d: Vec, a: number): Vec => ({ x: d.x * Math.cos(a) - d.y * Math.sin(a), y: d.x * Math.sin(a) + d.y * Math.cos(a) });
const quad = (s: CanthusStroke, t: number): Vec => { const u = 1 - t; return { x: u * u * s.root.x + 2 * u * t * s.ctrl.x + t * t * s.tip.x, y: u * u * s.root.y + 2 * u * t * s.ctrl.y + t * t * s.tip.y }; };
export const canthusPoint = quad;

/** `fine` : part de détail fin du LOD (`microLod`) — retire des rides par la fin de liste, ne déplace pas les autres. `th` : épaisseur du trait de paupière (échelle de la largeur des rides). */
export function canthusLines(g: OpeningGeometry, o: NonNullable<Microdetail['canthusLines']>, seed: number, th: number, fine = 1): CanthusStroke[] {
  const rnd = mulberry32((seed ^ 0x2f6e2b1) >>> 0); const out: CanthusStroke[] = [];
  // --- externe : éventail depuis le coin externe, prolongement de la tangente du bord supérieur, biais vers le bas
  const fo = upperFrame(g, 1); const dir0 = fo.T; const down = rad(10 * g.s);        // g.s = +1 : externe à droite ; la rotation positive (y vers le bas) abaisse la direction
  const keepO = fine <= 0 ? 0 : Math.max(1, Math.ceil(o.count * fine));
  for (let k = 0; k < o.count; k++) {
    const jLen = rnd(), jAng = rnd(), jBend = rnd();   // 3 tirages par ride, toujours faits
    const u = o.count === 1 ? 0.5 : k / (o.count - 1);
    const a = rad((u - 0.5) * 2 * o.spread * 40 + (jAng - 0.5) * 6) * g.s + down;
    const d = rot(dir0, a);
    const len = g.w * (0.035 + 0.1 * o.outer) * (0.7 + 0.6 * jLen) * (1 - 0.25 * Math.abs(u - 0.5) * 2);
    const root: Vec = { x: fo.pos.x + d.x * g.w * 0.03, y: fo.pos.y + d.y * g.w * 0.03 };
    const tip: Vec = { x: root.x + d.x * len, y: root.y + d.y * len };
    const bend = (jBend - 0.5) * 0.3 * len;
    const ctrl: Vec = { x: (root.x + tip.x) / 2 - d.y * bend, y: (root.y + tip.y) / 2 + d.x * bend };
    if (k < keepO && o.outer > 0) out.push({ root, ctrl, tip, width: Math.max(0.3, th * 0.12), alpha: clamp(0.1 + 0.5 * o.outer * (1 - 0.3 * Math.abs(u - 0.5) * 2), 0, 1), side: 'outer', angleDeg: (a * 180) / Math.PI * g.s });
  }
  // --- interne : un à deux arcs sous le canthus interne, vers le nez (direction −T de l'enveloppe, tournée vers le bas)
  const fi = lowerFrame(g, 0.05); const toNose = rot({ x: -fo.T.x, y: -fo.T.y }, 0);
  const nInner = o.inner > 0.5 ? 2 : 1;
  for (let k = 0; k < nInner; k++) {
    const jLen = rnd(), jAng = rnd(), jBend = rnd();
    const a = rad(34 + 22 * k + (jAng - 0.5) * 6) * -g.s;   // vers le bas-nez ; plus raide pour le second
    const d = rot(toNose, a);
    const len = g.w * (0.04 + 0.07 * o.inner) * (0.8 + 0.4 * jLen);
    const root: Vec = { x: fi.pos.x + fi.N.x * g.hEff * 0.06 + d.x * g.w * 0.01, y: fi.pos.y + fi.N.y * g.hEff * 0.06 + d.y * g.w * 0.01 };
    const tip: Vec = { x: root.x + d.x * len, y: root.y + d.y * len };
    const bend = (jBend - 0.5) * 0.3 * len;
    const ctrl: Vec = { x: (root.x + tip.x) / 2 - d.y * bend, y: (root.y + tip.y) / 2 + d.x * bend };
    if (k < Math.max(fine > 0 ? 1 : 0, Math.ceil(nInner * fine)) && o.inner > 0) out.push({ root, ctrl, tip, width: Math.max(0.3, th * 0.14), alpha: clamp(0.1 + 0.45 * o.inner, 0, 1), side: 'inner', angleDeg: (a * 180) / Math.PI * -g.s });
  }
  return out;
}

/** Contour fermé d'une ride effilée (racine large → pointe nulle), `n` pas par côté. */
export function canthusOutline(s: CanthusStroke, n = 6): Vec[] {
  const left: Vec[] = []; const right: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n; const p = quad(s, t); const q = quad(s, Math.min(1, t + 0.02)); const r = quad(s, Math.max(0, t - 0.02));
    const dx = q.x - r.x; const dy = q.y - r.y; const l = Math.hypot(dx, dy) || 1; const w = (s.width / 2) * (1 - t) ** 0.9;
    left.push({ x: p.x - (dy / l) * w, y: p.y + (dx / l) * w }); right.push({ x: p.x + (dy / l) * w, y: p.y - (dx / l) * w });
  }
  return [...left, ...right.reverse()];
}
export const CANTHUS_COUNT_MAX = MAX_COUNT;

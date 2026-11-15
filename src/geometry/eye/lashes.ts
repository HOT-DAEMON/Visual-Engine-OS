import { clamp, rad } from '../../core/math';
import { clumpLashes, flickLashes } from './lash-extras';
import { mulberry32 } from '../../core/prng';
import type { EyeSpec } from '../../schema';
import type { Frame, OpeningGeometry } from './opening';
import { lowerFrame, upperFrame } from './opening';
import type { Vec } from './primitives';
import { linerTopOffset } from './liner';

// ------------------------------------------------------------------ Cils

export interface Lash {
  readonly base: Vec;
  readonly ctrl: Vec;
  readonly tip: Vec;
  /** Second contrôle : présent pour les cils CUBIQUES (cils longs externes), absent pour les quadratiques. */
  readonly ctrl2?: Vec;
  readonly baseWidth: number;
  /** 0 = pointe arrondie (contrôle large), 1 = aiguille (contrôle resserré) — voir `tipSharpness`. */
  readonly tipSharpness: number;
  /** Écart de luminosité tiré pour CE cil (−1..1) — voir `colorVariation` ; 0 = couleur de base. */
  readonly colorJitter: number;
}

const smoothstep = (x: number): number => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};

type LashGroupParams = EyeSpec['lashes']['upper'] | EyeSpec['lashes']['lower'];

/**
 * Cil courbé (voir `bendDeg`) : la direction tourne de `bendDeg` degrés entre la racine et la pointe, vers la normale N du bord (ou vers l'extérieur T si le cil est déjà normal).
 * Angle θ(s) = θ0 + bend·s^e avec e = 2,2 − 1,6·curl (curl grand = courbure précoce) ; intégré en 8 pas puis ramené à une cubique (P1, P2 tangents aux directions de départ et d'arrivée).
 */
function bentLash(base: Vec, dir: Vec, N: Vec, T: Vec, len: number, bendDeg: number, curl: number): Pick<Lash, 'base' | 'ctrl' | 'ctrl2' | 'tip'> {
  const cr = dir.x * N.y - dir.y * N.x;
  const toward = Math.abs(cr) > 1e-6 ? Math.sign(cr) : Math.sign(dir.x * T.y - dir.y * T.x) || 1;
  const bend = rad(bendDeg) * toward;
  const e = 2.2 - 1.6 * clamp(curl, 0, 1);
  const rot = (d: Vec, a: number): Vec => ({ x: d.x * Math.cos(a) - d.y * Math.sin(a), y: d.x * Math.sin(a) + d.y * Math.cos(a) });
  let x = base.x;
  let y = base.y;
  const steps = 8;
  for (let k = 0; k < steps; k++) {
    const d = rot(dir, bend * ((k + 0.5) / steps) ** e);
    x += (d.x * len) / steps;
    y += (d.y * len) / steps;
  }
  const d1 = dir;
  const d2 = rot(dir, bend);
  return {
    base,
    ctrl: { x: base.x + (d1.x * len) / 3, y: base.y + (d1.y * len) / 3 },
    ctrl2: { x: x - (d2.x * len) / 3, y: y - (d2.y * len) / 3 },
    tip: { x, y },
  };
}

/**
 * Construit un groupe de cils à partir de sa MORPHOLOGIE (longueur/épaisseur de base, arche,
 * angle, pointe, courbure) et de la dispersion statistique entre FIBRES individuelles (seedée,
 * donc déterministe). Chaque cil tire un nombre d'appels FIXE au PRNG, qu'il soit ou non retenu
 * ensuite — c'est ce qui garantit qu'ajouter un paramètre plus tard ne décale pas les tirages
 * existants pour une seed donnée.
 */
function buildLashes(
  frameAt: (t: number) => Frame,
  p: LashGroupParams,
  lidPx: number,
  shiftPx: number,
  seed: number,
  rootShift?: (t: number) => number,
): Lash[] {
  const rnd = mulberry32(seed >>> 0);
  const out: Lash[] = [];
  // `p.length` est déjà converti en pixels par l'appelant (`lashes.length * g.h`) ; `lidPx` est
  // l'épaisseur du bord palpébral en pixels, base de l'épaisseur des cils (`p.thickness` est une
  // fraction de cette épaisseur, voir eye-lashes.ts).
  const lengthPx = p.length;
  const baseWidthPx = lidPx * p.thickness;
  for (let i = 0; i < p.count; i++) {
    // Ordre d'appel FIXE : 6 tirages par cil, même si le cil est ensuite écarté par la dispersion.
    const jPos = rnd();
    const jLen = rnd();
    const jThick = rnd();
    const jOrient = rnd();
    const jCurl = rnd();
    const jColor = rnd();

    const spread = p.positionDispersion * 0.9;
    const t = clamp(p.span.from + (p.span.to - p.span.from) * ((i + 0.5) / p.count) + ((jPos - 0.5) * spread * (p.span.to - p.span.from)) / (0.9 * p.count), 0.02, 0.98);
    const { pos, T, N } = frameAt(t);

    // Éventail (sweep) + rotation globale (angleDeg) + dispersion d'orientation par cil.
    const phi = rad((p.sweep * (t - 0.3)) / 0.7 + p.angleDeg + (jOrient - 0.5) * 2 * p.orientationVariation);
    const dir0: Vec = { x: N.x * Math.cos(phi) + T.x * Math.sin(phi), y: N.y * Math.cos(phi) + T.y * Math.sin(phi) };
    // `outerLift` (opt-in) : mélange la direction vers le haut de l'œil, de plus en plus à l'extérieur.
    const lift = p.outerLift * smoothstep((t - 0.4) / 0.6);
    const lx = dir0.x * (1 - lift);
    const ly = dir0.y * (1 - lift) - lift;
    const ln = Math.hypot(lx, ly) || 1;
    const dir: Vec = lift === 0 ? dir0 : { x: lx / ln, y: ly / ln };

    // Arche : profil de longueur gaussien, pic et largeur réglables, amplitude réglable.
    const envelope = Math.exp(-(((t - p.arch.peak) / Math.max(p.arch.width, 0.02)) ** 2));
    const f = (1 - p.arch.strength) + p.arch.strength * envelope;
    // `outerLength` (opt-in) : allonge les cils de la moitié externe ; facteur exactement 1 à 0.
    const outer = 1 + p.outerLength * smoothstep((t - 0.5) / 0.5);
    const len = lengthPx * f * (1 + (jLen - 0.5) * 2 * p.lengthVariation) * outer;
    const curl = clamp(p.curl * (1 + (jCurl - 0.5) * 2 * p.curlVariation), 0, 1.5);
    const width = Math.max(0.3, baseWidthPx * (1 + (jThick - 0.5) * 2 * p.thicknessVariation));

    const shift = (rootShift ? Math.max(shiftPx, rootShift(t)) : shiftPx) - p.rootFuse * lidPx * 0.9;
    const base: Vec = { x: pos.x + N.x * shift, y: pos.y + N.y * shift };
    const widthF = width * (1 + 0.8 * p.rootFuse);
    if (p.bendDeg !== 0) {
      out.push({ ...bentLash(base, dir, N, T, len, p.bendDeg * (1 + (jCurl - 0.5) * 2 * p.curlVariation), p.curl), baseWidth: widthF, tipSharpness: p.tipSharpness, colorJitter: (jColor - 0.5) * 2 * p.colorVariation });
      continue;
    }
    out.push({
      base,
      ctrl: { x: base.x + dir.x * len * 0.6, y: base.y + dir.y * len * 0.6 },
      tip: { x: base.x + dir.x * len + T.x * len * curl * 0.25, y: base.y + dir.y * len + T.y * len * curl * 0.25 },
      baseWidth: widthF,
      tipSharpness: p.tipSharpness,
      colorJitter: (jColor - 0.5) * 2 * p.colorVariation,
    });
  }
  return out;
}

/**
 * `rootShift` (optionnel) : décalage des racines selon la position `t` — fourni quand un liner est
 * actif pour que les cils sortent du BORD HAUT du liner (voir geometry/eye/liner.ts).
 */
export function upperLashes(
  g: OpeningGeometry,
  lashes: EyeSpec['lashes']['upper'],
  lidPx: number,
  seed: number,
  rootShift?: (t: number) => number,
): Lash[] {
  const base = buildLashes((t) => upperFrame(g, t), { ...lashes, length: lashes.length * g.h }, lidPx, lidPx * 0.3, seed, rootShift);
  const clumped = clumpLashes(base, lashes.clump, lashes.clumpSize, seed);
  return [...clumped, ...flickLashes(g, lashes.flick, lidPx, rootShift ?? (() => lidPx * 0.3), seed)];
}

export function lowerLashes(g: OpeningGeometry, lashes: EyeSpec['lashes']['lower'], lidPx: number, seed: number): Lash[] {
  const base = buildLashes((t) => lowerFrame(g, t), { ...lashes, length: lashes.length * g.h }, lidPx, lidPx * 0.1, seed);
  return clumpLashes(base, lashes.clump, lashes.clumpSize, seed);
}

/**
 * Point d'entrée UNIQUE des cils d'un œil : le rendu (render/eye/lids-fold.ts) et la vérification (verify/eye-lashes.ts) appellent la même fonction, avec les mêmes graines et le même
 * décalage de racine (le liner, s'il existe, porte les racines sur son bord haut), pour que la vérification porte sur les cils réellement dessinés.
 */
export function eyeLashSet(eye: EyeSpec, g: OpeningGeometry, th: number): { upper: Lash[]; lower: Lash[]; rootShift: ((t: number) => number) | undefined } {
  const liner = eye.lids.liner;
  const rootShift = liner ? (t: number) => linerTopOffset(liner, th, t) * 0.88 : undefined;
  return {
    upper: upperLashes(g, eye.lashes.upper, th, (eye.seed ^ 0xa5a5a5a5) >>> 0, rootShift),
    lower: lowerLashes(g, eye.lashes.lower, th, (eye.seed ^ 0x5a5a5a5a) >>> 0),
    rootShift,
  };
}

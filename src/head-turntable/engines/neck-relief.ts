import { clamp, clamp01 } from '../../core/math';
import { neckModelFor, uAtY, fieldAt, type NeckModel } from '../../neck';
import { visibilityOf } from '../../neck/anatomy';
import { detailGain, effectiveStyle } from '../../neck/style';
import { mix, type RGB } from '../color';
import { smooth } from '../math';
import type { HeadTurnSpec, V3 } from '../types';
import type { EngineHead } from './face-model';
import { neckCutY, neckSection, type NeckSection } from './neck3d';
import { py } from './units';

/**
 * RELIEFS DU COU 3D : sterno-cléido-mastoïdien (SCM), platysma, clavicules + fosse sus-sternale, LUS DU MOTEUR DE COU (`src/neck`), jamais redessinés à part.
 * Ce module ne contient ni muscle ni os : il lit (1) les VISIBILITÉS calculées par `neck/anatomy.ts` pour le visage de l'hôte (masse, âge, tension, tension de peau) et
 * (2) les TRACÉS de `render/neck/muscles.ts` et `reliefs.ts` exprimés en (u le long du cou, ψ autour), qu'il pose sur la section elliptique du cou 3D (x = a·sin ψ, z = zc + b·cos ψ : la
 * même paramétrisation que `neck/geometry.sectionPoint`). Une marque est un CREUX peint en ton d'ombre durci (cel : pas de dégradé, même logique que le trait de lisière).
 * Documenté dans docs/HEAD-TURNTABLE-NECK-RELIEF.md.
 */
export interface NeckRelief {
  readonly model: NeckModel; readonly scm: number; readonly platysma: number; readonly clavicle: number;
  readonly tension: number; readonly sep: number; readonly tendon: number; readonly age: number; readonly detail: number; readonly chinU: number; readonly jawU: number;
}
const CACHE = new WeakMap<EngineHead, NeckRelief>();
export function neckReliefOf(e: EngineHead): NeckRelief {
  let r = CACHE.get(e);
  if (!r) {
    const model = neckModelFor(e.p, e.lm), sys = e.p.neck.system, st = model.composition.structures;
    CACHE.set(e, (r = {
      model, scm: visibilityOf(st, 'scm'), platysma: visibilityOf(st, 'platysma-infrahyoid'), clavicle: visibilityOf(st, 'clavicle'),
      tension: sys.surface.skinTension, sep: sys.musculature.separation, tendon: sys.musculature.tendonVisibility, age: sys.modifiers.age,
      detail: detailGain(effectiveStyle(sys.style)) * (1 - 0.8 * model.fields.simplify), chinU: uAtY(model, model.ctx.chinY), jawU: uAtY(model, model.ctx.jawY),
    }));
  }
  return r;
}

/** Teinte d'un creux : l'ombre de la peau durcie de 30 % vers l'encre (lue par le peintre ET par le contrôle de rendu). */
export const markColor = (pal: { shade: RGB; ink: RGB }): RGB => mix(pal.shade, pal.ink, 0.3);

/** Un trait lu du moteur : ψ(u) du centre, demi-largeur MONDE (U), opacité du moteur (une marque n'est peinte que si elle se lirait : ≥ MIN_OPACITY). */
const MIN_OPACITY = 0.1, PI = Math.PI;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Un trait posé sur une rangée : ψ de son centre à cette hauteur, pente dψ/dy (pour la distance perpendiculaire) et demi-largeur monde. */
interface Curve { readonly psi: number; readonly slope: number; readonly w: number }
/** Tout ce qui ne dépend que de la hauteur y : section, traits, et si la rangée porte une clavicule. Calculé UNE fois par rangée quantifiée (Q), pas par pixel. */
interface Row { readonly a: number; readonly b: number; readonly zc: number; readonly curves: readonly Curve[]; readonly claviY: number; readonly claviW: number; readonly notch: boolean; readonly base: NeckSection }
const Q = 0.0005, ROWS = new WeakMap<EngineHead, Map<number, Row>>();

const BASE_PTS: readonly (readonly [number, number])[] = [[0.06, 0.03], [0.35, 0.048], [0.7, 0.04], [0.98, 0.015]];   // clavicule : (x / demi-largeur de la base, hauteur au-dessus de la base en H) — `render/neck/reliefs.ts`
const claviY = (xi: number): number => {
  if (xi <= BASE_PTS[0]![0]) return BASE_PTS[0]![1];
  for (let i = 1; i < BASE_PTS.length; i++) if (xi <= BASE_PTS[i]![0]) { const [x0, y0] = BASE_PTS[i - 1]!, [x1, y1] = BASE_PTS[i]!; return lerp(y0, y1, (xi - x0) / (x1 - x0)); }
  return NaN;
};

/** Traits (ψ de centre, pente, demi-largeur) à la hauteur y : SCM (bords interne/externe, cordes) et platysma, avec les opacités du moteur. */
function curvesAt(R: NeckRelief, y: number): Curve[] {
  const out: Curve[] = [], dy = 0.01, uOf = (yy: number): number => uAtY(R.model, py(yy)), mSide = fieldAt(R.model, 'muscleSide', uOf(y));
  const add = (f: (u: number) => number, w: number): void => {
    const pe = f(uOf(y));
    if (!Number.isFinite(pe)) return;
    const p2 = f(uOf(y + dy));
    out.push({ psi: pe, slope: Number.isFinite(p2) ? (p2 - pe) / dy : 0, w });
  };
  if (R.scm > 0.03) for (const s of [-1, 1] as const) {
    const v = clamp01(R.scm * (1 + 0.8 * s * mSide)), u0 = Math.min(0.9, R.jawU + 0.02), tOf = (u: number): number => (u - u0) / (0.97 - u0);
    const psiC = (u: number): number => lerp(s * 0.68 * PI, s * 0.14 * PI, smooth(tOf(u))), half = (u: number): number => (0.05 + 0.06 * Math.sin(PI * tOf(u))) * PI * (0.7 + 0.6 * v);
    const edge = (sign: number) => (u: number): number => (u >= u0 && u <= 0.97 ? psiC(u) + sign * half(u) : NaN);
    // Bord interne (côté trachée) : creux net ; bord externe : plus mince et plus faible. Opacités = celles du moteur (`muscles.ts`).
    const oIn = clamp((0.08 + 0.34 * v) * (0.25 + 1.5 * R.sep) * (0.3 + 1.4 * R.tension), 0, 0.75) * R.detail, oOut = (0.05 + 0.3 * v) * R.sep * R.detail;
    if (oIn >= MIN_OPACITY) add(edge(s > 0 ? -1 : 1), 0.0035 + 0.004 * v);
    if (oOut >= MIN_OPACITY) add(edge(s > 0 ? 1 : -1), 0.0025 + 0.002 * v);
    const tv = R.tendon * v * (0.4 + 1.2 * R.tension) * R.detail;
    if (tv > 0.06 && 0.55 * tv >= MIN_OPACITY) for (const d of [-0.05, 0.06]) add((u) => (u >= 0.86 && u <= 0.985 ? s * lerp(0.2, 0.1 + d, (u - 0.86) / 0.125) * PI : NaN), 0.0028);
  }
  if (R.platysma > 0.06 && 0.3 * R.platysma >= MIN_OPACITY) for (const s of [-1, 1] as const) {
    const u1 = R.chinU + 0.55 * (1 - R.chinU);
    add((u) => (u >= R.chinU + 0.01 && u <= u1 ? s * lerp(0.2, 0.12, (u - R.chinU - 0.01) / (u1 - R.chinU - 0.01)) * PI : NaN), 0.0028);
  }
  return out;
}

function rowAt(e: EngineHead, R: NeckRelief, n: HeadTurnSpec['neck'], y: number): Row {
  const sec = neckSection(e, y, n.y1), base = neckSection(e, n.y1, n.y1), clav = R.clavicle > 0.05 && y > n.y1 - 0.09;
  return {
    a: sec.a, b: sec.b, zc: sec.zc, curves: curvesAt(R, y), base,
    claviY: clav && 0.22 * R.clavicle * R.detail * 1.5 >= MIN_OPACITY ? n.y1 + 0.006 : NaN, claviW: 0.0035 + 0.003 * R.clavicle,
    // Fosse sus-sternale : opacité du moteur ≥ 0,15 (sinon invisible à cette lecture).
    notch: clav && clamp(0.12 + 0.3 * R.clavicle * (0.5 + R.age), 0, 0.6) * R.detail >= 0.15,
  };
}

/** Vrai si le point `p` de la surface du cou porte une marque de relief (creux de SCM, corde, bande de platysma, clavicule, fosse). */
export function neckMark(spec: HeadTurnSpec, p: V3): boolean {
  const e = spec.engine;
  if (!e || !e.p.neck.visible) return false;
  const R = neckReliefOf(e);
  if (!(R.scm > 0.03 || R.platysma > 0.06 || R.clavicle > 0.05)) return false;
  let rows = ROWS.get(e); if (!rows) ROWS.set(e, (rows = new Map()));
  const yq = Math.round(p.y / Q);
  let r = rows.get(yq); if (!r) rows.set(yq, (r = rowAt(e, R, spec.neck, yq * Q)));
  const psi = Math.atan2(p.x / r.a, (p.z - r.zc) / r.b), ds = Math.hypot(r.a * Math.cos(psi), r.b * Math.sin(psi));
  for (const c of r.curves) if ((Math.abs(psi - c.psi) * ds) / Math.hypot(1, ds * c.slope) < c.w) return true;
  // Clavicules (deux arcs sous la peau de la base du cou, face antérieure) et fosse sus-sternale (ellipse au centre).
  if (p.z > r.zc && (Number.isFinite(r.claviY) || r.notch)) {
    // Base locale : la clavicule et la fosse sus-sternale suivent le plan de coupe (oblique pour une tête issue d'un visage : le devant, côté manubrium, est plus bas que y1).
    const n = spec.neck, xi = Math.abs(p.x) / r.base.a, yc = claviY(xi), yb = neckCutY(e, p.z, n.y1);
    if (Number.isFinite(r.claviY) && Number.isFinite(yc) && Math.abs(p.y - (yb - yc + 0.006)) < r.claviW) return true;
    if (r.notch && (p.x / (0.1 * r.base.a)) ** 2 + ((p.y - (yb - 0.026)) / 0.02) ** 2 <= 1) return true;
  }
  return false;
}

import type { Composition } from './compose';
import type { CompositionSpec } from './compose-plan';
import type { FamilySpec, FlowField, HairProfile, Range } from './grammar';
import type { View } from './head';
import type { LockSpec } from './lock';
import { paintLock } from './paint';
import { add, clamp, mul, norm, v3, type V2 } from './vec';

/**
 * INTENTION ARTISTIQUE — quatre axes continus qui traduisent un mot de direction artistique (aérien, lisse, volumineux, balayé, lourd)
 * en deux choses : des DELTAS de profil (champs de la grammaire) et une `CompositionSpec` (vide tant qu'aucun axe n'exige un réglage de composition ; le balayage passe par le cap des familles, sinon il sature). Chaque axe a sa MESURE
 * sur la coiffure produite (`measureIntent`) : l'intention n'est donc pas une étiquette, elle se vérifie (monotonie testée).
 *   volume  −1 plaquée … +1 gonflée      → largeur et décollement des mèches ; mesure : largeur du volume / largeur de tête
 *   sleek   0 ébouriffée … 1 lisse       → ondulation, retroussé, éventail, courbure ; mesure : virage cumulé par unité de longueur (↓)
 *   weight  −1 aérienne … +1 lourde      → nombre, largeur, longueur, gravité ; mesure : part de l'enveloppe couverte (↑)
 *   wind    0 … 1, vers `windDir` (rad)  → balayage du champ + lecture imposée ; mesure : projection du vecteur de lecture sur `windDir` (une coiffure qui retombe n'est pas balayée, même cohérente)
 */
export interface Intent { readonly volume?: number; readonly sleek?: number; readonly weight?: number; readonly wind?: number; readonly windDir?: number }
export const PRESETS = {
  airy: { weight: -0.8, volume: 0.2, sleek: 0.3 }, sleek: { sleek: 1, volume: -0.3 }, voluminous: { volume: 1, weight: 0.3 },
  windswept: { wind: 0.9, windDir: 0, sleek: 0.2 }, heavy: { weight: 0.9, volume: 0.4, sleek: 0.5 },
} as const satisfies Record<string, Intent>;
export type PresetName = keyof typeof PRESETS;

const sc = (r: Range, k: number): Range => ({ lo: r.lo * k, hi: r.hi * k });
const shift = (r: Range, d: number): Range => ({ lo: r.lo + d, hi: r.hi + d });
const asDir = (a: number): ReturnType<typeof v3> => v3(Math.cos(a), 0, 0.0);

export function applyIntent(P: HairProfile, I: Intent): { profile: HairProfile; composition: CompositionSpec } {
  const vol = clamp(I.volume ?? 0, -1, 1); const sl = clamp(I.sleek ?? 0, 0, 1); const wt = clamp(I.weight ?? 0, -1, 1); const wd = clamp(I.wind ?? 0, 0, 1);
  const families = P.families.map((F): FamilySpec => ({
    ...F, ...(F.aim ? { aim: norm(add(F.aim, mul(asDir(I.windDir ?? 0), 1.5 * wd))) } : {}), count: Math.max(1, Math.round(F.count * (1 + 0.5 * wt))), fan: F.fan * (1 - 0.7 * sl),
    length: sc(F.length, 1 + 0.15 * wt), width: sc(F.width, (1 + 0.45 * vol) * (1 + 0.3 * wt)),
    lift0: sc(F.lift0, 1 + 0.7 * vol), lift1: sc(F.lift1, 1 + 0.7 * vol), gravity: shift(F.gravity, 0.2 * wt),
    waveAmp: sc(F.waveAmp, 1 - 0.85 * sl), flickAmt: sc(F.flickAmt, 1 - 0.9 * sl), bend: sc(F.bend, 1 - 0.4 * sl),
  }));
  const dir = asDir(I.windDir ?? 0);
  const field: FlowField = wd > 0 ? { ...P.field, sweep: add(P.field.sweep, mul(dir, 0.6 * wd)), swirl: P.field.swirl * (1 - 0.8 * wd), radial: P.field.radial * (1 - 0.8 * wd) } : P.field;
  return { profile: { ...P, name: `${P.name}+intent`, field, families }, composition: {} };
}
export const presetIntent = (n: PresetName): Intent => PRESETS[n];

export interface IntentMeasure { readonly volume: number; readonly sleek: number; readonly weight: number; readonly wind: number }
/** Mesures des quatre axes sur une coiffure rendue (voir en-tête pour le sens de chacune). */
export function measureIntent(P: HairProfile, specs: readonly LockSpec[], view: View, comp: Composition, windDir = 0): IntentMeasure {
  const painted = specs.map((L) => paintLock(P.head, L, view)); let x0 = Infinity; let x1 = -Infinity;
  for (const p of painted) for (const q of [...p.blade.left, ...p.blade.right] as V2[]) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); }
  // Sinuosité : virage cumulé EN EXCÈS du virage net (la courbure d'ensemble n'est pas de la turbulence), par unité de longueur.
  let exc = 0; let len = 0;
  painted.forEach((p) => { const o: number[] = []; let l = 0; for (let i = 1; i < p.blade.spine.length; i++) { const a = p.blade.spine[i - 1] as V2; const b = p.blade.spine[i] as V2; o.push(Math.atan2(b.y - a.y, b.x - a.x)); l += Math.hypot(b.x - a.x, b.y - a.y); } let tv = 0; let net = 0; for (let i = 1; i < o.length; i++) { let d = (o[i] as number) - (o[i - 1] as number); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; tv += Math.abs(d); net += d; } exc += tv - Math.abs(net); len += l; });
  const env = comp.negative.envelope; const open = comp.negative.ratio;
  return { volume: (x1 - x0) / (2 * P.head.rx * view.s), sleek: 1 - clamp((exc / Math.max(1e-9, len)) * 25, 0, 1), weight: env > 0 ? 1 - open : 0, wind: Math.max(0, comp.reading.coherence * Math.cos(comp.reading.angle - windDir)) };
}

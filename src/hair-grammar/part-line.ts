import { bladeOutline } from './blade';
import { domePredicate } from './dome';
import { project, type HeadSpec, type View } from './head';
import type { PaintedLock } from './paint';
import { clamp, norm, rad, sub, v3, type V2, type V3 } from './vec';
import { GROOVE_MAX_H } from './observe-part';

/**
 * LA RAIE DEMANDÉE, LUE SUR LA LIGNE — `observe-part.ts` cherche un sillon quand on ne sait pas où il est (une référence). Quand la position est DEMANDÉE, la question est plus précise et plus exacte :
 * le long de la ligne de crâne `x = xp` (projetée dans l'image, de l'élévation 30° au sommet), (1) aucune lame ne la recouvre — le COULOIR, ± `PART_HALF` ; (2) les deux rideaux de mèches se rejoignent
 * près d'elle : l'ouverture (distance entre la lame la plus proche à gauche et à droite) reste un sillon (≤ `GROOVE_MAX_H`), pas une fenêtre chauve.
 * La lecture suit la ligne projetée, donc elle vaut à tous les lacets (une mesure par colonne ne vaut que de face). Elle se fait par INTERVALLES de balayage sur les contours des lames : exacte,
 * sans raster, et ≈ 0,3 ms pour une coiffure complète. Seules les mèches qui ne sont pas `back` comptent (la tête les cache derrière le crâne).
 * Les échantillons jugés sont ceux de la calotte (`dome.ts`), la même région que le contrôle `anat.dome`.
 */
/** Demi-largeur du couloir protégé de la raie (unités H) : une ligne de crâne à découvert, pas une fenêtre. */
export const PART_HALF = 0.035;
/** Netteté minimale exigée par la vérification (`compose-verify.ts`) ; la génération vise `PART_TARGET` (0,8, `part-shape.ts`) pour garder de la marge. */
export const PART_FLOOR = 0.6;
/** Sévérité d'une mèche qui recouvre le couloir : même valeur dans la vérification (`style.part`) et dans le coût local du solveur, pour qu'ils se mettent d'accord. */
export const PART_SEVERITY = 1;
/** Nombre minimal d'échantillons pour juger le SILLON : en dessous (ligne à peine dans la calotte de la vue, lacet ≳ 45° côté détourné), la netteté n'est pas lisible et vaut 1 (sans objet). Le couloir, lui, se juge dès 1 échantillon. */
export const MIN_JUDGED = 4;
/** Sillon jugé sur ces élévations de racine (degrés) : du front au sommet du crâne. */
const EL_FROM = 30; const EL_TO = 89; const EL_STEP = 3;
/** L'OUVERTURE ne se juge qu'à partir de cette élévation : plus bas, c'est le front, où la chevelure (frange) naît plus haut — mesurer là de la peau de front n'est pas mesurer un sillon. Le couloir, lui, reste libre de 30° à 89°. */
const OPEN_FROM_EL = 45;
/** Plafond (unités H) de l'ouverture dans la moyenne : un rideau absent ne pèse pas plus que cette valeur. */
const OPEN_CAP = 0.5;
/** CIBLE de la génération : l'excès se compte au-dessus de 0,85 × `GROOVE_MAX_H`, pas du plafond lui-même — viser le plafond laissait des ouvertures de 0,1400–0,1416 H (juste au-dessus) dont le gain d'excès, trop petit, n'arrêtait plus la recherche. */
const AIM_OPEN = 0.85 * GROOVE_MAX_H;

/** Point de la ligne de raie projeté dans l'image, avec son élévation de crâne (degrés). */
export type PartPoint = V2 & { readonly el: number };

/** Point 3D (repère de tête) de la ligne de crâne `x = xp` à l'élévation `el` (degrés). */
export function partPoint3(h: HeadSpec, xp: number, el: number): V3 {
  const c = Math.cos(rad(el)); const az = Math.asin(clamp(xp / (h.rx * c), -1, 1));
  return v3(h.rx * c * Math.sin(az), -h.ry * Math.sin(rad(el)), h.cz + h.rz * c * Math.cos(az));
}

/** Direction (repère de tête, unitaire) de la ligne de raie à l'élévation `el`, vers le front : le cap naturel d'un rideau qui la longe. */
export function partTangent(h: HeadSpec, xp: number, el: number): V3 { return norm(sub(partPoint3(h, xp, Math.max(EL_FROM - 3, el - 3)), partPoint3(h, xp, el))); }

/** Ligne de crâne `x = xp` (repère de tête, unités H) projetée dans l'image. */
export function partLinePoints(h: HeadSpec, view: View, xp: number): PartPoint[] {
  const pts: PartPoint[] = [];
  for (let el = EL_FROM; el <= EL_TO; el += EL_STEP) { const q = project(view, partPoint3(h, xp, el)); pts.push({ x: q.x, y: q.y, el }); }
  return pts;
}

type Iv = readonly [number, number];
/** Intervalles de x couverts par un contour à l'ordonnée y (règle pair-impair, comme `fillPoly`). */
function intervalsAt(poly: readonly V2[], y: number): Iv[] {
  const xs: number[] = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i] as V2; const b = poly[j] as V2; if (a.y > y !== b.y > y) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x)); }
  xs.sort((p, q) => p - q); const out: Iv[] = []; for (let k = 0; k + 1 < xs.length; k += 2) out.push([xs[k] as number, xs[k + 1] as number]);
  return out;
}

export interface PartLine {
  /** Part des échantillons (30°–89°, dans la calotte) dont le couloir est libre (0–1). */
  readonly bare: number;
  /** Part des échantillons jugés dont le couloir est libre ET dont l'ouverture est un sillon (0–1) : la netteté de la raie. */
  readonly clarity: number;
  /** Ouverture médiane (unités H) des échantillons dont le couloir est libre ; `Infinity` si un rideau manque. */
  readonly width: number;
  /** Ouverture MOYENNE (unités H ; chaque côté plafonné à `OPEN_CAP` / 2), échantillons recouverts comptés pour 0 : décroît à chaque rideau ajouté, même quand le second manque encore. */
  readonly meanOpen: number;
  /** Excès moyen (unités H) de l'ouverture au-dessus du plafond de sillon, par côté plafonné comme `meanOpen` : 0 = tous les échantillons jugés sont des sillons. C'est ce que la génération minimise (la netteté, quantifiée, ne guide pas). */
  readonly excess: number;
  /** Échantillons dont l'OUVERTURE est jugée (élévation ≥ 45°, dans la calotte). */
  readonly judged: number;
  /** Mèches qui recouvrent le couloir, par nombre d'échantillons recouverts décroissant. */
  readonly covering: readonly { readonly id: string; readonly n: number }[];
}

/** Échantillon de la ligne : position image, lame la plus proche à gauche / à droite (hors couloir), couloir recouvert ou non. */
interface Sample { readonly x: number; readonly y: number; readonly el: number; left: number; right: number; crossed: boolean }
/**
 * Lecture INCRÉMENTALE : les intervalles de chaque échantillon sont calculés une fois pour la coiffure, puis `withLock` n'ajoute que ceux d'une mèche candidate (≈ 0,2 ms contre ≈ 1,5 ms pour tout
 * relire) — la génération des rideaux (`part-shape.ts`) évalue ainsi des centaines de candidats sur la mesure exacte, pas sur un indicateur de surface.
 */
export interface PartSamples { readonly s: number; readonly samples: readonly Sample[]; readonly hits: ReadonlyMap<string, number> }

function absorb(sa: Sample, o: readonly V2[], w: number): boolean {
  let touched = false;
  for (const [a, b] of intervalsAt(o, sa.y)) {
    if (b >= sa.x - w && a <= sa.x + w) { touched = true; sa.crossed = true; }
    else if (b < sa.x - w) sa.left = Math.max(sa.left, b); else sa.right = Math.min(sa.right, a);
  }
  return touched;
}

/** Échantillons de la raie `xp` (unités H, repère de tête) sur des mèches peintes ; seules les mèches qui ne sont pas `back` comptent. */
export function partSamples(h: HeadSpec, view: View, painted: readonly PaintedLock[], xp: number): PartSamples {
  const inDome = domePredicate(h, view); const w = PART_HALF * view.s;
  const samples: Sample[] = partLinePoints(h, view, xp).filter((q) => inDome(q.x, q.y)).map((q) => ({ x: q.x, y: q.y, el: q.el, left: -Infinity, right: Infinity, crossed: false }));
  const hits = new Map<string, number>();
  for (const p of painted) { if (p.layer === 'back') continue; const o = bladeOutline(p.blade); let n = 0; for (const sa of samples) if (absorb(sa, o, w)) n++; if (n) hits.set(p.spec.id, n); }
  return { s: view.s, samples, hits };
}

/** Les mêmes échantillons avec UNE mèche de plus (la mèche d'origine n'est pas modifiée). */
export function withLock(S: PartSamples, p: PaintedLock): PartSamples {
  if (p.layer === 'back') return S;
  const w = PART_HALF * S.s; const o = bladeOutline(p.blade); const hits = new Map(S.hits); let n = 0;
  const samples = S.samples.map((sa) => { const c = { ...sa }; if (absorb(c, o, w)) n++; return c; });
  if (n) hits.set(p.spec.id, (hits.get(p.spec.id) ?? 0) + n);
  return { s: S.s, samples, hits };
}

/** Résumé (netteté, ouverture) de la lecture. Moins de `MIN_JUDGED` échantillons (vue de dos, ligne à peine visible) : la netteté est sans objet et vaut 1. */
export function summarize(S: PartSamples): PartLine {
  const n = S.samples.length; if (!n) return { bare: 1, clarity: 1, width: 0, meanOpen: 0, excess: 0, judged: 0, covering: [] };
  // Zone jugée : élévation ≥ OPEN_FROM_EL ; mais une raie décentrée de face (± 0,4 rx) n'a que quelques échantillons dans la calotte (le crâne s'abaisse sur les côtés) et tous sous 45° : on juge alors
  // les MIN_JUDGED plus hauts, sinon une fenêtre chauve large serait déclarée « non lisible » (netteté 1) alors que la vue est de face. Moins de MIN_JUDGED échantillons au total : réellement non lisible.
  const elMin = n >= MIN_JUDGED ? Math.min(OPEN_FROM_EL, S.samples.map((q) => q.el).sort((a, b) => b - a)[MIN_JUDGED - 1] as number) : OPEN_FROM_EL;
  const maxOpen = GROOVE_MAX_H * S.s; let bare = 0; let ok = 0; let sum = 0; let exc = 0; let judged = 0; const widths: number[] = [];
  for (const sa of S.samples) {
    if (!sa.crossed) bare++;
    if (sa.el < elMin) continue; judged++;
    if (sa.crossed) continue;
    const open = sa.right - sa.left; widths.push(open); if (open <= maxOpen) ok++;
    // Progrès par côté (distance à la ligne, plafonnée à la moitié du plafond) : un premier rideau compte déjà quand le second manque encore.
    const o2 = Math.min(OPEN_CAP / 2, (sa.x - sa.left) / S.s) + Math.min(OPEN_CAP / 2, (sa.right - sa.x) / S.s); sum += o2; exc += Math.max(0, o2 - AIM_OPEN);
  }
  widths.sort((a, b) => a - b);
  return { bare: bare / n, clarity: judged < MIN_JUDGED ? 1 : ok / judged, width: widths.length ? (widths[Math.floor(widths.length / 2)] as number) / S.s : 0, meanOpen: judged ? sum / judged : 0, excess: judged ? exc / judged : 0, judged, covering: [...S.hits.entries()].map(([id, c]) => ({ id, n: c })).sort((a, b) => b.n - a.n) };
}

/** Lecture de la raie `xp` sur des mèches peintes. */
export const partOpenness = (h: HeadSpec, view: View, painted: readonly PaintedLock[], xp: number): PartLine => summarize(partSamples(h, view, painted, xp));

/** Nombre d'échantillons de la ligne qu'UNE mèche recouvre (0 = elle laisse le couloir libre) : critère local du solveur et de la génération. */
export function crossesPart(h: HeadSpec, view: View, p: PaintedLock, xp: number): number {
  const inDome = domePredicate(h, view); const w = PART_HALF * view.s; const o = bladeOutline(p.blade); let n = 0;
  for (const q of partLinePoints(h, view, xp)) { if (!inDome(q.x, q.y)) continue; if (intervalsAt(o, q.y).some(([a, b]) => b >= q.x - w && a <= q.x + w)) n++; }
  return n;
}

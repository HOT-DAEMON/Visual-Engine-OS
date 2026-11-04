import { centroids, silhouetteProfile } from './silhouette';
import { buildParts } from './parts';
import { check, layerOf, type Check, type LayerReport } from './verify-types';
import type { HeadTurnSpec, TurnRender } from './types';

/** Extrait typé de `references/face/rotation_head.measures.json` (produit par scripts/head-turntable/measure-rotation.py). */
export interface RotationMeasures {
  readonly views: Readonly<Record<string, {
    readonly silhouette: readonly { t: number; left: number | null; right: number | null }[];
    readonly irises: readonly { x: number; t: number; w: number }[]; readonly mouth: readonly { x: number; t: number }[];
  }>>;
}
export type RenderAt = (yaw: number) => TurnRender;

/** Vues dont les silhouettes ont servi à bâtir la table de sections (face et profil) ; les autres sont de la validation HORS ÉCHANTILLON. */
export const FIT_YAWS = [0, 90, 180] as const;
export const HOLDOUT_YAWS = [20, 45, 70, 110, 135, 160] as const;
const isIris = (r: TurnRender) => (i: number): boolean => { const R = r.rgba[i]!, B = r.rgba[i + 2]!; return B - R > 30 && B > 90; };
const isMouthIn = (r: TurnRender) => (i: number): boolean => Math.abs(r.rgba[i]! - 189) < 30 && Math.abs(r.rgba[i + 1]! - 108) < 30 && Math.abs(r.rgba[i + 2]! - 110) < 30;

/** Erreur moyenne (U) entre la silhouette rendue et la silhouette MESURÉE de la planche, aux mêmes hauteurs et depuis les mêmes origines. */
export function silhouetteError(m: RotationMeasures, yaw: number, r: TurnRender): number {
  const ms = m.views[String(yaw)]!.silhouette, pr = silhouetteProfile(r, ms.map((p) => p.t));
  let e = 0, n = 0;
  for (const p of pr) { const q = ms.find((x) => Math.abs(x.t - p.t) < 1e-6); if (!q || q.left === null || q.right === null) continue; e += Math.abs(p.left - q.left) + Math.abs(p.right - q.right); n += 2; }
  return n ? e / n : Infinity;
}

/** Recouvrement (IoU) entre deux masques de couverture de même taille ; `flip` retourne le second horizontalement autour du pivot. */
export function maskIoU(a: TurnRender, b: TurnRender, flip: boolean): number {
  let inter = 0, uni = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const xb = flip ? Math.round(2 * a.originX - 1 - x) : x, A = a.ids[y * a.w + x]! > 0, B = xb >= 0 && xb < b.w && b.ids[y * b.w + xb]! > 0;
    if (A || B) uni++; if (A && B) inter++;
  }
  return uni ? inter / uni : 1;
}

/** COUCHE GÉOMÉTRIQUE : fidélité aux silhouettes mesurées (calage + hors échantillon), symétrie, périodicité, visibilité des yeux, positions des repères, avancée du nez. */
export function verifyGeometry(m: RotationMeasures, at: RenderAt, spec?: HeadTurnSpec): LayerReport {
  const c: Check[] = [];
  if (spec) {
    let bad = 0;
    for (const mesh of buildParts(spec)) { for (const p of mesh.P) if (![p.x, p.y, p.z].every(Number.isFinite)) bad++; for (const n of mesh.N) if (![n.x, n.y, n.z].every(Number.isFinite)) bad++; }
    c.push(check('geometry', 'mesh.finite', 'Maillages : sommets ou normales non finis (NaN / Infinity)', bad, 0, 0));
  }
  for (const yaw of FIT_YAWS) c.push(check('geometry', `sil.fit.${yaw}`, `Silhouette à ${yaw}° (vue de calage) : erreur moyenne vs mesure, en U`, silhouetteError(m, yaw, at(yaw)), 0, 0.03));
  for (const yaw of HOLDOUT_YAWS) c.push(check('geometry', `sil.holdout.${yaw}`, `Silhouette à ${yaw}° (HORS échantillon) : erreur moyenne vs mesure, en U`, silhouetteError(m, yaw, at(yaw)), 0, 0.035));
  c.push(check('geometry', 'mirror.45', 'Symétrie : rendu à +45° = miroir du rendu à −45° (IoU)', maskIoU(at(45), at(-45), true), 0.985, 1));
  c.push(check('geometry', 'period.315', 'Périodicité : rendu à 315° = rendu à −45° (IoU)', maskIoU(at(315), at(-45), false), 0.999, 1));
  const nIris = (yaw: number): number => centroids(at(yaw), isIris(at(yaw)), 6).length;
  c.push(check('geometry', 'eyes.0', 'Yeux visibles à 0° (attendu 2)', nIris(0), 2, 2));
  c.push(check('geometry', 'eyes.90', 'Yeux visibles à 90° (attendu 1)', nIris(90), 1, 1));
  c.push(check('geometry', 'eyes.180', 'Yeux visibles à 180° (attendu 0)', nIris(180), 0, 0));
  for (const yaw of [0, 20, 45, 70, 90, 110]) {
    const r = at(yaw), meas = m.views[String(yaw)]!.irises, got = centroids(r, isIris(r), 6);
    if (!got.length || !meas.length) continue;
    const near = (l: readonly { x: number; t: number; w: number }[]) => [...l].sort((a, b) => b.w - a.w)[0]!, g = near(got), q = near(meas);
    c.push(check('geometry', `iris.${yaw}`, `Iris proche à ${yaw}° : écart de position vs mesure, en U`, Math.hypot(g.x - q.x, g.t - q.t), 0, 0.05));
  }
  for (const yaw of [0, 20, 45, 70]) {
    const r = at(yaw), q = m.views[String(yaw)]!.mouth[0], g = [...centroids(r, isMouthIn(r), 6)].sort((a, b) => b.area - a.area)[0];   // îlot le plus grand : l'intérieur de la bouche
    if (q && g) c.push(check('geometry', `mouth.${yaw}`, `Bouche à ${yaw}° : écart de position vs mesure, en U`, Math.hypot(g.x - q.x, g.t - q.t), 0, 0.08, 'hard', 'seuil 0,08 : la planche mesure la cavité de la bouche ouverte (≈ 0,076 U en retrait des lèvres) ; le moteur peint l\'intérieur sur la surface des lèvres (cavité non modélisée : voir docs)'));
  }
  const p90 = silhouetteProfile(at(90), Array.from({ length: 41 }, (_, i) => i / 40)), minL = (a: number, b: number): number => Math.min(...p90.filter((p) => p.t >= a && p.t <= b).map((p) => p.left));
  c.push(check('geometry', 'nose.protrusion', 'Profil 90° : le nez dépasse le front de (U) — la planche : 0,04', minL(0.3, 0.45) - minL(0.55, 0.8), 0.02, 0.1));
  return layerOf('geometry', c);
}

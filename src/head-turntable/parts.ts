import { bumpMesh, ellipsoid, headMesh, neckMeshes, PART, type Mesh } from './mesh';
import { rad, v3 } from './math';
import { sectionAt, surfaceZ } from './sections';
import { ALA_CONTOUR_YAW, ALA_PULL_MAX, alaOverflow, type AlaEllipsoid } from './nose-contour';
import type { BumpKnots, HeadTurnSpec } from './types';
import { earMesh, earRig } from './engines/ear3d';
import { engineHead } from './engines/face-model';
import { noseLandmarks } from './engines/nose-mouth';
import { hairShellMesh } from './hair-shell';
import { hairPartMeshes } from './hair-parts';

/** Largeur d'ailes (U) et décalage hauteur ↔ base du nez de la planche : les ailes des autres têtes sont posées et dimensionnées par rapport à ces valeurs. */
const REF_ALA = ((): number => noseLandmarks(engineHead()).crestX)();
const ALA_ABOVE_BASE = 0.0147;   // les ailes sont centrées 0,0147 U au-dessus de la base du nez (planche : base 0,7897 → y = 0,775, comme avant)

/** Interpolation linéaire d'une colonne (1 = z, 2 = demi-largeur) des nœuds d'une bosse à la hauteur y. */
function knotAt(k: BumpKnots, y: number, col: 1 | 2): number {
  if (y <= k[0]![0]) return k[0]![col];
  for (let i = 0; i + 1 < k.length; i++) { const a = k[i]!, b = k[i + 1]!; if (y <= b[0]) return a[col] + (b[col] - a[col]) * ((y - a[0]) / (b[0] - a[0] || 1)); }
  return k[k.length - 1]![col];
}

/** Bosse construite sur un profil de face : hauteur = z du profil − face avant de la table de sections (jamais négative). */
function bumpOf(spec: HeadTurnSpec, k: BumpKnots): Mesh {
  const y0 = k[0]![0], y1 = k[k.length - 1]![0];
  return bumpMesh(spec, y0, y1, (y) => knotAt(k, y, 1) - sectionAt(spec, y).zf, (y) => knotAt(k, y, 2));
}

/** Aile posée sur la joue, centre décalé de `pull` (U) vers l'axe : centre, demi-axes. z = surface de la joue À L'ABSCISSE de l'aile (comme la bosse centrale, `bumpMesh`), pas l'avant de l'axe `zf` : la joue recule vers les côtés, une aile large posée sur `zf` flottait devant elle. */
export function alaSeated(spec: HeadTurnSpec, sg: 1 | -1, pull: number): AlaEllipsoid {
  const ys = spec.nose.baseY - ALA_ABOVE_BASE, sa = sectionAt(spec, ys), ka = spec.engine ? spec.nose.alaX / REF_ALA : 1, x = sg * (spec.nose.alaX - pull);
  return { c: v3(x, ys, surfaceZ(sa, x, true) + 0.022 * ka), ex: 0.026 * ka, ey: 0.024 * ka, ez: 0.026 * ka };
}

/**
 * Contrainte « l'aile reste dans le contour de la joue à 30° » (`nose-contour.ts`, docs/NOSE-ALAR-SEAT.md), à la manière de `face/nose/constraints.ts` : valeur ramenée à la plus proche admissible, jamais de réglage global.
 * Retourne le décalage vers l'axe (U) : 0 pour tout nez qui ne déborde pas (nez de la planche et nez libres : inchangés), saturé à (1 − `ALA_PULL_MAX`) × alaX.
 * Point fixe en 4 itérations : rapprocher l'aile de l'axe relève la surface de la joue sous elle, donc le recalcul.
 */
export function alaPull(spec: HeadTurnSpec): number {
  const max = (1 - ALA_PULL_MAX) * spec.nose.alaX, cs = Math.cos(rad(ALA_CONTOUR_YAW));
  let pull = 0;
  for (let it = 0; it < 4; it++) {
    const ov = alaOverflow(spec, alaSeated(spec, -1, pull), ALA_CONTOUR_YAW);
    if (ov <= 1e-5) break;
    pull = Math.min(max, pull + ov / cs + 1e-4);
  }
  return pull;
}

/** Aile du nez (ellipsoïde posé sur la face, côté `sg`) : centre et demi-axes. Source UNIQUE : le maillage (`buildParts`) et l'adoucissement des normales à l'éclairage (`nose-light.ts`) la lisent. */
export function alaOf(spec: HeadTurnSpec, sg: 1 | -1): AlaEllipsoid { return alaSeated(spec, sg, alaPull(spec)); }

/** Toutes les pièces du modèle, dans le repère de la tête. Les oreilles viennent du moteur d'oreille (`src/face/ear`) : modèle, relief, placement. */
export function buildParts(spec: HeadTurnSpec): Mesh[] {
  const meshes: Mesh[] = [headMesh(spec), ...neckMeshes(spec), bumpOf(spec, spec.nose.knots), bumpOf(spec, spec.mouth.knots)];
  const ax = v3(1, 0, 0), ay = v3(0, 1, 0), az = v3(0, 0, 1);
  for (const sg of [1, -1] as const) {
    const a = alaOf(spec, sg);
    meshes.push(ellipsoid(PART.bump, a.c, ax, ay, az, a.ex, a.ey, a.ez, 10, 16));
    meshes.push(...earMesh(earRig(spec, sg)));
  }
  if (spec.hairVolume) meshes.push(hairShellMesh(spec, spec.hairVolume), ...hairPartMeshes(spec, spec.hairVolume));
  return meshes;
}

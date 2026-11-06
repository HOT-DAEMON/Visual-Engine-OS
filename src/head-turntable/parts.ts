import { bumpMesh, ellipsoid, headMesh, neckMeshes, PART, type Mesh } from './mesh';
import { v3 } from './math';
import { sectionAt } from './sections';
import type { BumpKnots, HeadTurnSpec } from './types';
import { earMesh, earRig } from './engines/ear3d';

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

/** Toutes les pièces du modèle, dans le repère de la tête. Les oreilles viennent du moteur d'oreille (`src/face/ear`) : modèle, relief, placement. */
export function buildParts(spec: HeadTurnSpec): Mesh[] {
  const meshes: Mesh[] = [headMesh(spec), ...neckMeshes(spec), bumpOf(spec, spec.nose.knots), bumpOf(spec, spec.mouth.knots)];
  const ys = 0.775, sa = sectionAt(spec, ys), ax = v3(1, 0, 0), ay = v3(0, 1, 0), az = v3(0, 0, 1);
  for (const sg of [1, -1] as const) {
    meshes.push(ellipsoid(PART.bump, v3(sg * spec.nose.alaX, ys, sa.zf + 0.022), ax, ay, az, 0.026, 0.024, 0.026, 10, 16));
    meshes.push(...earMesh(earRig(spec, sg)));
  }
  return meshes;
}

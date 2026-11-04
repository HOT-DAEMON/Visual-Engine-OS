import { bumpMesh, ellipsoid, headMesh, neckMeshes, PART, type Mesh } from './mesh';
import { cross, norm, rad, v3 } from './math';
import { sectionAt } from './sections';
import type { BumpKnots, HeadTurnSpec, V3 } from './types';

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

/** Oreille d'un côté (sg = +1 : côté +x) : ellipsoïde aplati dont le bord antérieur touche le crâne, le bord postérieur s'écarte de `openDeg`. */
export function earFrame(spec: HeadTurnSpec, sg: 1 | -1): { c: V3; d: V3; h: V3; n: V3; rd: number; rh: number; rt: number } {
  const e = spec.ear, yc = (e.y0 + e.y1) / 2, s = sectionAt(spec, yc), al = rad(e.openDeg);
  const rd = e.depth / 2, rh = (e.y1 - e.y0) / 2, rt = e.thick / 2;
  const n = v3(sg * Math.cos(al), 0, Math.sin(al));                // normale de la plaque : vers l'extérieur et un peu vers l'avant
  const d = v3(sg * Math.sin(al), 0, -Math.cos(al));               // sens avant → arrière de la plaque
  const t = rad(e.tiltDeg), h0 = v3(0, Math.cos(t), -Math.sin(t) * 0.5);
  const h = norm(cross(n, cross(h0, n)));                          // hauteur de la plaque : verticale rendue orthogonale à n
  const front = v3(sg * s.a * 0.92, yc, s.zc + e.z + 0.05);       // attache : bord antérieur sur le crâne
  const c = v3(front.x + d.x * rd, yc, front.z + d.z * rd);
  return { c, d, h, n, rd, rh, rt };
}

/** Toutes les pièces du modèle, dans le repère de la tête. */
export function buildParts(spec: HeadTurnSpec): Mesh[] {
  const meshes: Mesh[] = [headMesh(spec), ...neckMeshes(spec), bumpOf(spec, spec.nose.knots), bumpOf(spec, spec.mouth.knots)];
  const ys = 0.775, sa = sectionAt(spec, ys), ax = v3(1, 0, 0), ay = v3(0, 1, 0), az = v3(0, 0, 1);
  for (const sg of [1, -1] as const) {
    meshes.push(ellipsoid(PART.bump, v3(sg * spec.nose.alaX, ys, sa.zf + 0.022), ax, ay, az, 0.026, 0.024, 0.026, 10, 16));
    const f = earFrame(spec, sg);
    meshes.push(ellipsoid(PART.ear, f.c, f.d, f.h, f.n, f.rd, f.rh, f.rt, 16, 24));
  }
  return meshes;
}

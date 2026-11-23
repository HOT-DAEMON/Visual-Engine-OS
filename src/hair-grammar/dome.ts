import type { Grid } from './compose-grid';
import { landmarks, project, type HeadSpec, type View } from './head';
import { v3 } from './vec';

/**
 * CALOTTE — la région de l'image que le contrôle anatomique `anat.dome` exige couverte : l'intérieur de l'ellipse du crâne (0,8 du rayon, au carré) qui reste
 * au-dessus de la ligne des yeux moins 0,12 H. Extraite de `compose-verify.ts` pour être PARTAGÉE avec le remplissage de calotte (`repair-dome.ts`) : la
 * vérification et la réparation jugent exactement les mêmes cellules. `domePredicate` donne la même région en coordonnées image continues (lecture de la raie, `part-line.ts`).
 */
export function domePredicate(h: HeadSpec, view: View): (px: number, py: number) => boolean {
  const c0 = project(view, v3(0, 0, h.cz)); const rx = h.rx * view.s; const ry = h.ry * view.s; const eyeY = project(view, landmarks(h).eyeR).y;
  return (px, py) => py <= eyeY - 0.12 * view.s && ((px - c0.x) / rx) ** 2 + ((py - c0.y) / ry) ** 2 <= 0.8;
}

export function domeMask(h: HeadSpec, view: View, g: Grid): Uint8Array {
  const inside = domePredicate(h, view); const m = new Uint8Array(g.nx * g.ny);
  for (let y = 0; y < g.ny; y++) for (let x = 0; x < g.nx; x++) if (inside((x + 0.5) * g.cell, (y + 0.5) * g.cell)) m[y * g.nx + x] = 1;
  return m;
}

/** Part de la calotte couverte par les lames rasterisées dans `g` (1 si la calotte est vide de cellules). */
export function domeRatio(mask: Uint8Array, g: Grid): number {
  let n = 0; let c = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) { n++; if (g.data[i]) c++; }
  return n ? c / n : 1;
}

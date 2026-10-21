import { el } from '../../../core/svg';
import { outlinePath, type FaceLandmarks, type NoseGeometry } from '../../../face';
import type { MouthGeo } from '../../../face/mouth';
import type { StructureGeometry } from '../../../face/structure';
import { lineD } from '../soft';
import type { StructureCtx } from './kit';

/**
 * CONTOURS DESSINÉS (intensité = `stylization.outline`, plancher 0,5 en rendu `ink`). Les traits sont tracés sur la MÊME géométrie que le rendu (contour du visage, arêtes du nez,
 * ailes, narines, lèvres, ligne de fermeture, bord inférieur de la mandibule) : changer de mode de rendu ne reconstruit pas l'anatomie, il change seulement l'encre.
 * Épaisseurs : tête 1, mâchoire 0,8, nez et bouche 0,6, détails (narines, dômes) 0,4 — un trait épais pour la silhouette, fin pour l'intérieur.
 */
export function inkStrength(c: StructureCtx): number {
  return c.p.renderMode === 'ink' ? Math.max(0.5, c.p.stylization.outline) : c.p.stylization.outline;
}

export function renderInk(c: StructureCtx, lm: FaceLandmarks, nose: NoseGeometry, g: StructureGeometry, m: MouthGeo): string[] {
  const s = inkStrength(c);
  if (s <= 0.01) return [];
  const ink = '#15101a';
  const w = (k: number): number => (0.5 + 2.6 * s) * k * c.u;
  const stroke = (d: string, k: number): string => el('path', { d, fill: 'none', stroke: ink, 'stroke-width': w(k), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-opacity': 0.92 });
  const out: string[] = [stroke(outlinePath(lm.outline), 1)];
  // Mâchoire : bord inférieur complet.
  out.push(stroke(lineD(g.mandible.lowerBorder), 0.8));
  // Nez : arêtes de l'arête nasale (deux bords de l'arête), contour des ailes, nez-narines, silhouette de la pointe.
  const { axis, half } = nose.dorsum;
  for (const sd of [-1, 1]) out.push(stroke(lineD(axis.slice(2, -2).map((q, i) => ({ x: q.x + sd * (half[i + 2] as number), y: q.y }))), 0.5));
  for (const a of [nose.alae.left, nose.alae.right]) out.push(stroke(lineD(a.outerEdge), 0.6));
  for (const n of [nose.regions.nostrils.left, nose.regions.nostrils.right]) out.push(stroke(`M${n.aperture.map((q) => `${q.x} ${q.y}`).join('L')}Z`, 0.4));
  out.push(stroke(`M${nose.tip.poly.map((q) => `${q.x} ${q.y}`).join('L')}Z`, 0.4));
  // Bouche : ligne de fermeture, contours des deux lèvres, cavité.
  out.push(stroke(lineD(m.closure), 0.6));
  out.push(stroke(`M${m.upperLip.map((q) => `${q.x} ${q.y}`).join('L')}Z`, 0.5));
  out.push(stroke(`M${m.lowerLip.map((q) => `${q.x} ${q.y}`).join('L')}Z`, 0.5));
  return out;
}

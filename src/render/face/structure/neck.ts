import type { FaceLandmarks } from '../../../face';
import { lineD } from '../soft';
import type { StructureGeometry } from '../../../face/structure';
import { blobEl, type StructureCtx } from './kit';

/**
 * Cou (T9), calque de structure : ombre portée du menton sous la mandibule (profondeur = angle cervico-mentonnier effectif), bande de tissu sous-mandibulaire,
 * sterno-cléido-mastoïdiens (relief `muscles`), tension du platysma (bouche ouverte, tête inclinée). Dessiné juste après le cou, derrière la tête.
 */
export function renderNeckStructure(c: StructureCtx, lm: FaceLandmarks, g: StructureGeometry): string[] {
  const { p, ra, I, u, detail } = c;
  const nk = g.neck;
  const out: string[] = [];
  // Ombre portée du menton : dégradé large et doux, collé sous la mandibule (centre à 15 % de sa portée au-dessus de la bande), jamais un disque à bord net. Opacité plafonnée à 0,3 ;
  // la portée (angle cervico-mentonnier, sous-menton) règle la HAUTEUR de l'ombre, l'épaisseur du tissu son intensité. Flou ≥ 40 % de la hauteur : pas de bord visible.
  const ry = Math.max(0.006 * lm.H, 0.9 * nk.shadowReachPx);
  out.push(blobEl(c, { c: { x: 0, y: nk.submentalBand.c.y - 0.15 * nk.shadowReachPx }, rx: nk.submentalBand.rx * 0.95, ry, rotDeg: 0 }, ra.shadow, 0.14 + 0.16 * p.neck.thickness, Math.max(7 * u, 0.4 * ry)));
  // Sterno-cléido-mastoïdiens : ombre le long du bord interne, reflet du côté lumière ; relief = `muscles` × détail.
  for (const [s, line] of [[-1, nk.scm.left], [1, nk.scm.right]] as const) {
    const lit = s * c.dir.x >= 0;
    out.push(c.kit.stroke(lineD(line), ra.shadow, (2 + 3 * p.neck.muscles) * u, (0.06 + 0.24 * p.neck.muscles) * detail, 2.2 * u * c.soft));
    if (lit) out.push(c.kit.stroke(lineD(line.map((q) => ({ x: q.x + s * 3 * u, y: q.y }))), ra.light, 1.6 * u, 0.12 * I * p.neck.muscles * detail, 1.6 * u * c.soft));
  }
  // Platysma : deux bandes verticales fines sous le menton, visibles seulement sous tension (ouverture, inclinaison).
  if (nk.platysmaTension > 0.05) {
    for (const s of [-1, 1]) out.push(c.kit.stroke(lineD([{ x: s * 0.28 * nk.halfWidthPx, y: g.neck.submentalBand.c.y }, { x: s * 0.2 * nk.halfWidthPx, y: g.neck.submentalBand.c.y + 0.8 * nk.shadowReachPx + 12 * u }]), ra.shadow, 1.6 * u, 0.3 * nk.platysmaTension * detail, 1.4 * u * c.soft));
  }
  return out.filter((s) => s !== '');
}

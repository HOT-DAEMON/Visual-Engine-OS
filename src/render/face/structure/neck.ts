import type { FaceLandmarks } from '../../../face';
import type { StructureGeometry } from '../../../face/structure';
import { blobEl, type StructureCtx } from './kit';

/**
 * Cou (T9), calque de structure : SEULE l'ombre portée du menton sous la mandibule (profondeur = angle cervico-mentonnier effectif) et la bande de tissu
 * sous-mandibulaire, qui appartiennent à la tête. Muscles, platysma et reliefs : moteur de cou (`render/neck`). Dessiné juste après le cou, derrière la tête.
 */
export function renderNeckStructure(c: StructureCtx, lm: FaceLandmarks, g: StructureGeometry): string[] {
  const { p, ra, u } = c;
  const nk = g.neck;
  const out: string[] = [];
  // Ombre portée du menton : dégradé large et doux, collé sous la mandibule (centre à 15 % de sa portée au-dessus de la bande), jamais un disque à bord net. Opacité plafonnée à 0,3 ;
  // la portée (angle cervico-mentonnier, sous-menton) règle la HAUTEUR de l'ombre, l'épaisseur du tissu son intensité. Flou ≥ 40 % de la hauteur : pas de bord visible.
  const ry = Math.max(0.006 * lm.H, 0.9 * nk.shadowReachPx);
  out.push(blobEl(c, { c: { x: 0, y: nk.submentalBand.c.y - 0.15 * nk.shadowReachPx }, rx: nk.submentalBand.rx * 0.95, ry, rotDeg: 0 }, ra.shadow, 0.14 + 0.16 * p.neck.thickness, Math.max(7 * u, 0.4 * ry)));
  return out.filter((s) => s !== '');
}

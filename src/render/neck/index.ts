import type { ResolvedAppearance } from '../../appearance';
import { el, urlRef } from '../../core/svg';
import type { FaceLandmarks } from '../../face';
import { direction2D, type LightVector } from '../../lighting/light';
import { neckModelFor } from '../../neck';
import type { FaceParams } from '../../schema';
import { makeCtx } from './ctx';
import { renderAttachments } from './attach';
import { renderMuscles } from './muscles';
import { silhouettePath } from './path';
import { renderDewlap, renderReliefs } from './reliefs';
import { shadeBody } from './shade';
import { renderSurface } from './surface';

/**
 * RENDU DU COU (moteur de cou, `src/neck`). Enfant du visage : dessiné AVANT la tête, derrière elle ; haut caché sous le menton.
 * Un seul chemin pour le contour (`neckPath`, lu aussi par les ombres de contact) et un seul pour la surface :
 *   contour (sections déformées) → ombrage volumétrique (normales réelles, lumière, peau PARTAGÉE avec la tête et le corps) → fanon →
 *   muscles → reliefs (larynx, hyoïde, trachée, vaisseaux, clavicules, plis) → motifs de surface (écailles, plaques, plumes) → accessoires.
 * L'ombre PORTÉE du menton/de la mâchoire sur le cou reste produite par les sous-moteurs de contact et de structure (la tête en est propriétaire) ;
 * ils reçoivent le contour du cou depuis ce module.
 */
export const neckPath = (p: FaceParams, lm: FaceLandmarks): string => silhouettePath(neckModelFor(p, lm));

export function renderNeck(id: string, p: FaceParams, lm: FaceLandmarks, skin: string, ra: ResolvedAppearance, L: LightVector): { defs: string[]; markup: string[] } {
  if (!p.neck.visible) return { defs: [], markup: [] };
  const model = neckModelFor(p, lm);
  const path = silhouettePath(model);
  const c = makeCtx(`${id}-neck`, model, p.neck.system, skin, ra, L, direction2D(L));
  // Sous un motif de surface, le corps ombré porte la couleur des ÉLÉMENTS (sinon des fonds de peau apparaissent entre les écailles) ;
  // sans `elementColor`, c'est la peau : la même que la tête et le corps.
  const sf = model.composition.surface;
  const bodyColor = sf.pattern !== 'smooth' && sf.elementColor ? sf.elementColor : skin;
  const body = shadeBody(`${id}-neck`, model, path, bodyColor, ra, L, p.neck.shade);
  const base = ra.tone(-(0.12 + 0.28 * p.neck.shade), skin);
  const att = renderAttachments(c);
  // Un motif de surface (écailles, plaques, plumes) remplace la peau nue : muscles et reliefs ne sont dessinés que sur une peau lisse.
  const skinDetail = model.composition.surface.pattern === 'smooth' ? [...renderMuscles(c), ...renderReliefs(c)] : [];
  const detail = [...skinDetail, ...renderSurface(c)];
  // Le fanon et les accessoires dépassent du contour du cou : ils ne sont pas rognés par lui.
  const markup = [...att.behind, el('g', {}, [body.markup, ...renderDewlap(c, base), el('g', { 'clip-path': urlRef(`${id}-neck-clip`) }, detail), ...att.front])];
  return { defs: [...body.defs, ...c.kit.defs], markup };
}

import type { ResolvedAppearance } from '../../../appearance';
import { noseGeometry, type FaceLandmarks, type NoseGeometry } from '../../../face';
import { direction2D, type LightVector } from '../../../lighting/light';
import { intensityFor } from '../../../lighting/rig';
import type { FaceParams } from '../../../schema';
import { softKit } from '../soft';
import { renderAlae, renderNasolabial, renderNostrils } from './alae';
import type { NoseCtx } from './context';
import { renderTip } from './tip';
import { renderUpperJunctions, renderWalls } from './walls';

export interface NoseRender {
  readonly defs: string[];
  /** Calque unique du nez, dans l'ordre anatomique. Les lumières de contour et les ombres de contact sont ajoutées PAR L'ASSEMBLEUR (sous-moteur). */
  readonly markup: string[];
  readonly geometry: NoseGeometry;
}

/**
 * Rendu du nez, du général au particulier (chaque étape est un fichier) :
 *   raccords hauts (glabelle, orbites) → parois + arête → raccord nasolabial → ailes → pointe → narines.
 * Le nez est un enfant du visage : la géométrie vient de `noseGeometry` (elle-même issue des repères), la lumière est celle du visage,
 * la couleur vient de l'apparence de la peau. Rien ici ne place un élément « à la main » devant la tête.
 */
export function renderNose(id: string, p: FaceParams, lm: FaceLandmarks, skin: string, ra: ResolvedAppearance, L: LightVector, geometry?: NoseGeometry): NoseRender {
  const g = geometry ?? noseGeometry(p, lm);
  const kit = softKit(`${id}-nose`, lm.W, lm.H);
  const defs: string[] = [];
  const ctx: NoseCtx = { id, p, lm, g, skin, ra, L, dir: direction2D(L), I: intensityFor(L, 'skin'), u: lm.W / 300, kit, defs };
  const markup = [...renderUpperJunctions(ctx), ...renderWalls(ctx), ...renderNasolabial(ctx), ...renderAlae(ctx), ...renderTip(ctx), ...renderNostrils(ctx)];
  return { defs: [...kit.defs, ...defs], markup, geometry: g };
}

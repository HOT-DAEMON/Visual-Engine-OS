import type { ResolvedAppearance } from '../../../appearance';
import type { FaceLandmarks, NoseGeometry } from '../../../face';
import { facePose } from '../../../face/deform';
import { mouthGeometry, type MouthGeo } from '../../../face/mouth';
import { structureGeometry, type StructureGeometry } from '../../../face/structure';
import type { LightVector } from '../../../lighting/light';
import type { FaceParams } from '../../../schema';
import { renderChinStructure } from './chin';
import { renderFolds } from './folds';
import { renderInk } from './ink';
import { structureCtx } from './kit';
import { renderMouthStructured } from './mouth';
import { renderNeckStructure } from './neck';
import { renderNoseRegions } from './nose';
import { renderTissue } from './tissue';

/** Sortie du moteur de structure : géométrie (lue par la vérification) et calques classés par EMPLACEMENT dans l'ordre de dessin du visage. */
export interface StructureLayers {
  readonly defs: string[];
  /** Avant le nez : chair des joues, creux, masséter, bord de mâchoire, tissus péri-labiaux. */
  readonly tissue: string[];
  /** Après le nez de base : parois, dômes, sillons, base, columelle, narines à rebord, philtrum. */
  readonly noseRegions: string[];
  /** Remplace la bouche classique. */
  readonly mouth: string[];
  /** Après la bouche : plis (déformation de tissu), transitions du menton, contours dessinés. */
  readonly after: string[];
  /** Derrière la tête, après le cou : ombre sous-mentonnière, muscles, platysma. */
  readonly neck: string[];
  readonly geometry: StructureGeometry;
  readonly mouthGeo: MouthGeo;
}

/** Assemble tous les calques de structure d'un visage `anatomyEngine: 'structured'`. */
export function renderStructure(id: string, p: FaceParams, lm: FaceLandmarks, nose: NoseGeometry, skin: string, ra: ResolvedAppearance, L: LightVector): StructureLayers {
  const geometry = structureGeometry(p, lm, nose);
  const mouthGeo = mouthGeometry(p, lm);
  const pose = facePose(p, lm, geometry.tissue.cheeks);
  const c = structureCtx(id, p, lm.W, lm.H, ra, L);
  const tissue = renderTissue(c, geometry);
  const noseRegions = renderNoseRegions(c, nose, skin);
  const mouth = renderMouthStructured(c, mouthGeo, skin);
  const after = [...renderFolds(c, geometry, mouthGeo, pose.field, pose.pulls.foldDeepen), ...renderChinStructure(c, geometry), ...renderInk(c, lm, nose, geometry, mouthGeo)];
  const neck = renderNeckStructure(c, geometry);
  return { defs: [...c.kit.defs, ...mouth.defs], tissue, noseRegions, mouth: mouth.markup, after, neck, geometry, mouthGeo };
}

import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import type { FaceLandmarks } from '../landmarks';
import { alaGeometry } from './alae';
import { resolveNoseConstraints } from './constraints';
import { noseRegions } from './regions';
import { DORSUM_SAMPLES, dorsumGeometry } from './dorsum';
import { noseFrame } from './frame';
import { junctionGeometry } from './junctions';
import { nostrilGeometry } from './nostrils';
import { noseProfile } from './profile';
import { tipGeometry } from './tip';
import type { NoseGeometry } from './types';

export type { NoseGeometry, NoseAlaGeo, NostrilGeo, NoseTipGeo, NoseRootGeo, NoseDorsumGeo, NoseJunctionsGeo } from './types';
export { noseFrame, tipLift, type NoseFrame } from './frame';
export { resolveNoseConstraints, type NoseConstraint, type ResolvedNose } from './constraints';
export type { NoseRegionsGeo, NoseSidewallGeo, NoseDomeGeo, NoseGrooveGeo, NostrilRegionGeo } from './regions-types';
export { noseProfile, type NoseProfile } from './profile';

/**
 * Moteur de nez : assemble les sous-composants dans l'ordre anatomique racine → dorsum → pointe → ailes → narines → raccords.
 * Fonction PURE et déterministe : mêmes `FaceParams` et mêmes repères → mêmes sommets. Le nez ne porte aucune coordonnée propre :
 * tout dérive de `faceLandmarks` (canthi, ligne des yeux, base du nez, bouche, orbites), donc il suit le visage quand on le déplace.
 */
export function noseGeometry(p: FaceParams, lm: FaceLandmarks): NoseGeometry {
  const F = noseFrame(p, lm);
  const { root, dorsum } = dorsumGeometry(p, F);
  const prof = noseProfile(p, F, DORSUM_SAMPLES, root.depthPx);
  const tip = tipGeometry(p, F, dorsum.deviationPx, prof.projectionPx);
  // Contraintes anatomiques (T2) : arbitrage des axes indépendants AVANT de construire les volumes qui en dépendent.
  const R = resolveNoseConstraints(p, F, lm);
  const alae = alaGeometry(p, F, tip.c.x, R.baseWidth);
  const nostrils = nostrilGeometry(p, F);
  // Silhouette : paroi droite (racine → supra-pointe), puis le bord EXTÉRIEUR de l'aile droite dans son ordre de parcours (jonction → crête → attache),
  // puis le seuil jusqu'à la columelle ; le côté gauche en est le miroir parcouru à l'envers. Aucun point n'est trié : le contour ne se recoupe pas.
  const wallR: Vec[] = dorsum.axis.map((q, i) => ({ x: q.x + (dorsum.wallHalf[i] as number), y: q.y }));
  const sill: Vec = { x: F.colHalf, y: alae.right.base.y + 0.002 * F.H };
  const right = [...wallR, ...alae.right.outerEdge, sill];
  const silhouette = [...right, ...[...right].reverse().map((q) => ({ x: -q.x, y: q.y }))];
  return {
    widthPx: F.nw,
    baseY: F.baseY,
    root,
    dorsum,
    tip,
    alae,
    nostrils,
    columella: { half: F.colHalf, topY: F.tipY, bottomY: F.baseY + 0.006 * F.H },
    profile: prof.points,
    junctions: junctionGeometry(p, F, lm, alae),
    silhouette,
    regions: noseRegions({ p, F, lm, R, dorsum, tip, alae, nostrils }),
  };
}

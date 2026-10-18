import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import type { FaceLandmarks } from '../landmarks';
import { alaGeometry } from './alae';
import { DORSUM_SAMPLES, dorsumGeometry } from './dorsum';
import { noseFrame } from './frame';
import { junctionGeometry } from './junctions';
import { nostrilGeometry } from './nostrils';
import { noseProfile } from './profile';
import { tipGeometry } from './tip';
import type { NoseGeometry } from './types';

export type { NoseGeometry, NoseAlaGeo, NostrilGeo, NoseTipGeo, NoseRootGeo, NoseDorsumGeo, NoseJunctionsGeo } from './types';
export { noseFrame, tipLift, type NoseFrame } from './frame';
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
  const alae = alaGeometry(p, F, tip.c.x);
  const nostrils = nostrilGeometry(p, F);
  // Silhouette : paroi droite (racine → supra-pointe), contour extérieur de l'aile droite (crête → attache → seuil), puis le miroir.
  const wallR: Vec[] = dorsum.axis.map((q, i) => ({ x: q.x + (dorsum.wallHalf[i] as number), y: q.y }));
  const aR = alae.right.poly.filter((q) => q.x >= F.colHalf).sort((a, b) => a.y - b.y);
  const right = [...wallR, ...aR];
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
  };
}

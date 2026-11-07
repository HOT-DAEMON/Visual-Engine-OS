import { Resolver } from '../core/resolve';
import { clamp } from '../core/math';
import type { NeckSystem } from '../schema/neck-system';
import { SPECIES } from './species';
import { effectiveStyle } from './style';
import type { FaceNeckParams, HeadContext, NeckMorphology } from './types';
import { NECK_REF, type NeckFrame } from './frame';

/** Proportions de RÉFÉRENCE (valeurs par défaut du moteur) : l'exagération amplifie l'écart à ces valeurs, pas les valeurs absolues. */
const REF = NECK_REF;

/**
 * NeckMorphology RÉSOLUE : fusionne `FaceNeck` (largeur, longueur, évasement : source unique), `NeckSystem` (reste des familles),
 * le style (exagération, angularité) et les contraintes d'espèce. Toute borne appliquée est consignée (`corrections`), jamais en silence.
 * Ordre : (1) valeurs demandées → (2) exagération de style (écart à la référence ×(1+e)) → (3) bornes d'espèce.
 */
export function resolveMorphology(n: FaceNeckParams, sys: NeckSystem, ctx: HeadContext, frame: NeckFrame): NeckMorphology {
  const R = new Resolver();
  const sp = SPECIES[sys.species];
  const st = effectiveStyle(sys.style);
  const e = st.exaggeration;
  // (2) Largeur et longueur exagérées sont déjà dans `frame` (source unique `lm.neck`) ; ici seul l'ÉVASEMENT (écart à la référence ×(1+e)) et la section.
  const aTop = frame.half;
  const flare = clamp(n.flare + 1.2 * e * (n.flare - REF.flare), 0, 0.9);
  const aBase = aTop * (1 + flare) * (1 + 0.08 * (sys.modifiers.mass - 0.4));
  const bottomY = frame.bottomY;
  const lengthPx = bottomY - frame.topY;
  // Début de l'évasement : suit le bas RÉEL du menton (35 % de la distance menton → base, comme le tracé historique).
  const y1 = ctx.chinY + 0.35 * (bottomY - ctx.chinY);
  const flareStart = clamp((y1 - frame.topY) / lengthPx, 0.05, 0.95);
  // (3) Bornes d'espèce.
  const lim = (id: string, param: string, v: number, lo: number, hi: number, why: string): number => R.limit(`species-${sys.species}-${id}`, param, v, lo, hi, why);
  const curvature = lim('curvature', 'neck.system.profile.curvature', sys.profile.curvature * (1 + 1.0 * e), -sp.maxCurvature, sp.maxCurvature, `courbure maximale de l'espèce « ${sys.species} »`);
  const sCurve = lim('scurve', 'neck.system.profile.sCurve', sys.profile.sCurve, 0, sp.maxSCurve, `inflexion maximale de l'espèce « ${sys.species} »`);
  const cross = lim('cross', 'neck.system.profile.crossSection', sys.profile.crossSection, 0, sp.maxCross, `section maximale de l'espèce « ${sys.species} »`);
  const segments = lim('segments', 'neck.system.profile.segments', sys.profile.segments, sp.minSegments, sp.maxSegments, `segments de l'espèce « ${sys.species} » : ${sp.minSegments} à ${sp.maxSegments}`);
  const torsion = lim('torsion', 'neck.system.orientation.torsionDeg', sys.orientation.torsionDeg, -sp.maxTorsionDeg, sp.maxTorsionDeg, `torsion maximale de l'espèce « ${sys.species} »`);
  const pitch = lim('pitch', 'neck.system.orientation.pitchDeg', sys.orientation.pitchDeg, -sp.joint.pitch * 0.6, sp.joint.pitch * 0.8, `inclinaison maximale de l'espèce « ${sys.species} »`);
  const roll0 = lim('roll', 'neck.system.orientation.rollDeg', sys.orientation.rollDeg, -sp.joint.roll, sp.joint.roll, `roulis maximal de l'espèce « ${sys.species} »`);
  // Le haut du cou reste SOUS la tête : décalage de l'axe + inclinaison bornés à 0,6 du demi-menton (sinon le cou sortirait à côté de la mâchoire).
  const room = 0.6 * ctx.chinHalf;
  const axisOffsetPx = R.limit('neck-top-under-head', 'neck.system.orientation.axisOffset', sys.orientation.axisOffset * aTop, -room, room, 'le haut du cou reste sous la tête (0,6 du demi-menton)');
  const rollMax = (Math.asin(clamp((room - Math.abs(axisOffsetPx)) / (0.35 * lengthPx), 0, 1)) * 180) / Math.PI;
  const roll = R.limit('neck-top-under-head-roll', 'neck.system.orientation.rollDeg', roll0, -rollMax, rollMax, 'le haut du cou reste sous la tête (0,6 du demi-menton)');
  return {
    topY: frame.topY, bottomY, lengthPx, aTop, aBase,
    depthRatio: frame.depthRatio, bTop: frame.depthHalf * frame.depthRatio, flareStart,
    trapezius: sys.musculature.trapezius,
    taper: clamp(sys.profile.taper * (1 + 1.2 * e), -1, 1), waist: clamp(sys.profile.waist * (1 + 0.8 * e), 0, 1),
    curvature, sCurve,
    // Section : 2 = ellipse ; la section rectangulaire arrondie (cuirasse) monte l'exposant jusqu'à 5. L'angularité de style y ajoute.
    sectionExp: 2 + 3 * clamp(cross + 0.5 * st.angularity, 0, 1),
    segments, pitchDeg: pitch, rollDeg: roll, torsionDeg: torsion,
    axisOffsetPx,
    lrBias: sys.asymmetry.leftRightBias, fbBias: sys.asymmetry.frontBackBias,
    variation: sys.asymmetry.localVariation * (1 - 0.8 * st.simplification), seed: sys.asymmetry.seed,
    mass: sys.modifiers.mass, age: sys.modifiers.age, angularity: st.angularity,
    corrections: R.applied,
  };
}

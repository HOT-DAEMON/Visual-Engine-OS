import type { RandomFace } from '../generation/random-face';
import { browGapPerEye, eyeBands, facePerimeters, faceLandmarks, PERIMETER_LIMITS, PERIMETER_RATIOS, BROW_GAP, type PerimeterId } from '../face';
import { usesZones } from '../face/zones-limits';
import { check, type Check } from './types';

/** Tolérance de la contrainte d'écart sourcil / paupière (fraction de H) : la passe de point fixe de `fitEyeToFace` converge à 5e-4 H ; la marge couvre aussi l'arrondi de la mesure. */
const GAP_TOL = 0.0015;

/**
 * VÉRIFICATION DES PÉRIMÈTRES D'OCCUPATION (moteur `structured` ; `[]` sinon) — `docs/FACE-PERIMETERS.md`. Mesures sur les repères résolus et sur la géométrie exacte des yeux posés.
 *  géométrie : la chaîne verticale front → sourcils → écart → enveloppe palpébrale → nez → philtrum → bouche → menton est ordonnée (aucune hauteur négative, aucun chevauchement) et chaque périmètre tient dans le visage ;
 *  anatomie  : hauteur et largeur de chaque périmètre dans ses bornes ; écart sourcil / paupière FLEXIBLE mais borné, ŒIL PAR ŒIL ; le nez commence SOUS la zone entre les yeux ;
 *  style     : rapports canoniques (intercanthale / fente, nez / intercanthale, bouche / intercanthale, menton / bouche) hors du « tolérable » → avertissement (pas d'échec : le style stylisé les écarte volontairement).
 */
export function checkPerimeters(face: RandomFace): Check[] {
  if (!usesZones(face.params)) return [];
  const lm = faceLandmarks(face.params, face.width, face.height), eyes = (['left', 'right'] as const).map((s) => eyeBands(s, face.fits[s], lm));
  const P = facePerimeters(face.params, lm, eyes), by = P.byId, H = lm.H, out: Check[] = [];
  const braw = eyes.some((e) => e.browTopY !== null);
  // Sans sourcil, ceux-ci sont estimés (limite des sourcils) : ils ne sont pas contrôlés.
  const skipped = new Set<PerimeterId>(braw ? [] : ['brows', 'browGap']);
  const chain: PerimeterId[] = ['forehead', 'brows', 'browGap', 'eyes'].filter((id) => !skipped.has(id as PerimeterId)) as PerimeterId[];
  out.push(check('geometry', 'perimeters-ordered', '>=', Math.min(...chain.map((id) => by[id].heightPx), by.nose.heightPx, by.philtrum.heightPx, by.mouth.heightPx, by.chin.heightPx), 0, 'un périmètre est de hauteur négative : l\'ordre front / sourcils / paupière / nez / philtrum / bouche / menton est brisé'));
  const seams: [PerimeterId, PerimeterId][] = [['forehead', 'brows'], ['brows', 'browGap'], ['browGap', 'eyes']];
  for (const [a, b] of seams) if (!skipped.has(a) && !skipped.has(b)) out.push(check('geometry', `perimeters-seam-${a}-${b}`, '==', by[a].bottomY, by[b].topY, `le périmètre « ${by[a].label} » ne rejoint pas « ${by[b].label} » (trou ou recouvrement)`, 'error', 1e-6));
  for (const [a, b] of [['nose', 'philtrum'], ['philtrum', 'mouth'], ['mouth', 'chin']] as [PerimeterId, PerimeterId][]) out.push(check('geometry', `perimeters-seam-${a}-${b}`, '==', by[a].bottomY, by[b].topY, `le périmètre « ${by[a].label} » ne rejoint pas « ${by[b].label} » (trou ou recouvrement)`, 'error', 1e-6));
  out.push(check('geometry', 'perimeters-inside-face', '<=', Math.max(...P.list.filter((q) => !skipped.has(q.id)).map((q) => q.widthShare)), 1.001, 'un composant sort du contour du visage à sa hauteur'));
  // Le nez commence sous la zone entre les yeux : sa pointe, sa base et son périmètre sont sous le bas de cette zone.
  out.push(check('anatomy', 'nose-below-interocular', '>=', by.nose.topY - by.interocular.bottomY, -1e-6, 'le périmètre du nez commence AU-DESSUS du bas de la zone entre les yeux'));
  out.push(check('anatomy', 'nose-tip-below-interocular', '>=', lm.noseTipY - by.interocular.bottomY, 0, 'la pointe du nez est dans la zone entre les yeux'));
  if (braw) for (const [i, g] of browGapPerEye(eyes).entries()) {
    out.push(check('anatomy', `brow-gap-min-${i}`, '>=', g / H, BROW_GAP.min - GAP_TOL, 'le sourcil chevauche (ou touche) la paupière'));
    out.push(check('anatomy', `brow-gap-max-${i}`, '<=', g / H, BROW_GAP.max + GAP_TOL, 'le sourcil flotte loin au-dessus de l\'œil'));
  }
  for (const q of P.list) {
    if (skipped.has(q.id)) continue;
    const L = PERIMETER_LIMITS[q.id];
    out.push(check('anatomy', `perimeter-${q.id}-height`, '>=', q.heightShare, L.height.min - 1e-6, `périmètre « ${q.label} » trop bas (${(q.heightShare * 100).toFixed(1)} % de H)`, q.id === 'browGap' ? 'error' : 'warn'));
    out.push(check('anatomy', `perimeter-${q.id}-height-max`, '<=', q.heightShare, L.height.max + 1e-6, `périmètre « ${q.label} » trop haut (${(q.heightShare * 100).toFixed(1)} % de H)`, 'warn'));
    out.push(check('anatomy', `perimeter-${q.id}-width`, '>=', q.widthShare, L.width.min - 1e-6, `périmètre « ${q.label} » trop étroit`, 'warn'));
    out.push(check('anatomy', `perimeter-${q.id}-width-max`, '<=', q.widthShare, L.width.max + 1e-6, `périmètre « ${q.label} » trop large pour le visage`, 'warn'));
  }
  const inter = by.interocular.halfPx, eyeW = by.eyes.halfPx - Math.abs(lm.innerCanthus.right.x), R = PERIMETER_RATIOS;
  const ratio = (id: string, v: number, r: { min: number; max: number }, msg: string): void => { out.push(check('style', `ratio-${id}-min`, '>=', v, r.min, msg, 'warn'), check('style', `ratio-${id}-max`, '<=', v, r.max, msg, 'warn')); };
  ratio('interocular-eye', (2 * inter) / Math.max(1e-6, eyeW), R.interocularToEye, 'distance intercanthale / largeur de fente hors canon (règle des cinq yeux)');
  ratio('nose-interocular', by.nose.halfPx / inter, R.noseToInterocular, 'largeur du nez / distance intercanthale hors canon');
  ratio('mouth-interocular', by.mouth.halfPx / inter, R.mouthToInterocular, 'largeur de la bouche / distance intercanthale hors canon');
  ratio('chin-mouth', by.chin.halfPx / Math.max(1e-6, by.mouth.halfPx), R.chinToMouth, 'menton en pointe de bouclier (largeur du menton / bouche)');
  return out;
}

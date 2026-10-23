import { faceZones } from '../face/zones';
import { ZONE_LIMITS, usesZones } from '../face/zones-limits';
import { templeHalfWidth } from '../face/zones';
import type { FaceLandmarks } from '../face';
import type { FaceParams } from '../schema';
import { check, type Check } from './types';

/**
 * VÉRIFICATION DES ZONES VERTICALES (moteur `structured`) : les sept zones recouvrent exactement la hauteur H (aucun trou, aucun recouvrement), chaque
 * zone borne reste dans ses limites (`zones-limits.ts`), l'implantation reste entre le sommet du crâne et les sourcils, et son extrémité de tempe est
 * SUR le contour du crâne. Mesures sur les repères résolus.
 */
export function checkZones(p: FaceParams, lm: FaceLandmarks): Check[] {
  if (!usesZones(p)) return [];
  const z = faceZones(p, lm);
  const o: Check[] = [];
  // Le bas du menton est à H/2 + abaissement de la mandibule : les zones recouvrent exactement « sommet du crâne → bas du menton ».
  o.push(check('geometry', 'zones-sum-to-height', '==', z.bands.reduce((s, b) => s + b.share, 0), (lm.chinY + lm.H / 2) / lm.H, 'les sept zones verticales ne recouvrent pas exactement la hauteur sommet → menton', 'error', 1e-9));
  o.push(check('geometry', 'zones-ordered', '>=', Math.min(...z.bands.map((b) => b.heightPx)), 0, "une zone verticale est négative : l'ordre cuir chevelu / front / yeux / nez / philtrum / lèvres / menton est brisé"));
  for (const b of z.bands) {
    if (!b.limits) continue;
    o.push(check('anatomy', `zone-${b.id}-min`, '>=', b.share, b.limits.min - 1e-6, `la zone « ${b.label} » est trop courte (${(b.share * 100).toFixed(1)} % de H)`));
    o.push(check('anatomy', `zone-${b.id}-max`, '<=', b.share, b.limits.max + 1e-6, `la zone « ${b.label} » est trop longue (${(b.share * 100).toFixed(1)} % de H)`));
  }
  o.push(check('anatomy', 'forehead-share-of-cranium', '>=', z.foreheadOfCranium, ZONE_LIMITS.foreheadShare.min, 'le front est trop bas dans la hauteur du crâne'));
  o.push(check('anatomy', 'forehead-share-of-cranium-max', '<=', z.foreheadOfCranium, ZONE_LIMITS.foreheadShare.max, 'le front occupe trop de la hauteur du crâne'));
  o.push(check('anatomy', 'hairline-below-crown', '>=', z.hair.centerY, z.hair.crownY + 0.03 * lm.H, "l'implantation touche le sommet du crâne"));
  o.push(check('anatomy', 'hairline-above-brow', '<=', z.hair.line.reduce((m, q) => Math.max(m, q.y), -Infinity), lm.browLimitY, "l'implantation descend sous la limite des sourcils"));
  // L'extrémité de l'implantation est DANS le crâne, près du contour (entre 85 % et 100 % de la demi-largeur à son ordonnée) : jamais à l'extérieur, jamais perdue au centre.
  const ratio = Math.abs(z.hair.temple.x) / templeHalfWidth(lm, z.hair.temple.y);
  o.push(check('anatomy', 'hairline-temple-inside-skull', '<=', ratio, 1, "l'extrémité de l'implantation sort du crâne"));
  o.push(check('anatomy', 'hairline-temple-near-skull', '>=', ratio, 0.85, "l'extrémité de l'implantation est loin du contour du crâne (la tempe n'est pas rejointe)"));
  return o;
}

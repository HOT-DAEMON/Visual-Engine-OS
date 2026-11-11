import { faceLandmarks, noseGeometry, type FaceLandmarks, type NoseGeometry } from '../face';
import { noseRelief, noseTipHeight, type NoseRelief } from '../relief/nose';
import { check, type Check } from './types';
import type { RandomFace } from '../generation/random-face';

/**
 * VÉRIFICATION DU RELIEF DU NEZ (celui que lit le moteur d'éclairage unique, `src/relief/nose.ts`), trois couches chiffrées.
 *  geometry : relief fini ; nul sur le bord de la boîte du nez (aucune marche → aucune ligne d'ombre parasite) ; pente maximale bornée.
 *  anatomy  : le nez culmine dans sa moitié basse (pas à la racine) ; le centre des narines est plus bas que la pointe ; relief borné par la projection.
 *  style    : le nez n'est ni plat ni pointu (rapport pic / projection dans une bande).
 * Pure : `noseReliefChecks` prend la fonction de relief en entrée pour que les tests puissent lui injecter un défaut et constater qu'il est détecté.
 */
export const NOSE_RELIEF_LIMITS = { edgeMax: 0.05, slopeMax: 0.3, peakMin: 0.6, peakMax: 2.2 } as const;

export function noseReliefChecks(relief: NoseRelief, lm: FaceLandmarks, nose: NoseGeometry): Check[] {
  const H = lm.H, tipH = noseTipHeight(lm, nose), x1 = nose.widthPx * 1.25, y0 = nose.root.y - 0.04 * H, y1 = nose.baseY + 0.09 * H;
  const nx = 60, ny = 70, at = (i: number, j: number): number => relief(-x1 + (2 * x1 * i) / nx, y0 + ((y1 - y0) * j) / ny);
  let finite = true, peak = -Infinity, peakY = 0, edge = 0, slope = 0;
  const stepX = (2 * x1) / nx, stepY = (y1 - y0) / ny, v: number[][] = [];
  for (let j = 0; j <= ny; j++) { v.push([]); for (let i = 0; i <= nx; i++) { const z = at(i, j); v[j]!.push(z); if (!Number.isFinite(z)) finite = false; if (z > peak) { peak = z; peakY = y0 + stepY * j; } if (i === 0 || i === nx || j === 0 || j === ny) edge = Math.max(edge, Math.abs(z)); } }
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { if (i < nx) slope = Math.max(slope, Math.abs(v[j]![i + 1]! - v[j]![i]!) / stepX); if (j < ny) slope = Math.max(slope, Math.abs(v[j + 1]![i]! - v[j]![i]!) / stepY); }
  const out: Check[] = [];
  out.push(check('geometry', 'nose-relief-finite', '==', Number(finite), 1, 'le relief du nez contient une valeur non finie'));
  out.push(check('geometry', 'nose-relief-edge-zero', '<=', edge / tipH, NOSE_RELIEF_LIMITS.edgeMax, 'le relief du nez ne s\'éteint pas sur le bord de sa boîte (marche = ligne d\'ombre parasite)'));
  out.push(check('geometry', 'nose-relief-slope', '<=', slope / tipH, NOSE_RELIEF_LIMITS.slopeMax, 'pente du relief du nez trop raide (arête vive ou marche)'));
  out.push(check('anatomy', 'nose-peak-lower-half', '>=', (peakY - nose.root.y) / Math.max(1, nose.baseY - nose.root.y), 0.45, 'le nez culmine trop près de la racine'));
  const nostrilZ = Math.max(...[nose.nostrils.left, nose.nostrils.right].map((n) => relief(n.c.x, n.c.y)));
  out.push(check('anatomy', 'nostril-below-tip', '<=', nostrilZ, relief(nose.tip.c.x, nose.tip.c.y), 'une narine est plus haute que la pointe'));
  out.push(check('anatomy', 'nose-relief-bounded', '<=', peak / tipH, NOSE_RELIEF_LIMITS.peakMax, 'le relief du nez dépasse nettement sa projection'));
  out.push(check('style', 'nose-relief-not-flat', '>=', peak / tipH, NOSE_RELIEF_LIMITS.peakMin, 'le nez est plat (rapport pic / projection trop faible)', 'warn'));
  return out;
}

export function checkNoseRelief(face: RandomFace): Check[] {
  const lm = faceLandmarks(face.params, face.width, face.height), nose = noseGeometry(face.params, lm);
  return noseReliefChecks(noseRelief(face.params, lm, nose, noseTipHeight(lm, nose)), lm, nose);
}

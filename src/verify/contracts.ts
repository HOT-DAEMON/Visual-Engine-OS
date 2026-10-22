import { faceLandmarks } from '../face';
import { measureFace } from '../face/contracts';
import type { RandomFace } from '../generation/random-face';
import { check, type Check } from './types';

/**
 * VÉRIFICATION PAR CONTRATS : les trois couches (géométrie, anatomie, style) appliquées aux MESURES OBSERVABLES du visage et aux
 * corrections du résolveur. Pure et déterministe. Chaque contrôle donne la valeur mesurée et la limite (traçable dans les artefacts).
 *  - géométrie : toutes les mesures sont finies ; aucune contrainte n'écrase une grandeur demandée de plus de moitié (bouche écrasée = avertissement) ;
 *  - anatomie : ordre vertical yeux < base du nez < bouche < sillon du menton ; la bouche est plus étroite que la mâchoire ;
 *    le nez plus large que la bouche n'est pas imposé (variation réelle des visages), seul l'ordre l'est ;
 *  - style : budget de détail maîtrisé (nombre de filtres du rendu) — un visage qui exploserait le coût de rendu est signalé.
 */
export function checkContracts(face: RandomFace, svg: string): Check[] {
  const p = face.params;
  if (p.anatomyEngine !== 'structured') return [];
  const lm = faceLandmarks(p, face.width, face.height);
  const m = measureFace(p, face.width, face.height);
  const out: Check[] = [];
  out.push(check('geometry', 'contract-measures-finite', '==', Object.values(m).filter((v) => !Number.isFinite(v)).length, 0, 'mesures observables non finies'));
  const ratios = lm.corrections.filter((c) => c.requested > 1e-6).map((c) => c.applied / c.requested);
  const worst = ratios.length ? Math.min(...ratios) : 1;
  out.push(check('geometry', 'contract-no-crushed-request', '>=', worst, 0.5, 'une contrainte ramène une grandeur demandée à moins de la moitié (ex. bouche écrasée dans un contour étroit)', 'warn'));
  out.push(check('anatomy', 'contract-vertical-order', '==', Number(m['eye.leftY']! < m['nose.baseY']! && m['nose.baseY']! < m['mouth.centerY']! && m['mouth.centerY']! < m['chin.sulcusY']!), 1, 'ordre vertical yeux < nez < bouche < menton non respecté'));
  out.push(check('anatomy', 'contract-mouth-inside-jaw', '<=', m['mouth.halfWidthPx']!, m['mandible.outerHalf']!, 'la bouche déborde la mâchoire'));
  out.push(check('style', 'contract-filter-budget', '<=', (svg.match(/<filter /g) ?? []).length, 160, 'budget de filtres dépassé (coût de rendu ; médiane mesurée ≈ 100 sur un visage complet)', 'warn'));
  return out;
}

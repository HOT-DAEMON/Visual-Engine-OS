import type { Raster } from '../regression/png';
import type { LitFigure } from '../relief/figure';
import { equivalenceChecks, measureEquivalence, type EquivalenceMetrics } from './render-equivalence';
import { litStats } from './lit';
import { check, type Check } from './types';

/**
 * VÉRIFICATION D'ÉQUIVALENCE DE LA FIGURE COMPLÈTE (tête + cou + corps) — les trois couches du moteur, pour prouver qu'une approximation de vitesse (par exemple
 * `headCastScale`) ne dégrade ni la géométrie, ni l'anatomie, ni le style (docs/PERF-4.md). Elle ajoute à l'équivalence de rendu par pixels
 * (`render-equivalence.ts`, bornes calibrées au dépôt, inchangées) :
 *  - géométrie : le champ de relief de la tête est IDENTIQUE (l'approximation ne touche que la lumière, jamais la forme) ;
 *  - anatomie  : la part éclairée de chaque zone de la tête (gauche / droite / haut / bas / orbite / cou / sous le menton) ne bouge pas de plus de `LIT_ZONE_TOL` ;
 *  - style     : la part d'ombre du visage et la part de pénombre ne bougent pas de plus de `LIT_STYLE_TOL`.
 * Les deux tolérances ont été fixées d'après les mesures de 9 configurations (3 personnes × 3 lumières) ; un contrôle négatif (lumière tournée de 40°) les fait échouer.
 */
export const LIT_ZONE_TOL = 0.02, LIT_STYLE_TOL = 0.02;
const ZONES = ['left', 'right', 'top', 'bottom', 'orbit', 'neck', 'neckCast', 'neckTop'] as const;

export function figureEquivalence(ref: LitFigure, opt: LitFigure, refRaster: Raster, optRaster: Raster): { metrics: EquivalenceMetrics; checks: Check[] } {
  const metrics = measureEquivalence(refRaster, optRaster, ref.svg, opt.svg), checks = equivalenceChecks(metrics);
  const same = ref.head.field.depth.length === opt.head.field.depth.length && ref.head.field.depth.every((v, i) => Object.is(v, opt.head.field.depth[i]));
  checks.push(check('geometry', 'figure-relief-identique', '==', same ? 1 : 0, 1, 'le champ de relief de la tête est identique (l\'approximation ne change que la lumière)'));
  const a = litStats(ref.head, ref.face.lm), b = litStats(opt.head, opt.face.lm);
  for (const z of ZONES) if (!Number.isNaN(a[z]) && !Number.isNaN(b[z])) checks.push(check('anatomy', `figure-lit-${z}`, '<=', Math.abs(a[z] - b[z]), LIT_ZONE_TOL, `part éclairée « ${z} » : écart ${Math.abs(a[z] - b[z]).toFixed(4)} (≤ ${LIT_ZONE_TOL})`));
  for (const k of ['shadow', 'transition'] as const) if (!Number.isNaN(a[k]) && !Number.isNaN(b[k])) checks.push(check('style', `figure-style-${k}`, '<=', Math.abs(a[k] - b[k]), LIT_STYLE_TOL, `part « ${k} » du visage : écart ${Math.abs(a[k] - b[k]).toFixed(4)} (≤ ${LIT_STYLE_TOL})`));
  return { metrics, checks };
}

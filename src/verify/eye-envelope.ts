import { openingProfile, REF_PROFILE, REF_RANGES, type OpeningGeometry } from '../geometry/eye';
import type { EyeSpec } from '../schema';
import { check, type Check } from './types';

/**
 * VÉRIFICATION DE L'ENVELOPPE D'UN ŒIL contre les références MESURÉES (references/eyes/measures.json, voir docs/EYES-REFS.md) — trois couches :
 *  - geometry : paupières ordonnées (la basse n'est jamais au-dessus de la haute), un seul sommet par paupière (pas d'ondulation) ;
 *  - anatomy  : position du sommet de la paupière haute et du creux de la basse dans la plage mesurée ; iris ≈ hauteur d'ouverture ;
 *  - style    : écart quadratique du profil normalisé au profil de référence moyen.
 * Les styles stylisés (round, chibi, angular, triangle, circle, diamond, rounded_rect…) sortent volontairement des bornes humaines : seules les
 * vérifications géométriques (error) leur sont appliquées ; l'anatomie et le style ne concernent que les styles « naturels » (warn).
 */
export const NATURAL_STYLES: readonly EyeSpec['shape']['style'][] = ['almond', 'sharp', 'drooping', 'compressed'];

const norm = (v: readonly number[]): number[] => { const m = Math.max(...v.map(Math.abs)) || 1; return v.map((x) => x / m); };
const rms = (a: readonly number[], b: readonly number[]): number => Math.sqrt(a.reduce((s, x, i) => s + (x - (b[i] as number)) ** 2, 0) / a.length);
/** Nombre de sommets distincts (amplitude > `eps` de part et d'autre) d'une courbe échantillonnée. */
export function peaks(v: readonly number[], eps = 0.004): number {
  let n = 0; let state: 'up' | 'down' = 'up'; let last = v[0] as number; let top = last;
  for (const x of v) {
    if (state === 'up') { if (x > top) top = x; else if (top - x > eps) { n++; state = 'down'; last = x; } }
    else if (x < last) last = x; else if (x - last > eps) { state = 'up'; top = x; }
  }
  return n;
}

export function checkEyeEnvelope(g: OpeningGeometry, style: EyeSpec['shape']['style'], irisRy: number): Check[] {
  const p = openingProfile(g);
  const out: Check[] = [];
  const minGap = Math.min(...p.upper.map((u, i) => u + (p.lower[i] as number)));
  out.push(check('geometry', 'envelope-lids-ordered', '>=', minGap, -1e-6, 'la paupière basse passe au-dessus de la haute'));
  out.push(check('geometry', 'envelope-single-peak-upper', '<=', peaks(p.upper), 1, 'la paupière haute ondule (plusieurs sommets)'));
  out.push(check('geometry', 'envelope-single-peak-lower', '<=', peaks(p.lower), 1, 'la paupière basse ondule (plusieurs creux)'));
  if (!NATURAL_STYLES.includes(style)) return out;
  const [uLo, uHi] = REF_RANGES.upperPeakAt;
  const [lLo, lHi] = REF_RANGES.lowerPeakAt;
  out.push(check('anatomy', 'upper-peak-min', '>=', p.upperPeakAt, uLo, 'sommet de la paupière haute trop près du canthus interne (références : 0,41–0,60)', 'warn'));
  out.push(check('anatomy', 'upper-peak-max', '<=', p.upperPeakAt, uHi, 'sommet de la paupière haute trop près du canthus externe', 'warn'));
  out.push(check('anatomy', 'lower-peak-min', '>=', p.lowerPeakAt, lLo, 'creux de la paupière basse trop près du canthus interne (références : 0,46–0,63)', 'warn'));
  out.push(check('anatomy', 'lower-peak-max', '<=', p.lowerPeakAt, lHi, 'creux de la paupière basse trop près du canthus externe', 'warn'));
  const ratio = (2 * irisRy) / ((p.aspect * g.w) || 1);
  out.push(check('anatomy', 'iris-over-opening-height-min', '>=', ratio, REF_RANGES.irisOverOpeningHeight[0], 'iris bien plus petit que la hauteur d’ouverture (références ≈ 1,0)', 'warn'));
  out.push(check('anatomy', 'iris-over-opening-height-max', '<=', ratio, REF_RANGES.irisOverOpeningHeight[1], 'iris bien plus grand que la hauteur d’ouverture', 'warn'));
  const dev = Math.max(rms(norm(p.upper), REF_PROFILE.upper), rms(norm(p.lower), REF_PROFILE.lower));
  out.push(check('style', 'envelope-vs-reference-profile', '<=', dev, 0.16, 'profil de l’enveloppe éloigné du profil de référence mesuré', 'warn'));
  return out;
}

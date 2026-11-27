import type { EyeSpec } from '../schema';
import { eyeLevers } from '../render/eye/appearance-levers';
import { effectivePupilSize } from '../geometry/eye';
import { check, type Check } from './types';

/**
 * VÉRIFICATION DES LEVIERS D'APPARENCE DE L'ŒIL (passe 20, `render/eye/appearance-levers.ts`) — lit l'œil BRUT (le fini `flat` / `cel` met `appearance` à null) :
 *  - geometry : la bande de lumière de l'iris reste hors de la pupille (largeur 0,32 × valeur ≤ 1 − pupille/iris : sinon elle se confond avec le bord de la pupille) ;
 *  - anatomy  : un œil dont l'opacité globale descend sous 0,25 n'est plus un œil lisible (avertissement) ; les reflets agrandis ne dépassent pas l'iris (taille × 0,6 + 0,8 × size ≤ 1,4) ;
 *  - style    : un levier réglé hors de sa valeur neutre doit SE VOIR à la taille de rendu : bande ≥ 0,6 px d'épaisseur, ombre portée supplémentaire ≥ 0,5 px, reflet ≥ 0,8 px.
 *    Un levier invisible est un paramètre orphelin à l'écran (avertissement).
 * Silencieux (aucun contrôle) pour un œil sans apparence ou à leviers neutres.
 */
export const BAND_MIN_PX = 0.6, SHADOW_EXTRA_MIN_PX = 0.5, HIGHLIGHT_MIN_PX = 0.8, OPACITY_MIN = 0.25, REFLECTION_SCALE_MAX = 1.4;

export function checkEyeAppearance(raw: EyeSpec, irisRx: number, hEff: number, pxPerUnit: number): Check[] {
  const lv = eyeLevers(raw); const out: Check[] = [];
  const pupilToIris = effectivePupilSize(raw.pupil);
  if (lv.highlightBand > 0) {
    out.push(check('geometry', 'band-clear-of-pupil', '>=', 1 - 0.32 * lv.highlightBand - pupilToIris, 0, 'la bande de lumière de l’iris atteint la pupille (largeur 0,32 × valeur > 1 − pupille / iris)', 'warn'));
    out.push(check('style', 'band-visible', '>=', 0.32 * lv.highlightBand * irisRx * pxPerUnit, BAND_MIN_PX, 'la bande de lumière de l’iris est plus fine que 0,6 px : paramètre orphelin à cette taille', 'warn'));
  }
  if (lv.castShadow > 0) out.push(check('style', 'cast-shadow-visible', '>=', 0.1 * lv.castShadow * hEff * pxPerUnit, SHADOW_EXTRA_MIN_PX, 'la profondeur d’ombre ajoutée par shading.castShadow est inférieure à 0,5 px : paramètre orphelin à cette taille', 'warn'));
  if (lv.opacity < 1) out.push(check('anatomy', 'eye-opacity-readable', '>=', lv.opacity, OPACITY_MIN, 'l’œil est presque transparent (opacité < 0,25) : il n’est plus lisible', 'warn'));
  if (lv.reflectionScale !== 1) {
    out.push(check('anatomy', 'reflection-scale-bounded', '<=', lv.reflectionScale, REFLECTION_SCALE_MAX, 'reflection.size agrandit trop les reflets (× > 1,4) : ils sortiraient de l’iris', 'warn'));
    out.push(check('style', 'reflection-visible', '>=', raw.highlights.primary.size * irisRx * lv.reflectionScale * pxPerUnit, HIGHLIGHT_MIN_PX, 'le reflet principal, réduit par reflection.size, est plus petit que 0,8 px', 'warn'));
  }
  return out;
}

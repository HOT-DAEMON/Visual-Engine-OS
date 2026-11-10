import { darken, mix } from '../core/color';
import { puberty } from './canon';
import type { BodyRenderOpts } from './render';

/**
 * TEINTES du corps : UNE lecture de l'apparence du visage pour le haut et le bas du corps. Avec `appearance` (apparence résolue de la peau de l'hôte, la MÊME que lit le
 * cou), la peau est `appearance.base` et l'ombre est l'ombre de l'apparence (`appearance.shadow`) mélangée à la peau ; sans elle, comportement historique
 * (`darken(peau, 0,2)`) : appels directs, tests, rendus autonomes. L'écart de teinte torse/cou mesuré avant (jusqu'à 11°) vient de cette ombre qui gardait la teinte de la peau
 * alors que celle du cou (et de la tête) vire vers l'ombre de l'apparence.
 */
export const SHADE_MIX = 0.35;
/** Sexe EXPRIMÉ du corps (−1 féminin … +1 masculin) : l'axe `sex` n'agit qu'après la puberté. Source unique, lue par la scène pour le larynx du cou. */
export const expressedSex = (p: { sex: number; age: number }): number => p.sex * puberty(p.age);
export function bodyTones(o: Pick<BodyRenderOpts, 'skin' | 'appearance'>): { skin: string; shade: string } {
  const skin = o.appearance?.base ?? o.skin;
  return { skin, shade: o.appearance ? mix(skin, o.appearance.shadow, SHADE_MIX) : darken(skin, 0.2) };
}

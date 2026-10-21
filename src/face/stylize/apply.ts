import { clamp } from '../../core/math';
import type { FaceParams } from '../../schema';

/**
 * PROFIL DE STYLISATION (T13) : amplifie des traits de la GÉOMÉTRIE en réécrivant les paramètres MORPHOLOGIQUES, jamais le matériau ni l'éclairage
 * (le mode de rendu `renderMode` est un autre champ et n'est pas lu ici). Fonction PURE et IDEMPOTENTE : le profil est « cuit » une fois (`baked = true`),
 * un second appel ne fait rien. Deux principes gouvernent chaque exagération :
 *   1. on amplifie l'ÉCART à la valeur neutre dans le SENS où le trait va déjà (un menton déjà fuyant devient plus fuyant, pas proéminent) ;
 *   2. les RELATIONS essentielles sont ensuite réimposées (`relations.ts`) : menton plus étroit que la mâchoire, cou entre menton et mâchoire, etc.
 */
/** Amplifie l'écart de `v` à `neutral` de `1 + k × gain`, dans le sens existant (sens `+` si `v` est exactement neutre). */
const amplify = (v: number, neutral: number, gain: number, k: number): number => {
  // Gain nul : la valeur n'est pas touchée (pas même l'écart minimal ci-dessous).
  if (gain === 0) return v;
  const d = v - neutral;
  const dir = d === 0 ? 1 : Math.sign(d);
  // Écart minimal de 5 % de l'amplitude : un visage exactement neutre est quand même exagéré dans le sens +.
  return neutral + dir * Math.max(Math.abs(d), 0.05) * (1 + k * gain);
};
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** `true` si le profil n'exagère rien (tous les gains à 0) : `outline` et `detail` règlent le RENDU, pas la géométrie, et ne comptent donc pas. */
export const isNeutralProfile = (s: FaceParams['stylization']): boolean =>
  s.chinProjection === 0 && s.jawWidth === 0 && s.angularity === 0 && s.jawNeckContrast === 0 && s.mouthSize === 0 && s.cornerAsymmetry === 0 && s.simplify === 0;

export function applyStylization(p: FaceParams): FaceParams {
  const s = p.stylization;
  // Idempotence : un profil déjà appliqué ne s'applique pas deux fois. Neutralité : sans exagération, les paramètres ne sont pas touchés (les visages d'avant restent identiques).
  if (s.baked || isNeutralProfile(s)) return p;
  const q: FaceParams = structuredClone(p);
  // 1. Projection du menton : écart à 0,5 multiplié jusqu'à ×4 (gain 1).
  q.chin.projection = clamp(amplify(p.chin.projection, 0.5, s.chinProjection, 3), 0, 1);
  // 2. Largeur mandibulaire (osseuse) : écart à la valeur neutre 0,8 multiplié jusqu'à ×3,5.
  q.jawWidth = clamp(amplify(p.jawWidth, 0.8, s.jawWidth, 2.5), 0.5, 0.98);
  // 3. Angularité : angle mandibulaire aigu, corps rectiligne, menton carré, tissus mous qui arrondissent réduits.
  q.jaw.angle = p.jaw.angle * (1 - 0.8 * s.angularity);
  q.mandible.bodyCurve = p.mandible.bodyCurve * (1 - 0.7 * s.angularity);
  // La forme continue du menton n'est posée que si l'angularité agit (sinon la symphyse historique reste en vigueur).
  if (s.angularity > 0) q.chin.form = mix(p.chin.form ?? (p.chin.symphysis === 'square' ? 1 : p.chin.symphysis === 'pointed' ? -1 : 0), 1, 0.8 * s.angularity);
  q.softTissue.fat = p.softTissue.fat * (1 - s.angularity);
  // 4. Contraste mâchoire / cou : le cou se rétrécit (jusqu'à −35 %) sous la même mâchoire.
  q.neck.width = clamp(p.neck.width * (1 - 0.35 * s.jawNeckContrast), 0.2, 0.8);
  // 5. Taille relative de la bouche : de −50 % à +50 % de la largeur (bornée par le contour dans les repères).
  q.mouth.width = clamp(p.mouth.width * (1 + 0.5 * s.mouthSize), 0.16, 0.5);
  // 6. Asymétrie des commissures : s'ajoute à celle du personnage.
  q.mouth.cornerAsym = clamp(p.mouth.cornerAsym + s.cornerAsymmetry, -1, 1);
  // 7. Simplification des transitions : les raccords fondus deviennent des plans francs (0 = raccord net).
  const k = s.simplify;
  q.chin.upperBlend = mix(p.chin.upperBlend, 0, k);
  q.chin.lateralBlend = mix(p.chin.lateralBlend, 0, k);
  q.chin.lowerBlend = mix(p.chin.lowerBlend, 0, k);
  q.mandible.preauricular = mix(p.mandible.preauricular, 0, k);
  q.cheek.masseterBlend = mix(p.cheek.masseterBlend, 0, k);
  q.nose.alae.attachment = mix(p.nose.alae.attachment, 0, k);
  q.nose.junction.cheek = mix(p.nose.junction.cheek, 0, 0.7 * k);
  q.nose.philtrum.blend = mix(p.nose.philtrum.blend, 0, k);
  // 8. Relations essentielles réimposées sur les paramètres : le menton reste plus étroit que la mâchoire (la géométrie le rebornera aussi).
  q.chinWidth = Math.min(q.chinWidth, 0.92 * q.jawWidth);
  q.stylization = { ...s, baked: true };
  return q;
}

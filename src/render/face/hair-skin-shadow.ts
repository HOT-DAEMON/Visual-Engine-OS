import type { LightVector } from '../../lighting/light';
import { SKIN_SHADOW_DX, SKIN_SHADOW_DY } from '../../face/hair/sim/drape';
import { shadowReach } from './hair-light';

/**
 * OMBRE DES MÈCHES SUR LA PEAU SUIVANT LA LUMIÈRE — la simulation (`sim/drape.ts`, `skinShadow`) décale le ruban de chaque mèche d'un vecteur FIXE (0,006 W ; 0,011 H), valable pour une seule lumière :
 * celle de référence du schéma (`schema/light-transform.ts` : azimut 330°, élévation 55°). Quand la lumière de la scène change (à droite, en bas, rasante, de face), l'ombre restait du même côté, de la même longueur.
 * Même règle physique que l'ombre portée des mèches (`hair-light.ts`, `shadowReach`) : l'ombre tombe À L'OPPOSÉ de la lumière, d'autant plus loin que celle-ci est rasante.
 *   décalage voulu = décalage cuit, TOURNÉ de l'écart d'azimut entre la lumière réelle et celle de référence, et multiplié par `shadowReach` (1 à 55°).
 * Le rendu ne recalcule pas la géométrie : il TRANSLATE le groupe d'ombres de (voulu − cuit). Lumière de référence → translation nulle : le rendu historique est inchangé, au bit près.
 */
/** Direction image de la lumière de référence (azimut 330° : 0° = haut de l'écran, 90° = droite) : (sin az, −cos az), vers la source. */
const REF_AZ = (330 * Math.PI) / 180;
const REF_ANGLE = Math.atan2(-Math.cos(REF_AZ), Math.sin(REF_AZ));

export function skinShadowShift(L: Pick<LightVector, 'x' | 'y' | 'z'>, W: number, H: number): { x: number; y: number } {
  const baked = { x: SKIN_SHADOW_DX * W, y: SKIN_SHADOW_DY * H };
  const reach = shadowReach(L);
  // Lumière de face (L.x = L.y = 0) : pas de direction ; on garde celle de référence, la portée (`reach` ≥ 0,45) réduisant l'ombre. Jamais NaN.
  const turn = Math.hypot(L.x, L.y) < 1e-6 ? 0 : Math.atan2(L.y, L.x) - REF_ANGLE; const c = Math.cos(turn); const s = Math.sin(turn);
  const off = { x: reach * (baked.x * c - baked.y * s), y: reach * (baked.x * s + baked.y * c) };
  return { x: off.x - baked.x, y: off.y - baked.y };
}

import type { LightVector } from '../../lighting/light';
import { SKIN_SHADOW_DX, SKIN_SHADOW_DY } from '../../face/hair/sim/drape';
import { intensityFor, softness } from '../../lighting/rig';
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

/** Douceur de la lumière de référence (taille 0,5, dureté 0,5, source à l'infini : `softness` = 0,5). Elle y garde l'opacité cuite. */
const REF_SOFTNESS = 0.5;

/**
 * OPACITÉ de l'ombre des mèches sur la peau suivant la lumière (docs/HAIR-PASS6.md). La position et la portée de l'ombre suivaient déjà la lumière (`skinShadowShift`), pas son INTENSITÉ : une scène presque éteinte gardait une ombre pleine.
 * Deux facteurs, tous deux lus sur le moteur d'éclairage (aucune constante nouvelle côté lumière) :
 *  - intensité effective pour la peau (`intensityFor(L, 'skin')`, 0–1) : le contraste d'une ombre est proportionnel à la lumière directrice qui la crée ; 0 = pas d'ombre ;
 *  - douceur (`softness(L)`, 0–1) : une source large ou proche remplit l'ombre. Facteur 1 − 0,5·(douceur − 0,5), borné à [0,75 ; 1,25].
 * Lumière de référence (intensité 1, douceur 0,5) : facteur 1, valeur rendue inchangée, au bit près. Le résultat reste dans [0, 1].
 */
export function skinShadowOpacity(L: LightVector, base: number): number {
  const soft = Math.min(1.25, Math.max(0.75, 1 - 0.5 * (softness(L) - REF_SOFTNESS)));
  const k = intensityFor(L, 'skin') * (Math.abs(soft - 1) < 1e-9 ? 1 : soft);
  return Math.abs(k - 1) < 1e-9 ? base : Math.min(1, Math.max(0, base * k));
}

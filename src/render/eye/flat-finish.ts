import { dominantColor, gradientDef, type CompiledSurface, type Surface } from '../../materials';
import { urlRef } from '../../core/svg';
import type { EyeSpec } from '../../schema';

/**
 * FINI « FLAT » (`EyeSpec.finish === 'flat'`) : l'œil est dessiné en APLATS FRANCS, comme les références au trait (réfs 12, 13, 17 de references/eyes :
 * 0 à 3 % de demi-teintes hors des bords, voir references/eyes/measures-ink.json). Rien de nouveau n'est dessiné : le fini retire ce que le modèle
 * d'éclairage ajoute (ombrage de sphère et vernis sur sclère / iris, ombre portée des paupières, vignettage d'orbite, ombre du pli, flou des reflets)
 * et ramène à une couleur unie les paramètres qui produisent un dégradé (fibres, anneau limbique, lueur, détail d'iris, humidité, apparence, dégradés
 * de couches d'iris, de liner, de cils, bord de pupille). Les COULEURS choisies par l'auteur restent : un iris en deux tons nets est un iris plat.
 *
 * Fonction pure : `resolveEye` l'applique AVANT tout (le rendu et `verifyEye` lisent donc le même œil), et le rendu lit `eye.finish` pour les
 * ombrages qui ne passent pas par un paramètre (voir `isFlat`).
 */
export const isFlat = (eye: Pick<EyeSpec, 'finish'>): boolean => eye.finish === 'flat';

const solid = (color: string): { type: 'solid'; color: string } => ({ type: 'solid', color });

export function flattenEye(eye: EyeSpec): EyeSpec {
  if (!isFlat(eye)) return eye;
  const flatLayers = eye.iris.layers.map((l) => ({ ...l, color2: null, gradient: 'none' as const, feather: 0, glow: 0 }));
  const lids = eye.lids;
  return {
    ...eye,
    appearance: null,
    microdetail: null,
    iris: {
      ...eye.iris,
      fibers: 0,
      limbalRing: 0,
      glow: null,
      detail: null,
      layers: flatLayers,
      material: { ...eye.iris.material, base: solid(dominantColor(eye.iris.material.base)), metallic: 0, clearcoat: 0, roughness: 1, emission: undefined },
    },
    eyebrow: eye.eyebrow ? { ...eye.eyebrow, hairs: 0 } : null,
    pupil: { ...eye.pupil, edge: { ...eye.pupil.edge, softness: 0, tint: null } },
    canthi: { ...eye.canthi, inner: { ...eye.canthi.inner, caruncle: 0 } },
    lids: {
      ...lids,
      waterline: 0,
      liner: lids.liner ? { ...lids.liner, tipColor: null, gloss: 0, opacity: 1 } : null,
    },
    lashes: {
      ...eye.lashes,
      upper: { ...eye.lashes.upper, opacity: 1, gloss: 0, colorVariation: 0 },
      lower: { ...eye.lashes.lower, opacity: 1, gloss: 0, colorVariation: 0 },
    },
  };
}

/**
 * Surface d'un seul aplat (ou du dégradé de couleur choisi par l'auteur), SANS ombrage diffus, environnement de métal, spéculaire ni vernis :
 * remplace `compileSurface` quand l'œil est `flat`.
 */
export function flatSurface(id: string, surface: Surface, base: Parameters<typeof gradientDef>[1]): CompiledSurface {
  const grad = gradientDef(`${id}-base`, base);
  return { defs: grad ? [grad] : [], markup: surface.draw({ fill: grad ? urlRef(`${id}-base`) : dominantColor(base) }) };
}

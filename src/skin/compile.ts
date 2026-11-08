import { outlinePath, type FaceLandmarks, type SkinRegions } from '../face';
import type { ResolvedAppearance } from '../appearance';
import type { LightVector } from '../lighting/light';
import type { FaceLighting, SkinMaterial } from '../schema';
import { baseLayer, clipDef, formLayer, fresnelLayer, poreLayer, spotLayers, terminatorLayers, wrapSkin, type SkinSurface } from './layers';
import { skinShading } from './shading';
import { compileZones } from './zones';

export interface CompiledSkin {
  readonly defs: string[];
  /** Calque unique de la peau (base + ombrage + reflets + zones + grain), découpé au contour de la tête. */
  readonly markup: string;
}

/**
 * Compile le matériau de peau sur la TÊTE : assemble les couches partagées (`layers.ts`) sur le contour de la tête. Le cou assemble les MÊMES couches
 * (`render/neck/skin.ts`) sur son propre contour : un seul modèle d'éclairage de la peau. Ordre : base → forme → terminateur (+ atténuation) →
 * zones (front, nez, joues, épaules) → reflets par région → Fresnel → pores (régions de la tête ; le cou a les siens) → effets de l'apparence.
 * Le matériau ne contient aucune coordonnée : `regions` (géométrie) et `L` (éclairage) arrivent en paramètres.
 */
export function compileSkin(id: string, lm: FaceLandmarks, mat: SkinMaterial, ra: ResolvedAppearance, L: LightVector, regions: SkinRegions, zones: FaceLighting['zones']): CompiledSkin {
  const { W, H } = lm;
  const s: SkinSurface = { d: outlinePath(lm.outline), w: W, h: H, top: -H / 2, bottom: lm.chinY, unit: W / 300 };
  const sh = skinShading(mat, L, regions, ra, ra.base);
  const parts = [baseLayer(id, s, ra), formLayer(id, s, sh, L, ra), terminatorLayers(id, s, sh, L)];
  const z = compileZones(id, lm, regions, zones, L, ra, sh.dir);
  parts.push({ defs: z.defs, layers: z.markup }, spotLayers(id, sh), fresnelLayer(id, s, sh), poreLayer(id, s, mat, ra, regions, (rid) => rid !== 'neck'));
  return wrapSkin(id, s, ra, [clipDef(id, s), ...parts.flatMap((p) => p.defs)], parts.flatMap((p) => p.layers));
}

/**
 * Matériau de peau (contrat : `schema/skin-material.ts`, doc : `docs/SKIN-LIGHT.md`).
 *   skinShading(mat, L, regions, ra, base) → description numérique (testable) ;
 *   compileSkin(id, lm, mat, ra, L, regions, zones) → SVG de la peau de la tête.
 */
export { skinShading, terminatorPosition, terminatorColorAt, type SkinShading, type SpecSpot, type ShadeStop } from './shading';
export { compileSkin, type CompiledSkin } from './compile';
export { compileZones } from './zones';
export { baseLayer, formLayer, terminatorLayer, falloffLayer, terminatorLayers, spotLayers, fresnelLayer, poreLayer, wrapSkin, clipDef, type SkinSurface, type Layers } from './layers';

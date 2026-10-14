/** Barrel du système de matériaux : c'est le seul point d'entrée que les consommateurs utilisent. */
export { SHADING } from './shading';
export { gradientStop, dominantColor, edgeColor, spotGradient, type BBox, type Surface, type CompiledSurface } from './surface';
export { specularLayers, compileGloss } from './specular';
export { compileSurface, gradientDef } from './compile-surface';
export { PRESET_NAMES, PRESET_PARAMS, resolvePreset, type PresetName } from './presets';

/**
 * Barrel du schéma : c'est le seul point d'entrée que les consommateurs (rendu, tests, index public)
 * utilisent — `import { EyeSpec } from '../schema'`. Chaque domaine (forme, iris, sourcil, hôte…)
 * vit dans son propre fichier ; ce fichier ne fait que les assembler et les republier.
 */
export { Hex, Slug } from './primitives';
export { ColorSource, MaterialDescriptor, PresetRef, MaterialRef } from './color-material';
export { LightSpec, Transform } from './light-transform';
export { HostSpec } from './host';
export { FaceParams, FaceNose, FaceMouth, FaceEars, type FaceParamsInput } from './face';
export { Lids, Liner } from './eye-lids';
export { Lashes, LashesUpper, LashesLower } from './eye-lashes';
export { CompoundEyeSpec } from './compound-eye';
export { GemEyeSpec } from './gem-eye';
export { EyeArchetype, type EyeArchetypeName } from './eye-archetype';
export { HeadTurn } from './eye-head-turn';
export { EyeSpec } from './eye';
export { PanelSpec } from './panel';
export { RobotEyeSpec } from './robot';
export { SceneSpec, type SceneInput } from './scene';

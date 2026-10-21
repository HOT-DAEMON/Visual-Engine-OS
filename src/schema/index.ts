/**
 * Barrel du schéma : c'est le seul point d'entrée que les consommateurs (rendu, tests, index public)
 * utilisent — `import { EyeSpec } from '../schema'`. Chaque domaine (forme, iris, sourcil, hôte…)
 * vit dans son propre fichier ; ce fichier ne fait que les assembler et les republier.
 */
export { Hex, Slug } from './primitives';
export { ColorSource, MaterialDescriptor, PresetRef, MaterialRef } from './color-material';
export { LightSpec, LightInfluence, Transform } from './light-transform';
export { HostSpec } from './host';
export { FaceParams, FaceMouth, FaceEars, type FaceParamsInput } from './face';
export { FaceNose, NoseRoot, NoseDorsum, NoseTip, NoseAlae, NoseNostrils, NoseJunction, DORSUM_SHAPES, type FaceNoseInput } from './face-nose';
export { FaceChin, FaceJaw, SYMPHYSIS_SHAPES } from './face-jaw';
export { NoseSidewall, NoseDomes, NoseGroove, NoseBase, NoseColumella, NosePhiltrum } from './face-nose-regions';
export { FaceMandible, FaceSoftTissue, FaceCheek, SoftMasseter } from './face-structure';
export { FaceDeform, DeformArticulation, DeformExpression } from './face-deform';
export { FaceStylization, FaceRenderMode, RENDER_MODES } from './face-style';
export { SkinMaterial, SkinRoughness, SkinSpecular, SkinSubsurface, SKIN_MODELS, SKIN_REGIONS, type SkinRegionId, type SkinMaterialInput } from './skin-material';
export { FaceLighting, FaceRims, FaceContacts, LightZones, RimSpec, ContactSpec, RIM_SIDES, RIM_COMPONENTS, CONTACT_COMPONENTS, type RimComponent, type ContactComponent, type FaceLightingInput } from './face-lighting';
export { FaceNeck, FaceHair, FaceFacialHair, FaceAsymmetry, HAIR_STYLES, HAIR_FRINGES, HAIR_TEXTURES, HAIR_TEXTURE_CHOICES, HAIRLINES, MUSTACHES, BEARDS, SIDEBURNS } from './face-extras';
export { HairTie, HairBraids, type HairStyle, type HairTexture, type HairTextureChoice, type HairlineShape } from './hair-system';
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
export { Appearance, AppearanceLight, AppearanceShading, AppearanceStop, AppearanceTexture, TEXTURE_KINDS, SHADING_MODES, type AppearanceInput } from './appearance';
export { FLOW_MODES, FRINGE_ENGINES, EAR_BEHAVIORS, CHEEK_LOCKS, HairFlow, HairSilhouette, HairFringeEngine, HairRootLift, HairSide, HairSides, HairOcclusion, HairTiers, HairTips, HairStrands, HairTextureMix, HairLook } from './hair-v2';

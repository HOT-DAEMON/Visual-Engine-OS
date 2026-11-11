export { lightModelOf, lightModelOfSpec, shadeAt, bounceAt, tonesOf, type LightModel, type LitStyle, type ShadowHue, type Gobo, type Shade, type Tones, type ModelOpts, type LitSpecLike } from './model';
export { castShadow, castShadowScaled, ambientOcclusion, type CastOpts } from './cast';
export { REGION, REGION_NAMES, gridOf, normalsOf, type ReliefField, type Grid } from './field';
export { headRelief, headGrid } from './head';
export { headLit, type HeadLit, type HeadLitOpts } from './overlay';
export { litHead, litFigure, hostFace, neckAxisZ, type LitFigure, type HostFace } from './figure';
export { LIGHT_PATTERNS, patternById, goboAt, type LightPattern } from './patterns';
export { toLab, labRgb, lch, labToward, deltaL, type Lab } from './oklab';

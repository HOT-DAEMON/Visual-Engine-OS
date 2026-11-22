import { mulberry32 } from '../../src/core/prng';
import { applyIrisPreset, extra2Recipes, generateExtra2Eye } from '../../src/generation/eye-gallery-ext2';
import { PHOTO2_IRIS_FAMILIES, photoIrisFamily2 } from '../../src/generation/eye-iris-families-photo2';

/** Œil de base (almond, sans famille) + famille d'iris photo 2 : l'œil qu'utilisent le calibrage, les artefacts et les tests de la passe 13. */
const rc2 = extra2Recipes(); const baseIdx = rc2.findIndex((r) => r.style === 'almond' && r.irisFamily === null);
export const famEye = (f: (typeof PHOTO2_IRIS_FAMILIES)[number]): Record<string, unknown> => { const i = PHOTO2_IRIS_FAMILIES.indexOf(f); return applyIrisPreset(generateExtra2Eye(baseIdx) as never, photoIrisFamily2(f, mulberry32(7 + i)), 'almond', false) as Record<string, unknown>; };

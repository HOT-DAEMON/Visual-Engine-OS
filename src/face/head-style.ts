import type { FaceParams } from '../schema';

/**
 * Le visage est-il dessiné en CEL (aplats à bords nets) ? Source unique : la peau, le cou, le corps (`render/face/face.ts` → `skinAppearance`), le tirage du fini des
 * yeux (`generateRandomFace`, option `eyeFinish`) et la vérification de la paire d'yeux (`eyes-finish-matches-head`) lisent TOUS cette définition.
 * `renderMode: 'anime'` force le cel ; sinon c'est le mode d'ombrage demandé à la peau (`skin.shading.mode`).
 */
export const faceIsCel = (params: Pick<FaceParams, 'renderMode' | 'skin'>): boolean => params.renderMode === 'anime' || params.skin.shading.mode === 'cel';

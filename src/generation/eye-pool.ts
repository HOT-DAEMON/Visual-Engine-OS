import { EXTRA_EYE_COUNT, generateExtraEye } from './eye-gallery-ext';
import { EXTRA2_COUNT, generateExtra2Eye } from './eye-gallery-ext2';
import { generateRandomEye } from './random-eye';
import type { EyeInput } from './random-eye-helpers';

/**
 * Le « vivier » d'yeux des galeries : les 48 identités de scripts/gallery.ts, gallery-pairs.ts et
 * gallery-variants.ts (mêmes seeds `1000 + i × 101`, expression neutre). Les galeries d'expressions et
 * de rotations de tête (`examples/gallery-expr-*.json`, `gallery-head-*.json`) sont ces MÊMES identités
 * avec un réglage commun surchargé : `galleryPair(i, expression)` en est l'équivalent exact.
 */
export const GALLERY_IDENTITIES = 48;
export const galleryEyeSeed = (i: number): number => 1000 + i * 101;

function assertIndex(i: number): void {
  if (!Number.isInteger(i) || i < 0 || i >= GALLERY_IDENTITIES) throw new RangeError(`identité de galerie hors [0, ${GALLERY_IDENTITIES - 1}] : ${i}`);
}

/** L'œil de référence de l'identité `i` (neutre par défaut), tel que les galeries le tirent. */
export function galleryEye(i: number, expression: EyeInput['expression'] = { kind: 'neutral', intensity: 1 }): EyeInput {
  assertIndex(i);
  return generateRandomEye(galleryEyeSeed(i), { expression });
}

/** Paire œil gauche / œil droit de l'identité `i` : même œil, `outerSide` imposé (vrai miroir). */
export function galleryPair(i: number, expression?: EyeInput['expression']): { left: EyeInput; right: EyeInput } {
  const eye = galleryEye(i, expression);
  return { left: { ...eye, shape: { ...eye.shape, outerSide: 'left' } }, right: { ...eye, shape: { ...eye.shape, outerSide: 'right' } } };
}

/** Identités de la galerie ÉTENDUE : les 48 d'origine (0–47) puis les 100 formes de `eye-gallery-ext` (48–147). */
export const EXTENDED_IDENTITIES = GALLERY_IDENTITIES + EXTRA_EYE_COUNT;

/** Paire gauche / droite de l'identité étendue `i` (0–147) ; mêmes règles de miroir que `galleryPair`. */
export function extendedPair(i: number, expression?: EyeInput['expression']): { left: EyeInput; right: EyeInput } {
  if (!Number.isInteger(i) || i < 0 || i >= EXTENDED_IDENTITIES) throw new RangeError(`identité étendue hors [0, ${EXTENDED_IDENTITIES - 1}] : ${i}`);
  if (i < GALLERY_IDENTITIES) return galleryPair(i, expression);
  const eye = generateExtraEye(i - GALLERY_IDENTITIES, expression);
  return { left: { ...eye, shape: { ...eye.shape, outerSide: 'left' } }, right: { ...eye, shape: { ...eye.shape, outerSide: 'right' } } };
}

/** Identités de la galerie ÉTENDUE 2 (passe 9) : les 148 précédentes (0–147) puis les 100 formes de `eye-gallery-ext2` (148–247). `eyeSource: 'extended'` garde ses 148 identités et ses tirages. */
export const EXTENDED2_IDENTITIES = EXTENDED_IDENTITIES + EXTRA2_COUNT;

/** Paire gauche / droite de l'identité `i` (0–247) ; mêmes règles de miroir que `extendedPair`. */
export function extended2Pair(i: number, expression?: EyeInput['expression']): { left: EyeInput; right: EyeInput } {
  if (!Number.isInteger(i) || i < 0 || i >= EXTENDED2_IDENTITIES) throw new RangeError(`identité étendue 2 hors [0, ${EXTENDED2_IDENTITIES - 1}] : ${i}`);
  if (i < EXTENDED_IDENTITIES) return extendedPair(i, expression);
  const eye = generateExtra2Eye(i - EXTENDED_IDENTITIES, expression);
  return { left: { ...eye, shape: { ...eye.shape, outerSide: 'left' } }, right: { ...eye, shape: { ...eye.shape, outerSide: 'right' } } };
}

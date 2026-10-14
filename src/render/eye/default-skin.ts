import type { MaterialDescriptor } from '../../schema';

/** Peau claire utilisée quand l'œil n'est ni sur un hôte ni muni d'un `skin` explicite. */
export const DEFAULT_SKIN: MaterialDescriptor = {
  base: { type: 'solid', color: '#eec9ad' },
  metallic: 0,
  roughness: 0.85,
  clearcoat: 0,
  opacity: 1,
};

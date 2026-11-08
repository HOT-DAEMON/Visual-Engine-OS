import type { HairStyle } from '../../schema';

type Style = Exclude<HairStyle, 'bald'>;

/**
 * VOCABULAIRE DE FORMES par coiffure (`docs/HAIR-VOCAB.md`) : quelles formes libres une coiffure peut porter. Un épi rigide (cône) est une mèche figée :
 * lisible sur une coupe courte, en pointes ou en volume, absurde au sommet de cheveux pendants (`bob`, `long`) ou tirés vers une attache, où les cônes
 * formaient une couronne de dents (mesuré : 100-130 cônes sur 40 visages `bob` / `long`). Source unique : construction ET vérification (`style-vocabulary`).
 */
export const VOCAB: Readonly<Record<Style, { readonly cones: boolean }>> = {
  buzz: { cones: false },
  short: { cones: true },
  spiky: { cones: true },
  curly: { cones: true },
  afro: { cones: true },
  bob: { cones: false },
  long: { cones: false },
  ponytail: { cones: false },
  bun: { cones: false },
  braids: { cones: false },
};

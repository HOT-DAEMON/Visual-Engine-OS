import { z } from 'zod';

const Signed = z.number().min(-1).max(1);
const Unit = z.number().min(0).max(1);
/**
 * PARAMÈTRES 3D (en plus de `BodyParams`, dont ils ne dupliquent RIEN : âge, sexe, adiposité, musculature, charpente, poses des bras restent là-bas).
 * Chaque axe est indépendant. Les angles de courbure sont des ÉCARTS au canon (±1 ≈ ±30 % de la flèche) ; ils ne sont pas couplés entre eux.
 */
export const VolumeParams = z.object({
  /** Courbures vertébrales : cervicale (lordose), dorsale (cyphose), lombaire (lordose). */
  spine: z.object({ cervical: Signed.default(0), thoracic: Signed.default(0), lumbar: Signed.default(0) }).strict().default({}),
  /** Contrapposto : 0 = symétrique ; 1 = marqué. `side` = jambe porteuse (+1 gauche du corps, −1 droite). Épaules et bassin basculent en sens opposés. */
  contrapposto: z.object({ amount: Unit.default(0.3), side: Signed.default(1), twist: Signed.default(0.2) }).strict().default({}),
  /** Saillie du ventre (0 plat … 1 ventre marqué), additive à l'effet de l'adiposité ; profondeur du thorax (±) ; projection des seins vient de `BodyParams.breast`. */
  torso: z.object({ belly: Unit.default(0), thoraxDepth: Signed.default(0), glute: Signed.default(0) }).strict().default({}),
  /** Balancement des bras (°, + = vers l'avant) : un par côté ; indépendants (marche = signes opposés). */
  swing: z.object({ left: z.number().min(-35).max(45).default(6), right: z.number().min(-35).max(45).default(-4) }).strict().default({}),
  /** Doigts relâchés : 0 = identiques, 1 = longueurs/orientations/flexions très variées (déterministe par `seed`). */
  fingerRelax: Unit.default(0.6),
  seed: z.number().int().default(7),
}).strict();
export type VolumeParams = z.infer<typeof VolumeParams>;
export type VolumeInput = z.input<typeof VolumeParams>;

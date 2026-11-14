import type { VaultViewId } from '../../src/head-turntable/vault-lab';
import type { SkullParams } from '../../src/skull/types';

/** Familles de crânes : COMBINAISONS de mesures indépendantes (valeurs ABSOLUES des paramètres de `SkullParams`), jamais des modèles prédéfinis. */
export const FAMILIES: readonly { id: string; label: string; ov: Partial<SkullParams> }[] = [
  { id: 'dolichocephale', label: 'Dolichocéphale : long, étroit, occiput plein', ov: { length: 1, cranialBreadth: -0.6, occipitalFlat: -0.5, frontalBreadth: -0.4 } },
  { id: 'mesocephale', label: 'Mésocéphale : proportions intermédiaires (nominal)', ov: {} },
  { id: 'brachycephale', label: 'Brachycéphale : court, large, occiput plat', ov: { length: -1, cranialBreadth: 0.7, occipitalFlat: 1, templeBreadth: 0.4 } },
  { id: 'haut', label: 'Crâne haut, sommet bombé', ov: { vaultHeight: 1, parietalFlat: -0.4 } },
  { id: 'bas', label: 'Crâne bas, sommet aplati', ov: { vaultHeight: 0, parietalFlat: 0.7 } },
  { id: 'occiput-plat', label: 'Occiput aplati et incliné', ov: { occipitalFlat: 1, occipitalSlope: 0.7 } },
  { id: 'occiput-proeminent', label: 'Occiput proéminent, en surplomb', ov: { occipitalFlat: -1, occipitalSlope: -0.8, occiput: 1, inion: 1 } },
  { id: 'front-large', label: 'Front large et plat', ov: { frontalBreadth: 1, frontalFlat: 0.8 } },
  { id: 'front-etroit', label: 'Front étroit et bombé', ov: { frontalBreadth: -1, frontalFlat: -0.8, frontalBulge: 1 } },
  { id: 'parietaux-bombes', label: 'Bombements pariétaux marqués', ov: { parietalBulge: 1, parietalConvexity: 1 } },
  { id: 'plans-lateraux-plats', label: 'Plans latéraux aplatis, transitions anguleuses', ov: { temporalFlat: 1, parietalConvexity: -1, planeTransition: -1 } },
  { id: 'asymetrique', label: 'Asymétrique (visage inchangé)', ov: { asymParietal: 0.8, asymOccipital: 1, asymFrontal: 0.8, asymWidth: 0.6, asymFaceCoupling: 0 } },
  { id: 'robuste', label: 'Robuste : reliefs osseux marqués', ov: { mastoid: 1, nuchalLine: 1, glabella: 1, temporalHollow: 0.6, boneShow: 1 } },
];
/** Interactions : deux paramètres, trois valeurs chacun (lignes × colonnes), vue la plus parlante ; `base` commun. */
export const PAIRS: readonly { a: string; b: string; va: number[]; vb: number[]; view: VaultViewId; base: Partial<SkullParams>; note: string }[] = [
  { a: 'cranialBreadth', b: 'vaultHeight', va: [-1, 0, 1], vb: [0.05, 0.5, 0.95], view: 'face', base: {}, note: 'largeur × hauteur de voûte' },
  { a: 'length', b: 'cranialBreadth', va: [-1, 0, 1], vb: [-1, 0, 1], view: 'dessus', base: {}, note: 'longueur × largeur : brachy / méso / dolichocéphale' },
  { a: 'frontalFlat', b: 'frontalBreadth', va: [-1, 0, 1], vb: [-1, 0, 1], view: 'dessus', base: {}, note: 'front plat × large' },
  { a: 'occipitalFlat', b: 'occipitalSlope', va: [-1, 0, 1], vb: [-1, 0, 1], view: 'profil', base: {}, note: 'occiput plat × incliné' },
  { a: 'temporalHollow', b: 'templeBreadth', va: [-1, 0, 1], vb: [-1, 0, 1], view: 'trois_quarts', base: {}, note: 'creux temporal × tempes (coin contraint)' },
  { a: 'parietalBulge', b: 'parietalFlat', va: [-1, 0, 1], vb: [-1, 0, 1], view: 'trois_quarts_arriere', base: {}, note: 'bosses × sommet plat' },
  { a: 'mastoid', b: 'scalp', va: [-1, 0, 1], vb: [0.05, 0.5, 0.95], view: 'trois_quarts_arriere', base: { nuchalLine: 1 } , note: 'mastoïde × épaisseur du cuir chevelu' },
  { a: 'asymParietal', b: 'asymOccipital', va: [-1, 0, 1], vb: [-1, 0, 1], view: 'dessus', base: { asymFaceCoupling: 0 }, note: 'asymétries propres croisées' },
];

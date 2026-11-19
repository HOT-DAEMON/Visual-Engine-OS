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
  // Passe 2 (docs/SKULL-VAULT-2.md) : toujours des COMBINAISONS de mesures indépendantes.
  { id: 'arcade-torus', label: 'Arcade en torus : bourrelet sus-orbitaire, front sans bosses', ov: { browArch: 1, glabella: 0.7, frontalEminence: -0.8, metopicRidge: -0.3, temporalLine: 0.6 } },
  { id: 'front-bosses', label: 'Front à bosses : éminences marquées, arcades effacées', ov: { frontalEminence: 1, browArch: -1, metopicRidge: 0.5, glabella: -0.5 } },
  { id: 'dolicho-chignon', label: 'Dolichocéphale à chignon occipital', ov: { length: 1, cranialBreadth: -0.5, occipitalFlat: -0.6, occipitalBun: 1, inionSize: 0.7 } },
  { id: 'muscle-temporal', label: 'Muscle temporal puissant, crête temporale marquée', ov: { temporalMuscle: 1, temporalLine: 0.8, templeBreadth: 0.3, mastoid: 0.6 } },
  { id: 'asym-fine', label: 'Asymétries fines : mastoïdes, pariétaux, astérion (visage inchangé)', ov: { asymMastoid: 1, asymParietalHeight: 1, parietalBulge: 0.8, asterion: 0.7, mastoid: 0.5, asymFaceCoupling: 0 } },
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
  // Passe 2
  { a: 'browArch', b: 'glabella', va: [-1, 0, 1], vb: [-1, 0, 1], view: 'trois_quarts', base: {}, note: 'arcade × glabelle : un seul bourrelet (fusion douce)' },
  { a: 'frontalEminence', b: 'browArch', va: [-1, 0, 1], vb: [-1, 0, 1], view: 'trois_quarts', base: {}, note: 'bosses frontales × arcades (juvénile ↔ robuste)' },
  { a: 'occipitalBun', b: 'occipitalFlat', va: [-1, 0, 1], vb: [-1, 0, 1], view: 'profil', base: {}, note: 'chignon × aplatissement occipital' },
  { a: 'temporalMuscle', b: 'temporalLine', va: [-1, 0, 1], vb: [-1, 0, 1], view: 'trois_quarts', base: {}, note: 'volume du muscle × crête temporale' },
  { a: 'browArch', b: 'browRidge', va: [0, 0.5, 1], vb: [0, 0.5, 1], view: 'profil', base: {}, note: 'arcade × `browRidge` existant : le paramètre existant échelonne l\'arcade' },
];

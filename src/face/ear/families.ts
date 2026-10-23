import type { EarExtensionKind, EarFamily, EarMaterialKind } from '../../schema/face-ear';
import type { FlatMorph, StructureId } from './types';

/**
 * PROFILS D'ESPÈCE (§9). Un profil n'est PAS une loi du moteur (« les oreilles d'elfe sont longues ») : c'est un préréglage de départ qui déclare
 *   - les structures obligatoires, optionnelles, interdites ;   - le rapport largeur/hauteur et les déviations morphologiques de la famille ;
 *   - les plages admises (au-delà : bornées, sauf exagération artistique) ;   - les matériaux et extensions compatibles ;   - la règle de symétrie.
 * Les familles se MÉLANGENT (`blend`) : les déviations et le rapport sont moyennés au poids, la présence d'une structure est majoritaire (≥ 0,5).
 */
export interface FamilyProfile {
  readonly id: EarFamily;
  readonly widthRatio: number;
  readonly morph: FlatMorph;
  readonly required: readonly StructureId[];
  readonly forbidden: readonly StructureId[];
  readonly ranges: Readonly<Record<string, readonly [number, number]>>;
  readonly materials: readonly EarMaterialKind[];
  readonly defaultMaterial: EarMaterialKind;
  readonly extensions: readonly EarExtensionKind[];
  /** `mirror` : gauche = miroir de droite (+ asymétrie contrôlée) ; `free` : chaque oreille tirée indépendamment. */
  readonly symmetry: 'mirror' | 'free';
}

const CORE: StructureId[] = ['helix', 'cymba', 'cavum', 'canal'];
const ALL_EXT: EarExtensionKind[] = ['terminal_tip', 'secondary_ridge', 'branching_ridge', 'membrane_panel', 'ornamental_growth', 'bioluminescent_channel'];

export const FAMILIES: Readonly<Record<EarFamily, FamilyProfile>> = {
  human: { id: 'human', widthRatio: 0.56, morph: {}, required: ['helix', 'antihelix', 'scapha', 'fossa', 'cymba', 'cavum', 'tragus', 'antitragus', 'lobule', 'canal', 'crus'], forbidden: [], ranges: { 'pole.tip': [-1, 0.3], 'pole.height': [-0.6, 0.45], 'lobule.length': [-1, 1] }, materials: ['skin', 'cartilage', 'ceramic'], defaultMaterial: 'skin', extensions: ['terminal_tip', 'bioluminescent_channel'], symmetry: 'mirror' },
  feline: { id: 'feline', widthRatio: 0.82, morph: { 'pole.height': 0.45, 'pole.round': -0.75, 'pole.tip': 0.3, 'lobule.length': -1, 'tragus.size': -0.4, 'concha.depth': 0.6, 'antihelix.relief': -0.5, 'helix.thickness': -0.4, 'posterior.convexity': -0.35, 'notch.depth': -0.3 }, required: CORE, forbidden: ['lobule', 'fossa'], ranges: { 'pole.round': [-1, 0] }, materials: ['skin', 'cartilage', 'hybrid'], defaultMaterial: 'cartilage', extensions: ['terminal_tip', 'secondary_ridge'], symmetry: 'mirror' },
  canid: { id: 'canid', widthRatio: 0.7, morph: { 'pole.height': 0.3, 'pole.round': 0.2, 'pole.lean': 0.3, 'pole.tip': 0.15, 'lobule.length': -1, 'concha.depth': 0.4, 'helix.thickness': -0.2, 'antihelix.relief': -0.4 }, required: CORE, forbidden: ['lobule', 'fossa'], ranges: {}, materials: ['skin', 'cartilage'], defaultMaterial: 'cartilage', extensions: ['terminal_tip', 'secondary_ridge'], symmetry: 'mirror' },
  equid: { id: 'equid', widthRatio: 0.42, morph: { 'pole.height': 0.85, 'pole.tip': 0.5, 'pole.round': -0.2, 'lobule.length': -1, 'antihelix.relief': -0.8, 'tragus.size': -0.6, 'concha.depth': 0.3, 'helix.thickness': -0.5 }, required: CORE, forbidden: ['lobule', 'fossa', 'antitragus'], ranges: {}, materials: ['skin', 'cartilage'], defaultMaterial: 'cartilage', extensions: ['terminal_tip'], symmetry: 'mirror' },
  elven: { id: 'elven', widthRatio: 0.5, morph: { 'pole.height': 0.35, 'pole.lean': 0.55, 'pole.tip': 0.85, 'lobule.length': -0.2, 'antihelix.relief': 0.3, 'helix.thickness': -0.3 }, required: ['helix', 'antihelix', 'scapha', 'cymba', 'cavum', 'canal', 'tragus', 'crus'], forbidden: [], ranges: { 'pole.tip': [0, 1] }, materials: ['skin', 'cartilage', 'crystal', 'ceramic'], defaultMaterial: 'skin', extensions: ['terminal_tip', 'secondary_ridge', 'bioluminescent_channel'], symmetry: 'mirror' },
  draconic: { id: 'draconic', widthRatio: 0.75, morph: { 'pole.height': 0.5, 'pole.round': -0.5, 'pole.tip': 0.5, 'lobule.length': -1, 'helix.thickness': 0.4, 'antihelix.relief': 0.5, 'concha.depth': 0.4 }, required: CORE, forbidden: ['lobule', 'tragus', 'antitragus'], ranges: {}, materials: ['scaly', 'membrane', 'hybrid', 'ceramic'], defaultMaterial: 'scaly', extensions: ALL_EXT, symmetry: 'mirror' },
  alien: { id: 'alien', widthRatio: 0.6, morph: { 'pole.height': 0.2, 'antihelix.upperLength': 0.5, 'antihelix.branchAngle': 0.6, 'concha.cymba': 0.5 }, required: ['canal'], forbidden: [], ranges: {}, materials: ['skin', 'cartilage', 'scaly', 'membrane', 'ceramic', 'crystal', 'hybrid'], defaultMaterial: 'hybrid', extensions: ALL_EXT, symmetry: 'free' },
};

/** Familles triées (ordre fixe) : le mélange est déterministe quelle que soit l'ordre des clés d'entrée. */
export const FAMILY_ORDER: readonly EarFamily[] = ['human', 'feline', 'canid', 'equid', 'elven', 'draconic', 'alien'];

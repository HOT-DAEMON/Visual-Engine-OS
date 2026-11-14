import { ancestors } from '../anatomy/components';
import { N, type VaultNeighbors, type VaultStructure } from './vault-registry-types';
import { LINE_STRUCTURES } from './vault-registry-lines';

/**
 * REGISTRE ANATOMIQUE DE LA VOÛTE CRÂNIENNE : une entrée par structure (os, régions, repères) avec identifiant canonique, voisinage, tissus (par région), position,
 * paramètres, influence sur la géométrie externe et vues de preuve. Les sutures et lignes sont dans `vault-registry-lines.ts`. Les parents (direct et lointains) viennent de
 * `src/anatomy/components.ts` (`lineage`) ; la visibilité par caméra et l'occlusion sont CALCULÉES sur le rendu (`head-turntable/vault-visibility.ts`), jamais déclarées.
 * Tous les os et régions sont visibles par défaut ; un paramètre à 0 laisse la structure à son modelé nominal.
 */
const mat = { inherits: 'cranium' } as const;
export const BONES: readonly VaultStructure[] = [
  { id: 'cranial-vault', fr: 'Voûte crânienne (ensemble)', latin: 'calvaria', kind: 'region', region: 'parietal',
    neighbors: N({ superior: [], inferior: ['face', 'neck'], medial: ['cranial-cavity'], lateral: ['ear'], posterior: [], anterior: ['face'] }),
    anchor: { yU: 0.3, az: 90, side: 1 },
    params: ['cranialBreadth', 'asymWidth', 'asymParietal', 'asymOccipital', 'asymFrontal', 'asymFaceCoupling', 'boneShow', 'length', 'scalp'],
    influence: { fields: ['a', 'relief'], yBand: [0.01, 0.72], azBand: [0, 180], views: ['face', 'dos', 'dessus'] }, visibleByDefault: true, material: mat },
  { id: 'frontal-bone', fr: 'Os frontal', latin: 'os frontale', kind: 'bone', region: 'frontal',
    neighbors: N({ superior: ['parietal-bone'], inferior: ['orbit', 'glabella'], medial: ['glabella'], lateral: ['pterion', 'temporal-bone'], posterior: ['parietal-bone'], anterior: [] }),
    anchor: { from: 'bregma', to: 'glabella', t: 0.55, az: 0, side: 0 },
    params: ['foreheadSlope', 'frontalBulge', 'frontalFlat', 'frontalBreadth'],
    influence: { fields: ['zf', 'pf', 'qf', 'relief'], yBand: [0.04, 0.4], azBand: [0, 75], views: ['profil', 'trois_quarts', 'dessus'] }, visibleByDefault: true, material: mat },
  { id: 'parietal-bone', fr: 'Os pariétal', latin: 'os parietale', kind: 'bone', region: 'parietal',
    neighbors: N({ superior: ['vertex'], inferior: ['temporal-bone'], medial: ['sagittal-suture'], lateral: ['temporal-bone'], posterior: ['occipital-bone'], anterior: ['frontal-bone'] }),
    anchor: { yU: 0.24, az: 112, side: 1 },
    params: ['parietalBulge', 'parietalFlat', 'parietalConvexity', 'vaultPeak'],
    influence: { fields: ['a', 'zf', 'zb', 'qf', 'qb', 'relief'], yBand: [0.0, 0.5], azBand: [60, 160], views: ['trois_quarts_arriere', 'dos', 'face', 'profil'] }, visibleByDefault: true, material: mat },
  { id: 'temporal-bone', fr: 'Os temporal (écaille)', latin: 'squama temporalis', kind: 'bone', region: 'temporal',
    neighbors: N({ superior: ['parietal-bone'], inferior: ['ear', 'mastoid-process'], medial: ['cranial-cavity'], lateral: [], posterior: ['mastoid-process', 'occipital-bone'], anterior: ['frontal-bone'] }),
    anchor: { from: 'pterion', dy: 0.03, az: 72, side: 1 },
    params: ['temporalFlat', 'templeBreadth', 'temporalHollow'],
    influence: { fields: ['a', 'qf', 'qb', 'relief'], yBand: [0.25, 0.6], azBand: [50, 110], views: ['face', 'profil', 'trois_quarts'] }, visibleByDefault: true, material: mat },
  { id: 'occipital-bone', fr: 'Os occipital', latin: 'os occipitale', kind: 'bone', region: 'occipital',
    neighbors: N({ superior: ['parietal-bone'], inferior: ['neck', 'nuchal-line'], medial: ['cranial-cavity'], lateral: ['temporal-bone', 'mastoid-process'], posterior: [], anterior: ['parietal-bone'] }),
    anchor: { from: 'opisthocranion', az: 180, side: 0 },
    params: ['occipitalFlat', 'occipitalSlope', 'occiput', 'inion', 'nuchalLine'],
    influence: { fields: ['zb', 'pb', 'qb', 'relief'], yBand: [0.12, 0.7], azBand: [110, 180], views: ['profil', 'dos', 'trois_quarts_arriere', 'dessus'] }, visibleByDefault: true, material: mat },
  { id: 'mastoid-process', fr: 'Processus mastoïde (région mastoïdienne)', latin: 'processus mastoideus', kind: 'region', region: 'mastoid',
    neighbors: N({ superior: ['temporal-bone'], inferior: ['neck'], medial: ['cranial-cavity'], lateral: ['ear'], posterior: ['occipital-bone'], anterior: ['ear'] }),
    anchor: { from: 'mastoid', az: 118, side: 1 },
    params: ['mastoid'],
    influence: { fields: ['relief'], yBand: [0.45, 0.7], azBand: [100, 135], views: ['profil', 'trois_quarts_arriere'] }, visibleByDefault: true, material: mat },
  { id: 'pterion', fr: 'Ptérion (région sphéno-temporale)', latin: 'pterion', kind: 'landmark', region: 'temporal',
    neighbors: N({ superior: ['parietal-bone'], inferior: ['sphenoid-bone'], medial: ['sphenoid-bone'], lateral: ['temporal-bone'], posterior: ['temporal-bone'], anterior: ['frontal-bone'] }),
    anchor: { from: 'pterion', az: 78, side: 1 },
    params: ['planeTransition'],
    influence: { fields: ['pf', 'qf', 'qb'], yBand: [0.2, 0.5], azBand: [50, 100], views: ['trois_quarts', 'dessus'] }, visibleByDefault: true, material: mat },
  { id: 'vertex', fr: 'Vertex (sommet du crâne)', latin: 'vertex', kind: 'landmark', region: 'vertex',
    neighbors: N({ superior: [], inferior: ['parietal-bone'], medial: ['sagittal-suture'], lateral: ['parietal-bone'], posterior: ['occipital-bone'], anterior: ['frontal-bone'] }),
    anchor: { from: 'vertex', az: 0, side: 0 },
    params: ['vaultHeight', 'vaultPeak', 'parietalFlat'],
    influence: { fields: ['y', 'a', 'zf', 'zb'], yBand: [-0.1, 0.3], azBand: [0, 180], views: ['face', 'profil', 'dos'] }, visibleByDefault: true, material: mat },
  { id: 'glabella', fr: 'Glabelle', latin: 'glabella', kind: 'landmark', region: 'glabella',
    neighbors: N({ superior: ['frontal-bone'], inferior: ['nose'], medial: [], lateral: ['brow', 'orbit'], posterior: ['frontal-bone'], anterior: [] }),
    anchor: { from: 'glabella', az: 0, side: 0 },
    params: ['glabella', 'browRidge'],
    influence: { fields: ['zf', 'relief'], yBand: [0.3, 0.45], azBand: [0, 30], views: ['profil', 'trois_quarts'] }, visibleByDefault: true, material: { inherits: 'cranium', specialize: 'peau mince sur os (tissu minimal)' } },
];
const OPPOSITE: Record<keyof VaultNeighbors, keyof VaultNeighbors> = { superior: 'inferior', inferior: 'superior', medial: 'lateral', lateral: 'medial', posterior: 'anterior', anterior: 'posterior' };
/** Voisinage réciproque : si A déclare B dans une direction, B déclare A dans la direction opposée (sauf entre un composant et son ascendant, dont la relation est de contenance et non de contact). Les déclarations explicites priment. */
function reciprocal(list: readonly VaultStructure[]): VaultStructure[] {
  const add = new Map<string, Partial<Record<keyof VaultNeighbors, string[]>>>();
  for (const a of list) for (const dir of Object.keys(a.neighbors) as (keyof VaultNeighbors)[]) for (const bId of a.neighbors[dir]) {
    const b = list.find((q) => q.id === bId); if (!b || ancestors(a.id).includes(b.id) || ancestors(b.id).includes(a.id)) continue;
    const o = OPPOSITE[dir]; if (b.neighbors[o].includes(a.id)) continue;
    const m = add.get(b.id) ?? {}; (m[o] ??= []).push(a.id); add.set(b.id, m);
  }
  return list.map((s) => { const m = add.get(s.id); return m ? { ...s, neighbors: { ...s.neighbors, ...Object.fromEntries((Object.keys(m) as (keyof VaultNeighbors)[]).map((d) => [d, [...s.neighbors[d], ...m[d]!]])) } } : s; });
}
export const VAULT_STRUCTURES: readonly VaultStructure[] = reciprocal([...BONES, ...LINE_STRUCTURES]);
export const structureOf = (id: string): VaultStructure | undefined => VAULT_STRUCTURES.find((s) => s.id === id);

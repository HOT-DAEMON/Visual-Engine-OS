import { N, type VaultStructure } from './vault-registry-types';

/**
 * Sutures, lignes et crêtes de la voûte : des DONNÉES anatomiques toujours présentes dans le modèle (`vault-curves.ts` donne leurs courbes), rendues seulement en relief fin
 * lorsque `suturesShow` > 0 (sillon de suture, crête de la ligne temporale) ou en calque de contrôle des planches. Aucune n'est visible par défaut.
 */
const mat = { inherits: 'cranium', specialize: 'relief fin sous la peau (suturesShow)' } as const;
const L = (id: string, fr: string, latin: string, kind: 'suture' | 'line', anchor: VaultStructure['anchor'], neighbors: VaultStructure['neighbors'], params: readonly string[], views: VaultStructure['influence']['views'], region: VaultStructure['region'] = 'parietal'): VaultStructure =>
  ({ id, fr, latin, kind, region, neighbors, anchor, params, influence: { fields: ['relief'], yBand: [0, 0.7], azBand: [0, 180], views }, visibleByDefault: false, material: mat });

export const LINE_STRUCTURES: readonly VaultStructure[] = [
  L('coronal-suture', 'Suture coronale', 'sutura coronalis', 'suture', { from: 'bregma', to: 'pterion', t: 0.5, az: 40, side: 1 }, N({ superior: ['sagittal-suture'], inferior: ['pterion'], medial: ['sagittal-suture'], lateral: ['pterion'], posterior: ['parietal-bone'], anterior: ['frontal-bone'] }), ['suturesShow'], ['trois_quarts', 'dessus', 'profil'], 'frontal'),
  L('sagittal-suture', 'Suture sagittale', 'sutura sagittalis', 'suture', { from: 'vertex', az: 0, side: 0 }, N({ superior: [], inferior: ['cranial-cavity'], medial: [], lateral: ['parietal-bone'], posterior: ['lambdoid-suture'], anterior: ['coronal-suture'] }), ['suturesShow'], ['dessus', 'profil', 'face'], 'vertex'),
  L('lambdoid-suture', 'Suture lambdoïde', 'sutura lambdoidea', 'suture', { from: 'lambda', to: 'asterion', t: 0.5, az: 150, side: 1 }, N({ superior: ['sagittal-suture'], inferior: ['squamous-suture'], medial: ['sagittal-suture'], lateral: ['squamous-suture'], posterior: ['occipital-bone'], anterior: ['parietal-bone'] }), ['suturesShow'], ['dos', 'trois_quarts_arriere', 'dessus'], 'occipital'),
  L('squamous-suture', 'Suture squameuse', 'sutura squamosa', 'suture', { from: 'pterion', to: 'asterion', t: 0.5, az: 100, side: 1 }, N({ superior: ['parietal-bone'], inferior: ['temporal-bone'], medial: ['cranial-cavity'], lateral: ['temporal-bone'], posterior: ['lambdoid-suture'], anterior: ['pterion'] }), ['suturesShow'], ['profil', 'trois_quarts_arriere'], 'temporal'),
  L('temporal-line', 'Ligne (crête) temporale', 'linea temporalis', 'line', { from: 'glabella', dy: -0.13, az: 76, side: 1 }, N({ superior: ['parietal-bone'], inferior: ['temporal-bone'], medial: ['frontal-bone'], lateral: ['temporal-bone'], posterior: ['parietal-bone'], anterior: ['frontal-bone'] }), ['suturesShow'], ['trois_quarts', 'profil', 'dessus'], 'temporal'),
  L('nuchal-line', 'Ligne nuchale supérieure et protubérance occipitale externe', 'linea nuchae superior / protuberantia occipitalis externa', 'line', { from: 'inion', az: 180, side: 0 }, N({ superior: ['occipital-bone'], inferior: ['occipital-bone', 'neck'], medial: [], lateral: ['mastoid-process'], posterior: [], anterior: [] }), ['nuchalLine', 'inion'], ['profil', 'dos', 'trois_quarts_arriere'], 'occipital'),
];

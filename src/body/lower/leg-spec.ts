import type { Level } from '../types';

/**
 * SOURCE UNIQUE DES ATOMES DE LA JAMBE (itération 06). Cette table est lue par DEUX consommateurs qui ne dupliquent rien :
 *  - le module 2D (`leg.ts`) : polygones de face ;
 *  - la couche de volumes 3D (`volume/legs.ts`, `volume/legs-muscles.ts`) : un loft par muscle.
 * Une entrée porte l'IDENTITÉ (id, parent, niveau, ton, palier via `muscle-tiers.ts`) et la PLACE du muscle le long de son segment ; les deux
 * rendus ne diffèrent que par la projection. Les champs `dz` et `bz` ne servent qu'à la 3D (le 2D de face les ignore).
 *  - `seg` : `u` = cuisse (axe fourche → genou), `s` = jambe (axe genou → cheville). `t0`, `t1` = étendue le long de l'axe (t < 0 : au-dessus de la fourche).
 *  - `off`, `w` : décalage latéral (+ = côté latéral) et DEMI-largeur, en fractions de la demi-largeur de référence (mi-cuisse / mollet).
 *  - `dz` : décalage antéro-postérieur du centre (+ = vers l'AVANT), en fraction de cette même demi-largeur ; `bz` : épaisseur relative (1 = canon).
 */
export interface LegMuscle {
  readonly id: string; readonly seg: 'u' | 's'; readonly t0: number; readonly t1: number; readonly off: number; readonly w: number; readonly belly: number;
  readonly level: Level; readonly parent: string; readonly tone: number; readonly show: 'always' | 'never';
  readonly dz: number; readonly bz: number;
  readonly from?: readonly [number, number]; readonly to?: readonly [number, number];
}
const r = (id: string, seg: 'u' | 's', t0: number, t1: number, off: number, w: number, belly: number, level: Level, parent: string, tone: number, dz: number, show: 'always' | 'never' = 'always', bz = 1, ft?: readonly [readonly [number, number], readonly [number, number]]): LegMuscle =>
  ({ id, seg, t0, t1, off, w, belly, level, parent, tone, show, dz, bz, ...(ft ? { from: ft[0], to: ft[1] } : {}) });
/**
 * Correspondance avec `references/anatomy/ref-02` : quadriceps (rose = droit fémoral, bleu = vaste latéral, violet = vaste médial), sartorius
 * (oblique orange), adducteurs, tibial antérieur, gastrocnémien, soléaire. Cuisse : l'avant est le quadriceps, l'arrière les ischio-jambiers.
 */
export const LEG_MUSCLES: readonly LegMuscle[] = [
  r('quadriceps', 'u', 0.03, 0.93, 0, 0.98, 0.42, 1, 'leg.thigh', 0.05, 0.3, 'always', 0.9),
  r('rectus-femoris', 'u', 0, 0.88, 0, 0.34, 0.45, 2, 'quadriceps', 0.15, 0.72, 'always', 0.8),
  r('vastus-lateralis', 'u', 0.04, 0.93, 0.62, 0.46, 0.4, 2, 'quadriceps', -0.05, 0.3, 'always', 0.85),
  r('vastus-medialis', 'u', 0.38, 0.98, -0.56, 0.38, 0.72, 2, 'quadriceps', 0.1, 0.34, 'always', 0.8),
  r('vastus-intermedius', 'u', 0.1, 0.9, 0, 0.3, 0.45, 2, 'quadriceps', -0.1, 0.1, 'never', 0.8),
  r('sartorius', 'u', 0, 1, 0, 0.14, 0.5, 2, 'leg.thigh', 0.2, 0.7, 'always', 0.7, [[-0.18, 0.92], [0.98, -0.82]]),
  r('adductors', 'u', 0.02, 0.72, -0.7, 0.42, 0.4, 1, 'leg.thigh', -0.1, -0.05, 'always', 0.85),
  r('gracilis', 'u', 0.05, 0.9, -0.9, 0.15, 0.4, 2, 'adductors', -0.05, -0.1, 'always', 0.7),
  r('adductor-longus', 'u', 0, 0.5, -0.62, 0.25, 0.4, 2, 'adductors', 0.05, 0.3, 'always', 0.7),
  r('adductor-magnus', 'u', 0.08, 0.9, -0.7, 0.3, 0.45, 2, 'adductors', -0.15, -0.2, 'never', 0.9),
  r('pectineus', 'u', -0.08, 0.18, -0.62, 0.18, 0.4, 2, 'adductors', 0, 0.25, 'always', 0.7),
  r('tensor-fasciae-latae', 'u', -0.2, 0.28, 0.68, 0.2, 0.35, 2, 'leg.thigh', 0.05, 0.4, 'always', 0.8),
  r('iliotibial-band', 'u', 0.1, 1, 0.82, 0.09, 0.5, 2, 'leg.thigh', -0.1, 0.05, 'always', 0.5),
  r('hamstrings', 'u', 0.05, 0.95, 0.1, 0.9, 0.45, 1, 'leg.thigh', -0.2, -0.45, 'never', 0.85),
  r('biceps-femoris', 'u', 0.08, 0.95, 0.55, 0.32, 0.45, 2, 'hamstrings', -0.2, -0.55, 'never', 0.85),
  r('semitendinosus', 'u', 0.08, 0.95, -0.1, 0.26, 0.45, 2, 'hamstrings', -0.2, -0.62, 'never', 0.75),
  r('semimembranosus', 'u', 0.1, 0.95, -0.45, 0.28, 0.45, 2, 'hamstrings', -0.2, -0.55, 'never', 0.85),
  r('tibialis-anterior', 's', 0.08, 0.78, 0.28, 0.3, 0.3, 2, 'leg.shin', 0.12, 0.62, 'always', 0.8),
  r('extensor-digitorum-longus', 's', 0.1, 0.8, 0.6, 0.2, 0.35, 2, 'leg.shin', 0.05, 0.4, 'always', 0.7),
  r('peroneus-longus', 's', 0.08, 0.62, 0.9, 0.2, 0.35, 2, 'leg.shin', -0.05, 0.1, 'always', 0.8),
  r('peroneus-brevis', 's', 0.5, 0.95, 0.6, 0.13, 0.4, 2, 'leg.shin', -0.05, 0.12, 'always', 0.7),
  r('extensor-hallucis-longus', 's', 0.5, 0.92, 0.1, 0.09, 0.4, 2, 'leg.shin', 0.1, 0.62, 'always', 0.6),
  r('gastrocnemius', 's', 0.04, 0.6, 0, 0.9, 0.35, 1, 'leg.shin', -0.15, -0.5, 'never', 0.95),
  r('gastrocnemius.medial', 's', 0.04, 0.58, -0.8, 0.5, 0.35, 2, 'gastrocnemius', -0.1, -0.55, 'always', 1),
  r('gastrocnemius.lateral', 's', 0.04, 0.55, 0.9, 0.38, 0.33, 2, 'gastrocnemius', -0.1, -0.5, 'always', 0.95),
  r('soleus', 's', 0.35, 0.92, -0.7, 0.36, 0.55, 2, 'leg.shin', -0.05, -0.3, 'always', 0.8),
  r('tibialis-posterior', 's', 0.1, 0.85, -0.1, 0.3, 0.4, 2, 'leg.shin', -0.15, -0.15, 'never', 0.7),
  r('flexor-digitorum-longus', 's', 0.15, 0.85, -0.35, 0.22, 0.4, 2, 'leg.shin', -0.15, -0.2, 'never', 0.6),
];

/**
 * REPÈRES du genou et de la cheville (même source pour le 2D et la 3D). `at` : `K` genou · `A` cheville ; `dir` : axe de la cuisse (0) ou de la jambe (1) ;
 * `n` : normale latérale de la cuisse (0) ou de la jambe (1) ; `dz` (3D seulement) : décalage vers l'AVANT en fraction de la demi-largeur du genou/cheville. Position = point d'ancrage + `n` × `lat` × (demi-largeur genou/cheville) + axe × `along` × h.
 * `rad` : rayon (×h) ; `rx`/`ry` : demi-axes (×h) pour la rotule ; `kind` : tissu ; `parent` : segment porteur.
 */
export interface LegLandmark { readonly id: string; readonly kind: 'bone' | 'landmark' | 'fat'; readonly parent: 'leg.thigh' | 'leg.shin'; readonly level: Level; readonly at: 'K' | 'A'; readonly dir: 0 | 1; readonly n: 0 | 1; readonly lat: number; readonly along: number; readonly rad: number; readonly rx?: number; readonly ry?: number; readonly tone?: number; readonly z?: number; readonly dz?: number }
export const LEG_LANDMARKS: readonly LegLandmark[] = [
  { id: 'knee.patella', kind: 'bone', parent: 'leg.thigh', level: 2, at: 'K', dir: 0, n: 0, lat: 0, along: -0.045, rad: 0.044, rx: 0.04, ry: 0.048, z: 120, dz: 0.9 },
  { id: 'knee.condyle.lateral', kind: 'landmark', parent: 'leg.thigh', level: 3, at: 'K', dir: 0, n: 0, lat: 0.82, along: 0, rad: 0.02 },
  { id: 'knee.condyle.medial', kind: 'landmark', parent: 'leg.thigh', level: 3, at: 'K', dir: 0, n: 0, lat: -0.85, along: 0, rad: 0.022 },
  { id: 'knee.tibial-tuberosity', kind: 'landmark', parent: 'leg.shin', level: 3, at: 'K', dir: 1, n: 1, lat: 0, along: 0.085, rad: 0.016, dz: 0.8 },
  { id: 'knee.fibula-head', kind: 'landmark', parent: 'leg.shin', level: 3, at: 'K', dir: 1, n: 1, lat: 0.72, along: 0.05, rad: 0.016, dz: -0.1 },
  { id: 'knee.fat-pad', kind: 'fat', parent: 'leg.shin', level: 3, at: 'K', dir: 1, n: 1, lat: 0, along: 0.05, rad: 0.03, tone: -0.2, dz: 0.62 },
  { id: 'ankle.malleolus.medial', kind: 'landmark', parent: 'leg.shin', level: 3, at: 'A', dir: 1, n: 1, lat: -0.95, along: 0, rad: 0.022 },
  { id: 'ankle.malleolus.lateral', kind: 'landmark', parent: 'leg.shin', level: 3, at: 'A', dir: 1, n: 1, lat: 0.95, along: 0.02, rad: 0.02 },
];
/** Constantes de cinématique partagées (2D et 3D) : un seul endroit où elles sont décidées. */
export const LEG_KIN = { lift: 0.22, inward: 0.4, minFlexCos: 0.35 } as const;
/**
 * Origine → insertion (repères osseux) : lues par la vérification anatomique (`ana.origin-insertion`) ; planches d'anatomie classiques (Gray, Netter) — les
 * muscles sans entrée sont des masses (niveau 1) ou des chefs dont l'attache est celle de la masse.
 */
export const LEG_ATTACH: Readonly<Record<string, readonly [string, string]>> = {
  'rectus-femoris': ['ilium.aiis', 'patella'], 'vastus-lateralis': ['femur.greater-trochanter', 'patella'], 'vastus-medialis': ['femur.linea-aspera', 'patella'], 'vastus-intermedius': ['femur.shaft', 'patella'],
  sartorius: ['ilium.asis', 'tibia.pes-anserinus'], gracilis: ['pubis.ramus', 'tibia.pes-anserinus'], 'adductor-longus': ['pubis.body', 'femur.linea-aspera'], 'adductor-magnus': ['ischium.ramus', 'femur.linea-aspera'],
  pectineus: ['pubis.pectineal-line', 'femur.pectineal-line'], 'tensor-fasciae-latae': ['ilium.asis', 'tibia.gerdy-tubercle'], 'iliotibial-band': ['ilium.crest', 'tibia.gerdy-tubercle'],
  'biceps-femoris': ['ischium.tuberosity', 'fibula.head'], semitendinosus: ['ischium.tuberosity', 'tibia.pes-anserinus'], semimembranosus: ['ischium.tuberosity', 'tibia.medial-condyle'],
  'tibialis-anterior': ['tibia.lateral-condyle', 'foot.medial-cuneiform'], 'extensor-digitorum-longus': ['tibia.lateral-condyle', 'foot.toes-2-5'], 'peroneus-longus': ['fibula.head', 'foot.first-metatarsal'],
  'peroneus-brevis': ['fibula.shaft', 'foot.fifth-metatarsal'], 'extensor-hallucis-longus': ['fibula.shaft', 'foot.hallux'], 'gastrocnemius.medial': ['femur.medial-condyle', 'calcaneus'],
  'gastrocnemius.lateral': ['femur.lateral-condyle', 'calcaneus'], soleus: ['tibia.soleal-line', 'calcaneus'], 'tibialis-posterior': ['tibia.interosseous', 'foot.navicular'], 'flexor-digitorum-longus': ['tibia.posterior', 'foot.toes-2-5'],
};

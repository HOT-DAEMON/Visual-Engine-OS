import { DEFAULT_HEAD } from '../head';
import { range as R, type FamilySpec, type HairProfile } from '../grammar';
import { himeFrame } from './frame';
import { HIME } from './hime';
import { v3 } from '../vec';

/**
 * Coupe « queue de cheval haute » (données seulement) : cheveux tirés vers un nœud au sommet arrière, frange et mèches de joue de la hime, queue qui part du nœud, se
 * soulève de la nuque (le décollement CROÎT vers la pointe : `lift0` < `lift1`) et retombe (gravité) en s'ondulant. Vue de face la queue est derrière la tête : on ne voit que le tire-cheveux
 * (`knot`, petit disque) et les côtés lisses ; la queue se juge de profil (lacet 60°–90°, planche d'artefacts).
 */
const base = { follow: 0, fan: 0.05, bend: R(-0.05, 0.05), waveAmp: R(0.03, 0.09), waveFreq: R(0.8, 1.3), flickAmt: R(0.05, 0.25), flickLen: R(0.15, 0.3), lift0: R(0.02, 0.04), lift1: R(0.04, 0.08), liftPow: R(1.2, 1.6), gravity: R(0.5, 0.8), width: R(0.1, 0.15), peak: R(0.4, 0.55), taper: R(1.1, 1.6), tone: R(-0.3, 0.9), strands: R(1, 3), layer: 'auto' as const };
const KEEP = ['dome', 'fringeLow', 'fringeHigh', 'fringeTop', 'templeL', 'templeR', 'sideL', 'sideR'];

const families: FamilySpec[] = [
  ...himeFrame(KEEP),
  // Cheveux tirés vers le nœud : nappes courtes qui montent de la nuque et des côtés vers le haut arrière (la queue part d'eux).
  { ...base, id: 'pulled', count: 38, el: R(18, 70), az: R(66, 294), aim: v3(0, -1, -0.5), follow: 0, length: R(0.26, 0.42), width: R(0.16, 0.24), lift0: R(0.01, 0.02), lift1: R(0.02, 0.04), gravity: R(0, 0.1), tone: R(-0.4, 0.4), taper: R(1, 1.3) },
  // Côtés du crâne, de l'oreille au nœud : nappes qui remontent en arrière vers le tire-cheveux. Sans elles le côté du crâne est NU de profil (vu sur planche à ±60°/±90° ; le vérificateur ne juge que la calotte du dessus).
  { ...base, id: 'sideUpL', count: 22, el: R(20, 62), az: R(-118, -62), aim: v3(0, -0.5, -1), follow: 0, length: R(0.3, 0.46), width: R(0.15, 0.22), lift0: R(0.01, 0.02), lift1: R(0.02, 0.05), gravity: R(0, 0.1), tone: R(-0.3, 0.6), taper: R(1.0, 1.3) },
  { ...base, id: 'sideUpR', count: 22, el: R(20, 62), az: R(62, 118), aim: v3(0, -0.5, -1), follow: 0, length: R(0.3, 0.46), width: R(0.15, 0.22), lift0: R(0.01, 0.02), lift1: R(0.02, 0.05), gravity: R(0, 0.1), tone: R(-0.3, 0.6), taper: R(1.0, 1.3) },
  // Nœud : disque plat (tire-cheveux) au sommet arrière.
  { ...base, id: 'knot', count: 8, el: R(62, 70), az: R(172, 188), aim: v3(0, 1, 0), follow: 0, fan: 0.9, length: R(0.1, 0.13), width: R(0.07, 0.1), lift0: R(0.07, 0.09), lift1: R(0.07, 0.09), gravity: R(0, 0.05), tone: R(-0.6, -0.2), taper: R(0.5, 0.8), peak: R(0.5, 0.6) },
  // Queue : 26 mèches larges et longues issues du nœud, qui s'écartent de la nuque puis retombent.
  { ...base, id: 'tail', count: 26, el: R(60, 68), az: R(168, 192), aim: v3(0, 0.55, -1), follow: 0, fan: 0.12, length: R(0.85, 1.1), width: R(0.11, 0.17), lift0: R(0.06, 0.09), lift1: R(0.2, 0.3), liftPow: R(1.0, 1.4), gravity: R(0.65, 0.85), peak: R(0.35, 0.5), taper: R(1.2, 1.7) },
];

export const PONYTAIL: HairProfile = { name: 'ponytail', head: DEFAULT_HEAD, field: HIME.field, families };

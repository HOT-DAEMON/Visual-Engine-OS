import { DEFAULT_HEAD } from '../head';
import { range as R, type FamilySpec, type HairProfile } from '../grammar';
import { v3 } from '../vec';

/**
 * Profil 01 « tousled » (ébouriffée, mèches balayées depuis un épi côté lointain, frange sur le front, longues mèches latérales).
 * Données seulement : le générateur est le même pour toutes les coiffures. Valeurs estimées sur la planche de référence
 * (cellule 01) puis ajustées par comparaison pixel (docs/HAIR-GRAMMAR-01.md).
 */
const base = { follow: 1, fan: 0.25, waveAmp: R(0.15, 0.4), waveFreq: R(0.8, 1.4), flickAmt: R(0.4, 0.9), flickLen: R(0.15, 0.3), lift0: R(0.02, 0.05), lift1: R(0.08, 0.2), liftPow: R(1.2, 1.8), gravity: R(0, 0.2), width: R(0.07, 0.12), peak: R(0.3, 0.5), taper: R(1.2, 1.8), tone: R(0.3, 1), strands: R(1, 3), layer: 'auto' as const };

const families: FamilySpec[] = [
  // Sous-couche de volume : grosses lames claires qui couvrent le crâne (aucun cuir chevelu nu).
  { ...base, id: 'mass', count: 16, el: R(30, 88), az: R(-110, 130), follow: 0, aim: v3(-0.1, 1, 0.2), fan: 0.4, length: R(0.35, 0.55), bend: R(0.1, 0.4), width: R(0.26, 0.4), peak: R(0.4, 0.6), taper: R(1.0, 1.4), lift0: R(0.04, 0.06), lift1: R(0.08, 0.14), flickAmt: R(0, 0.2), strands: R(2, 4), tone: R(0.4, 1) },
  { ...base, id: 'sweep', count: 9, el: R(65, 85), az: R(-130, -60), aim: v3(0.7, -0.15, -0.72), follow: 0, length: R(0.8, 1.15), bend: R(0.3, 0.8), lift0: R(0.08, 0.12), lift1: R(0.2, 0.34), width: R(0.13, 0.2) },
  { ...base, id: 'fringe', count: 11, el: R(48, 80), az: R(-30, 40), aim: v3(-0.28, 1, 0.3), follow: 0, length: R(0.42, 0.6), bend: R(0.2, 0.7), gravity: R(0.1, 0.3), lift0: R(0.06, 0.09), lift1: R(0.08, 0.16), width: R(0.11, 0.17) },
  { ...base, id: 'farSide', count: 7, el: R(40, 72), az: R(-125, -55), aim: v3(-0.32, 1, 0.32), follow: 0, length: R(0.7, 1.05), bend: R(0.2, 0.6), gravity: R(0.3, 0.6), lift0: R(0.08, 0.1), lift1: R(0.14, 0.28), width: R(0.1, 0.16) },
  { ...base, id: 'nearSide', count: 7, el: R(35, 70), az: R(55, 125), aim: v3(0.21, 1, -0.22), follow: 0, length: R(0.6, 1.0), bend: R(0.1, 0.4), gravity: R(0.4, 0.7), lift0: R(0.06, 0.08), lift1: R(0.06, 0.14), width: R(0.08, 0.13), tone: R(-0.3, 0.8) },
];

export const TOUSLED: HairProfile = {
  name: '01-tousled', head: DEFAULT_HEAD,
  field: { whorl: v3(-0.18, -0.4, 0.05), sweep: v3(0.4, 0, 0), swirl: 0.3, radial: 0.4, fall: 0.2 },
  families,
};

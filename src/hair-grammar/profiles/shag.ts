import { DEFAULT_HEAD } from '../head';
import { range as R, type FamilySpec, type HairProfile } from '../grammar';
import { v3 } from '../vec';

/**
 * Profil « shag » (mi-long ondulé en couches, raie décentrée, frange en rideau, pointes effilées retroussées qui dépassent le menton).
 * Forme LUE VISUELLEMENT sur la référence 53 (planche à grille, passe 10) ; aucune mesure numérique n'a été faite (voir `docs/HAIR-PASS10-REMAINING.md`). Données seulement.
 */
const base = { follow: 1, fan: 0.3, bend: R(0.1, 0.4), waveAmp: R(0.25, 0.5), waveFreq: R(1.2, 2.2), flickAmt: R(0.5, 1.1), flickLen: R(0.15, 0.3), lift0: R(0.02, 0.05), lift1: R(0.08, 0.2), liftPow: R(1.2, 1.8), gravity: R(0.4, 0.7), width: R(0.12, 0.2), peak: R(0.3, 0.5), taper: R(1.3, 2.0), tone: R(0, 1), strands: R(1, 3), layer: 'auto' as const };

const families: FamilySpec[] = [
  { ...base, id: 'back', count: 10, el: R(24, 60), az: R(70, 290), follow: 0, aim: v3(0, 1, -0.3), fan: 0.6, length: R(0.42, 0.7), width: R(0.26, 0.36), gravity: R(0.6, 0.9), lift1: R(0.12, 0.24), tone: R(-0.3, 0.4) },
  { ...base, id: 'crown', count: 10, el: R(78, 90), az: R(-180, 180), follow: 0, aim: v3(-0.4, 1, 0.1), fan: 0.15, length: R(0.14, 0.22), width: R(0.22, 0.32), lift0: R(0, 0.01), lift1: R(0.005, 0.02), gravity: R(0.2, 0.4), flickAmt: R(0, 0.1), waveAmp: R(0, 0.08), tone: R(0, 0.5) },
  { ...base, id: 'mass', count: 21, el: R(50, 80), az: R(-180, 180), follow: 0, aim: v3(-0.4, 1, 0.1), fan: 0.22, lift0: R(0.01, 0.03), lift1: R(0.02, 0.06), length: R(0.32, 0.55), width: R(0.26, 0.38), gravity: R(0.3, 0.55), waveAmp: R(0.1, 0.25), flickAmt: R(0, 0.3), tone: R(-0.2, 0.6) },
  { ...base, id: 'curtain', count: 12, el: R(54, 80), az: R(-50, 50), follow: 0, aim: v3(0.2, 1, 0.3), length: R(0.3, 0.42), bend: R(0.2, 0.7), gravity: R(0.4, 0.7), lift0: R(0.04, 0.06), lift1: R(0.06, 0.12) },
  { ...base, id: 'layerL', count: 13, el: R(-8, 50), az: R(-180, -86), follow: 0, aim: v3(-0.3, 1, -0.3), length: R(0.62, 0.95), bend: R(-0.4, 0.2), gravity: R(0.7, 1.0), lift0: R(0.05, 0.08), lift1: R(0.16, 0.3), width: R(0.11, 0.17) },
  { ...base, id: 'layerR', count: 7, el: R(-8, 50), az: R(86, 180), follow: 0, aim: v3(0.3, 1, -0.3), length: R(0.5, 0.74), bend: R(-0.2, 0.4), gravity: R(0.7, 1.0), lift0: R(0.05, 0.08), lift1: R(0.16, 0.3), width: R(0.11, 0.17) },
  { ...base, id: 'wispL', count: 4, el: R(20, 54), az: R(-88, -66), follow: 0, aim: v3(-0.15, 1, -0.35), length: R(0.5, 0.8), gravity: R(0.85, 1.0), width: R(0.07, 0.11), tone: R(0.3, 1) },
  { ...base, id: 'wispR', count: 3, el: R(20, 54), az: R(66, 88), follow: 0, aim: v3(0.15, 1, -0.35), length: R(0.5, 0.8), gravity: R(0.85, 1.0), width: R(0.07, 0.11), tone: R(0.3, 1) },
];

export const SHAG: HairProfile = {
  name: 'shag', head: DEFAULT_HEAD,
  field: { whorl: v3(-0.1, -0.4, 0), sweep: v3(0, 0, 0), swirl: 0.1, radial: 0.45, fall: 0.65 },
  families,
};

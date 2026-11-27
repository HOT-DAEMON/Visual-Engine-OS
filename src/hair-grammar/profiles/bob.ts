import { DEFAULT_HEAD } from '../head';
import { range as R, type FamilySpec, type HairProfile } from '../grammar';
import { v3 } from '../vec';

/**
 * Profil « carré » (bob ondulé au niveau du menton : dessus volumineux, frange couvrant le front, côtés et nuque qui s'évasent vers l'extérieur
 * au bas de la coupe). Forme LUE VISUELLEMENT sur la référence 06 (planche à grille, passe 10) ; aucune mesure numérique n'a été faite (voir `docs/HAIR-PASS10-REMAINING.md`). Données seulement.
 * Les mèches marchent sur la coque : l'évasement vient du décollement `lift1` croissant vers la pointe, pas d'un modèle d'épaules.
 */
const base = { follow: 1, fan: 0.2, bend: R(0.05, 0.3), waveAmp: R(0.12, 0.3), waveFreq: R(1.0, 1.8), flickAmt: R(0.3, 0.8), flickLen: R(0.15, 0.3), lift0: R(0.02, 0.05), lift1: R(0.06, 0.14), liftPow: R(1.2, 1.8), gravity: R(0.3, 0.6), width: R(0.14, 0.22), peak: R(0.35, 0.5), taper: R(0.9, 1.4), tone: R(0.2, 1), strands: R(1, 3), layer: 'auto' as const };

const families: FamilySpec[] = [
  { ...base, id: 'back', count: 10, el: R(24, 60), az: R(70, 290), follow: 0, aim: v3(0, 1, -0.3), fan: 0.5, length: R(0.4, 0.6), width: R(0.26, 0.36), gravity: R(0.6, 0.9), lift1: R(0.1, 0.2), tone: R(-0.3, 0.4) },
  { ...base, id: 'crown', count: 10, el: R(78, 90), az: R(-180, 180), follow: 0, aim: v3(0.35, 1, 0.1), fan: 0.15, length: R(0.14, 0.22), width: R(0.22, 0.32), lift0: R(0, 0.01), lift1: R(0.005, 0.02), gravity: R(0.2, 0.4), flickAmt: R(0, 0.1), waveAmp: R(0, 0.08), tone: R(0, 0.5) },
  { ...base, id: 'mass', count: 21, el: R(50, 80), az: R(-180, 180), follow: 0, aim: v3(0.35, 1, 0.1), fan: 0.22, lift0: R(0.01, 0.03), lift1: R(0.02, 0.06), length: R(0.3, 0.5), width: R(0.26, 0.38), gravity: R(0.3, 0.55), lift1: R(0.08, 0.16), flickAmt: R(0, 0.2), tone: R(-0.1, 0.7) },
  { ...base, id: 'fringe', count: 12, el: R(54, 78), az: R(-42, 42), follow: 0, aim: v3(0.25, 1, 0.3), length: R(0.3, 0.4), bend: R(0.15, 0.5), gravity: R(0.4, 0.7), lift0: R(0.04, 0.06), lift1: R(0.06, 0.1), width: R(0.12, 0.18), taper: R(0.7, 1.1) },
  { ...base, id: 'hangL', count: 12, el: R(-6, 48), az: R(-180, -86), follow: 0, aim: v3(-0.25, 1, -0.3), length: R(0.5, 0.72), bend: R(-0.3, 0.1), gravity: R(0.75, 1.0), lift0: R(0.05, 0.08), lift1: R(0.16, 0.26), liftPow: R(1.0, 1.4), width: R(0.14, 0.2), taper: R(0.7, 1.1) },
  { ...base, id: 'hangR', count: 6, el: R(-6, 48), az: R(86, 180), follow: 0, aim: v3(0.25, 1, -0.3), length: R(0.4, 0.58), bend: R(-0.1, 0.3), gravity: R(0.75, 1.0), lift0: R(0.05, 0.08), lift1: R(0.16, 0.26), liftPow: R(1.0, 1.4), width: R(0.14, 0.2), taper: R(0.7, 1.1) },
  { ...base, id: 'frameL', count: 5, el: R(26, 52), az: R(-86, -64), follow: 0, aim: v3(-0.2, 1, -0.35), length: R(0.5, 0.64), gravity: R(0.8, 1.0), lift1: R(0.1, 0.18), width: R(0.1, 0.15), tone: R(0, 0.8) },
  { ...base, id: 'frameR', count: 3, el: R(26, 52), az: R(64, 86), follow: 0, aim: v3(0.2, 1, -0.35), length: R(0.5, 0.64), gravity: R(0.8, 1.0), lift1: R(0.1, 0.18), width: R(0.1, 0.15), tone: R(0, 0.8) },
];

export const BOB: HairProfile = {
  name: 'bob', head: DEFAULT_HEAD,
  field: { whorl: v3(0, -0.4, -0.05), sweep: v3(0, 0, 0), swirl: 0, radial: 0.5, fall: 0.6 },
  families,
};

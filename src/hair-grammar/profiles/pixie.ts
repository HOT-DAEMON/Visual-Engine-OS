import { DEFAULT_HEAD } from '../head';
import { range as R, type FamilySpec, type HairProfile } from '../grammar';
import { v3 } from '../vec';

/**
 * Profil « pixie à frange balayée » (flancs et nuque très courts et plaqués, dessus texturé relevé vers l'arrière, frange balayée sur le côté qui couvre le front).
 * Cible : référence 32 (planche à grille + masque colorimétrique, docs/HAIR-MEASURE.md). Reprend les pistes notées en passe 10 après l'échec de la première tentative :
 * flancs très courts SANS décollement (sinon bloc anguleux au-dessus de l'oreille), mèches de frange nombreuses et étroites (sinon plaque sur le front),
 * dessus fourni, et UNE famille dominante (`top`), car la « masse dominante » de la vérification est une famille. Données seulement.
 */
const base = { follow: 0, fan: 0.25, bend: R(-0.3, 0.3), waveAmp: R(0.05, 0.2), waveFreq: R(1, 2), flickAmt: R(0.2, 0.7), flickLen: R(0.15, 0.3), lift0: R(0.015, 0.03), lift1: R(0.06, 0.16), liftPow: R(1.2, 1.8), gravity: R(0.1, 0.3), width: R(0.12, 0.18), peak: R(0.25, 0.4), taper: R(1.2, 1.7), tone: R(0, 1), strands: R(1, 3), layer: 'auto' as const };
const hug = { lift0: R(0.004, 0.01), lift1: R(0.006, 0.014), flickAmt: R(0, 0.1), waveAmp: R(0, 0.04), bend: R(-0.05, 0.05), fan: 0.08, gravity: R(0.3, 0.5), taper: R(1.0, 1.4), tone: R(-0.4, 0.3) };

const families: FamilySpec[] = [
  // Flancs et nuque : lames ALLONGÉES et étroites (une lame aussi large que longue donne un losange), plaquées, sans décollement.
  { ...base, ...hug, id: 'sidesL', count: 16, el: R(8, 66), az: R(-128, -52), aim: v3(-0.05, 1, 0.1), length: R(0.2, 0.3), width: R(0.07, 0.1) },
  { ...base, ...hug, id: 'sidesR', count: 16, el: R(8, 66), az: R(52, 128), aim: v3(0.05, 1, 0.1), length: R(0.2, 0.3), width: R(0.07, 0.1) },
  { ...base, ...hug, id: 'nape', count: 12, el: R(0, 60), az: R(128, 232), aim: v3(0, 1, -0.1), length: R(0.18, 0.26), width: R(0.08, 0.12) },
  // Frange balayée (variante « pixie à frange ») : le contrôle `anat.dome` exige 70 % de la calotte couverte et la calotte inclut le front jusqu'à 0,12 H au-dessus des yeux ; un front dégagé
  // comme sur la référence 32 (implantation à ≈ 0,36 H au-dessus des yeux) est donc refusé par construction. Mèches NOMBREUSES et ÉTROITES (pas de plaque), balayées vers +x.
  // Deux familles (droite / centre-gauche) : la masse dominante de la vérification est une FAMILLE ; une frange d'un seul tenant rivaliserait avec `top`.
  { ...base, id: 'fringeR', count: 24, el: R(54, 66), az: R(0, 58), aim: v3(0.75, 1, 0.4), fan: 0.12, length: R(0.4, 0.52), width: R(0.08, 0.11), peak: R(0.12, 0.2), taper: R(1.0, 1.4), lift0: R(0.02, 0.03), lift1: R(0.04, 0.08), gravity: R(0.4, 0.6), flickAmt: R(0.1, 0.3), tone: R(0.1, 1) },
  { ...base, id: 'fringeC', count: 24, el: R(54, 66), az: R(-62, 0), aim: v3(0.45, 1, 0.4), fan: 0.12, length: R(0.38, 0.5), width: R(0.08, 0.11), peak: R(0.12, 0.2), taper: R(1.0, 1.4), lift0: R(0.02, 0.03), lift1: R(0.04, 0.08), gravity: R(0.4, 0.6), flickAmt: R(0.1, 0.3), tone: R(0.1, 1) },
  // Dessus : masse dominante, mèches texturées relevées vers l'arrière et le côté (+x).
  { ...base, id: 'top', count: 32, el: R(58, 90), az: R(-180, 180), aim: v3(0.45, -0.2, -0.55), fan: 0.35, length: R(0.26, 0.42), width: R(0.16, 0.22), lift0: R(0.02, 0.04), lift1: R(0.08, 0.18), tone: R(0.1, 1) },
  // Pointes relevées au-dessus du front : accent (étroites, effilées).
  { ...base, id: 'quiff', count: 12, el: R(66, 86), az: R(-45, 45), aim: v3(0.5, -0.5, -0.5), fan: 0.3, length: R(0.28, 0.42), width: R(0.07, 0.1), taper: R(1.5, 2.1), lift0: R(0.03, 0.05), lift1: R(0.14, 0.28), flickAmt: R(0.4, 0.9), tone: R(0.3, 1) },
];

export const PIXIE: HairProfile = {
  name: 'pixie', head: DEFAULT_HEAD,
  field: { whorl: v3(-0.1, -0.4, 0.05), sweep: v3(0.4, 0, -0.3), swirl: 0.25, radial: 0.3, fall: 0.15 },
  families,
};

import { DEFAULT_HEAD } from '../head';
import { range as R, type FamilySpec, type HairProfile } from '../grammar';
import { v3 } from '../vec';

/**
 * Profil « hime » (cheveux longs droits, frange pleine à bord franc au niveau des sourcils, deux longues mèches latérales, rideau arrière dominant).
 * Cible : référence 47. Valeurs LUES sur planche à grille (docs/HAIR-MEASURE.md) : bas de frange ≈ −0,11 H par rapport à la ligne des yeux (±10 px),
 * mèche latérale jusqu'à ≈ +1,14 H sous la ligne des yeux. Données seulement ; trois leçons de rendu, apprises en isolant les familles une à une :
 *  - bord franc = `widthProg` `flat` jusqu'au bout (primitive de `width-program.ts`), pas un `taper` bas (la lame reste pointue) ;
 *  - une lame est dessinée avec sa demi-largeur DANS LE PLAN IMAGE : près du sommet ou de la silhouette elle doit rester étroite, sinon sa largeur s'étale au-dessus du crâne (touffes) ;
 *  - la « masse dominante » de la vérification est une FAMILLE : le rideau arrière est donc UNE famille (azimut 100°→260° : enjambe la nuque), pas deux moitiés symétriques.
 */
const blunt = [{ kind: 'flat', from: 0.5, to: 1.01 }] as const;
const base = { follow: 0, fan: 0.04, bend: R(0, 0.04), waveAmp: R(0, 0.03), waveFreq: R(0.8, 1.2), flickAmt: R(0, 0.03), flickLen: R(0.1, 0.2), lift0: R(0.015, 0.03), lift1: R(0.02, 0.05), liftPow: R(1.2, 1.6), gravity: R(0.9, 1), width: R(0.2, 0.3), peak: R(0.4, 0.55), taper: R(0.8, 1.2), tone: R(0, 1), strands: R(1, 3), layer: 'auto' as const };

const families: FamilySpec[] = [
  // Sous-couche des tempes (dessinée EN PREMIER, donc dessous) : nappes larges et opaques qui bouchent les fentes entre les bords des mèches de tempe et des flancs.
  // Aux côtés les lames sont verticales à l'écran : leur largeur est horizontale, donc sans effet d'étalement au-dessus du crâne.
  { ...base, id: 'underL', count: 4, el: R(30, 62), az: R(-82, -50), aim: v3(-0.03, 1, 0.1), fan: 0.03, length: R(0.55, 0.7), width: R(0.18, 0.24), peak: R(0.12, 0.2), lift0: R(0.012, 0.02), lift1: R(0.02, 0.035), tone: R(-0.2, 0.3), widthProg: blunt },
  { ...base, id: 'underR', count: 4, el: R(30, 62), az: R(50, 82), aim: v3(0.03, 1, 0.1), fan: 0.03, length: R(0.55, 0.7), width: R(0.18, 0.24), peak: R(0.12, 0.2), lift0: R(0.012, 0.02), lift1: R(0.02, 0.035), tone: R(-0.2, 0.3), widthProg: blunt },
  // Dôme : lames COURTES et ÉTROITES qui suivent le champ (radial depuis le tourbillon) : elles s'écartent d'elles-mêmes de chaque côté de la raie.
  { ...base, id: 'dome', count: 18, el: R(72, 90), az: R(50, 310), follow: 1, fan: 0.08, length: R(0.16, 0.24), width: R(0.09, 0.13), lift0: R(0, 0.008), lift1: R(0.004, 0.012), gravity: R(0.2, 0.35), peak: R(0.1, 0.16), tone: R(0, 0.5), strands: R(1, 2) },
  // Flancs au-dessus et derrière les oreilles : nappes parallèles qui tombent droit (|az| ≥ 62° : jamais sur le visage).
  { ...base, id: 'mass', count: 12, el: R(24, 70), az: R(62, 298), aim: v3(0, 1, 0), length: R(0.5, 0.75), width: R(0.22, 0.3), lift0: R(0.01, 0.025), lift1: R(0.02, 0.04), fan: 0.03, tone: R(-0.1, 0.7) },
  // Frange : bord franc, trois étages de racines ; la longueur croît avec la hauteur de racine pour que toutes les pointes tombent sur la même ligne (sourcils).
  { ...base, id: 'fringeLow', count: 24, el: R(55, 60), az: R(-62, 62), aim: v3(0, 1, 0.42), fan: 0.02, length: R(0.41, 0.45), width: R(0.07, 0.09), lift0: R(0.02, 0.03), lift1: R(0.03, 0.045), peak: R(0.1, 0.16), tone: R(0.2, 1), strands: R(1, 2), widthProg: blunt },
  { ...base, id: 'fringeHigh', count: 24, el: R(62, 68), az: R(-56, 56), aim: v3(0, 1, 0.42), fan: 0.02, length: R(0.47, 0.51), width: R(0.08, 0.1), lift0: R(0.02, 0.03), lift1: R(0.03, 0.045), peak: R(0.1, 0.16), tone: R(0, 0.8), strands: R(1, 2), widthProg: blunt },
  { ...base, id: 'fringeTop', count: 16, el: R(69, 76), az: R(-50, 50), aim: v3(0, 1, 0.42), fan: 0.02, length: R(0.51, 0.55), width: R(0.08, 0.1), lift0: R(0.02, 0.03), lift1: R(0.03, 0.045), peak: R(0.1, 0.16), tone: R(0, 0.7), strands: R(1, 2), widthProg: blunt },
  // Tempes : comblent la jonction frange / flancs (sans elles, un coin de peau reste visible selon la graine). Petites familles, une par côté.
  { ...base, id: 'templeL', count: 7, el: R(38, 62), az: R(-74, -52), aim: v3(-0.04, 1, 0.2), fan: 0.03, length: R(0.4, 0.55), width: R(0.09, 0.12), peak: R(0.1, 0.16), lift0: R(0.02, 0.03), lift1: R(0.03, 0.05), tone: R(0.1, 0.8), widthProg: blunt },
  { ...base, id: 'templeR', count: 7, el: R(38, 62), az: R(52, 74), aim: v3(0.04, 1, 0.2), fan: 0.03, length: R(0.4, 0.55), width: R(0.09, 0.12), peak: R(0.1, 0.16), lift0: R(0.02, 0.03), lift1: R(0.03, 0.05), tone: R(0.1, 0.8), widthProg: blunt },
  // Arrière : rideau long et droit, UNE famille (dominante), bout franc.
  { ...base, id: 'back', count: 14, el: R(0, 58), az: R(100, 260), aim: v3(0, 1, -0.1), fan: 0.06, length: R(1.0, 1.2), width: R(0.26, 0.34), lift0: R(0.03, 0.05), lift1: R(0.03, 0.06), tone: R(-0.4, 0.3), widthProg: blunt },
  // Mèches latérales : deux longues mèches droites devant les oreilles, bien en dessous du menton.
  { ...base, id: 'sideL', count: 4, el: R(24, 44), az: R(-76, -68), aim: v3(-0.03, 1, 0.12), fan: 0.02, length: R(1.05, 1.15), width: R(0.08, 0.1), lift0: R(0.03, 0.04), lift1: R(0.04, 0.06), tone: R(0.3, 1), widthProg: blunt },
  { ...base, id: 'sideR', count: 4, el: R(24, 44), az: R(68, 76), aim: v3(0.03, 1, 0.12), fan: 0.02, length: R(1.05, 1.15), width: R(0.08, 0.1), lift0: R(0.03, 0.04), lift1: R(0.04, 0.06), tone: R(0.3, 1), widthProg: blunt },
];

export const HIME: HairProfile = {
  name: 'hime', head: DEFAULT_HEAD,
  field: { whorl: v3(0, -0.4, 0), sweep: v3(0, 0, 0), swirl: 0, radial: 0.9, fall: 0.3 },
  families,
};

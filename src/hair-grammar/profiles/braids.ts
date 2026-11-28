import { DEFAULT_HEAD } from '../head';
import { range as R, type FamilySpec, type HairProfile } from '../grammar';
import type { LockSpec } from '../lock';
import { weaveStrands } from '../weave';
import { backCover, himeFrame } from './frame';
import { HIME } from './hime';
import { v3 } from '../vec';

/**
 * Coupe « couettes tressées » (données + UN appel à `weaveStrands`, l'auteur d'entrelacs qui existe déjà : `docs/HAIR-WEAVE.md`) : cheveux séparés par une raie, deux longues tresses à trois brins
 * devant les épaules. Les mèches de famille `braidL` / `braidR` sont des mèches de BASE (une par côté) que l'étape `post` remplace par trois brins entrelacés ; tout le reste est tiré comme d'habitude
 * (donc vérifié, réparé, peint par les mêmes chemins). Cible : références 09, 33, 55 (tresses plaquées sur le crâne puis tresse libre).
 */
const base = { follow: 0, fan: 0.03, bend: R(0, 0.02), waveAmp: R(0, 0.02), waveFreq: R(1, 1.2), flickAmt: R(0, 0.05), flickLen: R(0.1, 0.2), lift0: R(0.015, 0.03), lift1: R(0.02, 0.05), liftPow: R(1.2, 1.6), gravity: R(0.85, 1), width: R(0.12, 0.2), peak: R(0.4, 0.55), taper: R(0.9, 1.3), tone: R(-0.3, 0.8), strands: R(1, 3), layer: 'auto' as const };
const KEEP = ['fringeLow', 'fringeHigh', 'fringeTop', 'templeL', 'templeR'];
const BRAID = { length: R(1.15, 1.2), width: R(0.095, 0.1), peak: R(0.12, 0.12), taper: R(1.3, 1.3), tone: R(0.2, 0.2), strands: R(1, 1), gravity: R(0.9, 0.9), fan: 0, lift0: R(0.05, 0.05), lift1: R(0.09, 0.09), liftPow: R(1, 1) };

const families: FamilySpec[] = [
  ...himeFrame(KEEP, 1.5),
  // Dessus : pas de famille propre (essayée puis RETIRÉE : des écailles courtes `crown` donnaient de grandes pointes noires en flèche sur le dessus, vues sur planche ; la frange pleine et les nappes de raie couvrent la calotte).
  // Cheveux de derrière la raie, ramenés vers l'oreille puis vers la tresse.
  // Nappes de raie (côtés) : bandes ÉTROITES à pointe franche (comme les autres coupes), pas les « feuilles » larges `taper` 0,5–0,7 essayées d'abord (vues de profil à ±60°/±90° : grandes feuilles sombres posées sur le côté du crâne).
  { ...base, id: 'sweepL', count: 16, el: R(28, 66), az: R(-130, -62), aim: v3(-0.1, 1, 0.1), length: R(0.42, 0.62), width: R(0.15, 0.22), taper: R(0.9, 1.15), tone: R(0.1, 0.8) },
  { ...base, id: 'sweepR', count: 16, el: R(28, 66), az: R(62, 130), aim: v3(0.1, 1, 0.1), length: R(0.42, 0.62), width: R(0.15, 0.22), taper: R(0.9, 1.15), tone: R(0.1, 0.8) },
  // Arrière du crâne : couverture commune des coupes attachées (`frame.ts`).
  backCover(),
  // Mèches de base des tresses (une par côté) : racine à l'azimut ±74° (au-delà, l'oscillation latérale des brins part dans l'axe de PROFONDEUR et les croisements disparaissent de face : mesuré, 1 croisement visible contre 3), cap vers le bas et vers l'avant (devant l'épaule).
  { ...base, ...BRAID, id: 'braidL', count: 1, el: R(36, 36), az: R(-74, -74), aim: v3(-0.2, 1, 0.6) },
  { ...base, ...BRAID, id: 'braidR', count: 1, el: R(36, 36), az: R(74, 74), aim: v3(0.2, 1, 0.6) },
];

/** Remplace chaque mèche de base de tresse par TROIS brins entrelacés (`weaveStrands`, `freq` périodes sur la longueur) ; les autres mèches passent inchangées. */
export const braidPost = (specs: LockSpec[]): LockSpec[] =>
  specs.flatMap((L) => (L.family === 'braidL' || L.family === 'braidR' ? weaveStrands(DEFAULT_HEAD, L, { strands: 3, spread: 0.036, freq: 4, lift: 0.03, toneStep: 0.18 }) : [L]));

export const TWIN_BRAIDS: HairProfile = { name: 'twin_braids', head: DEFAULT_HEAD, field: HIME.field, families, post: braidPost };

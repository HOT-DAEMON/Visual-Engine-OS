import { rad, smooth } from '../math';
import { SkullParams } from '../../skull/types';
import type { EngineHead } from './face-model';
import { PX, spy, sy } from './units';

/** Section du cou à la hauteur y (U) : demi-largeur a (moteur de visage : `lm.neck.half`, évasement vers les trapèzes), centre zc et demi-profondeur b (moteur de crâne : faces antérieure `xFront` et postérieure `xBack`). */
export interface NeckSection { readonly a: number; readonly zc: number; readonly b: number }

/** Évasement du bas du cou : +10 % de la largeur sur les 0,2 U du bas (le socle de la planche) [mesuré]. */
const FLARE = 0.1;

/**
 * JONCTION COU → ÉPAULES (têtes issues d'un visage). Le cou n'est pas un cylindre : sur les `SHOULDER.len` U du bas il s'ouvre en CLOCHE vers les trapèzes.
 * Profil MESURÉ sur `references/rotation-3d/07.jpg` (vue de dos, cellule en bas à droite, largeur de silhouette ligne par ligne) : du cou le plus étroit à la coupe la largeur
 * est multipliée par 2,77 sur ≈ 0,9 fois la largeur du cou, et la courbe normalisée (0 ; 0,05 ; 0,19 ; 0,41 ; 0,63 ; 0,82 ; 0,97 ; 1 à t = 0 … 1 par 1/7) suit `smooth(t)` à 0,04 près
 * (concave au départ, convexe à l'arrivée : la pente du trapèze puis l'épaule). Les têtes précédentes appliquaient `smooth(t)²` : l'évasement était retardé et écrasé tout en bas.
 * Le rapport final R = 1 + K, K = `k0 + kTrap × skull.trapezius` (même axe que le moteur de crâne : « montée du trapèze vers l'épaule »), est volontairement plus modéré que la
 * réf. (2,77 = épaules entières d'un buste masculin musclé, coupées bien plus bas) : R ∈ [1,6 ; 2,4] ; ce choix est une CONVENTION, pas une mesure. La profondeur (avant-arrière)
 * grandit de `SHOULDER.depth` × K (le thorax est plus profond que le cou, mais moins qu'il n'est large) ; la nuque rejoint C7 (`skull.c7`) : le dos recule de `SHOULDER.back × c7 × g`,
 * le devant (creux sus-sternal) reste. La planche garde son évasement mesuré de 10 %.
 */
export const SHOULDER = { len: 0.4, k0: 0.5, kTrap: 1.0, depth: 0.55, back: 0.05 } as const;

/**
 * COUPE OBLIQUE DU COU (têtes issues d'un visage). Le plan de coupe n'est pas horizontal : l'orifice supérieur du thorax est oblique, le bord ANTÉRIEUR (manubrium, fosse sus-sternale) plus bas que le bord
 * POSTÉRIEUR (T1) ; un manuel d'anatomie le donne à ≈ 45° de l'horizontale, la pente de la plaque supérieure de T1 est d'environ 25° (valeur de mémoire, non revérifiée). On prend 25° : c'est une CONVENTION
 * prudente (45° ferait descendre le devant de 0,2 U et sortirait du cadre). Effet visible : avec la caméra sous le menton, le plan de coupe, tourné vers le bas ET vers l'arrière, n'est vu qu'au-delà de 25° de
 * tangage et très raccourci (le disque plat en « socle » de la planche est vu dès 0°) ; en dessous, le cou se prolonge simplement vers le bas. La planche (sans `mandLandmarks`) garde sa coupe horizontale.
 */
export const CUT_TILT_DEG = 25, CUT_SLOPE = Math.tan(rad(CUT_TILT_DEG));
/** Vrai pour une tête issue d'un visage (cou en cloche + coupe oblique) ; faux pour la planche mesurée. */
export const isBellHead = (e: EngineHead | undefined): boolean => !!(e?.fit as { mandLandmarks?: boolean } | undefined)?.mandLandmarks;

export function neckSection(e: EngineHead, y0: number, y1: number): NeckSection {
  const y = isBellHead(e) ? Math.min(y0, y1) : y0;   // sous le plan de coupe (devant de la coupe oblique) la section ne change plus : le cou ne prolonge pas les lignes du crâne au-delà de y1
  const n = e.sk.neck, yp = spy(y), zf = e.fit.zPorion + n.xFront(yp) * PX, zb = e.fit.zPorion + n.xBack(yp) * PX;
  if ((e.fit as { mandLandmarks?: boolean }).mandLandmarks) {
    const k = SkullParams.parse(e.fit.skull), g = smooth((y - (y1 - SHOULDER.len)) / SHOULDER.len), K = SHOULDER.k0 + SHOULDER.kTrap * k.trapezius;
    const zbS = zb - SHOULDER.back * k.c7 * g;
    return { a: e.lm.neck.half * PX * (1 + K * g), zc: (zf + zbS) / 2, b: Math.max(0.02, ((zf - zbS) / 2) * e.fit.neckScale * (1 + SHOULDER.depth * K * g)) };
  }
  const flare = 1 + FLARE * smooth((y - (y1 - 0.2)) / 0.2);
  return { a: e.lm.neck.half * PX * flare, zc: (zf + zb) / 2, b: Math.max(0.02, ((zf - zb) / 2) * e.fit.neckScale * flare) };
}
export const neckTopY = (e: EngineHead): number => sy(e.sk.neck.yTop);

/** Hauteur y du plan de coupe du cou à la profondeur z (repère tête) ; = y1 pour la planche. */
export const neckCutY = (e: EngineHead | undefined, z: number, y1: number): number => (e && isBellHead(e) ? y1 + CUT_SLOPE * (z - neckSection(e, y1, y1).zc) : y1);

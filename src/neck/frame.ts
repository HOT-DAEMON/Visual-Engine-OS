import type { Resolver } from '../core/resolve';
import { clamp } from '../core/math';
import { NeckSystem } from '../schema/neck-system';
import { effectiveAxial } from './expressions';
import { effectiveStyle } from './style';
import type { FaceNeckParams } from './types';

/**
 * CADRE DU COU — SOURCE UNIQUE de la demi-largeur, du haut et du bas du cou (avant : formule dupliquée dans `face/landmarks.ts`).
 * `face/landmarks.ts` l'appelle ; `lm.neck` est donc la VÉRITÉ que lisent le corps (ancre de base), les cheveux (collision), le contact
 * et le moteur de cou. Avec les valeurs par défaut du système (topWidth 1, exagération 0, masse 0,4) le résultat est IDENTIQUE à l'historique.
 *
 *  1. Face (contrat `FaceNeck`) : demi-largeur = `width · W / 2`, bornée entre le menton ×1,15 et la mâchoire ×0,85 (le menton ne l'agrandit que si `chinCoupling` > 0).
 *  2. Système (`neck.system`) : × `dimensions.topWidth` × masse × exagération de style. Ce second étage PEUT dépasser la mâchoire (cou de taureau) :
 *     c'est un choix de style explicite, signalé par la relation `jaw.neck-narrower-than-jaw` (avertissement), pas une erreur silencieuse.
 *  3. Longueur : `length · H` sous le menton, allongée/raccourcie par l'exagération (écart à 0,2 H amplifié), puis par la compression/l'étirement de pose (M05/M06).
 */
export interface NeckFrame {
  readonly half: number;
  readonly topY: number;
  readonly bottomY: number;
  /** Profondeur AP / largeur : lue par la pose, le profil et la planche tournante (avant : constante 0,85 recopiée dans chaque moteur). */
  /** Demi-profondeur de référence AP (px) : suit `FaceNeck.width`, la masse et l'exagération, mais PAS `topWidth` (la largeur du haut évolue seule). */
  readonly depthHalf: number;
  readonly depthRatio: number;
  /** Part de la rotation de la tête suivie par le cou (avant : `TWIST` = 0,55 dans le moteur de pose). */
  readonly twistShare: number;
}

/** Proportions de référence (défauts du moteur) : l'exagération amplifie l'écart à ces valeurs. */
export const NECK_REF = { width: 0.42, length: 0.2, flare: 0.25, depthRatio: 0.85, twistShare: 0.55 } as const;
const NEUTRAL = NeckSystem.parse({});

export function neckFrame(n: FaceNeckParams, W: number, H: number, chinHalf: number, jawHalf: number, chinProjection: number, R: Resolver): NeckFrame {
  const sys = n.system ?? NEUTRAL;
  const e = effectiveStyle(sys.style).exaggeration;
  const requested = (n.width * W) / 2 + n.chinCoupling * (chinProjection - 0.5) * 0.05 * W;
  const face = R.limit('neck-between-chin-and-jaw', 'neck.width', requested, chinHalf * 1.15, jawHalf * 0.85, 'le cou reste plus large que le menton et plus étroit que la mâchoire');
  const ratio = face / ((NECK_REF.width * W) / 2);
  const widthGain = clamp(1 + 1.1 * e * (ratio - 1), 0.5, 2.2);
  const massGain = 1 + 0.18 * (sys.modifiers.mass - 0.4);
  const half = face * sys.dimensions.topWidth * widthGain * massGain;
  // Profondeur : même base SANS `topWidth`. `topWidth` change la largeur seule ; `FaceNeck.width` (contrat du visage) entraîne la profondeur à rapport `depthRatio` constant : contrainte EXPLICITE.
  const depthHalf = face * widthGain * massGain;
  // M05/M06 : la compression axiale raccourcit le cou VISIBLE (la tête s'enfonce, la base remonte), l'étirement l'allonge — la base du corps suit (`lm.neck.bottomY`).
  const ax = effectiveAxial(sys);
  const length = Math.max(0.02, (n.length + 1.4 * e * (n.length - NECK_REF.length)) * (1 - 0.6 * ax.compression + 0.5 * ax.stretch));
  return { half, topY: -H / 2 + 0.6 * H, bottomY: H / 2 + length * H, depthHalf, depthRatio: sys.dimensions.depthRatio, twistShare: sys.pose.twistShare };
}

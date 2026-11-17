import { rad } from './math';
import { sectionAt, surfaceZ } from './sections';
import type { HeadTurnSpec, V3 } from './types';

/** Ellipsoïde d'aile à axes alignés : centre et demi-axes (U). Même forme que `alaOf` (`parts.ts`), déclarée ici pour ne pas créer d'import circulaire. */
export interface AlaEllipsoid { readonly c: V3; readonly ex: number; readonly ey: number; readonly ez: number }

/**
 * DÉBORDEMENT D'UNE AILE DU NEZ HORS DU CONTOUR DE LA JOUE, PAR CALCUL (aucun rendu). Pure, déterministe.
 *
 * Projection de la caméra à lacet θ (`toCam`, `math.ts`) : x' = x·cosθ − z·sinθ. Le visage se tourne vers la GAUCHE de l'image quand θ > 0 : le côté lointain est x < 0.
 *  - tête : section du crâne à la hauteur de l'aile (`sectionAt`), moitiés avant et arrière (`surfaceZ`) ; x' minimal = bord gauche du contour ;
 *  - aile : ellipsoïde ; x' minimal = x'(centre) − √((ex·cosθ)² + (ez·sinθ)²) (fonction d'appui d'un ellipsoïde à axes alignés).
 * Débordement = max(0, x' minimal de la tête − x' minimal de l'aile), en U. `ala` doit être l'aile du côté x < 0 ; pour θ < 0 on réfléchit (même valeur).
 *
 * VALIDÉE contre la mesure par DIFFÉRENCE DE RENDUS (`scripts/nose-refs/alar-overflow.ts`, docs/NOSE-ALAR-SEAT.md) : écart ≤ 0,004 U sur 20 comparaisons.
 * Ne regarde que les ellipsoïdes d'ailes : la bosse centrale ne déborde jamais (mesuré : rendu « sans ailes » = 0 sur tous les cas testés).
 */
export function alaOverflow(s: HeadTurnSpec, ala: AlaEllipsoid, yawDeg: number): number {
  const th = rad(Math.abs(yawDeg)), c = Math.cos(th), sn = Math.sin(th);
  if (sn < 1e-9) return 0;   // de face l'aile est au milieu de la face : pas de côté lointain
  const sec = sectionAt(s, ala.c.y);
  let head = Infinity; const N = 96;   // 96 pas en x sur la surface avant ET arrière
  for (let i = 0; i <= N; i++) {
    const x = -sec.a + (2 * sec.a * i) / N;
    for (const front of [true, false]) head = Math.min(head, x * c - surfaceZ(sec, x, front) * sn);
  }
  return Math.max(0, head - (ala.c.x * c - ala.c.z * sn - Math.hypot(ala.ex * c, ala.ez * sn)));
}

/** Lacet auquel la contrainte « l'aile reste dans le contour de la joue » est posée : la vue à 30° où le défaut a été mesuré (docs/NOSE-ALAR-SEAT.md). */
export const ALA_CONTOUR_YAW = 30;
/** L'aile ne peut pas être ramenée sous cette fraction de sa position `alaX` : au-delà elle serait enfouie dans la bosse centrale (la contrainte est alors saturée et la règle de vérification le dit). */
export const ALA_PULL_MAX = 0.4;

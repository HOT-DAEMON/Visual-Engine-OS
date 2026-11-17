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

/**
 * LARGEUR DE FACE DU NEZ 3D CONTRE SA SILHOUETTE 2D, PAR CALCUL (aucun rendu). Pure, déterministe.
 * Emprise frontale (lacet 0) de la bosse centrale (demi-largeur = nœuds de `spec.nose.knots`, qui viennent de la silhouette 2D du moteur de nez) et d'une aile (ellipsoïde, côté x > 0) :
 * rapport = demi-largeur maximale de l'union ÷ demi-largeur maximale de la seule silhouette. 1 = la 3D ne dépasse pas la silhouette 2D ; avant l'ancrage du bord externe : 1,50–1,54.
 * Mesure et arbitrage contre la planche de rotation : docs/NOSE-WIDTH-3D.md.
 */
export function frontWidthRatio(s: HeadTurnSpec, ala: AlaEllipsoid): number {
  const k = s.nose.knots, y0 = k[0]![0], y1 = k[k.length - 1]![0], N = 400;
  const half = (y: number): number => {
    if (y <= y0) return k[0]![2];
    for (let i = 0; i + 1 < k.length; i++) { const a = k[i]!, b = k[i + 1]!; if (y <= b[0]) return a[2] + (b[2] - a[2]) * ((y - a[0]) / (b[0] - a[0] || 1)); }
    return k[k.length - 1]![2];
  };
  let m2 = 1e-9, m3 = 1e-9;
  for (let i = 0; i <= N; i++) {
    const y = y0 + ((y1 - y0) * i) / N, w = half(y), t = (y - ala.c.y) / ala.ey, wa = Math.abs(t) < 1 ? Math.abs(ala.c.x) + ala.ex * Math.sqrt(1 - t * t) : 0;
    m2 = Math.max(m2, w); m3 = Math.max(m3, w, wa);
  }
  return m3 / m2;
}

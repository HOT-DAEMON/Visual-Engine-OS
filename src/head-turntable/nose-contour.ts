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

/** Lacet auquel la contrainte « l'aile reste dans le contour de la joue » a été posée en premier : la vue à 30° où le défaut a été mesuré (docs/NOSE-ALAR-SEAT.md). */
export const ALA_CONTOUR_YAW = 30;
/** L'aile ne peut pas être ramenée sous cette fraction de sa position `alaX` : au-delà elle serait enfouie dans la bosse centrale (la contrainte est alors saturée et la règle de vérification le dit). */
export const ALA_PULL_MAX = 0.4;
/**
 * Tolérance de débordement à 45° (U) : 1 pixel de la planche de rotation (1 U = 150 px, soit 0,0067). MESURE (docs/NOSE-YAW45.md) : le nez de la planche (`REF_SPEC`, ajusté sur les 9 vues)
 * ne dépasse pas le contour de la joue à 20°, 30° ni 45° (débordement 0 par rendu et par calcul) ; il le dépasse seulement à 60° (0,025) et 70° (0,038, bande mesurée sur les pixels 0,023–0,057).
 * Calibrée sur UN seul nez stylisé : borne de style, pas un canon anatomique (un nez réaliste dépasse plus tôt).
 */
export const ALA_TOL_45 = 0.0067;
/**
 * Bornes de contour : à chaque lacet `yaw` (°), l'aile peut dépasser le contour de la joue d'au plus `tol` (U), et la contrainte peut rappeler l'aile d'au plus `maxPull` × `alaX` vers l'axe.
 * 30° : rappel jusqu'à 0,6 (limite d'enfouissement dans la bosse centrale). 45° : rappel plafonné à 0,25, le seuil au-delà duquel la règle `eng.nose.alar-pull` dit « nez trop large pour le modèle 3D » :
 * au-delà, rappeler l'aile efface les ailes de face (mesuré, docs/NOSE-YAW45.md §5) ; le débordement résiduel est alors REPORTÉ par la règle `eng.nose.alar-contour-45`, pas caché.
 * Au-delà de 45° (60°, 70°) : NON borné, la planche montre le nez qui sort du contour.
 */
export interface ContourBound { readonly yaw: number; readonly tol: number; readonly maxPull: number }
export const ALA_CONTOUR_BOUNDS: readonly ContourBound[] = [{ yaw: ALA_CONTOUR_YAW, tol: 0, maxPull: 1 - ALA_PULL_MAX }, { yaw: 45, tol: ALA_TOL_45, maxPull: 0.25 }];

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

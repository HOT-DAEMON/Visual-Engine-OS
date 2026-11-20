import { skullGeometry } from '../skull/geometry';

import { skullOf } from './engines/skull-of';
import { faceAsymmetry, skullRelief } from './engines/skull-relief';
import { vaultRelief } from './engines/vault-relief';
import { silhouetteProfile } from './silhouette';
import { vaultRender } from './vault-lab';
import type { HeadTurnSpec } from './types';
import { check, type Check } from './verify-types';

/**
 * VÉRIFICATION DE RENDU, PASSE 3 (`docs/SKULL-VAULT-3.md`) : cohérence GÉOMÉTRIQUE (symétrie du relief pariétal, accord entre le contour de profil 2D et la silhouette 3D), ANATOMIQUE (le sillon est SOUS la ligne nuchale,
 * la mastoïde reste derrière l'oreille et ne déborde pas sur la tempe) et de STYLE (voir `verify-vault-2.ts` : le sillon est une bosse creuse lisse, il passe par les mêmes contrôles de contour et de courbure).
 * Bornes écrites avant la mesure (convention : 1,5 × le pire cas mesuré sur les têtes nominales, comme les passes 1 et 2), données dans `docs/SKULL-VAULT-VALIDATION-3.md`.
 */
const G = 'geometry' as const, A = 'anatomy' as const, D = Math.PI / 180;
/** Accord 2D / 3D : hauteurs normalisées t (depuis le sommet) où l'on compare le contour postérieur ; la référence (décalage constant des deux repères) est prise à t = 0,3. Au-dessus de t = 0,1 le sommet 2D (apex) et 3D (pôle de la coupe) n'ont pas la même définition. */
export const AGREE = { ts: Array.from({ length: 10 }, (_, i) => 0.1 + i * 0.05), ref: 4, H: 1000 } as const;
/** Bornes : accord 2D / 3D sur 12 têtes nominales (pire 0,012 U ; borne 1,5 ×) ; mastoïde hors de la tempe (voir plus bas). */
export const AGREE_NOMINAL_MAX = 0.018, AGREE_INFO_MAX = 0.1, MASTOID_TAIL_MAX = 0.008;

const backAt = (poly: readonly { x: number; y: number }[], y: number): number => {
  let m = Infinity;
  for (let i = 0; i + 1 < poly.length; i++) { const a = poly[i]!, b = poly[i + 1]!; if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) m = Math.min(m, a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y)); }
  return m;
};
/** Écart maximal (U) entre le contour POSTÉRIEUR du profil 2D (moteur `src/skull`, mode os) et celui de la silhouette 3D (profil 90°, sans cheveux), aux mêmes hauteurs, à un décalage constant près (les deux repères n'ont pas la même origine). */
export function profileAgreement(spec: HeadTurnSpec): number {
  const e = spec.engine!, g = skullGeometry(e.p as never, skullOf(e), AGREE.H), s3 = silhouetteProfile(vaultRender(spec, 'profil', 400, false), AGREE.ts).map((q) => q.right);
  const b2 = AGREE.ts.map((t) => -backAt(g.poly, t * AGREE.H) / AGREE.H); let m = 0;
  for (let i = 0; i < AGREE.ts.length && i < s3.length; i++) m = Math.max(m, Math.abs(b2[i]! - b2[AGREE.ref]! - (s3[i]! - s3[AGREE.ref]!)));
  return m;
}
/** Relief pariétal (éminences, asymétries) : écart maximal gauche / droite (U) quand rien d'asymétrique n'est demandé (propre ou reporté du visage) ; 0 quand une asymétrie est demandée (le contrôle ne s'applique pas). */
function parietalAsymmetry(spec: HeadTurnSpec): number {
  const e = spec.engine!, k = skullOf(e);
  if (k.asymParietal || k.asymParietalHeight || k.asymParietalAzimuth || k.asymOccipital || k.asymFrontal || k.asymFaceCoupling * faceAsymmetry(e) !== 0) return 0;
  let m = 0; for (let y = 0.05; y < 0.9; y += 0.05) for (let az = 10; az <= 170; az += 10) m = Math.max(m, Math.abs(skullRelief(e, y, az * D) - skullRelief(e, y, -az * D)));
  return m;
}
/** Relief de la seule mastoïde (mêmes paramètres, tout le reste à 0 : tête de référence) à moins de 40° d'azimut (le front et l'avant de la tempe, à 78° du processus) : elle ne doit pas s'y étendre. */
function mastoidTail(spec: HeadTurnSpec): number {
  const e = spec.engine!, k = skullOf(e), only = { mastoid: k.mastoid, mastoidSize: k.mastoidSize, mastoidDirection: k.mastoidDirection, mastoidSlope: k.mastoidSlope, asymMastoid: k.asymMastoid, asymMastoidDirection: k.asymMastoidDirection, scalp: k.scalp, boneShow: k.boneShow };
  const ref = { ...e, fit: { ...e.fit, skull: { ...Object.fromEntries(Object.keys(e.fit.skull).map((q) => [q, undefined])), ...only } } } as typeof e;
  let m = 0; for (let y = 0.2; y < 0.8; y += 0.02) for (let az = 0; az <= 40; az += 4) m = Math.max(m, Math.abs(vaultRelief(ref, y, az * D)), Math.abs(vaultRelief(ref, y, -az * D)));
  return m;
}
/** Hauteur (U) du maximum d'un terme du relief (sillon : creux ; ligne nuchale : saillie), mesurée à la nuque (azimut 180°) comme DIFFÉRENCE de deux têtes identiques sauf ce terme. Les deux termes subissent le MÊME poids de crâne (qui s'éteint vers la nuque : sur une tête où l'inion est bas, il remonte les deux pics) : on compare donc leur ORDRE, pas une hauteur absolue. */
function termPeakY(spec: HeadTurnSpec, term: 'nuchalGroove' | 'nuchalLine'): number {
  const e = spec.engine!, k = skullOf(e), mk = (o: object) => ({ ...e, fit: { ...e.fit, skull: { ...e.fit.skull, nuchalGroove: 0, nuchalLine: 0, scalp: k.scalp, boneShow: k.boneShow, ...o } } }) as typeof e;
  const a = mk({}), b = mk({ [term]: 1 }), s = term === 'nuchalGroove' ? -1 : 1; let best = { d: 0, y: 0 };
  for (let y = 0.3; y < 0.8; y += 0.001) { const d = s * (vaultRelief(b, y, Math.PI) - vaultRelief(a, y, Math.PI)); if (d > best.d) best = { d, y }; }
  return best.y;
}

export function vaultGeometryChecks3(spec: HeadTurnSpec): Check[] {
  return [
    check(G, 'vault.geo.symmetry.parietal', 'Relief pariétal symétrique gauche / droite quand aucune asymétrie (propre ni reportée du visage) n\'est demandée : écart maximal (U) [0 = rien à reprocher]', parietalAsymmetry(spec), 0, 1e-9),
    check(G, 'vault.geo.profile2d3d', 'Accord du contour POSTÉRIEUR du profil 2D et de la silhouette 3D (t de 0,1 à 0,55 U, à un décalage constant près) : écart maximal (U) [information : 12 têtes nominales ≤ 0,012 (borne stricte 0,018, testée) ; des extrêmes divergent jusqu\'à 0,076 (vaultHeight = 0), borne d\'information 0,1 ; voir docs/SKULL-VAULT-3.md]', profileAgreement(spec), 0, AGREE_INFO_MAX, 'info'),
  ];
}
export function vaultAnatomyChecks3(spec: HeadTurnSpec): Check[] {
  const e = spec.engine!, k = skullOf(e);
  return [
    check(A, 'vault.anat.groove.below', 'Sillon nuchal SOUS la ligne nuchale (y vers le bas) : hauteur du creux maximal moins hauteur de la saillie maximale de la ligne nuchale, mesurées sur le relief avec le même poids de crâne (U) [canon : strictement dessous, 0,002 – 0,1 U (résolution 0,001 U ; nominal ≈ 0,025 ; tête à inion très bas ≈ 0,005) ; 0,05 = sans objet quand le paramètre est nul]', k.nuchalGroove === 0 ? 0.05 : termPeakY(spec, 'nuchalGroove') - termPeakY(spec, 'nuchalLine'), 0.002, 0.1),
    check(A, 'vault.anat.mastoid.local', 'Mastoïde derrière l\'oreille : relief de la seule mastoïde à moins de 40° d\'azimut (front, avant de la tempe), maximal (U) [≤ 0,008 U ≈ 1,8 mm ; pire cas des coins de taille / direction / pente sous cuir chevelu mince et os apparent : 0,0051 U, borne = 1,5 × le pire ; avant la passe 3 le cône laissait ≈ 0,01 U à 78° du processus]', mastoidTail(spec), 0, MASTOID_TAIL_MAX),
  ];
}

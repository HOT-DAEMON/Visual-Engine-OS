/**
 * FORME DE LA MASTOÏDE : source UNIQUE, lue par le relief 3D (`head-turntable/engines/vault-relief.ts`) et par le dessin du profil 2D (`skull/render-detail.ts`). Pure (aucune dépendance).
 * Paramètres `mastoidSize`, `mastoidDirection`, `mastoidSlope` (conventions d'anatomie artistique, nominal 0 = l'ancienne gaussienne de σ = 13° d'azimut × 0,055 U) :
 *   taille   ×(1 + 0,5 s) au-dessus de 0, ×(1 + 0,4 s) en dessous (0,6 … 1,5) ; l'amplitude suit la taille ;
 *   direction l'axe long tourne de ±35° dans le plan (azimut, hauteur) et s'allonge de 50 % à ±1 (aire conservée) : le processus réel est un cône allongé à pointe antéro-inférieure ;
 *   pente    le profil exp(−½ r^(2p)) passe de p = 0,55 (cône) à 1,45 (plateau) ; p = 1 est la gaussienne d'origine.
 */
export const AZ_U = 0.0055;   // U par degré d'azimut au niveau de la largeur maximale
/** `tail0` / `tail1` : rayons elliptiques (en σ) entre lesquels la queue d'un profil CONIQUE est fondue jusqu'à 0 (passe 3, `docs/SKULL-VAULT-3.md` : le cône exp(−½ r^1,1) laissait ≈ 2 mm de relief à 60° du processus, sur la tempe). Sans effet pour p ≥ 1 (nominal et plateau identiques). */
export const MASTOID_SHAPE = { sAz: 0.0715, sY: 0.055, sizeUp: 0.5, sizeDown: 0.4, tiltDeg: 35, stretch: 0.5, slopeK: 0.45, tail0: 2, tail1: 4 } as const;

interface Axes { readonly f: number; readonly su: number; readonly sv: number; readonly cs: number; readonly sn: number; readonly p: number }
function axes(size: number, dir: number, slope: number, M = MASTOID_SHAPE): Axes {
  const f = 1 + (size >= 0 ? M.sizeUp : M.sizeDown) * size, el = 1 + M.stretch * Math.abs(dir), phi = (-dir * M.tiltDeg * Math.PI) / 180;
  return { f, su: M.sAz * f * el, sv: (M.sY * f) / Math.sqrt(el), cs: Math.cos(phi), sn: Math.sin(phi), p: 1 + M.slopeK * slope };
}

/** Valeur (0 … taille) du relief au point (azimut `az`, hauteur `y`) pour une mastoïde centrée en (`azM`, `yM`). */
export function mastoidBump(y: number, az: number, yM: number, azM: number, size: number, dir: number, slope: number): number {
  const a = axes(size, dir, slope), dx = (az - azM) * AZ_U, dy = y - yM;
  const u = (dx * a.cs + dy * a.sn) / a.su, v = (-dx * a.sn + dy * a.cs) / a.sv;
  const lam = Math.min(1, (1 - a.p) / MASTOID_SHAPE.slopeK);   // 0 pour p ≥ 1 ; 1 pour le cône pur
  let win = 1;
  if (lam > 0) { const t = Math.min(1, Math.max(0, (Math.hypot(u, v) - MASTOID_SHAPE.tail0) / (MASTOID_SHAPE.tail1 - MASTOID_SHAPE.tail0))); win = 1 - lam * t * t * (3 - 2 * t); }
  return a.f * Math.exp(-0.5 * (u * u + v * v) ** a.p) * win;
}

/** Contour (U, relatif au centre ; x = côté de l'azimut croissant, y vers le bas) où le relief vaut la fraction `level` (0 … 1) de son maximum : sert au dessin 2D de la forme. */
export function mastoidContour(level: number, size: number, dir: number, slope: number, n = 36): { x: number; y: number }[] {
  const a = axes(size, dir, slope), r = (-2 * Math.log(level)) ** (1 / (2 * a.p)), out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n, u = r * a.su * Math.cos(t), v = r * a.sv * Math.sin(t);
    out.push({ x: u * a.cs - v * a.sn, y: u * a.sn + v * a.cs });
  }
  return out;
}

import { clamp } from '../../../core/math';
import type { FaceLandmarks } from '../../landmarks';
import { halfWidthAt } from '../../outline';
import { neckOf } from '../../pose/neck';
import { skullOf } from '../../pose/skull';

/** Point 3D du repère de l'hôte : x vers la droite de l'image, y vers le bas, z vers la caméra (même convention que `pose/tree.ts`). */
export interface V3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Point de la surface du crâne après rotation de la tête : position projetée (orthographique), profondeur, visibilité. */
export interface Projected {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly visible: boolean;
}

/**
 * SURFACE DU CRÂNE en coordonnées (hauteur y, azimut az). C'est le support de la lisière : chaque point de la lisière est
 * posé SUR cette surface, donc il suit la tête quand elle tourne et il est cohérent avec la forme réelle du contour.
 *  - section horizontale à la hauteur y = ellipse de demi-axes (a(y), b(y)) ;
 *  - a(y) = demi-largeur du VRAI contour de face (le contour de face est la silhouette à yaw = 0) ;
 *  - b(y) = demi-profondeur du crâne complet de la pose (`face/pose/skull.ts`) : même modèle que les yeux, le nez et les oreilles ;
 *  - az : 0 = face, +π/2 = côté droit de l'image, π = nuque.
 */
export interface SkullSurface {
  readonly topY: number;
  readonly chinY: number;
  /** Ordonnée du pivot de la tête (haut du cou) : le tangage tourne autour de ce point. */
  readonly pivotY: number;
  a(y: number): number;
  b(y: number): number;
  point(y: number, az: number): V3;
  /** Normale EXACTE (unitaire, vers l'extérieur) de la surface (x/a(y))² + (z/b(y))² = 1 au point (y, az) : gradient avec la pente verticale de a et b. */
  normal(y: number, az: number): V3;
  /** Azimut du point de face (x, y) sur l'hémisphère avant (inverse de la projection à yaw = 0). */
  azOf(x: number, y: number): number;
  /** Rotation Y (lacet) puis X (tangage) autour du pivot, projection orthographique ; visible = normale tournée vers la caméra. */
  project(y: number, az: number, yawDeg: number, pitchDeg: number): Projected;
}

const RAD = Math.PI / 180;

export function skullSurface(lm: FaceLandmarks): SkullSurface {
  const skull = skullOf(lm);
  const { topY, chinY } = skull;
  const pivotY = neckOf(lm, skull).topY;
  const yy = (y: number): number => clamp(y, topY + 1e-3, chinY - 1e-3);
  const a = (y: number): number => halfWidthAt(lm.outline, yy(y));
  // Profondeur : même ellipsoïde que le crâne de la pose au-dessus du milieu du crâne ; en dessous, elle décroît plus lentement (demi-axe ×1,32) pour valoir
  // ≈ 0,65 rz à la mâchoire. Le crâne de la pose (`skull.zAt`) se referme à 0 à la mâchoire puis saute à 0,62 rz : un pôle sans réalité anatomique
  // (derrière la mâchoire il y a l'occiput et le cou), qui dégénérait la section de la nuque. Plancher 0,3 rz.
  const ryTop = Math.max(1e-6, skull.cy - topY);
  const ryBot = 1.316 * Math.max(1e-6, skull.jawY - skull.cy);
  const b = (y: number): number => {
    const u = (yy(y) - skull.cy) / (yy(y) <= skull.cy ? ryTop : ryBot);
    return Math.max(0.3 * skull.rz, skull.rz * Math.sqrt(Math.max(0, 1 - u * u)));
  };
  const point = (y: number, az: number): V3 => ({ x: a(y) * Math.sin(az), y, z: b(y) * Math.cos(az) });
  const normal = (y: number, az: number): V3 => {
    const e = 1e-3 * (chinY - topY);
    const da = (a(y + e) - a(y - e)) / (2 * e);
    const db = (b(y + e) - b(y - e)) / (2 * e);
    const sn = Math.sin(az);
    const cs = Math.cos(az);
    const v = { x: sn / a(y), y: -(sn * sn * da / a(y) + cs * cs * db / b(y)), z: cs / b(y) };
    const n = Math.hypot(v.x, v.y, v.z) || 1;
    return { x: v.x / n, y: v.y / n, z: v.z / n };
  };
  const azOf = (x: number, y: number): number => Math.asin(clamp(x / Math.max(a(y), 1e-6), -1, 1));
  const project = (y: number, az: number, yawDeg: number, pitchDeg: number): Projected => {
    const P = point(y, az);
    // Normale de la section elliptique (la pente verticale est négligée : la visibilité ne dépend que de l'azimut).
    const n0 = { x: Math.sin(az) / a(y), z: Math.cos(az) / b(y) };
    const ny = Math.hypot(n0.x, n0.z) || 1;
    const cy = Math.cos(yawDeg * RAD);
    const sy = Math.sin(yawDeg * RAD);
    const cp = Math.cos(pitchDeg * RAD);
    const sp = Math.sin(pitchDeg * RAD);
    const x1 = P.x * cy + P.z * sy;
    const z1 = -P.x * sy + P.z * cy;
    const dy = P.y - pivotY;
    const nx1 = (n0.x * cy + n0.z * sy) / ny;
    const nz1 = (-n0.x * sy + n0.z * cy) / ny;
    // Le tangage mélange la profondeur et la verticale : la composante verticale de la normale reste nulle avant rotation X.
    const nz2 = nz1 * cp;
    return { x: x1, y: dy * cp - z1 * sp + pivotY, z: dy * sp + z1 * cp, visible: nz2 > 0.05 && Number.isFinite(nx1) };
  };
  return { topY, chinY, pivotY, a, b, point, normal, azOf, project };
}

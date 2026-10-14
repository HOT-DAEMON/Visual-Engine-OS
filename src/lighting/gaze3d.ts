import { rad } from '../core/math';
import { num } from '../core/svg';
import type { EyeSpec } from '../schema';

/**
 * Le globe oculaire est un point sur une sphère qui tourne dans son orbite, indépendamment de la
 * rotation de l'œil entier (`transform.rotationDeg`, qui pivote aussi les paupières). Ce module ne
 * fait que projeter cette rotation en 2D — orthographique, comme le reste du moteur (voir light.ts).
 *
 * Repère : x à droite, y vers le bas (SVG). yaw>0 : le globe tourne vers la droite (regard à droite).
 * pitch>0 : le globe tourne vers le bas (regard vers le bas).
 */
export interface GazeProjection {
  /** Décalage du centre de l'iris/pupille, repère local de l'œil, unités = mêmes que la géométrie de l'œil. */
  readonly dx: number;
  readonly dy: number;
  /** Composante du regard le long de l'axe de vue, dans (0, 1] : 1 = regard de face, → 0 = de profil. */
  readonly foreshortening: number;
  /** Angle (degrés) de l'axe le long duquel l'iris se compreste (direction du déplacement projeté). */
  readonly tiltDeg: number;
}

/**
 * Projette la rotation 3D du globe. `radius` = rayon du globe (unités locales) ; `travel` amplifie ou
 * réduit le déplacement apparent pour un même angle (globe plus ou moins enfoncé dans l'orbite).
 * PHYSIQUE (projection orthographique d'un point sur une sphère) : dx = R·sin(yaw)·cos(pitch),
 * dy = R·sin(pitch), foreshortening = cos(yaw)·cos(pitch) (composante du vecteur unitaire vers la
 * caméra) — c'est aussi le facteur de compression exact d'un disque de normale `v` vu de face.
 */
export function projectGaze(yawDeg: number, pitchDeg: number, radius: number, travel: number): GazeProjection {
  const yaw = rad(yawDeg);
  const pitch = rad(pitchDeg);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const vx = sy * cp;
  const vy = sp;
  const foreshortening = Math.max(0.05, cy * cp);
  const dx = radius * travel * vx;
  const dy = radius * travel * vy;
  const tiltDeg = Math.abs(vx) < 1e-9 && Math.abs(vy) < 1e-9 ? 0 : (Math.atan2(vy, vx) * 180) / Math.PI;
  return { dx, dy, foreshortening, tiltDeg };
}

/** Rayon du globe : proportionnel à la hauteur de l'œil (approx. d'un globe partiellement enchâssé). */
export function eyeballRadius(eye: EyeSpec): number {
  return eye.shape.height * 0.62;
}

export function gazeOf(eye: EyeSpec): GazeProjection {
  return projectGaze(eye.gaze.yawDeg, eye.gaze.pitchDeg, eyeballRadius(eye), eye.gaze.travel);
}

/**
 * Transformation SVG qui applique le raccourcissement (foreshortening) autour d'un centre, en
 * conservant l'orientation locale du contenu dessiné (aspect de l'iris, fibres, etc.) : une mise à
 * l'échelle anisotrope le long de `tiltDeg`, réalisée par rotation → scale(f, 1) → rotation inverse.
 * À foreshortening = 1 (regard de face), c'est l'identité.
 */
export function foreshortenTransform(cx: number, cy: number, g: GazeProjection): string {
  if (g.foreshortening >= 0.999) return '';
  const t = num(g.tiltDeg);
  const f = num(g.foreshortening);
  return `translate(${num(cx)} ${num(cy)}) rotate(${t}) scale(${f} 1) rotate(${num(-g.tiltDeg)}) translate(${num(-cx)} ${num(-cy)})`;
}

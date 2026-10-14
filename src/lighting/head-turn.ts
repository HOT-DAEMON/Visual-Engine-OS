import { rad } from '../core/math';
import type { LightVector } from './light';
import { projectGaze, type GazeProjection } from './gaze3d';

/**
 * Rotation 3D de la TÊTE (pas du globe oculaire dans son orbite — voir gaze3d.ts, qui reste
 * combinable par-dessus) : la tête tourne autour de son propre axe, l'enveloppe palpébrale entière
 * (paupières, cils, sourcil, caroncule, pli) se raccourcit et se décale en conséquence, comme un
 * élément porté par une surface qui pivote. Approximation 2.5D assumée (pas de maillage de tête
 * réel) : l'œil est traité comme un point sur une sphère de rayon `headRadius`, exactement la même
 * physique de projection orthographique que `gaze3d.ts` — réutilisée telle quelle, pas réinventée.
 *
 * Limite assumée : sans hôte/visage, il n'y a pas de nez pour occulter partiellement l'œil côté
 * nez à un angle marqué — seuls le raccourcissement et le décalage de parallaxe sont modélisés.
 */
export function headTurnOf(yawDeg: number, pitchDeg: number, headRadius: number): GazeProjection {
  return projectGaze(yawDeg, pitchDeg, headRadius, 1);
}

/** Rotation 3D autour de l'axe VERTICAL (Y) — tête qui tourne comme pour dire « non ». */
function rotateY(v: LightVector, angleDeg: number): LightVector {
  const a = rad(angleDeg);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { ...v, x: v.x * c + v.z * s, z: -v.x * s + v.z * c };
}

/** Rotation 3D autour de l'axe HORIZONTAL (X) — tête qui incline comme pour dire « oui ». */
function rotateX(v: LightVector, angleDeg: number): LightVector {
  const a = rad(angleDeg);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { ...v, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
}

/**
 * Exprime la lumière DU MONDE dans le repère local d'une tête tournée de `yawDeg`/`pitchDeg` —
 * rotation inverse de celle de la tête (même principe que `light.ts#toLocal` pour la rotation 2D
 * dans le plan, étendu ici aux deux axes 3D supplémentaires). C'est ce qui fait que l'ombrage reste
 * physiquement cohérent : une tête qui se détourne de la lumière s'assombrit réellement, elle ne se
 * contente pas de changer de silhouette.
 */
export function rotateLightForHeadTurn(v: LightVector, yawDeg: number, pitchDeg: number): LightVector {
  return rotateX(rotateY(v, -yawDeg), -pitchDeg);
}

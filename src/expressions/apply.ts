import { clamp } from '../core/math';
import type { EyeSpec } from '../schema';
import { DELTAS } from './deltas';

/**
 * Retourne un œil dont la pose (ouverture, pli, sourcil, regard, pupille) a été ajustée pour
 * l'expression demandée. Si `eye.expression` est absent ou 'neutral' à intensité 0, retourne `eye`
 * inchangé (même référence).
 */
export function applyExpression(eye: EyeSpec): EyeSpec {
  const expr = eye.expression;
  if (!expr || expr.kind === 'neutral' || expr.intensity <= 0) return eye;
  const k = expr.intensity;
  const d = DELTAS[expr.kind];

  const shape = {
    ...eye.shape,
    openness: clamp(eye.shape.openness + d.openness * k, 0.05, 1.2),
    upperFraction: clamp(eye.shape.upperFraction + d.upperFraction * k, 0.4, 0.8),
    tiltDeg: clamp(eye.shape.tiltDeg + d.tiltDeg * 30 * k, -30, 30),
  };
  const lids = {
    ...eye.lids,
    crease: { ...eye.lids.crease, depth: clamp(eye.lids.crease.depth + d.creaseDepthAdd * k, 0, 1) },
  };
  const eyebrow = eye.eyebrow
    ? {
        ...eye.eyebrow,
        gap: clamp(eye.eyebrow.gap + d.browGap * k, 0, 1),
        tiltDeg: clamp(eye.eyebrow.tiltDeg + d.browTiltDeg * 30 * k, -30, 30),
        arch: clamp(eye.eyebrow.arch + d.browArch * k, 0, 1),
        pinch: clamp(eye.eyebrow.pinch + d.browPinch * k, -1, 1),
      }
    : null;
  const gaze = { ...eye.gaze, pitchDeg: clamp(eye.gaze.pitchDeg + d.pitchDeg * 35 * k, -35, 35) };
  const pupil = { ...eye.pupil, size: clamp(eye.pupil.size + d.pupilSize * k, 0.12, 0.7) };

  return { ...eye, shape, lids, eyebrow, gaze, pupil };
}

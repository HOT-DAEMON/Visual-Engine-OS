import { drawSkinAxes } from './random-axes';
import { range, maybe } from './random-eye-helpers';
import type { FaceParamsInput } from '../schema';

export type ExpressionKind = 'neutral' | 'angry' | 'sad' | 'fearful' | 'melancholic' | 'drowsy' | 'surprised' | 'sulky' | 'furious' | 'joyful' | 'smiling' | 'fierce' | 'stressed';
export const FACE_EXPRESSIONS: readonly ExpressionKind[] = ['neutral', 'neutral', 'neutral', 'angry', 'sad', 'fearful', 'melancholic', 'drowsy', 'surprised', 'sulky', 'furious', 'joyful', 'smiling', 'fierce', 'stressed'];

/** Teinte de peau : clarté et sous-ton INDÉPENDANTS (voir `random-axes.ts`). */
export function drawSkin(rnd: () => number): string {
  return drawSkinAxes(rnd).color;
}

/** Bouche induite par l'expression, pour que les yeux et la bouche racontent la même émotion. */
export function mouthFor(kind: ExpressionKind, k: number): { curve: number; open: number } {
  const t: Record<ExpressionKind, [number, number]> = {
    neutral: [0.05, 0], angry: [-0.5, 0.05], sad: [-0.8, 0], fearful: [-0.3, 0.45], melancholic: [-0.5, 0], drowsy: [0, 0.05], surprised: [0, 0.85],
    sulky: [-0.7, 0], furious: [-0.3, 0.55], joyful: [0.9, 0.55], smiling: [0.75, 0.05], fierce: [-0.1, 0.2], stressed: [-0.4, 0.12],
  };
  const [curve, open] = t[kind];
  return { curve: curve * k, open: open * k };
}

/** Proportions du visage. Ordre de tirage FIXE (ajouter un trait plus tard ne décale pas les existants). */
export function drawFaceParams(rnd: () => number, mouth: { curve: number; open: number }): FaceParamsInput {
  return {
    jawWidth: range(rnd, 0.58, 0.95),
    chinWidth: range(rnd, 0.1, 0.4),
    templeY: range(rnd, 0.28, 0.44),
    jawY: range(rnd, 0.68, 0.82),
    eyeLine: range(rnd, 0.42, 0.56),
    eyeGap: range(rnd, 0.14, 0.3),
    blush: maybe(rnd, 0.35) ? range(rnd, 0.3, 1) : 0,
    nose: { length: range(rnd, 0.1, 0.2), width: range(rnd, 0.1, 0.24), nostril: range(rnd, 0.2, 1), bridge: range(rnd, 0, 0.9) },
    mouth: { y: range(rnd, 0.76, 0.86), width: range(rnd, 0.2, 0.4), upperLip: range(rnd, 0.1, 0.8), lowerLip: range(rnd, 0.2, 0.9), curve: Math.max(-1, Math.min(1, mouth.curve + range(rnd, -0.1, 0.1))), open: Math.max(0, Math.min(1, mouth.open)), color: null },
    ears: { visible: maybe(rnd, 0.95), size: range(rnd, 0.06, 0.13), aspect: range(rnd, 1.3, 2.2), tiltDeg: range(rnd, 0, 18) },
  };
}

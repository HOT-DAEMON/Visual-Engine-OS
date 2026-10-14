import type { IrisPaletteOptions } from './palette';
import type { SceneInput } from '../schema';

export type EyeInput = Extract<SceneInput['objects'][number], { kind: 'eye' }>;

export const pick = <T>(rnd: () => number, options: readonly T[]): T => {
  const o = options[Math.floor(rnd() * options.length)];
  if (o === undefined) throw new Error('generateRandomEye: options vide');
  return o;
};
export const range = (rnd: () => number, lo: number, hi: number): number => lo + rnd() * (hi - lo);
export const maybe = (rnd: () => number, p: number): boolean => rnd() < p;

export interface RandomEyeOptions {
  readonly id?: string;
  readonly irisFamilies?: IrisPaletteOptions['families'];
  /** Force une expression plutôt que d'en tirer une au hasard (mettre 'neutral' pour désactiver). */
  readonly expression?: EyeInput['expression'];
}

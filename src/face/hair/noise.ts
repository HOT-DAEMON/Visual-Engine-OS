import { mulberry32 } from '../../core/prng';

/** Interpolation en S : dérivée nulle aux bornes, donc des transitions sans cassure. */
export const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** Bruit de valeurs 1D lisse et DÉTERMINISTE (graine → table de 64 valeurs en [-1, 1], périodique). */
export function noise1(seed: number): (x: number) => number {
  const r = mulberry32(seed >>> 0);
  const tab = Array.from({ length: 64 }, () => r() * 2 - 1);
  const at = (i: number): number => tab[((i % 64) + 64) % 64] as number;
  return (x) => {
    const i = Math.floor(x);
    const a = at(i);
    return a + (at(i + 1) - a) * smoothstep(x - i);
  };
}

export const sub = (a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } => ({ x: a.x - b.x, y: a.y - b.y });
export const unit = (a: { x: number; y: number }): { x: number; y: number } => {
  const n = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / n, y: a.y / n };
};
export const rot = (a: { x: number; y: number }, ang: number): { x: number; y: number } => ({ x: a.x * Math.cos(ang) - a.y * Math.sin(ang), y: a.x * Math.sin(ang) + a.y * Math.cos(ang) });

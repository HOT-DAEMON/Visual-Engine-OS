/** Couleurs : hex → [r, g, b] (0–255) et mélange linéaire. */
export type RGB = [number, number, number];
export const hex = (c: string): RGB => { const v = parseInt(c.replace('#', ''), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Couleurs : hex → [r, g, b] (0–255) et mélange linéaire. */
export type RGB = [number, number, number];
export const hex = (c: string): RGB => { const v = parseInt(c.replace('#', ''), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Luminance relative (WCAG) d'une couleur 0–255 et rapport de contraste entre deux couleurs (1 = identiques, 21 = noir / blanc). */
export const relLum = (c: readonly number[]): number => { const f = (v: number): number => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!); };
export const contrastRatio = (a: readonly number[], b: readonly number[]): number => { const x = relLum(a), y = relLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

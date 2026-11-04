import { parseHex } from '../core/color';

/** OKLab (Björn Ottosson) : espace perceptuel utilisé pour fixer l'ÉCART ombre/lumière (les références sont mesurées dans le même espace, voir `references/shadow/lighting-stats.json`). */
export interface Lab { readonly L: number; readonly a: number; readonly b: number }
const lin = (c: number): number => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const gam = (v: number): number => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055);
export function toLab(hex: string): Lab {
  const [r, g, b] = parseHex(hex).map(lin) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return { L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s };
}
/** Lab → [r,g,b] 0–255 (non arrondi, borné). */
export function labRgb(c: Lab): [number, number, number] {
  const l = (c.L + 0.3963377774 * c.a + 0.2158037573 * c.b) ** 3, m = (c.L - 0.1055613458 * c.a - 0.0638541728 * c.b) ** 3, s = (c.L - 0.0894841775 * c.a - 1.291485548 * c.b) ** 3;
  const f = (v: number): number => Math.min(255, Math.max(0, gam(v)));
  return [f(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), f(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), f(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
}
export const hexOf = (rgb: readonly number[]): string => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
/** Décale une couleur en L (additif), chroma (facteur) et teinte (degrés, + = vers le jaune/vert dans le cercle OKLab). */
export function lch(hex: string, dL: number, chromaK: number, dHueDeg: number): string {
  const c = toLab(hex), C = Math.hypot(c.a, c.b) * chromaK, h = Math.atan2(c.b, c.a) + (dHueDeg * Math.PI) / 180;
  return hexOf(labRgb({ L: c.L + dL, a: C * Math.cos(h), b: C * Math.sin(h) }));
}
export const deltaL = (a: string, b: string): number => toLab(a).L - toLab(b).L;
/** Ombre froide : (a, b) tirés d'une fraction `t` vers une teinte cible de chroma `chroma` par le CHEMIN DROIT dans le plan a-b (passe par le neutre : désature au lieu de tourner par le rose). */
export function labToward(hex: string, dL: number, targetDeg: number, chroma: number, t: number, chromaK = 1): string {
  const c = toLab(hex), h = (targetDeg * Math.PI) / 180;
  return hexOf(labRgb({ L: c.L + dL, a: (c.a * (1 - t) + chroma * Math.cos(h) * t) * chromaK, b: (c.b * (1 - t) + chroma * Math.sin(h) * t) * chromaK }));
}

/**
 * Utilitaires couleur. Les mélanges se font en lumière linéaire (pas en sRGB brut),
 * ce qui donne des éclaircissements/assombrissements physiquement cohérents.
 */
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function parseHex(hex: string): [number, number, number] {
  if (!HEX_RE.test(hex)) throw new RangeError(`Couleur invalide : ${hex}`);
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

const toLinear = (c8: number): number => {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const toSrgb8 = (l: number): number => {
  const c = l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, Math.round(c * 255)));
};

const hex2 = (n: number): string => n.toString(16).padStart(2, '0');

/** Mélange a→b (t ∈ [0,1]) en lumière linéaire. Retourne #rrggbb minuscule. */
export function mix(a: string, b: string, t: number): string {
  const tt = Math.min(1, Math.max(0, t));
  const A = parseHex(a);
  const B = parseHex(b);
  const ch = (i: 0 | 1 | 2): number => toSrgb8(toLinear(A[i]) * (1 - tt) + toLinear(B[i]) * tt);
  return `#${hex2(ch(0))}${hex2(ch(1))}${hex2(ch(2))}`;
}

export const lighten = (c: string, t: number): string => mix(c, '#ffffff', t);
export const darken = (c: string, t: number): string => mix(c, '#000000', t);

/** Luminance relative (Rec. 709, lumière linéaire) — utile pour les tests. */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

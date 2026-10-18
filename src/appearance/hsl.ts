import { clamp, clamp01 } from '../core/math';
import { parseHex } from '../core/color';

/** Couleur en HSL : `h` en degrés [0, 360), `s` et `l` dans [0, 1]. */
export interface Hsl {
  readonly h: number;
  readonly s: number;
  readonly l: number;
}

/** #rrggbb → HSL (formule standard, sRGB brut : sert aux décalages de TEINTE, pas aux mélanges de lumière). */
export function toHsl(hex: string): Hsl {
  const [r8, g8, b8] = parseHex(hex);
  // Canaux normalisés dans [0, 1].
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  // Gris pur : teinte indéfinie, saturation nulle.
  if (d < 1e-9) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  // La teinte dépend du canal dominant.
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: clamp01(s), l };
}

/** HSL → #rrggbb minuscule. */
export function fromHsl(c: Hsl): string {
  const h = ((c.h % 360) + 360) % 360;
  const s = clamp01(c.s);
  const l = clamp01(c.l);
  const k = (n: number): number => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to8 = (v: number): string => Math.round(clamp01(f(v)) * 255).toString(16).padStart(2, '0');
  return `#${to8(0)}${to8(8)}${to8(4)}`;
}

/** Distance angulaire signée la plus courte de `a` vers `b` (degrés, dans [-180, 180]). */
export const hueDelta = (a: number, b: number): number => ((((b - a) % 360) + 540) % 360) - 180;

/** Tire la teinte de `c` vers `target` de la fraction `t` (chemin le plus court sur le cercle). */
export const pullHue = (c: Hsl, target: number, t: number): Hsl => ({ ...c, h: (c.h + hueDelta(c.h, target) * t + 360) % 360 });

export interface Grade {
  readonly contrast: number;
  readonly saturation: number;
  readonly brightness: number;
}

/**
 * Étalonnage d'une couleur : luminosité (décalage de L), saturation (échelle de S), contraste (écart de L
 * à 0,5 amplifié). Tous les paramètres à 0 renvoient la couleur d'entrée (au quantum 8 bits près).
 */
export function grade(hex: string, g: Grade): string {
  if (g.contrast === 0 && g.saturation === 0 && g.brightness === 0) return hex;
  const c = toHsl(hex);
  const l1 = c.l + g.brightness * 0.3;
  const l2 = 0.5 + (l1 - 0.5) * (1 + g.contrast);
  const s = g.saturation >= 0 ? c.s + (1 - c.s) * g.saturation : c.s * (1 + g.saturation);
  return fromHsl({ h: c.h, s: clamp(s, 0, 1), l: clamp(l2, 0, 1) });
}

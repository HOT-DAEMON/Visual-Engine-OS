import { mix } from '../core/color';
import { clamp01 } from '../core/math';
import type { Appearance } from '../schema/appearance';
import { fromHsl, grade, pullHue, toHsl, type Grade } from './hsl';

/** Teinte visée par les ombres (bleu-violet) et par les lumières chaudes / froides. */
const SHADOW_HUE = 250;
const WARM_HUE = 48;
const COOL_HUE = 195;

/**
 * Apparence RÉSOLUE : toutes les couleurs sont calculées une fois, puis lues par les composants.
 * Contrat : aucune propriété n'est `undefined` ; toutes les couleurs sont des `#rrggbb`.
 */
export interface ResolvedAppearance {
  /** Couleur de base étalonnée (contraste / saturation / luminosité). */
  readonly base: string;
  /** Teinte d'ombre : PROCHE de la base (même famille), décalée vers le bleu-violet. */
  readonly shadow: string;
  /** Teinte de lumière : base éclaircie, décalée vers le chaud (couleurs chaudes) ou le froid (couleurs froides). */
  readonly light: string;
  /** Lumière de contour (liseré). */
  readonly rim: string;
  /** Teinte du reflet (bande blanche en cel : blanc teinté de la lumière). */
  readonly highlight: string;
  /** Couleur le long de la mèche : `t` = 0 racine, 1 pointe (dégradé à N stops, ou base seule). */
  ramp(t: number): string;
  /** Opacité le long de la mèche (stops à opacité < 1 : pointe translucide). */
  rampAlpha(t: number): number;
  /** Ton continu v ∈ [-1, 1] : négatif → vers l'ombre, positif → vers la lumière (mélange en lumière linéaire). */
  tone(v: number, from?: string): string;
  /** Les trois tons du mode cel : lumière, ombre, ombre propre. */
  cel(from?: string): { readonly lit: string; readonly shade: string; readonly core: string };
  readonly spec: Appearance;
}

/** Teinte de lumière dérivée : éclaircie, saturation tempérée, décalage chaud/froid selon la famille de teinte. */
function deriveLight(base: string): string {
  const c = toHsl(base);
  // Couleurs très sombres (noir, brun profond) : sheen bleuté, comme les cheveux noirs réels.
  if (c.l < 0.22) return fromHsl({ h: 218, s: 0.34, l: Math.min(0.62, c.l * 2.6 + 0.28) });
  const target = c.h < 110 || c.h >= 300 ? WARM_HUE : COOL_HUE;
  const p = pullHue(c, target, 0.22);
  return fromHsl({ h: p.h, s: p.s * 0.78, l: Math.min(0.9, p.l + (1 - p.l) * 0.5) });
}

/** Teinte d'ombre dérivée : assombrie, décalée de `shift` vers le bleu-violet (couleur proche de la principale). */
function deriveShadow(base: string, shift: number): string {
  const c = toHsl(base);
  const p = pullHue(c, SHADOW_HUE, shift * 0.55);
  return fromHsl({ h: p.h, s: Math.min(1, p.s * (1 + 0.1 * shift)), l: p.l * (0.62 - 0.08 * shift) });
}

/** Interpolation de couleur et d'opacité entre les stops du dégradé (stops triés par offset). */
function makeRamp(base: string, stops: Appearance['gradient'], g: Grade): { color: (t: number) => string; alpha: (t: number) => number } {
  if (stops.length === 0) return { color: () => base, alpha: () => 1 };
  const colors = stops.map((s) => grade(s.color, g));
  const pick = (t: number): { i: number; f: number } => {
    const x = clamp01(t);
    let i = 0;
    while (i < stops.length - 2 && x > (stops[i + 1] as { offset: number }).offset) i++;
    const a = (stops[i] as { offset: number }).offset;
    const b = (stops[i + 1] as { offset: number }).offset;
    return { i, f: b - a < 1e-9 ? 0 : clamp01((x - a) / (b - a)) };
  };
  if (stops.length === 1) return { color: () => colors[0] as string, alpha: () => (stops[0] as { opacity: number }).opacity };
  return {
    color: (t) => {
      const { i, f } = pick(t);
      return mix(colors[i] as string, colors[i + 1] as string, f);
    },
    alpha: (t) => {
      const { i, f } = pick(t);
      const a = (stops[i] as { opacity: number }).opacity;
      return a + ((stops[i + 1] as { opacity: number }).opacity - a) * f;
    },
  };
}

/** Résout une apparence pour une couleur de base : SOURCE UNIQUE de toutes les teintes d'un composant. */
export function resolveAppearance(baseHex: string, spec: Appearance): ResolvedAppearance {
  const g: Grade = { contrast: spec.contrast, saturation: spec.saturation, brightness: spec.brightness };
  const base = grade(baseHex, g);
  // Teintes IMPOSÉES : étalonnées comme la base. Teintes DÉRIVÉES : calculées depuis la base DÉJÀ étalonnée (un contraste fort
  // ne doit pas écraser ombre et lumière l'une sur l'autre).
  const shadow = spec.light.shadow ? grade(spec.light.shadow, g) : deriveShadow(base, spec.light.shadowShift);
  const light = spec.light.light ? grade(spec.light.light, g) : deriveLight(base);
  const rim = spec.light.rim ? grade(spec.light.rim, g) : mix(light, '#ffffff', 0.35);
  const highlight = spec.reflection.tint ?? mix(light, '#ffffff', 0.78);
  const ramp = makeRamp(base, spec.gradient, g);
  const tone = (v: number, from: string = base): string => (v >= 0 ? mix(from, light, Math.min(1, v) * 0.7) : mix(from, shadow, Math.min(1, -v) * 0.95));
  const cel = (from: string = base): { lit: string; shade: string; core: string } => ({
    lit: mix(from, light, 0.16),
    shade: mix(from, shadow, 0.78),
    core: mix(shadow, '#000000', 0.22),
  });
  return { base, shadow, light, rim, highlight, ramp: ramp.color, rampAlpha: ramp.alpha, tone, cel, spec };
}

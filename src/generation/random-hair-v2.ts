import { fromHsl, toHsl } from '../appearance';
import type { AppearanceInput, FaceHair, FaceParamsInput } from '../schema';
import { maybe, pick, range } from './random-eye-helpers';

/** Tirage pondéré : `weights[i]` est la part de `options[i]` (un seul appel à `rnd`). */
function weighted<T>(rnd: () => number, options: readonly T[], weights: readonly number[]): T {
  let r = rnd() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < options.length; i++) {
    r -= weights[i] as number;
    if (r < 0) return options[i] as T;
  }
  return options[options.length - 1] as T;
}

/** Part des couleurs VIVES parmi les tirages v2 (la v1 n'en produisait que 8 %) : 35 % de remplacement + les 8 % d'origine ≈ 40 %. */
export const VIVID_SHARE = 0.35;

/**
 * Couleur vive : teinte tirée parmi des familles bien espacées (rose, magenta, violet, bleu, cyan, turquoise, vert, lime,
 * jaune, orange, rouge), saturation 0,65–0,95, luminosité 0,42–0,66. Continue en saturation / luminosité, discrète en teinte
 * pour garantir une vraie diversité de familles (pas dix nuances de bleu).
 */
export function drawVividColor(rnd: () => number): string {
  const hue = pick(rnd, [335, 305, 275, 218, 188, 165, 132, 92, 52, 26, 356]) + range(rnd, -9, 9);
  return fromHsl({ h: hue, s: range(rnd, 0.65, 0.95), l: range(rnd, 0.42, 0.66) });
}

/**
 * Dégradé racine → pointe pour une couleur donnée : analogue (teinte voisine ±25–70°, plus claire) ou, pour les couleurs
 * vives, parfois complémentaire. Les naturelles s'éclaircissent seulement (pointes décolorées). Renvoie null = pas de dégradé.
 */
export function drawTip(rnd: () => number, color: string, vivid: boolean): { tip: string; mid: string | null } | null {
  if (!maybe(rnd, vivid ? 0.75 : 0.35)) return null;
  const c = toHsl(color);
  const shift = (maybe(rnd, vivid ? 0.3 : 0) ? 150 + range(rnd, -20, 20) : range(rnd, 25, 70)) * (maybe(rnd, 0.5) ? 1 : -1);
  const tip = fromHsl({ h: c.h + shift, s: vivid ? Math.min(0.95, c.s + 0.05) : c.s * 0.8, l: Math.min(0.82, c.l + range(rnd, 0.08, 0.28)) });
  const mid = maybe(rnd, 0.4) ? fromHsl({ h: c.h + shift * 0.5, s: c.s, l: Math.min(0.78, c.l + 0.08) }) : null;
  return { tip, mid };
}

/** Apparence : ombrage cel (45 %) ou lisse, ombre portée, reflets, effets légers pour les couleurs vives. */
function drawAppearance(rnd: () => number, vivid: boolean): AppearanceInput {
  const cel = maybe(rnd, 0.45);
  return {
    shading: { mode: cel ? 'cel' : 'smooth', bands: maybe(rnd, 0.6) ? 3 : 2, highlightBand: cel ? range(rnd, 0.35, 0.85) : 0, castShadow: maybe(rnd, 0.75) ? range(rnd, 0.35, 0.9) : 0 },
    light: { shadowShift: range(rnd, 0.2, 0.6), rimStrength: range(rnd, 0.2, 0.5) },
    contrast: range(rnd, -0.1, 0.25),
    saturation: vivid ? range(rnd, 0, 0.2) : range(rnd, -0.1, 0.1),
    reflection: { intensity: range(rnd, 0.3, 0.9), size: rnd() },
    glow: { intensity: vivid && maybe(rnd, 0.2) ? range(rnd, 0.15, 0.35) : 0, radius: range(rnd, 0.2, 0.5) },
    bloom: { intensity: vivid && maybe(rnd, 0.15) ? range(rnd, 0.15, 0.4) : 0, radius: range(rnd, 0.2, 0.5), threshold: range(rnd, 0.6, 0.85) },
  };
}

export interface HairV2Options {
  /** Autorise des occlusions du visage tirées au hasard (désactivé par défaut : les yeux sont l'objet principal de la scène). */
  readonly occlusions?: boolean;
}

/**
 * Axes du moteur de cheveux v2. Tirés APRÈS tous les autres axes du visage : proportions, peau, yeux et axes v1 d'une
 * seed existante ne changent pas. Chaque axe est tiré indépendamment (aucun n'en déduit un autre) ; les valeurs
 * incompatibles avec la coiffure (formes flottantes sur un chignon, frange sur une coupe rase) sont écartées ici.
 */
export function drawHairV2(rnd: () => number, hair: { style: FaceHair['style']; color: string; texture: FaceHair['texture'] }, opts: HairV2Options = {}): NonNullable<FaceParamsInput['hair']> & { color: string } {
  const s = hair.style;
  const flat = s === 'bald' || s === 'buzz';
  const tied = s === 'bun' || s === 'ponytail' || s === 'braids';
  const vivid = maybe(rnd, VIVID_SHARE);
  const color = vivid ? drawVividColor(rnd) : hair.color;
  const isVivid = vivid || toHsl(color).s > 0.6;
  const tip = drawTip(rnd, color, isVivid);
  const mode = flat || tied ? 'classic' : weighted(rnd, ['classic', 'ribbons', 'cones', 'mixed'] as const, [30, 28, 17, 25]);
  const flow = { mode, ribbons: Math.round(range(rnd, 4, 10)), sWave: range(rnd, 0.3, 1), span: range(rnd, 0.3, 0.9), float: range(rnd, 0.4, 1), cones: Math.round(range(rnd, 4, 10)), coneSharp: range(rnd, 0.5, 1), wisps: flat ? 0 : maybe(rnd, 0.6) ? Math.round(range(rnd, 4, 16)) : 0 };
  const tex = hair.texture;
  const silhouette = { puff: flat ? 0 : maybe(rnd, 0.7) ? range(rnd, 0.15, tex === 'straight' || tex === 'wavy' ? 0.75 : 0.5) : 0, asymmetry: maybe(rnd, 0.6) ? range(rnd, 0.3, 0.9) : 0, bias: maybe(rnd, 0.5) ? -1 : 1, lift: range(rnd, 0, 0.7) };
  // Une asymétrie de silhouette se voit à l'enveloppe : il faut un minimum de gonflement pour que le gain par côté ait de la matière.
  if (!flat && silhouette.asymmetry > 0.3) silhouette.puff = Math.max(silhouette.puff, 0.2);
  const fe = flat ? 'off' : weighted(rnd, ['off', 'sheer', 'blades', 'wispy', 'asym_brow'] as const, [35, 20, 20, 12, 13]);
  const fringeEngine = { mode: fe, gap: range(rnd, 0.25, 0.8), count: 0, side: maybe(rnd, 0.5) ? -1 : 1, cheekLocks: maybe(rnd, 0.4) };
  const rootLift = flat || !maybe(rnd, 0.5) ? { amount: 0, width: 0.35, fall: 0.5 } : { amount: range(rnd, 0.3, 0.9), width: range(rnd, 0.25, 0.6), fall: range(rnd, 0.3, 0.9) };
  const side = (): { ear: 'auto' | 'covered' | 'free' | 'tucked'; cheek: 'none' | 'short' | 'long' } => ({ ear: weighted(rnd, ['auto', 'covered', 'free', 'tucked'] as const, [40, 20, 25, 15]), cheek: weighted(rnd, ['none', 'short', 'long'] as const, [55, 25, 20]) });
  const sides = { left: side(), right: side() };
  const tc = flat ? 1 : weighted(rnd, [1, 2, 3, 4], [30, 30, 25, 15]);
  const tiers = { count: tc, step: range(rnd, 0.15, 0.4), underTone: range(rnd, -0.5, -0.15), underHue: range(rnd, -30, 30), underVisible: tc > 1 ? range(rnd, 0.5, 0.9) : 0 };
  const tips = { irregular: maybe(rnd, 0.7) ? range(rnd, 0.2, 0.9) : 0, flick: maybe(rnd, 0.5) ? range(rnd, 0.1, 0.8) : 0, fade: maybe(rnd, 0.5) ? range(rnd, 0.1, 0.7) : 0, edgeFade: maybe(rnd, 0.4) ? range(rnd, 0.1, 0.6) : 0 };
  const strands = { mass: maybe(rnd, 0.5) ? range(rnd, 0.1, 0.8) : 0, fine: range(rnd, 0.6, 1), hairline: maybe(rnd, 0.6) ? range(rnd, 0.1, 0.9) : 0 };
  const textures = ['straight', 'wavy', 'curly', 'coily', 'braided'] as const;
  const textureMix = !flat && maybe(rnd, 0.3) ? [{ texture: pick(rnd, textures), weight: range(rnd, 0.3, 1) }, { texture: pick(rnd, textures), weight: range(rnd, 0.3, 1) }] : [];
  const occlusion = opts.occlusions && maybe(rnd, 0.3) ? { eyeLeft: maybe(rnd, 0.5) ? range(rnd, 0.15, 0.55) : 0, eyeRight: maybe(rnd, 0.3) ? range(rnd, 0.15, 0.55) : 0, brows: maybe(rnd, 0.4) ? range(rnd, 0.2, 0.6) : 0, nose: 0, mouth: 0 } : { eyeLeft: 0, eyeRight: 0, brows: 0, nose: 0, mouth: 0 };
  const appearance = drawAppearance(rnd, isVivid);
  return { color, flow, silhouette, fringeEngine, rootLift, sides, tiers, tips, strands, textureMix, occlusion, appearance, look: { tipColor: tip?.tip ?? null, midColor: tip?.mid ?? null, tipReach: range(rnd, 0.35, 0.8) } };
}

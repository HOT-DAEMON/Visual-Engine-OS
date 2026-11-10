import { mulberry32 } from '../core/prng';
import { neckPresetPatch } from '../neck/presets';
import type { FaceParamsInput } from '../schema';
import { maybe, range } from './random-eye-helpers';

/**
 * Tirage du SYSTÈME de cou d'un visage aléatoire (docs/NECK-REMAINING.md). Générateur DÉRIVÉ de la graine par un décalage fixe : il ne consomme JAMAIS le flux des tirages
 * existants, donc les proportions, les yeux, les cheveux et les paramètres plats du cou (largeur, longueur, évasement) d'un visage restent ceux d'avant. Seul `neck.system` varie.
 * Les tirages restent HUMAINS et plausibles (masse, âge, trapèzes, tension, tendons, plis ; fanon seulement si masse ET âge élevés). `variety` ∈ [0,1] est l'amplitude :
 * 0 (DÉFAUT) = cou neutre d'avant (aucun tirage appliqué) : le système modifie le cadre `lm.neck` (largeur, base du corps), donc l'activer déplace la géométrie des visages existants ; il est OPT-IN. Priorité : tirage < preset < `neck` imposé par l'appelant (fusion profonde faite dans `random-face.ts`).
 */
export function drawNeckSystem(seed: number, variety = 0): Record<string, unknown> | null {
  if (variety <= 0) return null;
  const r = mulberry32(((seed >>> 0) ^ 0x6e65636b) >>> 0), v = Math.min(1, variety);
  const u = (lo: number, hi: number): number => { const mid = (lo + hi) / 2, x = range(r, lo, hi); return mid + (x - mid) * v; };
  const mass = u(0.1, 0.75), age = u(0.15, 0.85), elderlyHeavy = mass > 0.55 && age > 0.6;
  return {
    modifiers: { mass, age },
    musculature: { trapezius: u(0.2, 0.9), tension: u(0.3, 0.7), separation: u(0.2, 0.7), tendonVisibility: u(0, 0.55) },
    softTissue: { foldDepth: u(0.2, 0.6), foldDistribution: u(0.2, 0.7), dewlap: elderlyHeavy && maybe(r, 0.7) ? u(0.2, 0.6) : 0 },
  };
}

/** Cou aléatoire final : `drawn` (tirages plats existants + surcharge) ← système tiré ← preset ← surcharge de l'appelant. */
export function randomNeck(seed: number, drawn: Record<string, unknown>, override: Record<string, unknown> | undefined, opts: { variety?: number; preset?: string }): FaceParamsInput['neck'] {
  const merge = (a: unknown, b: unknown): unknown => (isObj(a) && isObj(b) ? Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => [k, k in b ? merge(a[k], b[k]) : a[k]])) : b === undefined ? a : b);
  const sys = drawNeckSystem(seed, opts.variety ?? 0);
  let out: unknown = sys ? merge(drawn, { system: sys }) : drawn;
  if (opts.preset) out = merge(out, neckPresetPatch(opts.preset));
  return merge(out, override ?? {}) as FaceParamsInput['neck'];
}
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

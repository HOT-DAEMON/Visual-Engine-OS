import { darken, lighten, mix } from '../../core/color';
import { dirToView, type Camera } from './camera';
import { dot3, norm3, p3, type P3 } from './vec3';

/**
 * ÉCLAIRAGE GLOBAL (espace VUE : la lumière suit la caméra, le relief se lit sous tout angle). Rendu = f(géométrie, matière, lumière, caméra) :
 * `tone(n)` ∈ [0, ~1,2] — ambiant + diffus clé + lumière de contour douce + reflet large (jamais de noir pur, jamais de contour noir).
 */
export interface LightRig { readonly key: P3; readonly rim: P3; readonly ambient: number; readonly keyGain: number; readonly rimGain: number; readonly specGain: number; readonly specPow: number }
export const DEFAULT_LIGHT: LightRig = { key: norm3(p3(-0.55, -0.6, 0.62)), rim: norm3(p3(0.8, -0.2, -0.45)), ambient: 0.28, keyGain: 0.74, rimGain: 0.22, specGain: 0.2, specPow: 9 };
const V = p3(0, 0, 1);
/** Teinte lumineuse d'une normale en espace vue (0 = ombre profonde teintée, ~0,55 = peau neutre, > 0,8 = reflet). */
export function tone(nv: P3, L: LightRig): number {
  const d = Math.max(0, dot3(nv, L.key)), fr = (1 - Math.max(0, dot3(nv, V))) ** 3, rim = fr * Math.max(0, dot3(nv, L.rim));
  const half = norm3(p3(L.key.x, L.key.y, L.key.z + 1)), sp = Math.max(0, dot3(nv, half)) ** L.specPow;
  return L.ambient + L.keyGain * d + L.rimGain * rim * 2 + L.specGain * sp;
}
export interface Palette { readonly shadow: string; readonly skin: string; readonly light: string; readonly ink: string }
/** Palette dérivée d'une teinte de peau : ombre rosée-violacée (diffusion sous-cutanée), lumière chaude, encre = ombre profonde (jamais #000). */
export const paletteOf = (skin: string): Palette => ({ shadow: mix(darken(skin, 0.5), '#6e3446', 0.22), skin, light: mix(lighten(skin, 0.55), '#fff1de', 0.3), ink: mix(darken(skin, 0.52), '#5a2a3a', 0.25) });
export const colorOf = (t: number, p: Palette): string => (t < 0.55 ? mix(p.shadow, p.skin, Math.max(0, t) / 0.55) : mix(p.skin, p.light, Math.min(1, (t - 0.55) / 0.6) * 0.62));
export const viewNormal = (n: P3, c: Camera): P3 => dirToView(n, c);

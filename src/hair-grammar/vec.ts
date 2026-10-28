/**
 * Utilitaires vectoriels 3D/2D minimaux de la grammaire de coiffure. Repère de TÊTE (avant projection) :
 * x vers la droite anatomique de la tête (vue de face), y vers le BAS, z vers l'AVANT (le visage regarde +z).
 * L'origine est le centre du crâne. Unité : la hauteur de tête H (sommet du crâne → menton) = 1.
 */
export interface V3 { readonly x: number; readonly y: number; readonly z: number }
export interface V2 { readonly x: number; readonly y: number }

export const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z });
export const add = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const mul = (a: V3, k: number): V3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const len = (a: V3): number => Math.hypot(a.x, a.y, a.z);
export const norm = (a: V3): V3 => { const l = len(a) || 1; return mul(a, 1 / l); };
export const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const rad = (d: number): number => (d * Math.PI) / 180;
/** Lissage cubique 0→1 (dérivées nulles aux bornes). */
export const smooth = (t: number): number => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };

/** Générateur pseudo-aléatoire déterministe (mulberry32) : mêmes graines → mêmes coiffures. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

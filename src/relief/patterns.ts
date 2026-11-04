import type { Gobo, LitStyle, ShadowHue } from './model';

/** Masque de lumière projeté (store, feuillage : planche 05, deux dernières vignettes). 1 = lumière passe, 0 = bloquée. Déterministe, repère de l'hôte. */
const hash = (x: number, y: number): number => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vn = (x: number, y: number): number => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return hash(xi, yi) * (1 - u) * (1 - v) + hash(xi + 1, yi) * u * (1 - v) + hash(xi, yi + 1) * (1 - u) * v + hash(xi + 1, yi + 1) * u * v; };
const sst = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function goboAt(g: Gobo, x: number, y: number): number {
  if (g.kind === 'blinds') { const a = (g.angleDeg * Math.PI) / 180, u = (x * Math.cos(a) + y * Math.sin(a)) / g.scale, f = u - Math.floor(u); return sst(0, 0.06, f) * (1 - sst(g.duty, g.duty + 0.06, f)); }
  const n = 0.65 * vn(x / g.scale, y / g.scale) + 0.35 * vn((x * 2.1) / g.scale + 17, (y * 2.1) / g.scale + 5);
  return sst(1 - g.duty - 0.05, 1 - g.duty + 0.05, n);
}

/**
 * MOTIFS D'ÉCLAIRAGE LUS SUR LES RÉFÉRENCES (planches 01 « 9 directions », 09 « Lighting Patterns », 06 « 9 masques »). Azimut : 0 = d'en haut, 90 = de la
 * droite de l'IMAGE, 270 = de la gauche ; élévation au-dessus du plan de l'image (négative = par derrière). `expect` décrit ce que l'œil lit dans la
 * référence (part éclairée par côté / par bande) : c'est le CONTRAT du contrôle de style (`verify/lit.ts`), pas un réglage du rendu.
 */
export interface LightPattern {
  readonly id: string; readonly label: string; readonly ref: string; readonly azimuthDeg: number; readonly elevationDeg: number;
  readonly style: LitStyle; readonly shadowHue: ShadowHue; readonly hardness: number; readonly sourceSize: number; readonly bias: number;
  readonly expect: { readonly left?: readonly [number, number]; readonly right?: readonly [number, number]; readonly top?: readonly [number, number]; readonly bottom?: readonly [number, number]; readonly orbit?: readonly [number, number]; readonly neckTop?: readonly [number, number] };
}
const P = (id: string, label: string, ref: string, az: number, el: number, expect: LightPattern['expect'], hardness = 0.9, size = 0.15, bias = 0.1): LightPattern => ({ id, label, ref, azimuthDeg: az, elevationDeg: el, style: 'cel2', shadowHue: 'cool', hardness, sourceSize: size, bias, expect });
export const LIGHT_PATTERNS: readonly LightPattern[] = [
  P('side-left', 'Latérale gauche (split)', '01-4 · 09 split', 270, 18, { left: [0.78, 1], right: [0, 0.22] }),
  P('side-right', 'Latérale droite (split)', '01-3', 90, 18, { left: [0, 0.22], right: [0.78, 1] }),
  P('three-quarter-left', 'Trois-quarts gauche, haute (loop / court)', '01-1 · 01-8 · 09 loop', 305, 38, { left: [0.7, 1], right: [0, 0.6] }),
  P('three-quarter-right', 'Trois-quarts droite, haute (Rembrandt)', '01-2 · 09 rembrandt', 55, 38, { left: [0, 0.6], right: [0.7, 1] }),
  P('overhead', 'Zénithale (overhead)', '01-5 · 06-1 · 09 overhead', 0, 50, { top: [0.6, 1], orbit: [0, 0.6], neckTop: [0, 0.4] }, 0.9, 0.15, 0.2),
  P('underlight', 'Par en dessous (underside)', '01-6 · 01-7 · 09 underside', 180, 18, { top: [0, 0.4], bottom: [0.5, 1], orbit: [0, 0.6] }, 0.9, 0.15, 0.36),
  P('frontal', 'Frontale douce (aplat clair)', '06-2', 330, 85, { left: [0.55, 1], right: [0.55, 1] }, 0.5, 0.6, 0),
];
/** Limites assumées : le motif « zénithale » des planches (bas du visage blanc, cou sombre) suppose une seconde lumière de rebond par en dessous, non modélisée : voir docs/LIGHT-VISIBLE-06-REMAINING.md. */
export const patternById = (id: string): LightPattern => LIGHT_PATTERNS.find((p) => p.id === id) ?? (LIGHT_PATTERNS[0] as LightPattern);

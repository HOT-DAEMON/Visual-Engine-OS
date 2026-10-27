import { mulberry32 } from '../../core/prng';
import { parseHex, mix } from '../../core/color';
import type { IrisLayer } from '../../schema/eye-iris-layers';
import type { Vec } from './primitives';

/**
 * EYE-04 — Géométrie des couches de couleur de l'iris (pure, déterministe). Repère : disque UNITAIRE (rayon 1), 0° = haut, horaire ;
 * le rendu applique ensuite l'échelle de l'iris (`irisRx`, `irisRy`). Fournit : bords irréguliers à graine, secteurs, spots, cellules angulaires.
 */
const TAU = Math.PI * 2;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Point du disque unitaire à l'angle `a` (deg, 0 = haut, horaire) et au rayon `r`. */
export const polar = (aDeg: number, r: number): Vec => ({ x: Math.sin(toRad(aDeg)) * r, y: -Math.cos(toRad(aDeg)) * r });

/** Perturbation radiale lisse, reproductible : depend de (graine œil, indice de couche), amplitude `irregularity`. */
export function wobble(seed: number, index: number, irregularity: number): (aDeg: number) => number {
  if (irregularity <= 0) return () => 1;
  const rnd = mulberry32((seed * 2654435761 + index * 40503) >>> 0);
  const h = [2, 3, 5, 7].map((k) => ({ k, ph: rnd() * TAU, amp: (0.4 + rnd() * 0.6) / k }));
  return (a) => 1 + irregularity * 0.22 * h.reduce((s, c) => s + c.amp * Math.sin(c.k * toRad(a) + c.ph), 0);
}

/** Étendue angulaire effective : [début, fin] en degrés, début = angleDeg − span/2. `full`/`ring` : tour complet ; `half` : 180°. */
export function angularRange(l: IrisLayer): { readonly a0: number; readonly a1: number; readonly full: boolean } {
  if (l.mask === 'full' || l.mask === 'ring') return { a0: 0, a1: 360, full: true };
  const span = l.mask === 'half' ? 180 : l.span;
  return { a0: l.angleDeg - span / 2, a1: l.angleDeg + span / 2, full: span >= 360 };
}

/** Bornes radiales ordonnées et bornées à [0, 1]. */
export function radialRange(l: IrisLayer): { readonly r0: number; readonly r1: number } {
  const lo = Math.min(l.inner, l.outer);
  const hi = Math.max(l.inner, l.outer);
  return { r0: l.mask === 'full' ? 0 : lo, r1: hi };
}

/** Contour (polygone) d'une zone secteur/anneau irrégulière : arc extérieur aller, arc intérieur retour ; `samples` points par arc. */
export function zoneOutline(l: IrisLayer, seed: number, index: number, samples = 48): Vec[] {
  const { a0, a1, full } = angularRange(l);
  const { r0, r1 } = radialRange(l);
  const w = wobble(seed, index, l.irregularity);
  const n = Math.max(8, samples);
  const outer: Vec[] = [];
  const inner: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const k = w(a);
    outer.push(polar(a, Math.min(1, r1 * k)));
    inner.push(polar(a, Math.min(1, r0 * k)));
  }
  if (full && r0 <= 0) return outer.slice(0, -1);
  if (!full && r0 <= 0.001) return [...outer, { x: 0, y: 0 }];
  return [...outer, ...inner.reverse()];
}

export interface AngularCell { readonly a0: number; readonly a1: number; readonly color: string; }

/**
 * Cellules d'un gradient ANGULAIRE (le SVG n'a pas de dégradé conique) : `steps` secteurs de couleur interpolée.
 * Tour complet : t = (1 − cos(θ − angleDeg)) / 2 → `color` à angleDeg, `color2` à l'opposé, sans couture. Secteur : t linéaire.
 */
export function angularCells(l: IrisLayer, steps: number): AngularCell[] {
  const c2 = l.color2 ?? l.color;
  const { a0, a1, full } = angularRange(l);
  const cells: AngularCell[] = [];
  for (let i = 0; i < steps; i++) {
    const s0 = a0 + ((a1 - a0) * i) / steps;
    const s1 = a0 + ((a1 - a0) * (i + 1)) / steps;
    const mid = (s0 + s1) / 2;
    const t = full ? (1 - Math.cos(toRad(mid - l.angleDeg))) / 2 : (i + 0.5) / steps;
    cells.push({ a0: s0, a1: s1, color: mix(l.color, c2, t) });
  }
  return cells;
}

/** Fusion émulée : mélange `layer` à `base` selon le mode (multiplier / écran), canal par canal ; `normal` : couleur de la couche. */
export function blendColor(base: string, layer: string, mode: IrisLayer['blend']): string {
  if (mode === 'normal') return layer;
  const [br, bg, bb] = parseHex(base);
  const [lr, lg, lb] = parseHex(layer);
  const f = mode === 'multiply' ? (b: number, c: number) => (b * c) / 255 : (b: number, c: number) => 255 - ((255 - b) * (255 - c)) / 255;
  const h = (v: number): string => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${h(f(br, lr))}${h(f(bg, lg))}${h(f(bb, lb))}`;
}

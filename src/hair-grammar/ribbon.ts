import { smoothPath } from './blade';
import type { V2 } from './vec';

/**
 * RUBAN DE TRAIT — seconde primitive de la grammaire (avec la mèche 3D de `lock.ts`) : un trait d'encre à largeur variable.
 * Dans une illustration au trait, une mèche = une paire de rubans qui convergent en pointe + une masse de ton entre eux ;
 * les rubans portent donc la FORME (cap, courbure, ondulation, pointe effilée), les masses portent l'OMBRE.
 *
 * Tout est exprimé dans le REPÈRE DE TÊTE `HeadFrame` : origine = iris de l'œil proche, unité = hauteur de tête, axe y vers le bas.
 * Ainsi la taille d'une mèche se lit directement par rapport au visage (0,5 = une demi-hauteur de tête), jamais en pixels.
 */
export interface HeadFrame { readonly ox: number; readonly oy: number; readonly unit: number }
/** Point de ruban : position (u, v) en hauteurs de tête depuis l'iris proche, largeur w (même unité). */
export type RibbonPoint = readonly [number, number, number];
export interface Ribbon { readonly id: number; readonly role: 'hair' | 'face'; readonly p: readonly RibbonPoint[] }
export interface ToneMass { readonly level: 1 | 2; readonly poly: readonly (readonly [number, number])[] }
export interface RibbonProfile { readonly frame: HeadFrame & { readonly cell: number }; readonly ribbons: readonly Ribbon[]; readonly tones: readonly ToneMass[] }

/** Repère → pixels de cellule. */
export const toCell = (f: HeadFrame, u: number, v: number): V2 => ({ x: f.ox + u * f.unit, y: f.oy + v * f.unit });

/** Contour fermé d'un ruban (bord gauche aller, bord droit retour, capuchon arrondi aux deux bouts). `minW` : largeur plancher (px). */
export function ribbonOutline(r: Ribbon, f: HeadFrame, widthScale = 1, minW = 0.5): V2[] {
  const n = r.p.length;
  const c = r.p.map((q) => toCell(f, q[0], q[1]));
  const half = r.p.map((q) => Math.max(minW, q[2] * f.unit * widthScale) / 2);
  const L: V2[] = []; const R: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = c[Math.max(0, i - 1)] as V2; const b = c[Math.min(n - 1, i + 1)] as V2;
    let tx = b.x - a.x; let ty = b.y - a.y; const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
    const p = c[i] as V2; const h = half[i] as number;
    L.push({ x: p.x - ty * h, y: p.y + tx * h }); R.push({ x: p.x + ty * h, y: p.y - tx * h });
  }
  const cap = (end: 'start' | 'end'): V2[] => {
    const i = end === 'start' ? 0 : n - 1; const p = c[i] as V2; const h = half[i] as number;
    const j = end === 'start' ? 1 : n - 2; const q = c[Math.min(n - 1, Math.max(0, j))] as V2;
    const dx = p.x - q.x; const dy = p.y - q.y; const m = Math.hypot(dx, dy) || 1;
    return [{ x: p.x + (dx / m) * h * 0.9, y: p.y + (dy / m) * h * 0.9 }];
  };
  return [...L, ...cap('end'), ...R.reverse(), ...cap('start')];
}

export const ribbonPath = (r: Ribbon, f: HeadFrame, widthScale = 1, minW = 0.5): string => (r.p.length < 2 ? '' : smoothPath(ribbonOutline(r, f, widthScale, minW), true));
export const tonePath = (t: ToneMass, f: HeadFrame): string => smoothPath(t.poly.map(([u, v]) => toCell(f, u, v)), true);

/** Longueur de la ligne moyenne d'un ruban, en hauteurs de tête. */
export function ribbonLength(r: Ribbon): number {
  let s = 0; for (let i = 1; i < r.p.length; i++) s += Math.hypot((r.p[i] as RibbonPoint)[0] - (r.p[i - 1] as RibbonPoint)[0], (r.p[i] as RibbonPoint)[1] - (r.p[i - 1] as RibbonPoint)[1]);
  return s;
}

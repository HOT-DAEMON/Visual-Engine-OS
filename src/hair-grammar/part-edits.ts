import type { HeadSpec } from './head';
import type { LockSpec } from './lock';
import { norm, rad, v3 } from './vec';

/**
 * ÉDITIONS QUI ÉLOIGNENT UNE MÈCHE DE LA RAIE — partagées par la génération (`part-shape.ts`) et le solveur local (`repair-local.ts`). Séparées pour éviter un cycle d'import : le solveur local ne dépend que de ces
 * éditions, la génération dépend du solveur local (`localCost`, `refreshChildren`).
 */
export interface PartEdit { readonly name: string; readonly cost: number; readonly apply: (L: LockSpec) => LockSpec }

const pair = (a: PartEdit, b: PartEdit): PartEdit => ({ name: `${a.name} + ${b.name}`, cost: a.cost + b.cost + 0.05, apply: (L) => b.apply(a.apply(L)) });

/** Côté (±1) d'où une mèche naît par rapport à la raie `xp` : le côté vers lequel elle doit s'écarter. */
export function sideOf(h: HeadSpec, L: LockSpec, xp: number): 1 | -1 {
  const xr = h.rx * Math.cos(rad(L.root.el)) * Math.sin(rad(L.root.az));
  return Math.abs(xr - xp) > 1e-6 ? (xr >= xp ? 1 : -1) : L.aim.x >= 0 ? 1 : -1;
}

/** Éditions qui éloignent une mèche de la raie du côté `side`, triées par coût d'édition croissant. */
export function awayEdits(side: 1 | -1): PartEdit[] {
  const lat = [0.25, 0.5, 0.8, 1.2].map((d): PartEdit => ({ name: `cap latéral ${side > 0 ? '+' : '−'}${d} (loin de la raie)`, cost: d / 2, apply: (L) => ({ ...L, aim: norm(v3(L.aim.x + side * d, L.aim.y, L.aim.z)) }) }));
  const root = [4, 8, 14].map((d): PartEdit => ({ name: `racine ${side > 0 ? '+' : '−'}${d}° d'azimut (loin de la raie)`, cost: d / 25, apply: (L) => (L.parent || L.shellRoot ? L : { ...L, root: { el: L.root.el, az: L.root.az + side * d } }) }));
  const wid = [0.8, 0.6].map((s): PartEdit => ({ name: `largeur ×${s}`, cost: (1 - s) * 2, apply: (L) => ({ ...L, width: L.width * s }) }));
  const len = [0.8, 0.6].map((s): PartEdit => ({ name: `longueur ×${s}`, cost: (1 - s) * 1.2, apply: (L) => ({ ...L, length: L.length * s }) }));
  const out = [...lat, ...root, ...wid, ...len];
  for (const a of [...lat, ...root]) for (const b of [...wid, ...len]) out.push(pair(a, b));
  for (const a of lat) for (const b of root) out.push(pair(a, b));
  return out.sort((a, b) => a.cost - b.cost);
}

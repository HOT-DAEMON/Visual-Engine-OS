import { bladeOutline } from './blade';
import { fillPoly, makeGrid, type Grid } from './compose-grid';
import { project, type HeadSpec, type View } from './head';
import type { PaintedLock } from './paint';
import { shellPoint } from './shell';
import { v3, type V2 } from './vec';

/**
 * VISIBILITÉ RÉELLE — ce qu'on voit, selon l'ORDRE DE PEINTURE (`back` → tête → `front` → `over`, puis l'ordre de la coiffure), et non selon
 * `facing` seul. Deux mesures, toutes deux de géométrie pure sur la même trame que `compose.ts` :
 *  - `visible` : part (0–1) de l'aire de chaque lame qui reste visible une fois recouverte par les mèches peintes après elle ET par la tête
 *    (pour une mèche `back`). Une lame à 0 est entièrement enfouie : de la géométrie que personne ne voit.
 *  - `misLayered` : mèche peinte AU-DESSUS du visage (`front`/`over`) alors qu'une grande part de son axe est derrière le crâne (normale de coque
 *    tournée à l'opposé de la caméra) ET sous le contour de la tête. Elle apparaîtrait collée sur le visage alors qu'elle est derrière : défaut de
 *    cohérence géométrique que ni `facing` des repères ni l'auto-intersection ne voient.
 * La tête est l'enveloppe convexe des points de coque projetés (crâne + mâchoire jusqu'au menton) : exacte pour un crâne convexe, conservatrice ailleurs.
 */
export interface Visibility {
  /** Part visible de l'aire de chaque lame (même ordre que les mèches). */
  readonly visible: number[];
  /** Part des échantillons de l'axe qui sont visibles (utile pour couper une mèche en tronçons visibles / cachés). */
  readonly spineVisible: number[];
  /** Indices des mèches peintes devant la tête alors qu'elles sont derrière. */
  readonly misLayered: number[];
  /** Indices des mèches entièrement enfouies (part visible < `BURIED`). */
  readonly buried: number[];
  /** Contour de la tête sous cette vue (repère image). */
  readonly head: V2[];
}

/** Part visible minimale en deçà de laquelle une lame est dite enfouie. */
export const BURIED = 0.03;
/** Part de l'axe derrière la tête, au-delà de laquelle une mèche de devant est dite mal étagée. */
export const BEHIND = 0.5;
const CELL = 2;
const FACE_ID = 0xfffe;

/** Enveloppe convexe (Andrew, monotone chain). */
function hull(pts: readonly V2[]): V2[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y); const cr = (o: V2, a: V2, b: V2): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: V2[] = []; for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2] as V2, lo[lo.length - 1] as V2, q) <= 0) lo.pop(); lo.push(q); }
  const up: V2[] = []; for (const q of [...p].reverse()) { while (up.length >= 2 && cr(up[up.length - 2] as V2, up[up.length - 1] as V2, q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

/** Contour de la tête (crâne + mâchoire) sous la vue : enveloppe convexe de la coque projetée de y = −ry à y = chinY. */
export function headOutline(h: HeadSpec, view: View): V2[] {
  const pts: V2[] = [];
  for (let i = 0; i <= 24; i++) { const y = -h.ry + (i / 24) * (h.chinY + h.ry); for (let k = 0; k < 24; k++) { const q = shellPoint(h, y, (k / 24) * 2 * Math.PI); const e = project(view, v3(q.x * 0.97, q.y, h.cz + (q.z - h.cz) * 0.97)); pts.push({ x: e.x, y: e.y }); } }
  return hull(pts);
}

const inside = (poly: readonly V2[], q: V2): boolean => { let r = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) { const u = poly[a] as V2; const w = poly[b] as V2; if (u.y > q.y !== w.y > q.y && q.x < ((w.x - u.x) * (q.y - u.y)) / (w.y - u.y) + u.x) r = !r; } return r; };

/** Mèches peintes au-dessus du visage alors qu'elles sont derrière le crâne : sans trame, coût négligeable (utilisé à chaque vérification). */
export function misLayeredLocks(painted: readonly PaintedLock[], head: readonly V2[]): number[] {
  const out: number[] = [];
  painted.forEach((p, i) => {
    if (p.layer === 'back') return;
    const f = p.blade.facing; let behind = 0; let m = 0;
    for (let k = 0; k < f.length; k++) { if (!inside(head, p.blade.spine[k] as V2)) continue; m++; if ((f[k] as number) < -0.05) behind++; }
    if (m >= 6 && behind / m >= BEHIND) out.push(i);
  });
  return out;
}

/** Visibilité d'un ensemble de mèches peintes sous `view` (voir l'en-tête). `size` : étendue de la trame (px). */
export function visibility(h: HeadSpec, view: View, painted: readonly PaintedLock[], size = { w: 156, h: 150 }): Visibility {
  const head = headOutline(h, view); const n = painted.length;
  const ids = new Uint16Array(makeGrid(size.w, size.h, CELL).data.length); const g: Grid = makeGrid(size.w, size.h, CELL);
  const polys = painted.map((p) => bladeOutline(p.blade));
  const stamp = (poly: readonly V2[], id: number): void => { g.data.fill(0); fillPoly(g, poly, 1); for (let i = 0; i < g.data.length; i++) if (g.data[i]) ids[i] = id; };
  // Ordre de peinture : back → tête → front → over ; dans une couche, l'ordre de la coiffure.
  const order: number[] = []; for (const layer of ['back', 'front', 'over'] as const) { if (layer === 'front') order.push(-1); painted.forEach((p, i) => { if (p.layer === layer) order.push(i); }); }
  for (const i of order) stamp(i < 0 ? head : (polys[i] as V2[]), i < 0 ? FACE_ID : i + 1);
  const own = new Array<number>(n).fill(0); const seen = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) { g.data.fill(0); fillPoly(g, polys[i] as V2[], 1); let a = 0; let v = 0; for (let c = 0; c < g.data.length; c++) if (g.data[c]) { a++; if (ids[c] === i + 1) v++; } own[i] = a; seen[i] = v; }
  const visible = own.map((a, i) => (a > 0 ? (seen[i] as number) / a : 0));
  const at = (q: V2): number => { const cx = Math.floor(q.x / CELL); const cy = Math.floor(q.y / CELL); return cx < 0 || cy < 0 || cx >= g.nx || cy >= g.ny ? 0 : (ids[cy * g.nx + cx] as number); };
  const spineVisible = painted.map((p, i) => { const sp = p.blade.spine; let v = 0; for (const q of sp) if (at(q) === i + 1) v++; return v / Math.max(1, sp.length); });
  const misLayered = misLayeredLocks(painted, head); const buried: number[] = [];
  painted.forEach((_, i) => { if ((own[i] as number) > 0 && (visible[i] as number) < BURIED) buried.push(i); });
  return { visible, spineVisible, misLayered, buried, head };
}

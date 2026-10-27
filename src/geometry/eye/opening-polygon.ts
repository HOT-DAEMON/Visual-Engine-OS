import { cubicAt, type Vec } from './primitives';
import type { OpeningGeometry } from './opening';

/** Contour échantillonné de l'ouverture (bord haut de pi à po, puis bord bas de po à pi), `n` points par courbe, translaté de (dx, dy). */
export function openingPolygon(g: OpeningGeometry, n = 32, dx = 0, dy = 0): Vec[] {
  const pts: Vec[] = [];
  for (let i = 0; i < n; i++) pts.push(cubicAt(g.pi, g.u1, g.u2, g.po, i / n));
  for (let i = 0; i < n; i++) pts.push(cubicAt(g.po, g.l1, g.l2, g.pi, i / n));
  return dx === 0 && dy === 0 ? pts : pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

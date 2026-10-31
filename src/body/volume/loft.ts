import { add3, cross3, dot3, mul3, norm3, p3, sub3, type P3 } from './vec3';
import type { Station } from './types';

/** Point de contrôle d'un loft : centre, demi-axes, et `hint` = direction vers laquelle pointe la face de `b` (ex. la normale de la peau). */
export interface Ctl { readonly c: P3; readonly a: number; readonly b: number; readonly hint: P3 }
const sm = (u: number): number => u * u * (3 - 2 * u);
const cr = (p0: number, p1: number, p2: number, p3_: number, t: number): number => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3_) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3_) * t * t * t);
const crP = (A: P3, B: P3, C: P3, D: P3, t: number): P3 => p3(cr(A.x, B.x, C.x, D.x, t), cr(A.y, B.y, C.y, D.y, t), cr(A.z, B.z, C.z, D.z, t));

/**
 * LOFT : de quelques points de contrôle à `n` sections régulières (centre par Catmull-Rom, demi-axes par lissage, repère (t,u,w) re-orthonormé).
 * `u = hint × t` puis `w = t × u` : `w` suit `hint` (face visible du muscle), `u` est la largeur tangentielle. Pur et déterministe.
 */
export function loft(ctl: readonly Ctl[], n = 9): Station[] {
  const m = ctl.length;
  if (m < 2) throw new RangeError('loft : au moins 2 points de contrôle');
  const at = (i: number): Ctl => ctl[Math.min(m - 1, Math.max(0, i))] as Ctl;
  const pts: { c: P3; a: number; b: number; h: P3 }[] = [];
  for (let k = 0; k < n; k++) {
    const s = (k / (n - 1)) * (m - 1), i = Math.min(m - 2, Math.floor(s)), t = s - i, q = sm(t);
    const A = at(i - 1), B = at(i), C = at(i + 1), D = at(i + 2);
    pts.push({ c: crP(A.c, B.c, C.c, D.c, t), a: Math.max(1e-3, B.a + (C.a - B.a) * q), b: Math.max(1e-3, B.b + (C.b - B.b) * q), h: norm3(add3(mul3(B.hint, 1 - t), mul3(C.hint, t))) });
  }
  return pts.map((q, k) => {
    const nx = (pts[Math.min(n - 1, k + 1)] as typeof q).c, pv = (pts[Math.max(0, k - 1)] as typeof q).c;
    const t = norm3(sub3(nx, pv));
    let u = cross3(q.h, t);
    if (dot3(u, u) < 1e-8) u = cross3(p3(0, 0, 1), t);
    u = norm3(u);
    const w = norm3(cross3(t, u));
    return { c: q.c, a: q.a, b: q.b, t, u, w: dot3(w, q.h) < 0 ? mul3(w, -1) : w };
  });
}
/** Point de la section `s` à l'angle θ (0 = +u, π/2 = +w) et sa normale sortante unitaire. */
export function ringPoint(s: Station, th: number): { p: P3; n: P3 } {
  const ct = Math.cos(th), st = Math.sin(th);
  const p = add3(s.c, add3(mul3(s.u, s.a * ct), mul3(s.w, s.b * st)));
  return { p, n: norm3(add3(mul3(s.u, s.b * ct), mul3(s.w, s.a * st))) };
}
/** Station isolée (sphère d'articulation, tube) : repère arbitraire stable. */
export function ball(c: P3, r: number): Station[] {
  const t = p3(0, 1, 0), u = p3(1, 0, 0), w = p3(0, 0, 1);
  return [{ c: sub3(c, mul3(t, r * 0.999)), a: 1e-3, b: 1e-3, t, u, w }, { c, a: r, b: r, t, u, w }, { c: add3(c, mul3(t, r * 0.999)), a: 1e-3, b: 1e-3, t, u, w }];
}

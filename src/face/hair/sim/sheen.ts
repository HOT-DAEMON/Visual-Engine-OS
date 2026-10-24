import type { Vec } from '../../../geometry/eye/primitives';
import type { FaceLandmarks } from '../../landmarks';
import type { Poly } from '../../poly';
import type { HairGeometry } from '../types';
import type { Profile } from './profiles';

/**
 * Bandes de brillance CONTINUES (rendu encre) : un arc blanc ininterrompu qui suit la courbure du crâne à travers toute la masse
 * du dessus, déporté du côté du balayage de l'archétype (`sil.sweep`), plus un second arc plus court en dessous. Ce sont des
 * polygones fermés, effilés aux deux bouts, rognés ensuite par la silhouette des cheveux (le rendu s'en charge).
 * Entrées : la géométrie des cheveux et les repères du visage ; aucune coordonnée propre (enfant du visage).
 */
export function sheenBands(geo: HairGeometry, lm: FaceLandmarks, prof: Profile): Poly[] {
  const { W } = lm;
  const ys = geo.scalp.map((q) => q.y);
  const xs = geo.scalp.map((q) => q.x);
  const yTop = Math.min(...ys);
  const half = (Math.max(...xs) - Math.min(...xs)) / 2;
  const yHl = lm.hair.centerY;
  const rx = 0.82 * half;
  const sw = prof.sil.sweep;
  const arc = (k: number, drop: number, wMax: number, span: number): Poly => {
    const n = 28;
    const c: Vec[] = [];
    for (let i = 0; i <= n; i++) {
      const u = -1 + (2 * i) / n;
      const x0 = u * rx * span + sw * 0.18 * rx;
      const xn = Math.max(-1, Math.min(1, x0 / rx));
      c.push({ x: x0, y: yTop + (yHl - yTop) * (k + drop * xn * xn) });
    }
    const up: Vec[] = [];
    const dn: Vec[] = [];
    c.forEach((p, i) => {
      const t = i / n;
      const w = (wMax * Math.sin(Math.PI * t) ** 1.5) / 2;
      const q = c[Math.min(n, i + 1)] as Vec;
      const r = c[Math.max(0, i - 1)] as Vec;
      const l = Math.hypot(q.x - r.x, q.y - r.y) || 1;
      const nx = -(q.y - r.y) / l;
      const ny = (q.x - r.x) / l;
      up.push({ x: p.x + nx * w, y: p.y + ny * w });
      dn.push({ x: p.x - nx * w, y: p.y - ny * w });
    });
    return [...up, ...dn.reverse()];
  };
  const vol = Math.min(1.4, prof.sil.top);
  return [arc(0.3, 0.55, 0.04 * W * vol, 0.9), arc(0.58, 0.45, 0.022 * W, 0.62)];
}

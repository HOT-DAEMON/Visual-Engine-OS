import { num } from '../core/svg';
import type { CPoint } from './types';

/**
 * Courbe lissée par les points : cubiques de Bézier dont les tangentes suivent la DIRECTION de la corde (Pi-1 → Pi+1) et la LONGUEUR de
 * chaque segment (un tiers de la corde voisine) — pas de dépassement sur des points inégalement espacés, contrairement à Catmull-Rom uniforme.
 * L'acuité `s` d'un point raccourcit sa tangente (s = 1 → angle vif). Courbe C¹ là où s = 0, déterministe, sans état.
 */
export interface Bez { readonly p0: CPoint; readonly c1: CPoint; readonly c2: CPoint; readonly p3: CPoint }

export function bezierChain(pts: readonly CPoint[], closed: boolean): Bez[] {
  const n = pts.length;
  const at = (i: number): CPoint => (closed ? (pts[((i % n) + n) % n] as CPoint) : (pts[Math.max(0, Math.min(n - 1, i))] as CPoint));
  const tan = (i: number): { x: number; y: number } => {
    const a = at(i - 1), b = at(i + 1);
    const dx = b.x - a.x, dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  };
  const out: Bez[] = [];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = at(i), b = at(i + 1);
    const d = Math.hypot(b.x - a.x, b.y - a.y) / 3;
    const ta = tan(i), tb = tan(i + 1);
    const ka = d * (1 - (a.s ?? 0)), kb = d * (1 - (b.s ?? 0));
    out.push({ p0: a, c1: { x: a.x + ta.x * ka, y: a.y + ta.y * ka }, c2: { x: b.x - tb.x * kb, y: b.y - tb.y * kb }, p3: b });
  }
  return out;
}

const f = (p: { x: number; y: number }): string => `${num(p.x)} ${num(p.y)}`;

/** Chemin SVG (`M … C …`) d'une chaîne de cubiques ; `close` ajoute `Z`. */
export function chainPath(ch: readonly Bez[], close = false): string {
  if (ch.length === 0) return '';
  return `M${f((ch[0] as Bez).p0)}${ch.map((b) => `C${f(b.c1)} ${f(b.c2)} ${f(b.p3)}`).join('')}${close ? 'Z' : ''}`;
}

/** Échantillons d'une chaîne (t régulier, `per` par segment) : polyligne pour mesures et décalages. */
export function sampleChain(ch: readonly Bez[], per = 10): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const b of ch) {
    for (let k = 0; k < per; k++) {
      const t = k / per, u = 1 - t;
      out.push({
        x: u * u * u * b.p0.x + 3 * u * u * t * b.c1.x + 3 * u * t * t * b.c2.x + t * t * t * b.p3.x,
        y: u * u * u * b.p0.y + 3 * u * u * t * b.c1.y + 3 * u * t * t * b.c2.y + t * t * t * b.p3.y,
      });
    }
  }
  const l = ch[ch.length - 1];
  if (l) out.push({ x: l.p3.x, y: l.p3.y });
  return out;
}

/** Chemin lissé direct par les points. */
export const smoothPath = (pts: readonly CPoint[], closed = false): string => chainPath(bezierChain(pts, closed), closed);

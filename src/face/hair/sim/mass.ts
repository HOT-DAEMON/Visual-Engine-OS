import type { Vec } from '../../../geometry/eye/primitives';
import { orient, type Poly } from '../../poly';
import type { HairLock } from '../types';

/**
 * Masse de volume ASYMÉTRIQUE : pour chaque tranche horizontale (y), on garde l'abscisse minimale et maximale atteinte par
 * les mèches, puis on lisse. Contrairement à `envelope` (symétrique, |x|), elle suit une coiffure balayée d'un seul côté.
 * Le polygone est le « moule » sombre sous les lames : aucune trouée de crâne entre deux mèches, silhouette lisible.
 * `y0` / `y1` bornent la zone (sommet → bas de la masse) ; `pad` gonfle d'une épaisseur de mèche pour raccorder les bords.
 */
export function asymEnvelope(locks: readonly HairLock[], y0: number, y1: number, pad: number, bins = 36): Poly | null {
  const lo: number[] = new Array(bins).fill(Infinity);
  const hi: number[] = new Array(bins).fill(-Infinity);
  const span = y1 - y0 || 1;
  for (const l of locks) {
    for (const q of l.poly) {
      if (q.y < y0 || q.y > y1) continue;
      const b = Math.min(bins - 1, Math.floor(((q.y - y0) / span) * bins));
      if (q.x < (lo[b] as number)) lo[b] = q.x;
      if (q.x > (hi[b] as number)) hi[b] = q.x;
    }
  }
  const rows: { y: number; a: number; b: number }[] = [];
  for (let i = 0; i < bins; i++) if (Number.isFinite(lo[i])) rows.push({ y: y0 + ((i + 0.5) / bins) * span, a: lo[i] as number, b: hi[i] as number });
  if (rows.length < 3) return null;
  // Lissage 1-2-1 (deux passes) : pas de dents d'escalier sur la silhouette.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < rows.length - 1; i++) {
      const r = rows[i]!;
      r.a = 0.25 * rows[i - 1]!.a + 0.5 * r.a + 0.25 * rows[i + 1]!.a;
      r.b = 0.25 * rows[i - 1]!.b + 0.5 * r.b + 0.25 * rows[i + 1]!.b;
    }
  }
  const left: Vec[] = rows.map((r) => ({ x: r.a - pad, y: r.y }));
  const right: Vec[] = rows.map((r) => ({ x: r.b + pad, y: r.y }));
  const first = rows[0]!;
  const last = rows[rows.length - 1]!;
  const cap: Vec[] = [{ x: first.b, y: first.y - pad * 0.8 }, { x: (first.a + first.b) / 2, y: first.y - pad * 1.1 }, { x: first.a, y: first.y - pad * 0.8 }];
  void last;
  return orient([...right, ...[...left].reverse(), ...cap]);
}

/**
 * Masse par COLONNES : pour chaque tranche verticale (x), le haut et le bas atteints par les mèches. Contrairement à la
 * version par lignes, le bord inférieur épouse le profil de la frange (diagonale, échancrures) ; il est remonté de `inset`
 * pour que les pointes des mèches dépassent de la masse (jamais un bandeau sombre à bord plat).
 */
export function columnEnvelope(locks: readonly HairLock[], yMax: number, pad: number, inset: number, bins = 44): Poly | null {
  let x0 = Infinity;
  let x1 = -Infinity;
  for (const l of locks) for (const q of l.poly) { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; }
  if (!(x1 > x0)) return null;
  const top: number[] = new Array(bins).fill(Infinity);
  const bot: number[] = new Array(bins).fill(-Infinity);
  const span = x1 - x0;
  for (const l of locks) for (const q of l.poly) {
    if (q.y > yMax) continue;
    const b = Math.min(bins - 1, Math.floor(((q.x - x0) / span) * bins));
    if (q.y < (top[b] as number)) top[b] = q.y;
    if (q.y > (bot[b] as number)) bot[b] = q.y;
  }
  const cols: { x: number; t: number; b: number }[] = [];
  for (let i = 0; i < bins; i++) if (Number.isFinite(top[i])) cols.push({ x: x0 + ((i + 0.5) / bins) * span, t: top[i] as number, b: bot[i] as number });
  if (cols.length < 4) return null;
  for (let pass = 0; pass < 2; pass++) for (let i = 1; i < cols.length - 1; i++) {
    const c = cols[i]!;
    c.t = 0.25 * cols[i - 1]!.t + 0.5 * c.t + 0.25 * cols[i + 1]!.t;
    c.b = 0.25 * cols[i - 1]!.b + 0.5 * c.b + 0.25 * cols[i + 1]!.b;
  }
  const up: Vec[] = cols.map((c) => ({ x: c.x, y: c.t - pad }));
  const dn: Vec[] = cols.map((c) => ({ x: c.x, y: Math.max(c.t + 0.02 * span, c.b - inset) })).reverse();
  return orient([...up, ...dn]);
}

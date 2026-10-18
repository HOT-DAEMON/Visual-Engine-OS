import type { Vec } from '../../geometry/eye/primitives';
import type { Poly } from '../poly';
import { rot, smoothstep } from './noise';

/**
 * Pointe RETROUSSÉE : sur le dernier quart de la ligne médiane, la direction tourne progressivement vers
 * l'extérieur de la tête (`outward` = ±1 : côté de l'image où se trouve la mèche). `amount` ∈ [0, 1] → jusqu'à ~75°.
 * La racine et le début de la mèche ne bougent pas : seule la pointe se relève.
 */
export function flickTip(c: Vec[], outward: number, amount: number): Vec[] {
  if (amount < 0.02 || c.length < 6) return c;
  const n = c.length;
  const start = Math.floor(n * 0.72);
  const out: Vec[] = c.slice(0, start + 1);
  let prev = c[start] as Vec;
  for (let i = start + 1; i < n; i++) {
    const a = c[i - 1] as Vec;
    const b = c[i] as Vec;
    // Segment d'origine, tourné d'un angle croissant vers l'extérieur.
    const k = smoothstep((i - start) / (n - 1 - start));
    const seg = rot({ x: b.x - a.x, y: b.y - a.y }, outward * amount * 1.3 * k);
    prev = { x: prev.x + seg.x, y: prev.y + seg.y };
    out.push(prev);
  }
  return out;
}

/**
 * Pointe IRRÉGULIÈRE : le sommet de la pointe d'un ruban (entre le dernier point du bord gauche et le dernier du bord
 * droit) est remplacé par deux pointes inégales séparées par une encoche. `u` ∈ [-1, 1] déplace l'encoche d'un côté.
 * `poly` = [bord gauche…, bord droit inversé…] (convention de `ribbon`) ; `amount` = profondeur de l'encoche (0 = rien).
 */
export function raggedTip(poly: Poly, amount: number, u: number, depth: number): Poly {
  if (amount < 0.05 || poly.length < 8) return poly;
  const n = poly.length / 2;
  const a = poly[n - 1] as Vec;
  const b = poly[n] as Vec;
  const pre = poly[n - 3] as Vec;
  // Direction de la mèche à la pointe, longueur de l'encoche proportionnelle à la largeur de la mèche et à `depth`.
  const dx = (a.x + b.x) / 2 - pre.x;
  const dy = (a.y + b.y) / 2 - pre.y;
  const l = Math.hypot(dx, dy) || 1;
  const w = Math.hypot(a.x - b.x, a.y - b.y);
  const back = -depth * amount;
  const mid = { x: (a.x + b.x) / 2 + (b.x - a.x) * 0.2 * u + (dx / l) * back, y: (a.y + b.y) / 2 + (b.y - a.y) * 0.2 * u + (dy / l) * back };
  const reach = amount * 0.5 * w;
  // Pointe gauche prolongée, pointe droite raccourcie (ou l'inverse) : deux « dents » inégales.
  const tipA = { x: a.x + (dx / l) * reach * (0.5 + u * 0.5), y: a.y + (dy / l) * reach * (0.5 + u * 0.5) };
  const tipB = { x: b.x - (dx / l) * reach * 0.2, y: b.y - (dy / l) * reach * 0.2 };
  return [...poly.slice(0, n - 1), tipA, mid, tipB, ...poly.slice(n + 1)];
}

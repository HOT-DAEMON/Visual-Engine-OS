import type { Vec } from '../../geometry/eye/primitives';
import type { Poly } from '../poly';
import { rot, smoothstep } from './noise';

export const normals = (c: Vec[]): Vec[] =>
  c.map((_, i) => {
    const a = c[Math.max(0, i - 1)] as Vec;
    const b = c[Math.min(c.length - 1, i + 1)] as Vec;
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
  });

/**
 * Mèche = ruban effilé le long d'une ligne médiane. `sharp` : 0 = pointe arrondie, 1 = pointe d'aiguille ;
 * la racine est plus étroite (elle disparaît sous les mèches voisines et la sous-couche).
 */
export function ribbon(c: Vec[], w0: number, sharp: number, root = 0.8): Poly {
  const n = c.length;
  const nn = normals(c);
  const left: Vec[] = [];
  const right: Vec[] = [];
  c.forEach((p, i) => {
    const u = i / (n - 1);
    const prof = sharp * (1 - u ** 1.2) + (1 - sharp) * (1 - 0.75 * u ** 2);
    const w = (Math.max(0.03 * w0, w0 * prof * (root + (1 - root) * Math.min(1, u * 5))) / 2) * 1;
    const q = nn[i] as Vec;
    left.push({ x: p.x + q.x * w, y: p.y + q.y * w });
    right.push({ x: p.x - q.x * w, y: p.y - q.y * w });
  });
  return [...left, ...right.reverse()];
}

const lengthOf = (c: Vec[]): number[] => {
  const cum = [0];
  for (let i = 1; i < c.length; i++) cum.push((cum[i - 1] as number) + Math.hypot((c[i] as Vec).x - (c[i - 1] as Vec).x, (c[i] as Vec).y - (c[i - 1] as Vec).y));
  return cum;
};

const along = (c: Vec[], cum: number[], d: number): { p: Vec; t: Vec } => {
  let j = 0;
  while (j < c.length - 2 && (cum[j + 1] as number) < d) j++;
  const a = c[j] as Vec;
  const b = c[j + 1] as Vec;
  const seg = (cum[j + 1] as number) - (cum[j] as number) || 1;
  const f = Math.min(1, Math.max(0, (d - (cum[j] as number)) / seg));
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { p: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }, t: { x: (b.x - a.x) / l, y: (b.y - a.y) / l } };
};

/**
 * Tresse à trois brins : chaîne de lentilles obliques qui alternent de côté (motif en chevrons), serrée en
 * pointe vers l'extrémité. Retourne un polygone par segment (dessinés de la racine vers la pointe) et le bout.
 */
export function plait(c: Vec[], w: number): { segs: Poly[]; end: Vec } {
  const cum = lengthOf(c);
  const total = cum[cum.length - 1] as number;
  const step = Math.max(w * 0.95, 1e-6);
  const K = Math.max(2, Math.floor(total / step));
  const segs: Poly[] = [];
  for (let k = 0; k < K; k++) {
    const u = (k + 0.5) / K;
    const { p, t } = along(c, cum, u * total);
    const wk = w * (1 - 0.55 * smoothstep(Math.min(1, Math.max(0, (u - 0.7) / 0.3))));
    const sg = k % 2 === 0 ? 1 : -1;
    const d = rot(t, 0.8 * sg);
    const n = { x: -t.y, y: t.x };
    const m = { x: p.x + n.x * sg * 0.12 * wk, y: p.y + n.y * sg * 0.12 * wk };
    const a = step * 0.95;
    const b = wk * 0.34;
    segs.push(Array.from({ length: 10 }, (_, j) => {
      const th = (2 * Math.PI * j) / 10;
      return { x: m.x + d.x * a * Math.cos(th) - d.y * b * Math.sin(th), y: m.y + d.y * a * Math.cos(th) + d.x * b * Math.sin(th) };
    }));
  }
  return { segs, end: c[c.length - 1] as Vec };
}

/**
 * Cône : largeur maximale `w0` à la RACINE (pas de rétrécissement : c'est la base épaisse d'un paquet rigide),
 * qui décroît jusqu'à une pointe d'aiguille. `power` = 1 : bords droits (cône parfait) ; > 1 : bords concaves (aiguille).
 */
export function cone(c: Vec[], w0: number, power = 1): Poly {
  const n = c.length;
  const nn = normals(c);
  const left: Vec[] = [];
  const right: Vec[] = [];
  c.forEach((p, i) => {
    const u = i / (n - 1);
    const w = (w0 * Math.max(0.0, 1 - u) ** power) / 2;
    const q = nn[i] as Vec;
    left.push({ x: p.x + q.x * w, y: p.y + q.y * w });
    right.push({ x: p.x - q.x * w, y: p.y - q.y * w });
  });
  return [...left, ...right.reverse()];
}

/**
 * DEMI-largeur du ruban (ou du cône) à l'abscisse réduite u ∈ [0, 1] : MÊME formule que `ribbon` / `cone`. Lue par le
 * rendu pour tracer des bandes (ombre, reflet) exactement à l'intérieur de la mèche.
 */
export function halfWidth(u: number, w0: number, sharp: number, profile: 'ribbon' | 'cone', power = 1, root = 0.8): number {
  if (profile === 'cone') return (w0 * Math.max(0, 1 - u) ** power) / 2;
  const prof = sharp * (1 - u ** 1.2) + (1 - sharp) * (1 - 0.75 * u ** 2);
  return Math.max(0.03 * w0, w0 * prof * (root + (1 - root) * Math.min(1, u * 5))) / 2;
}

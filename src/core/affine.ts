import type { Box } from './pathbox';

/**
 * Transformations affines 2D minimales pour l'audit d'emprise (`offcanvas.ts`) : analyse de l'attribut SVG `transform`, produit, boîte englobante transformée.
 * Matrice [a b c d e f] au sens SVG : x' = a·x + c·y + e ; y' = b·x + d·y + f. Une liste inconnue ou mal formée renvoie `null` (l'appelant traite alors
 * l'élément comme « peut être partout » : on ne supprime jamais ce qu'on ne sait pas mesurer).
 */
export type Mat = readonly [number, number, number, number, number, number];
export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

export const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

const nums = (s: string): number[] => (s.match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);

/** Analyse d'une liste `transform="translate(…) rotate(…) …"` ; `null` si une fonction est inconnue ou a un nombre d'arguments invalide. */
export function parseTransform(t: string | undefined): Mat | null {
  if (t === undefined || t.trim() === '') return IDENTITY;
  let m: Mat = IDENTITY;
  const re = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  const rest = t.replace(re, '').replace(/,/g, '').trim();
  if (rest !== '') return null;
  for (let r = re.exec(t); r; r = re.exec(t)) {
    const a = nums(r[2] as string);
    if (a.some((v) => !Number.isFinite(v))) return null;
    let f: Mat;
    switch (r[1]) {
      case 'translate': if (a.length < 1 || a.length > 2) return null; f = [1, 0, 0, 1, a[0]!, a[1] ?? 0]; break;
      case 'scale': if (a.length < 1 || a.length > 2) return null; f = [a[0]!, 0, 0, a[1] ?? a[0]!, 0, 0]; break;
      case 'rotate': {
        if (a.length !== 1 && a.length !== 3) return null;
        const q = (a[0]! * Math.PI) / 180, c = Math.cos(q), s = Math.sin(q), cx = a[1] ?? 0, cy = a[2] ?? 0;
        f = [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy]; break;
      }
      case 'matrix': if (a.length !== 6) return null; f = [a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!]; break;
      case 'skewX': if (a.length !== 1) return null; f = [1, 0, Math.tan((a[0]! * Math.PI) / 180), 1, 0, 0]; break;
      case 'skewY': if (a.length !== 1) return null; f = [1, Math.tan((a[0]! * Math.PI) / 180), 0, 1, 0, 0]; break;
      default: return null;
    }
    m = mul(m, f);
  }
  return m;
}

/** Boîte englobante (alignée sur les axes) de l'image d'une boîte par `m` : contient toujours l'image des quatre coins. */
export function transformBox(m: Mat, b: Box): Box {
  const xs: number[] = [], ys: number[] = [];
  for (const [x, y] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]] as const) { xs.push(m[0] * x + m[2] * y + m[4]); ys.push(m[1] * x + m[3] * y + m[5]); }
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  return { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 };
}

/** Intersection de deux boîtes ; `null` si elles ne se recouvrent pas (un contact par un bord compte comme vide). */
export function intersectBox(a: Box, b: Box): Box | null {
  const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

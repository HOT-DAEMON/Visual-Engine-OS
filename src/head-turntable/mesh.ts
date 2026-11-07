import { cross, norm, sub, v3 } from './math';
import { sectionAt, sectionPoint, surfaceZ } from './sections';
import type { HeadTurnSpec, V3 } from './types';
import { neckSection } from './engines/neck3d';

/** Identifiants de parties (groupes de contour : 1 et 4 = peau de la tête, sans trait entre eux ; 2 et 5 = cou ; 3 = oreilles). */
export const PART = { head: 1, neck: 2, ear: 3, bump: 4, neckCut: 5, earBack: 6 } as const;

/** Maillage triangulaire : positions et normales dans le repère de la tête. */
export interface Mesh { readonly id: number; readonly P: V3[]; readonly N: V3[]; readonly T: [number, number, number][]; /** Coordonnées de texture (u, v) par sommet : interpolées par la rastérisation (oreille : plan de l'oreille). */ readonly UV?: [number, number][] }

/** Maillage d'une grille de rangées (rows[i][j]) : normales = produit vectoriel des tangentes, orientées à l'opposé de `inside(i)`. */
export function gridMesh(id: number, rows: V3[][], wrap: boolean, inside: (i: number, j: number) => V3, uv?: [number, number][][]): Mesh {
  const ni = rows.length, nj = rows[0]!.length;
  const P = rows.flat(), N: V3[] = [], T: [number, number, number][] = [];
  const idx = (i: number, j: number): number => i * nj + ((j % nj) + nj) % nj;
  for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) {
    const du = sub(P[idx(i, wrap ? j + 1 : Math.min(nj - 1, j + 1))]!, P[idx(i, wrap ? j - 1 : Math.max(0, j - 1))]!);
    const dv = sub(P[idx(Math.min(ni - 1, i + 1), j)]!, P[idx(Math.max(0, i - 1), j)]!);
    let n = norm(cross(du, dv));
    const out = sub(P[idx(i, j)]!, inside(i, j));
    if (n.x * out.x + n.y * out.y + n.z * out.z < 0) n = v3(-n.x, -n.y, -n.z);
    N.push(n);
  }
  const jn = wrap ? nj : nj - 1;
  for (let i = 0; i + 1 < ni; i++) for (let j = 0; j < jn; j++) { T.push([idx(i, j), idx(i, j + 1), idx(i + 1, j)], [idx(i, j + 1), idx(i + 1, j + 1), idx(i + 1, j)]); }
  return uv ? { id, P, N, T, UV: uv.flat() } : { id, P, N, T };
}

/** Crâne + mâchoire : pile de sections elliptiques (pas dy), fermée au sommet et au bas du menton. */
export function headMesh(spec: HeadTurnSpec, K = 96, dy = 0.0125): Mesh {
  const y0 = spec.rows[0]!.y, y1 = spec.rows[spec.rows.length - 1]!.y;
  const ys: number[] = []; for (let y = y0; y < y1 - 1e-9; y += dy) ys.push(y); ys.push(y1);
  const rows = ys.map((y) => { const s = sectionAt(spec, y); return Array.from({ length: K }, (_, j) => { const q = sectionPoint(s, (j / K) * 2 * Math.PI); return v3(q.x, y, q.z); }); });
  return gridMesh(PART.head, rows, true, (i) => { const s = sectionAt(spec, ys[i]!); return v3(0, ys[i]!, s.zw); });
}

/** Cou : cylindre elliptique ; le bas est refermé par un disque (id neckCut), comme le socle de la planche. */
export function neckMeshes(spec: HeadTurnSpec, K = 64): Mesh[] {
  const n = spec.neck, e = spec.engine, ys = Array.from({ length: 12 }, (_, i) => n.y0 + ((n.y1 - n.y0) * i) / 11);
  const flare = (y: number): number => 1 + 0.1 * Math.max(0, (y - (n.y1 - 0.2)) / 0.2);   // évasement de 10 % sur les 0,2 U du bas (le socle de la planche)
  // Section : moteur de crâne / visage (lignes du cou) si la spec en porte, sinon cylindre mesuré.
  const sec = (y: number): { a: number; zc: number; b: number } => (e ? neckSection(e, y, n.y1) : { a: n.a * flare(y), zc: n.zc, b: n.b * flare(y) });
  const rows = ys.map((y) => { const s = sec(y); return Array.from({ length: K }, (_, j) => { const th = (j / K) * 2 * Math.PI; return v3(s.a * Math.sin(th), y, s.zc + s.b * Math.cos(th)); }); });
  const body = gridMesh(PART.neck, rows, true, (i) => v3(0, ys[i]!, sec(ys[i]!).zc));
  const last = rows[rows.length - 1]!, c = v3(0, n.y1, sec(n.y1).zc);
  const P = [...last, c], N = P.map(() => v3(0, 1, 0)), T: [number, number, number][] = [];
  for (let j = 0; j < K; j++) T.push([j, (j + 1) % K, K]);
  return [body, { id: PART.neckCut, P, N, T }];
}

/** Bosse (nez, lèvres) : sections demi-elliptiques posées sur la surface de la tête, de hauteur h(y) et de demi-largeur w(y). */
export function bumpMesh(spec: HeadTurnSpec, y0: number, y1: number, h: (y: number) => number, w: (y: number) => number, K = 17, steps = 40): Mesh {
  const rows: V3[][] = [];
  for (let i = 0; i <= steps; i++) {
    const y = y0 + ((y1 - y0) * i) / steps, s = sectionAt(spec, y), hh = Math.max(1e-4, h(y)), ww = Math.max(1e-3, w(y));
    rows.push(Array.from({ length: K }, (_, j) => {
      const u = -1 + (2 * j) / (K - 1), x = u * ww, zs = surfaceZ(s, x, true);
      return v3(x, y, zs + hh * Math.sqrt(Math.max(0, 1 - u * u)) - 0.004);
    }));
  }
  return gridMesh(PART.bump, rows, false, (i) => { const y = y0 + ((y1 - y0) * i) / steps; return v3(0, y, sectionAt(spec, y).zc); });
}

/** Ellipsoïde (sphère UV) de centre c et demi-axes ex, ey, ez le long des axes orthonormés (ax, ay, az). */
export function ellipsoid(id: number, c: V3, ax: V3, ay: V3, az: V3, ex: number, ey: number, ez: number, nu = 18, nv = 28): Mesh {
  const rows: V3[][] = [];
  for (let i = 0; i <= nu; i++) {
    const ph = -Math.PI / 2 + (Math.PI * i) / nu, cp = Math.cos(ph), sp = Math.sin(ph);
    rows.push(Array.from({ length: nv }, (_, j) => {
      const th = (2 * Math.PI * j) / nv, a = ex * cp * Math.cos(th), b = ey * sp, d = ez * cp * Math.sin(th);
      return v3(c.x + ax.x * a + ay.x * b + az.x * d, c.y + ax.y * a + ay.y * b + az.y * d, c.z + ax.z * a + ay.z * b + az.z * d);
    }));
  }
  return gridMesh(id, rows, true, () => c);
}

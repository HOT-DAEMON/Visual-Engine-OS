import { cross, norm, sub, v3 } from './math';
import { sectionAt, sectionPoint, surfaceZ } from './sections';
import type { HeadTurnSpec, V3 } from './types';
import { CUT_SLOPE, isBellHead, neckSection } from './engines/neck3d';
import { headRelief } from './engines/head-relief';

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
  const relief = headRelief(spec.engine);   // bosses pariétales, asymétrie, joues : déplacement radial sur la superellipse (têtes issues d'un visage seulement)
  const rows = ys.map((y) => {
    const s = sectionAt(spec, y);
    return Array.from({ length: K }, (_, j) => {
      const th = (j / K) * 2 * Math.PI, q = sectionPoint(s, th), d = relief ? relief(y, th) : 0;
      if (d === 0) return v3(q.x, y, q.z);
      const rx = q.x, rz = q.z - s.zc, rl = Math.hypot(rx, rz) || 1;   // direction radiale depuis l'axe vertical du centre de la section
      const xr = q.x + (d * rx) / rl;
      return v3(Math.max(-s.a, Math.min(s.a, xr)), y, q.z + (d * rz) / rl);   // jamais plus large que la demi-largeur de la section : le contour de FACE reste celui du moteur de visage (`head.geo.front2d`), les bosses se lisent de profil et de trois quarts
    });
  });
  return gridMesh(PART.head, rows, true, (i) => { const s = sectionAt(spec, ys[i]!); return v3(0, ys[i]!, s.zw); });
}

/**
 * Cou : cylindre elliptique ; le bas est refermé par un plan (id neckCut). Planche : disque horizontal (le socle mesuré). Tête issue d'un visage : le plan de coupe est OBLIQUE (`engines/neck3d.ts`
 * `CUT_SLOPE`, plan de l'orifice supérieur du thorax : devant plus bas, nuque plus haute) ; chaque colonne j du maillage descend de y0 jusqu'à la hauteur du plan à son azimut.
 */
export function neckMeshes(spec: HeadTurnSpec, K = 64): Mesh[] {
  const n = spec.neck, e = spec.engine, bell = isBellHead(e), nr = bell ? 30 : 12;   // la cloche des trapèzes demande plus de rangées que le cylindre de la planche (inchangée : 12)
  const flare = (y: number): number => 1 + 0.1 * Math.max(0, (y - (n.y1 - 0.2)) / 0.2);   // évasement de 10 % sur les 0,2 U du bas (le socle de la planche)
  // Section : moteur de crâne / visage (lignes du cou) si la spec en porte, sinon cylindre mesuré.
  const sec = (y: number): { a: number; zc: number; b: number } => (e ? neckSection(e, y, n.y1) : { a: n.a * flare(y), zc: n.zc, b: n.b * flare(y) });
  const base = sec(n.y1), slope = bell ? CUT_SLOPE : 0, ths = Array.from({ length: K }, (_, j) => (j / K) * 2 * Math.PI);
  // Hauteur du bord de la coupe à l'azimut th : point FIXE de y = y1 + pente × (z(y, th) − zc1) (la section dépend de y : la nuque, plus haute, est plus étroite) ; 8 itérations (contraction : pente × dz/dy ≪ 1) → les points du bord sont coplanaires.
  const endY = (th: number): number => { let y = n.y1; for (let k = 0; slope && k < 8; k++) { const s = sec(y); y = n.y1 + slope * (s.zc + s.b * Math.cos(th) - base.zc); } return y; };
  const ends = ths.map(endY), yAt = (i: number, j: number): number => n.y0 + (ends[j]! - n.y0) * (i / (nr - 1));   // slope = 0 : y = y0 + (y1 − y0)·i/(nr − 1), exactement l'ancien pas régulier
  const rows = Array.from({ length: nr }, (_, i) => ths.map((th, j) => { const y = yAt(i, j), s = sec(y); return v3(s.a * Math.sin(th), y, s.zc + s.b * Math.cos(th)); }));
  const body = gridMesh(PART.neck, rows, true, (i, j) => { const y = yAt(i, j); return v3(0, y, sec(y).zc); });
  const last = rows[nr - 1]!, c = v3(0, n.y1, base.zc);
  const P = [...last, c], nn = norm(v3(0, 1, -slope)), N = P.map(() => nn), T: [number, number, number][] = [];
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

import { cross, norm, sub, v3 } from './math';
import { sectionAt, sectionPoint, surfaceZ } from './sections';
import type { HeadTurnSpec, V3 } from './types';
import { CUT_SLOPE, isBellHead, neckSection } from './engines/neck3d';
import { headRelief, headReliefOver } from './engines/head-relief';

/** Identifiants de parties (groupes de contour : 1 et 4 = peau de la tête, sans trait entre eux ; 2 et 5 = cou ; 3 = oreilles). */
export const PART = { head: 1, neck: 2, ear: 3, bump: 4, neckCut: 5, earBack: 6, hair: 7, hairPart: 8, hairBun: 9 } as const;

/** Maillage triangulaire : positions et normales dans le repère de la tête. */
export interface Mesh { readonly id: number; readonly P: V3[]; readonly N: V3[]; readonly T: [number, number, number][]; /** Coordonnées de texture (u, v) par sommet : interpolées par la rastérisation (oreille : plan de l'oreille). */ readonly UV?: [number, number][];
  /** Test de DÉCOUPE évalué par la rastérisation sur la position 3D interpolée (repère tête) de chaque pixel : faux = pixel ignoré. Coque de cheveux : lisière (`hair-shell.ts`). */
  readonly clip?: (p: V3) => boolean }

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

/** Relief du crâne (bosses pariétales, asymétrie, joues) : déplacement radial en (y, θ), ou `undefined` pour la planche. */
export type SkullRelief = ReturnType<typeof headRelief>;

/** Point de la surface du crâne à la hauteur y et à l'angle th, relief compris : source UNIQUE du maillage du crâne ET de la coque de cheveux (sans elle, les bosses pariétales percent une coque fine). */
export function skullSurfacePoint(spec: HeadTurnSpec, relief: SkullRelief, y: number, th: number): V3 {
  const s = sectionAt(spec, y), q = sectionPoint(s, th), d = relief ? relief(y, th) : 0;
  if (d === 0) return v3(q.x, y, q.z);
  const rx = q.x, rz = q.z - s.zc, rl = Math.hypot(rx, rz) || 1;   // direction radiale depuis l'axe vertical du centre de la section
  const xr = q.x + (d * rx) / rl, ov = headReliefOver(spec.engine, y);   // ov : tolérance de l'asymétrie de largeur de la voûte (0 sinon)
  return v3(Math.max(-s.a - ov, Math.min(s.a + ov, xr)), y, q.z + (d * rz) / rl);   // jamais plus large que la demi-largeur de la section : le contour de FACE reste celui du moteur de visage (`head.geo.front2d`), les bosses se lisent de profil et de trois quarts
}

/** Crâne + mâchoire : pile de sections elliptiques (pas dy), fermée au sommet et au bas du menton. */
export function headMesh(spec: HeadTurnSpec, K = 96, dy = 0.0125): Mesh {
  const y0 = spec.rows[0]!.y, y1 = spec.rows[spec.rows.length - 1]!.y;
  const ys: number[] = []; for (let y = y0; y < y1 - 1e-9; y += dy) ys.push(y); ys.push(y1);
  const relief = headRelief(spec.engine);   // bosses pariétales, asymétrie, joues : déplacement radial sur la superellipse (têtes issues d'un visage seulement)
  const rows = ys.map((y) => Array.from({ length: K }, (_, j) => skullSurfacePoint(spec, relief, y, (j / K) * 2 * Math.PI)));
  return gridMesh(PART.head, rows, true, (i) => { const s = sectionAt(spec, ys[i]!); return v3(0, ys[i]!, s.zw); });
}

/** Prolongation du cou sous sa base (U) et nombre de rangées de cette prolongation (têtes issues d'un visage) : voir `neckMeshes`. 1 U couvre un tangage de ±60° (la prolongation doit dépasser la ligne de coupe du cadre à toutes les vues). */
export const NECK_EXT = 1.0, NECK_EXT_ROWS = 10, NECK_BODY_ROWS = 30;

/** Section du cou à la hauteur y : moteur de crâne / visage (cloche des trapèzes) si la spec en porte, sinon cylindre mesuré de la planche (évasement de 10 % sur les 0,2 U du bas, le socle de la planche). */
const neckSec = (spec: HeadTurnSpec): ((y: number) => { a: number; zc: number; b: number }) => {
  const n = spec.neck, e = spec.engine, flare = (y: number): number => 1 + 0.1 * Math.max(0, (y - (n.y1 - 0.2)) / 0.2);
  return (y) => (e ? neckSection(e, y, n.y1) : { a: n.a * flare(y), zc: n.zc, b: n.b * flare(y) });
};

/** Hauteur y du bord du plan de l'orifice thoracique à l'azimut th : point FIXE de y = y1 + pente × (z(y, th) − zc1) (la section dépend de y) ; 8 itérations (contraction : pente × dz/dy ≪ 1) → points coplanaires. */
const cutEndY = (spec: HeadTurnSpec, sec: ReturnType<typeof neckSec>, th: number): number => {
  const n = spec.neck, base = sec(n.y1); let y = n.y1;
  for (let k = 0; k < 8; k++) { const s = sec(y); y = n.y1 + CUT_SLOPE * (s.zc + s.b * Math.cos(th) - base.zc); }
  return y;
};

/**
 * ANNEAU DE L'ORIFICE THORACIQUE (têtes issues d'un visage ; `[]` pour la planche) : le bord, coplanaire et OBLIQUE (devant plus bas), où le cou rejoint le thorax. Ce n'est plus un bord de maillage
 * (le cou se prolonge, voir `neckMeshes`) mais le REPÈRE du bas du cou : le rendu coupe le cou à la hauteur image du point le plus bas de cet anneau (`neck-clip.ts`), les clavicules s'y ancrent (`neck-relief.ts`).
 */
export function neckCutRing(spec: HeadTurnSpec, K = 64): V3[] {
  if (!isBellHead(spec.engine)) return [];
  const sec = neckSec(spec);
  return Array.from({ length: K }, (_, j) => { const th = (j / K) * 2 * Math.PI, y = cutEndY(spec, sec, th), s = sec(y); return v3(s.a * Math.sin(th), y, s.zc + s.b * Math.cos(th)); });
}

/**
 * Cou. Planche : cylindre elliptique refermé par un disque horizontal (le socle mesuré, id neckCut).
 * Tête issue d'un visage : PAS de plan de coupe. Un plan, même oblique, se lit comme un « seau » elliptique dès que la caméra passe sous le menton (tangage > 0 : grande ellipse pleine au bord net),
 * alors que les références `rotation-3d/01` montrent un cou qui continue vers le bas et que le CADRE coupe en ligne droite. Le cou est donc prolongé de `NECK_EXT` U sous sa base à section constante
 * (la cloche des trapèzes est déjà atteinte à `y1`), et le rendu le coupe par une ligne horizontale de l'image (`neck-clip.ts`) ; aucun pixel de plan de coupe n'est jamais dessiné.
 */
export function neckMeshes(spec: HeadTurnSpec, K = 64): Mesh[] {
  const n = spec.neck, e = spec.engine, bell = isBellHead(e), sec = neckSec(spec), ths = Array.from({ length: K }, (_, j) => (j / K) * 2 * Math.PI);
  if (bell) {
    const ys = [...Array.from({ length: NECK_BODY_ROWS }, (_, i) => n.y0 + ((n.y1 - n.y0) * i) / (NECK_BODY_ROWS - 1)), ...Array.from({ length: NECK_EXT_ROWS }, (_, i) => n.y1 + (NECK_EXT * (i + 1)) / NECK_EXT_ROWS)];
    const rows = ys.map((y) => { const s = sec(y); return ths.map((th) => v3(s.a * Math.sin(th), y, s.zc + s.b * Math.cos(th))); });
    return [gridMesh(PART.neck, rows, true, (i) => v3(0, ys[i]!, sec(ys[i]!).zc))];
  }
  const nr = 12, base = sec(n.y1);
  const yAt = (i: number): number => n.y0 + (n.y1 - n.y0) * (i / (nr - 1));   // planche : y = y0 + (y1 − y0)·i/(nr − 1), exactement l'ancien pas régulier
  const rows = Array.from({ length: nr }, (_, i) => ths.map((th) => { const y = yAt(i), s = sec(y); return v3(s.a * Math.sin(th), y, s.zc + s.b * Math.cos(th)); }));
  const body = gridMesh(PART.neck, rows, true, (i) => { const y = yAt(i); return v3(0, y, sec(y).zc); });
  const last = rows[nr - 1]!, c = v3(0, n.y1, base.zc);
  const P = [...last, c], nn = norm(v3(0, 1, 0)), N = P.map(() => nn), T: [number, number, number][] = [];
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

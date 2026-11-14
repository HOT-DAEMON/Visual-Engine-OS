import { gridMesh, PART, type Mesh } from './mesh';
import { clamp, norm, cross, smooth, v3 } from './math';
import { sectionAt } from './sections';
import type { HairPart, HairVolume } from './hair-volume-types';
import type { HeadTurnSpec, V3 } from './types';

const TAU = 2 * Math.PI;
/** Découpage : colonnes autour d'un tube, pas le long du tube, parallèles / méridiens d'une sphère. */
const KC = 16, NT = 18, NU = 16, NV = 28;

/** Point d'attache 3D sur les sections du crâne : dessus = en retrait du sommet, flanc = contour latéral légèrement en arrière de l'oreille, dos = face arrière. x vient du moteur de cheveux (`hair-parts-spec.ts`). */
export function attach(spec: HeadTurnSpec, p: { x: number; y: number }, place: 'top' | 'side' | 'back'): V3 {
  const top = spec.rows[0]!.y, s = sectionAt(spec, clamp(p.y, top, 1));
  if (place === 'top') return v3(p.x, p.y, s.zc - 0.3 * s.b);
  if (place === 'side') { const sg = p.x < 0 ? -1 : 1; return v3(sg * Math.max(Math.abs(p.x), s.a), p.y, s.zc - 0.12 * s.b); }
  return v3(p.x, p.y, s.zb + 0.012);
}

/** Sphère (ellipsoïde) avec coordonnées de texture (longitude, latitude) : le chignon a ses spirales aux pôles. */
function sphere(c: V3, rx: number, ry: number, rz: number): Mesh {
  const rows: V3[][] = [], uv: [number, number][][] = [];
  for (let i = 0; i <= NU; i++) {
    const ph = -Math.PI / 2 + (Math.PI * i) / NU, cp = Math.cos(ph), sp = Math.sin(ph);
    rows.push(Array.from({ length: NV + 1 }, (_, j) => { const th = (TAU * j) / NV; return v3(c.x + rx * cp * Math.cos(th), c.y + ry * sp, c.z + rz * cp * Math.sin(th)); }));
    uv.push(Array.from({ length: NV + 1 }, (_, j) => [j / NV, i / NU] as [number, number]));
  }
  return gridMesh(PART.hairBun, rows, false, () => c, uv);
}

/** Tube le long du chemin `pts` : section elliptique (largeur rx selon x, profondeur rz), texture (tour, longueur). Extrémités fermées par rayon nul. */
function tube(pts: readonly V3[], rx: readonly number[], rz: readonly number[]): Mesh {
  const X = v3(1, 0, 0), rows: V3[][] = [], uv: [number, number][][] = [];
  let len = 0;
  pts.forEach((c, i) => {
    const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(pts.length - 1, i + 1)]!, T = norm(v3(b.x - a.x, b.y - a.y, b.z - a.z)), D = norm(cross(X, T));
    if (i > 0) len += Math.hypot(c.x - pts[i - 1]!.x, c.y - pts[i - 1]!.y, c.z - pts[i - 1]!.z);
    rows.push(Array.from({ length: KC + 1 }, (_, j) => { const f = (TAU * j) / KC, u = Math.cos(f) * rx[i]!, w = Math.sin(f) * rz[i]!; return v3(c.x + X.x * u + D.x * w, c.y + X.y * u + D.y * w, c.z + X.z * u + D.z * w); }));
    uv.push(Array.from({ length: KC + 1 }, (_, j) => [j / KC, len] as [number, number]));
  });
  return gridMesh(PART.hairPart, rows, false, (i) => pts[i]!, uv);
}

/** Queue : part de l'attache, sort vers l'arrière puis tombe ; s'évase au premier tiers (éventail) puis s'effile. */
function tail(spec: HeadTurnSpec, p: Extract<HairPart, { kind: 'tail' }>): Mesh {
  const o = attach(spec, p, p.place), sg = p.x < 0 ? -1 : 1, pts: V3[] = [], rx: number[] = [], rz: number[] = [];
  for (let i = 0; i < NT; i++) {
    const t = i / (NT - 1), g = smooth(Math.min(1, t * 2.2));
    const x = p.place === 'side' ? o.x + sg * (0.05 + 0.12 * p.len) * t ** 0.8 : o.x, z = o.z - (p.place === 'side' ? 0.05 * p.len * t : 0.04 + 0.1 * p.len * g * (1 - 0.3 * t));
    const y = p.place === 'top' ? o.y + p.len * (t - 0.45 * Math.sin(Math.PI * t)) : o.y + p.len * t;
    pts.push(v3(x, y, p.place === 'top' ? z - 0.12 * p.len * Math.sin(Math.PI * t) : z));
    const fan = (p.r0 + p.spread * 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.1))) * (1 - 0.8 * t ** 2.4);
    rx.push(Math.max(i === NT - 1 ? 0 : 0.004, fan)); rz.push(Math.max(i === NT - 1 ? 0 : 0.004, fan * 0.75));
  }
  return tube(pts, rx, rz);
}

/** Tresse : tube vertical derrière la tête depuis la racine, effilé aux 15 % du bout. */
function braid(spec: HeadTurnSpec, p: Extract<HairPart, { kind: 'braid' }>): Mesh {
  const o = attach(spec, p, Math.abs(p.x) >= 0.12 ? 'side' : 'back'), pts: V3[] = [], rx: number[] = [], rz: number[] = [];
  for (let i = 0; i < NT; i++) {
    const t = i / (NT - 1);
    pts.push(v3(o.x, o.y + p.len * t, o.z - 0.05 - 0.08 * t));
    const r = p.r * (1 - 0.3 * t) * (t > 0.85 ? Math.max(0, 1 - (t - 0.85) / 0.15) : 1);
    rx.push(r); rz.push(r);
  }
  return tube(pts, rx, rz);
}

/** Pièces attachées de la coiffure en maillages (même repère, même rotation que le crâne). */
export function hairPartMeshes(spec: HeadTurnSpec, vol: HairVolume): Mesh[] {
  return vol.parts.map((p) => {
    if (p.kind === 'bun') { const o = attach(spec, p, p.place), sg = p.x < 0 ? -1 : 1, c = p.place === 'top' ? v3(o.x, o.y - 0.4 * p.r, o.z) : p.place === 'side' ? v3(o.x + sg * 0.6 * p.r, o.y, o.z) : v3(o.x, o.y, o.z - 0.6 * p.r); return sphere(c, p.r, p.r * 0.92, p.r * 0.95); }
    return p.kind === 'tail' ? tail(spec, p) : braid(spec, p);
  });
}

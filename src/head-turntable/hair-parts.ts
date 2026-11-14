import { gridMesh, PART, type Mesh } from './mesh';
import { clamp, norm, cross, smooth, v3 } from './math';
import { sectionAt } from './sections';
import { shellPoint } from './hair-shell';
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
function tube(pts: readonly V3[], rx: readonly number[], rz: readonly number[], part: number = PART.hairPart): Mesh {
  const rows: V3[][] = [], uv: [number, number][][] = [];
  let len = 0;
  pts.forEach((c, i) => {
    const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(pts.length - 1, i + 1)]!, T = norm(v3(b.x - a.x, b.y - a.y, b.z - a.z));
    // Repère de la section : l'axe x, sauf si la tangente lui est presque parallèle (épi qui part droit de côté : le produit vectoriel serait nul).
    const X = Math.abs(T.x) > 0.9 ? v3(0, 0, 1) : v3(1, 0, 0), D = norm(cross(X, T));
    if (i > 0) len += Math.hypot(c.x - pts[i - 1]!.x, c.y - pts[i - 1]!.y, c.z - pts[i - 1]!.z);
    rows.push(Array.from({ length: KC + 1 }, (_, j) => { const f = (TAU * j) / KC, u = Math.cos(f) * rx[i]!, w = Math.sin(f) * rz[i]!; return v3(c.x + X.x * u + D.x * w, c.y + X.y * u + D.y * w, c.z + X.z * u + D.z * w); }));
    uv.push(Array.from({ length: KC + 1 }, (_, j) => [j / KC, len] as [number, number]));
  });
  return gridMesh(part, rows, false, (i) => pts[i]!, uv);
}

/** Queue : part de l'attache, sort vers l'arrière puis tombe ; s'évase au premier tiers (éventail) puis s'effile. */
function tail(spec: HeadTurnSpec, p: Extract<HairPart, { kind: 'tail' }>): Mesh {
  const o = attach(spec, p, p.place), sg = p.x < 0 ? -1 : 1, pts: V3[] = [], rx: number[] = [], rz: number[] = [];
  for (let i = 0; i < NT; i++) {
    const t = i / (NT - 1), g = smooth(Math.min(1, t * 2.2));
    const x = p.place === 'side' ? o.x + sg * (0.05 + 0.12 * p.len) * t ** 0.8 : o.x, z = o.z - (p.place === 'side' ? 0.05 * p.len * t : 0.04 + 0.1 * p.len * g * (1 - 0.3 * t));
    const y = p.place === 'top' ? o.y + p.len * (t - 0.45 * Math.sin(Math.PI * t)) : o.y + p.len * t;
    pts.push(v3(x, y, p.place === 'top' ? z - 0.12 * p.len * Math.sin(Math.PI * t) : z));
    const fan = (p.r0 + p.spread * 0.85 * Math.sin(Math.PI * Math.min(1, t * 1.1))) * (1 - 0.75 * t ** 2.4);   // la queue est un VOLUME de cheveux rassemblés (section presque ronde), pas un pan
    rx.push(Math.max(i === NT - 1 ? 0 : 0.004, fan)); rz.push(Math.max(i === NT - 1 ? 0 : 0.004, fan * 0.92));
  }
  return tube(pts, rx, rz);
}

/** Tresse : TRESSAGE vrai. Un toron tous les `BRAID_PITCH` U (même pas que les côtes de la texture `braided`, `hair-strands.ts`) ; le chemin zigzague d'un toron à l'autre et la section se renfle au milieu de chaque toron, d'où une silhouette en chaîne et non un tube lisse (vue de face : les « pavés plats » des tresses). Le bout s'évase en petite touffe puis se ferme. */
export const BRAID_PITCH = 1 / 9, NB_PTS = 54;
function braid(spec: HeadTurnSpec, p: Extract<HairPart, { kind: 'braid' }>): Mesh {
  const o = attach(spec, p, Math.abs(p.x) >= 0.12 ? 'side' : 'back'), pts: V3[] = [], rx: number[] = [], rz: number[] = [], nb = Math.max(3, Math.round(p.len / BRAID_PITCH));
  for (let i = 0; i < NB_PTS; i++) {
    const t = i / (NB_PTS - 1), ph = TAU * t * nb, weave = Math.sin(ph);
    pts.push(v3(o.x + 0.22 * p.r * weave, o.y + p.len * t, o.z - 0.05 - 0.08 * t + 0.12 * p.r * Math.cos(ph)));
    const body = p.r * (1 - 0.3 * t) * (1 + 0.16 * Math.abs(Math.sin(ph / 2))), tuft = 1 + 0.45 * smooth((t - 0.86) / 0.07), close = t > 0.93 ? Math.max(0, 1 - (t - 0.93) / 0.07) : 1;
    const r = i === NB_PTS - 1 ? 0 : Math.max(0.004, body * tuft * close);
    rx.push(r * (1 + 0.12 * weave)); rz.push(r * (1 - 0.12 * weave));
  }
  return tube(pts, rx, rz);
}

/** Épi : cône concave (profil `(1 − t)^power`) planté dans la coque, dirigé par `up` / `out` / `sx` ; la pointe retombe un peu (gravité, 6 % de la longueur). */
const NS = 8, EMBED = 0.012;
function spike(spec: HeadTurnSpec, vol: HairVolume, p: Extract<HairPart, { kind: 'spike' }>): Mesh {
  const th = (p.az * Math.PI) / 180, sn = Math.sin(th), cs = Math.cos(th), root = shellPoint(spec, vol, p.y, th), d = norm(v3(sn * p.out + cs * p.sx, -p.up, cs * p.out - sn * p.sx));
  const pts: V3[] = [], rx: number[] = [], rz: number[] = [];
  for (let i = 0; i < NS; i++) {
    const t = i / (NS - 1), s = p.len * t - EMBED;
    pts.push(v3(root.x + d.x * s, root.y + d.y * s + 0.06 * p.len * t * t, root.z + d.z * s));
    const r = i === NS - 1 ? 0 : Math.max(0.003, p.r * (1 - t) ** p.power);
    rx.push(r); rz.push(r);
  }
  return tube(pts, rx, rz, PART.hairSpike);
}

/** Pièces attachées de la coiffure en maillages (même repère, même rotation que le crâne). */
export function hairPartMeshes(spec: HeadTurnSpec, vol: HairVolume): Mesh[] {
  return vol.parts.map((p) => {
    if (p.kind === 'bun') { const o = attach(spec, p, p.place), sg = p.x < 0 ? -1 : 1, c = p.place === 'top' ? v3(o.x, o.y - 0.4 * p.r, o.z) : p.place === 'side' ? v3(o.x + sg * 0.6 * p.r, o.y, o.z) : v3(o.x, o.y, o.z - 0.6 * p.r); return sphere(c, p.r, p.r * 0.92, p.r * 0.95); }
    return p.kind === 'tail' ? tail(spec, p) : p.kind === 'spike' ? spike(spec, vol, p) : braid(spec, p);
  });
}

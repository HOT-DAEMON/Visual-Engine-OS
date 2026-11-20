import { type Blade } from './blade';
import { project, viewRayInHead, type HeadSpec, type View } from './head';
import { walk, type LockSpec } from './lock';
import type { Relation } from './occlusion';
import { add, cross, dot, mul, norm, sub, v3, type V2, type V3 } from './vec';

/**
 * GÉOMÉTRIE LOCALE d'une mèche — l'interface que la GÉOMÉTRIE fournit au moteur d'apparence (le moteur ne l'invente pas) :
 * en chaque échantillon de la lame : tangente, normale 2D, courbure signée, orientation, torsion du ruban, largeur locale, profondeur,
 * NORMALE 3D du ruban (normale de coque tournée de la torsion autour de la tangente), exposition à la lumière, face visible, occlusion locale.
 * Une mèche torsadée n'a donc pas le même motif de reflet qu'une mèche plate : exposition et face visible changent avec `cos φ`.
 */
export interface LockGeom {
  readonly n: number;
  readonly tangent: V2[]; readonly normal: V2[]; readonly curvature: number[]; readonly orientation: number[]; readonly twist: number[];
  readonly width: number[]; readonly depth: number[];
  /** Normale 3D du ruban du côté caméra, exposition à la lumière (0–1), vrai si la face visible est le DESSOUS du ruban. */
  readonly normal3: V3[]; readonly exposure: number[]; readonly backface: boolean[];
  /** Occlusion locale 0–1 : 1 sur les portions recouvertes par une mèche de devant, décroissance douce de part et d'autre. */
  readonly occlusion: number[];
}
export interface Light { readonly dir: V3 }
/** Lumière par défaut : en haut à gauche, légèrement de face (repère de tête, y vers le bas). */
export const LIGHT: Light = { dir: norm(v3(-0.45, -0.65, 0.6)) };

/** Direction de la lumière dans le plan image (unité), d'après la vue. */
export function lightScreen(view: View, l: Light): V2 {
  const o = project(view, v3(0, 0, 0)); const p = project(view, l.dir); const x = p.x - o.x; const y = p.y - o.y; const m = Math.hypot(x, y) || 1;
  return { x: x / m, y: y / m };
}

const rotAbout = (d: V3, ax: V3, a: number): V3 => add(add(mul(d, Math.cos(a)), mul(cross(ax, d), Math.sin(a))), mul(ax, dot(ax, d) * (1 - Math.cos(a))));

/** Occlusion locale d'une mèche `idx` d'après les relations (portions où elle est DERRIÈRE), avec décroissance exp(−d/0,05). */
export function occlusionProfile(idx: number, n: number, relations: readonly Relation[]): number[] {
  const spans: [number, number][] = [];
  for (const r of relations) for (const iv of r.intervals) { if (r.a === idx && iv.front === 'b') spans.push([iv.a0, iv.a1]); else if (r.b === idx && iv.front === 'a') spans.push([iv.b0, iv.b1]); }
  return Array.from({ length: n }, (_, i) => { const t = i / (n - 1); let o = 0; for (const [a, b] of spans) { const d = t < a ? a - t : t > b ? t - b : 0; o = Math.max(o, Math.exp(-d / 0.05)); } return o; });
}

export function localGeometry(h: HeadSpec, L: LockSpec, blade: Blade, view: View, light: Light = LIGHT, occlusion?: number[]): LockGeom {
  const n = blade.spine.length; const S = walk(h, L, 28); const ray = viewRayInHead(view);
  const tangent: V2[] = []; const normal: V2[] = []; const orientation: number[] = []; const curvature: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = blade.spine[Math.max(0, i - 1)] as V2; const b = blade.spine[Math.min(n - 1, i + 1)] as V2; const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    tangent.push({ x: (b.x - a.x) / l, y: (b.y - a.y) / l }); normal.push({ x: -(b.y - a.y) / l, y: (b.x - a.x) / l }); orientation.push(Math.atan2(b.y - a.y, b.x - a.x));
  }
  for (let i = 0; i < n; i++) { const a = orientation[Math.max(0, i - 1)] as number; const b = orientation[Math.min(n - 1, i + 1)] as number; let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; const a0 = blade.spine[Math.max(0, i - 1)] as V2; const b0 = blade.spine[Math.min(n - 1, i + 1)] as V2; curvature.push(d / Math.max(1e-6, Math.hypot(b0.x - a0.x, b0.y - a0.y))); }
  const normal3: V3[] = []; const exposure: number[] = []; const backface: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const j = ((i / (n - 1)) * (S.length - 1)); const i0 = Math.min(S.length - 2, Math.floor(j)); const s0 = S[i0]!; const s1 = S[i0 + 1]!;
    const tan3 = norm(sub(s1.p, s0.p)); const ns = norm(v3(s0.n.x + (s1.n.x - s0.n.x) * (j - i0), s0.n.y + (s1.n.y - s0.n.y) * (j - i0), s0.n.z + (s1.n.z - s0.n.z) * (j - i0)));
    let rn = rotAbout(ns, tan3, blade.twist[i] as number); let back = false;
    if (dot(rn, ray) < 0) { rn = mul(rn, -1); back = true; }
    normal3.push(rn); backface.push(back); exposure.push(Math.max(0, Math.min(1, 0.5 + 0.5 * dot(rn, light.dir))));
  }
  return { n, tangent, normal, curvature, orientation, twist: [...blade.twist], width: blade.half.map((x) => 2 * x), depth: [...blade.depth], normal3, exposure, backface, occlusion: occlusion ?? new Array<number>(n).fill(0) };
}

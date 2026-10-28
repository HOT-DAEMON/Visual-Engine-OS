import { project, type View } from './head';
import type { LockSpec, Sample } from './lock';
import { clamp, smooth, type V2 } from './vec';

/**
 * LAME : conversion d'une mèche 3D en forme 2D (dessin d'encre). Étapes : projection de l'axe → rééchantillonnage lissé →
 * demi-largeur variable (montée douce depuis la racine, maximum à `peak`, pointe effilée d'exposant `taper`) → contour.
 * Le sens de lecture de l'axe (racine → pointe) est conservé : le rendu en tire dégradé, hachures et bord d'ombre.
 */
export interface Blade {
  readonly spine: V2[];
  readonly half: number[];
  /** Contours gauche/droite le long de l'axe (même longueur que `spine`). */
  readonly left: V2[];
  readonly right: V2[];
  /** Profondeur projetée (>0 vers la caméra) et facing (n·vue) des échantillons d'origine, ré-échantillonnés. */
  readonly facing: number[];
  readonly t: number[];
}

/** Interpolation Catmull-Rom (centripète simplifiée, uniforme) d'une polyligne à `n` points. */
export function resample(pts: V2[], n: number): { p: V2; k: number }[] {
  const m = pts.length - 1;
  const at = (i: number): V2 => pts[clamp(i, 0, m)] as V2;
  const out: { p: V2; k: number }[] = [];
  for (let j = 0; j < n; j++) {
    const u = (j / (n - 1)) * m;
    const i = Math.min(m - 1, Math.floor(u));
    const f = u - i;
    const p0 = at(i - 1); const p1 = at(i); const p2 = at(i + 1); const p3 = at(i + 2);
    const f2 = f * f; const f3 = f2 * f;
    const c = (a: number, b: number, c2: number, d: number): number => 0.5 * (2 * b + (-a + c2) * f + (2 * a - 5 * b + 4 * c2 - d) * f2 + (-a + 3 * b - 3 * c2 + d) * f3);
    out.push({ p: { x: c(p0.x, p1.x, p2.x, p3.x), y: c(p0.y, p1.y, p2.y, p3.y) }, k: u / m });
  }
  return out;
}

/** Profil de largeur 0–1 le long de t : naissance douce (la racine est cachée sous les autres mèches), maximum, pointe effilée. */
export function widthProfile(t: number, peak: number, taper: number): number {
  if (t < peak) return 0.04 + 0.96 * Math.sin((smooth(t / peak) * Math.PI) / 2);
  const u = (t - peak) / Math.max(1e-6, 1 - peak);
  return Math.max(0, 1 - u) ** taper * (1 - 0.0 * u);
}

export function makeBlade(L: LockSpec, samples: Sample[], view: View, ray: { x: number; y: number; z: number }, N = 40): Blade {
  const proj = samples.map((s) => project(view, s.p));
  const facing = samples.map((s) => s.n.x * ray.x + s.n.y * ray.y + s.n.z * ray.z);
  const rs = resample(proj, N);
  const spine = rs.map((r) => r.p);
  const half: number[] = []; const left: V2[] = []; const right: V2[] = [];
  for (let i = 0; i < N; i++) {
    const a = spine[Math.max(0, i - 1)] as V2; const b = spine[Math.min(N - 1, i + 1)] as V2;
    let dx = b.x - a.x; let dy = b.y - a.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const t = (rs[i] as { k: number }).k;
    const w = 0.5 * L.width * view.s * widthProfile(t, L.peak, L.taper);
    half.push(w);
    const p = spine[i] as V2;
    left.push({ x: p.x - dy * w, y: p.y + dx * w });
    right.push({ x: p.x + dy * w, y: p.y - dx * w });
  }
  const f = rs.map((r) => { const j = r.k * (facing.length - 1); const i0 = Math.min(facing.length - 2, Math.floor(j)); return (facing[i0] as number) * (1 - (j - i0)) + (facing[i0 + 1] as number) * (j - i0); });
  return { spine, half, left, right, facing: f, t: rs.map((r) => r.k) };
}

/** Chemin SVG lissé (Catmull-Rom → Bézier cubique) d'une polyligne, fermé ou non. */
export function smoothPath(pts: V2[], close = false): string {
  const n = pts.length;
  if (n < 2) return '';
  const at = (i: number): V2 => (close ? (pts[((i % n) + n) % n] as V2) : (pts[clamp(i, 0, n - 1)] as V2));
  const f = (v: number): string => (Math.round(v * 100) / 100).toString();
  let d = `M${f((pts[0] as V2).x)} ${f((pts[0] as V2).y)}`;
  const last = close ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1); const p1 = at(i); const p2 = at(i + 1); const p3 = at(i + 2);
    d += `C${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)} ${f(p2.x - (p3.x - p1.x) / 6)} ${f(p2.y - (p3.y - p1.y) / 6)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return close ? `${d}Z` : d;
}

/** Contour fermé d'une lame (gauche aller, droite retour). */
export const bladeOutline = (b: Blade): V2[] => [...b.left, ...[...b.right].reverse()];

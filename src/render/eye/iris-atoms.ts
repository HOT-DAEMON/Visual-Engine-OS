import { darken, lighten, mix } from '../../core/color';
import { el } from '../../core/svg';
import type { z } from 'zod';
import type { IrisDetail as IrisDetailSchema } from '../../schema/eye-iris-pupil';
import { P } from './helpers';
import type { IrisFrame, IrisPalette } from './iris-strands';

/**
 * DÉTAIL ATOMIQUE DE L'IRIS (passe 12) — quatre couches opt-in du MÊME moteur d'iris (`renderIrisDetail`), mesurées sur les références (`scripts/eye-refs/extract_iris_atoms.py`) :
 * fentes radiales sombres (04), facettes taillées (07), anneau à arcs (10b / 10a), braises (10a / 04). Chacune a sa graine ; aucune ne bouge le tirage des autres couches.
 */
type Rnd = () => number;
type IrisDetail = z.infer<typeof IrisDetailSchema>;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const gauss = (rnd: Rnd): number => Math.sqrt(-2 * Math.log(Math.max(1e-9, rnd()))) * Math.cos(TAU * rnd());
const LIGHT = (Math.PI * 5) / 4; // la lumière vient du haut-gauche (comme les reflets par défaut)

/** FENTES : fuseau sombre effilé entre deux rayons. Les `long` suivent d'abord les axes (la croix de la réf. 04), les courtes remplissent le reste avec un écart angulaire minimal. */
export function slits(f: IrisFrame, pal: IrisPalette, rnd: Rnd, o: NonNullable<IrisDetail['slits']>): string {
  const out: string[] = [];
  const ink = darken(pal.dark, 0.85);
  const used: number[] = [];
  const free = (a: number, gap: number): boolean => used.every((u) => Math.abs(((a - u + Math.PI) % TAU + TAU) % TAU - Math.PI) > gap);
  const spindle = (a: number, r0: number, r1: number, wDeg: number, op: number): void => {
    const w0 = (wDeg * DEG) / 2; const w1 = w0 * (1 - o.taper);
    const pts = [f.at(r0, a - w0), f.at(r1, a - w1), f.at(r1, a + w1), f.at(r0, a + w0)];
    out.push(el('path', { d: `M${pts.map(P).join('L')}Z`, fill: ink, 'fill-opacity': Math.min(1, op) }));
  };
  for (let i = 0; i < o.long; i++) {
    let a = (i * TAU) / Math.max(1, o.long) + (rnd() - 0.5) * 0.5; for (let t = 0; t < 12 && !free(a, 0.2); t++) a = rnd() * TAU;
    used.push(a); spindle(a, Math.min(o.inner, 0.28), Math.min(0.97, o.outer + 0.05), o.widthDeg * 1.6, o.depth);
  }
  for (let i = 0; i < o.count; i++) {
    let a = rnd() * TAU; for (let t = 0; t < 20 && !free(a, (TAU / o.count) * 0.22); t++) a = rnd() * TAU;
    used.push(a);
    const span = o.outer - o.inner; const r0 = o.inner + span * 0.35 * rnd(); const r1 = r0 + span * (0.45 + 0.55 * rnd());
    spindle(a, r0, Math.min(r1, o.outer), o.widthDeg * (0.55 + 0.9 * rnd()), o.depth * (0.55 + 0.45 * rnd()));
  }
  return el('g', {}, out);
}

type Pt = { x: number; y: number };
/** Demi-plan `a·x + b·y <= c` appliqué à un polygone (Sutherland-Hodgman). */
function clip(poly: Pt[], a: number, b: number, c: number): Pt[] {
  const res: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!; const q = poly[(i + 1) % poly.length]!; const dp = a * p.x + b * p.y - c; const dq = a * q.x + b * q.y - c;
    if (dp <= 0) res.push(p);
    if (dp <= 0 !== dq <= 0) { const t = dp / (dp - dq); res.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }); }
  }
  return res;
}

/**
 * FACETTES TAILLÉES (`facets.cut` > 0) : diagramme de puissance de `count × rings` graines dans la couronne [rhoFrom ; 0,97] du disque unité ; rayon de graine log-normal.
 * Chaque cellule : ton selon l'orientation face à la lumière + hasard, arêtes sombres franches, biseau clair sur les arêtes tournées vers la lumière, et une TABLE lumineuse
 * (cellule rétrécie vers son centroïde, décalée vers la lumière) sur une facette sur trois. Dispersion (`facets.dispersion`) : liseré spectral sur les arêtes opposées à la lumière.
 */
export function cutFacets(f: IrisFrame, pal: IrisPalette, rnd: Rnd, o: NonNullable<IrisDetail['facets']>, rhoFrom: number, spectral: (deg: number) => string): string {
  const n = o.count * o.rings; const sigma = 0.5 + 0.6 * o.cut; const r0 = 0.55 / Math.sqrt(n);
  const seeds = Array.from({ length: n }, () => { const rho = Math.sqrt(rhoFrom * rhoFrom + rnd() * (0.97 * 0.97 - rhoFrom * rhoFrom)); const a = rnd() * TAU; const r = r0 * Math.exp(sigma * gauss(rnd) - sigma * sigma / 2); return { x: Math.cos(a) * rho, y: Math.sin(a) * rho, w: r * r }; });
  const disc: Pt[] = Array.from({ length: 48 }, (_, k) => ({ x: Math.cos((k * TAU) / 48) * 0.985, y: Math.sin((k * TAU) / 48) * 0.985 }));
  const toFrame = (p: Pt): { x: number; y: number } => f.at(Math.min(0.985, Math.hypot(p.x, p.y)), Math.atan2(p.y, p.x));
  const out: string[] = []; const lx = Math.cos(LIGHT), ly = Math.sin(LIGHT);
  seeds.forEach((s, i) => {
    let cell = disc;
    for (let j = 0; j < n && cell.length > 2; j++) {
      if (j === i) continue; const t = seeds[j]!;
      cell = clip(cell, 2 * (t.x - s.x), 2 * (t.y - s.y), t.x * t.x + t.y * t.y - s.x * s.x - s.y * s.y - t.w + s.w);
    }
    if (cell.length < 3) return;
    const cx = cell.reduce((a, p) => a + p.x, 0) / cell.length; const cy = cell.reduce((a, p) => a + p.y, 0) / cell.length;
    if (Math.hypot(cx, cy) < rhoFrom * 0.9) return;
    const tilt = rnd() * TAU; const toward = 0.5 + 0.5 * Math.cos(tilt - LIGHT); const t = Math.min(1, Math.max(0, 0.55 * toward + 0.45 * rnd()));
    const col = t < 0.5 ? mix(darken(pal.dark, 0.35), pal.mid, t * 2) : mix(pal.mid, lighten(pal.light, 0.35), (t - 0.5) * 2);
    const ring = cell.map(toFrame);
    out.push(el('path', { d: `M${ring.map(P).join('L')}Z`, fill: col, 'fill-opacity': 0.3 + 0.62 * o.contrast * Math.abs(t - 0.5) * 2, stroke: darken(pal.edge, 0.8), 'stroke-width': f.rx * 0.0085, 'stroke-opacity': 0.45 + 0.45 * o.contrast, 'stroke-linejoin': 'round' }));
    for (let k = 0; k < cell.length; k++) {
      const p = cell[k]!; const q = cell[(k + 1) % cell.length]!; const ex = q.x - p.x, ey = q.y - p.y; const len = Math.hypot(ex, ey); if (len < 1e-6) continue;
      const nx = ey / len, ny = -ex / len; const facing = (nx * (p.x + q.x - 2 * cx) + ny * (p.y + q.y - 2 * cy)) >= 0 ? 1 : -1; const lit = facing * (nx * lx + ny * ly);   // normale sortante · direction de la lumière
      const a = toFrame(p), b = toFrame(q);
      if (lit > 0.25) out.push(el('path', { d: `M${P(a)}L${P(b)}`, fill: 'none', stroke: lighten(pal.light, 0.65), 'stroke-width': f.rx * 0.011, 'stroke-opacity': Math.min(0.95, 0.35 + 0.6 * o.contrast * lit), 'stroke-linecap': 'round' }));
      else if (o.dispersion > 0 && lit < -0.35) out.push(el('path', { d: `M${P(a)}L${P(b)}`, fill: 'none', stroke: spectral((((Math.atan2(cy, cx) % TAU) + TAU) % TAU / TAU) * 270), 'stroke-width': f.rx * 0.014, 'stroke-opacity': 0.7 * o.dispersion, 'stroke-linecap': 'round' }));
    }
    if (i % 3 === 0) {
      const sh = 0.5 + 0.12 * rnd(); const table = cell.map((p) => toFrame({ x: cx + (p.x - cx) * sh + lx * 0.012, y: cy + (p.y - cy) * sh + ly * 0.012 }));
      out.push(el('path', { d: `M${table.map(P).join('L')}Z`, fill: lighten(pal.light, 0.75), 'fill-opacity': 0.18 + 0.4 * o.contrast * toward }));
    }
  });
  return el('g', {}, out);
}

/** ANNEAU À ARCS : `count` arcs sur le cercle `ringRho` (halo large puis trait net) ; longueur de chaque arc = `duty` du secteur, ± 20 %, centrée sur le secteur. */
export function arcs(f: IrisFrame, pal: IrisPalette, rnd: Rnd, o: NonNullable<IrisDetail['arcs']>): string {
  const out: string[] = []; const col = o.color ?? lighten(pal.light, 0.5); const cell = TAU / o.count; const off = rnd() * TAU; const wpx = f.rx * o.width;
  for (let i = 0; i < o.count; i++) {
    const len = cell * Math.min(0.97, o.duty * (0.8 + 0.4 * rnd())); const mid = off + cell * (i + 0.5); const steps = Math.max(3, Math.round((len / TAU) * 72));
    const pts = Array.from({ length: steps + 1 }, (_, k) => f.at(o.ringRho, mid - len / 2 + (len * k) / steps));
    const d = `M${pts.map(P).join('L')}`;
    out.push(el('path', { d, fill: 'none', stroke: col, 'stroke-width': wpx * 2.6, 'stroke-opacity': 0.22 * o.opacity, 'stroke-linecap': 'round' }));
    out.push(el('path', { d, fill: 'none', stroke: col, 'stroke-width': wpx, 'stroke-opacity': o.opacity, 'stroke-linecap': 'butt' }));
    out.push(el('path', { d, fill: 'none', stroke: '#ffffff', 'stroke-width': wpx * 0.35, 'stroke-opacity': 0.7 * o.opacity, 'stroke-linecap': 'butt' }));
  }
  return el('g', {}, out);
}

/** BRAISES : points brillants allongés dans le sens radial, halo doux ; rayon polaire gaussien autour de `ringRho`. */
export function embers(f: IrisFrame, pal: IrisPalette, rnd: Rnd, o: NonNullable<IrisDetail['embers']>): string {
  const out: string[] = []; const col = o.color ?? lighten(pal.light, 0.5);
  for (let i = 0; i < o.count; i++) {
    const rho = Math.min(0.96, Math.max(0.12, o.ringRho + gauss(rnd) * o.spread * 0.5)); const a = rnd() * TAU; const c = f.at(rho, a);
    const r = f.rx * o.size * (0.5 + rnd()); const L = r * (1 + 4 * o.streak * rnd()); const op = o.opacity * (0.55 + 0.45 * rnd());
    const dx = Math.cos(a) * L, dy = Math.sin(a) * L * (f.ry / f.rx);
    out.push(el('circle', { cx: c.x, cy: c.y, r: r * 2.6, fill: col, 'fill-opacity': 0.2 * op }));
    out.push(el('path', { d: `M${P({ x: c.x - dx, y: c.y - dy })}L${P({ x: c.x + dx, y: c.y + dy })}`, fill: 'none', stroke: col, 'stroke-width': r * 1.1, 'stroke-opacity': op, 'stroke-linecap': 'round' }));
    out.push(el('circle', { cx: c.x, cy: c.y, r: r * 0.7, fill: '#ffffff', 'fill-opacity': 0.9 * op }));
  }
  return el('g', {}, out);
}

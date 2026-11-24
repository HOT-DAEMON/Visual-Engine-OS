import { darken, lighten, mix } from '../../core/color';
import { el } from '../../core/svg';
import type { z } from 'zod';
import type { IrisDetail as IrisDetailSchema } from '../../schema/eye-iris-pupil';
import { P } from './helpers';
import { irisLod } from '../../geometry/eye';
import { subPixel, type IrisFrame, type IrisPalette } from './iris-strands';

/** Taille minimale (px) d'un atome tracé : sous ce seuil il n'est que du bruit (LOD automatique). 0 sans LOD. */
const minPx = (f: IrisFrame): number => irisLod(f.pxPerUnit === null ? null : 1).minAtomPx;

/**
 * DÉTAIL ATOMIQUE DE L'IRIS (passe 12) — quatre couches opt-in du MÊME moteur d'iris (`renderIrisDetail`), mesurées sur les références (`scripts/eye-refs/extract_iris_atoms.py`) :
 * fentes radiales sombres (04), facettes taillées (07), anneau à arcs (10b / 10a), braises (10a / 04). Chacune a sa graine ; aucune ne bouge le tirage des autres couches.
 */
type Rnd = () => number;
type IrisDetail = z.infer<typeof IrisDetailSchema>;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
/** Tirage indépendant du PRNG partagé : hachage entier de (facette, rang). Une surcouche opt-in (éclats) ne doit PAS décaler les tirages des facettes de base. */
const hash01 = (i: number, k: number): number => { let x = Math.imul(i + 1, 374761393) + Math.imul(k + 1, 668265263) | 0; x = Math.imul(x ^ (x >>> 13), 1274126177); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
const gauss = (rnd: Rnd): number => Math.sqrt(-2 * Math.log(Math.max(1e-9, rnd()))) * Math.cos(TAU * rnd());
const LIGHT = (Math.PI * 5) / 4; // la lumière vient du haut-gauche (comme les reflets par défaut)

/** FENTES : fuseau sombre effilé entre deux rayons. Les `long` suivent d'abord les axes (la croix de la réf. 04), les courtes remplissent le reste avec un écart angulaire minimal. */
export function slits(f: IrisFrame, pal: IrisPalette, rnd: Rnd, o: NonNullable<IrisDetail['slits']>): string {
  const out: string[] = [];
  const ink = darken(pal.dark, 0.85);
  const used: number[] = [];
  const free = (a: number, gap: number): boolean => used.every((u) => Math.abs(((a - u + Math.PI) % TAU + TAU) % TAU - Math.PI) > gap);
  const spindle = (a: number, r0: number, r1: number, wDeg: number, op: number): void => {
    const w0 = (wDeg * DEG) / 2; const N = o.curve === 0 ? 1 : 4;
    if (subPixel(f, w0 * r1 * f.rx, minPx(f))) return;   // LOD : fuseau plus fin que ~0,45 px       // droite : 1 segment (SVG historique) ; courbe : 4 segments, dérive `curve` ° par unité de rayon
    const at = (t: number, side: number): { x: number; y: number } => { const r = r0 + (r1 - r0) * t; return f.at(r, a + side * w0 * (1 - o.taper * t) + o.curve * DEG * (r - r0)); };
    const left = Array.from({ length: N + 1 }, (_, k) => at(k / N, -1)); const right = Array.from({ length: N + 1 }, (_, k) => at(1 - k / N, 1));
    const pts = [left[0]!, ...left.slice(1), ...right.slice(0, N), right[N]!];
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
const cellArea = (c: readonly Pt[]): number => Math.abs(c.reduce((s, p, k) => { const q = c[(k + 1) % c.length]!; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;
/** Paramètres (t min, t max) où la droite (cx,cy)+t·(dx,dy) traverse le contour convexe `poly` ; `null` si elle ne le traverse pas. */
function chordParams(poly: readonly Pt[], cx: number, cy: number, dx: number, dy: number): [number, number] | null {
  const ts: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!; const q = poly[(i + 1) % poly.length]!; const ex = q.x - p.x, ey = q.y - p.y; const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((p.x - cx) * ey - (p.y - cy) * ex) / den; const u = ((p.x - cx) * dy - (p.y - cy) * dx) / den;
    if (u >= -1e-9 && u <= 1 + 1e-9) ts.push(t);
  }
  return ts.length >= 2 ? [Math.min(...ts), Math.max(...ts)] : null;
}
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
      if (subPixel(f, f.rx * 0.011, minPx(f))) continue;   // LOD : biseaux et liserés plus fins que ~0,45 px
      if (lit > 0.25) out.push(el('path', { d: `M${P(a)}L${P(b)}`, fill: 'none', stroke: lighten(pal.light, 0.65), 'stroke-width': f.rx * 0.011, 'stroke-opacity': Math.min(0.95, 0.35 + 0.6 * o.contrast * lit), 'stroke-linecap': 'round' }));
      else if (o.dispersion > 0 && lit < -0.35) out.push(el('path', { d: `M${P(a)}L${P(b)}`, fill: 'none', stroke: spectral((((Math.atan2(cy, cx) % TAU) + TAU) % TAU / TAU) * 270), 'stroke-width': f.rx * 0.014, 'stroke-opacity': 0.7 * o.dispersion, 'stroke-linecap': 'round' }));
    }
    if (o.shard > 0 && hash01(i, 0) < o.shard && !subPixel(f, Math.sqrt(cellArea(cell)) * f.rx, 3)) {   // éclats : corde par le centroïde -> deux triangles / trapèzes étroits de tons distincts
      const phi = hash01(i, 1) * Math.PI; const nx = Math.cos(phi), ny = Math.sin(phi); const dt = 0.14 + 0.1 * hash01(i, 2);
      const halves: [Pt[], string][] = [[clip(cell, nx, ny, nx * cx + ny * cy), lighten(col, dt)], [clip(cell, -nx, -ny, -(nx * cx + ny * cy)), darken(col, dt)]];
      for (const [h, hc] of halves) if (h.length >= 3) out.push(el('path', { d: `M${h.map(toFrame).map(P).join('L')}Z`, fill: hc, 'fill-opacity': 0.5 * (0.5 + o.contrast * 0.5) }));
      const tt = chordParams(cell, cx, cy, -ny, nx);   // la corde est LIMITÉE à la facette (intersections de sa droite avec le contour)
      if (tt) out.push(el('path', { d: `M${P(toFrame({ x: cx - ny * tt[0], y: cy + nx * tt[0] }))}L${P(toFrame({ x: cx - ny * tt[1], y: cy + nx * tt[1] }))}`, fill: 'none', stroke: darken(pal.edge, 0.8), 'stroke-width': f.rx * 0.006, 'stroke-opacity': 0.35 + 0.3 * o.contrast, 'stroke-linecap': 'round' }));
    }
    if (i % 3 === 0) {
      const sh = 0.5 + 0.12 * rnd();
      if (subPixel(f, Math.sqrt(cellArea(cell)) * f.rx, 2.5)) return;   // LOD : table de moins de ~2,5 px
      const table = cell.map((p) => toFrame({ x: cx + (p.x - cx) * sh + lx * 0.012, y: cy + (p.y - cy) * sh + ly * 0.012 }));
      out.push(el('path', { d: `M${table.map(P).join('L')}Z`, fill: lighten(pal.light, 0.75), 'fill-opacity': 0.18 + 0.4 * o.contrast * toward }));
    }
  });
  // poussière de gemme (opt-in) : losanges turquoise, côté lumière — après toutes les cellules, donc sans effet sur leurs tirages
  const grains = Math.round(o.dust * 60); const dustCol = mix(lighten(pal.light, 0.5), '#7ffff0', 0.35);
  for (let g = 0; g < grains; g++) {
    const rho = rhoFrom + (0.97 - rhoFrom) * Math.sqrt(rnd()); const a = LIGHT + gauss(rnd) * 0.9; const s = f.rx * (0.006 + 0.012 * rnd()); const op = 0.45 + 0.45 * rnd(); const c = f.at(rho, a);
    if (subPixel(f, s, minPx(f) * 1.5)) continue;
    out.push(el('path', { d: `M${P({ x: c.x, y: c.y - s })}L${P({ x: c.x + s * 0.8, y: c.y })}L${P({ x: c.x, y: c.y + s })}L${P({ x: c.x - s * 0.8, y: c.y })}Z`, fill: dustCol, 'fill-opacity': op }));
  }
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
    let rho = Math.min(0.96, Math.max(0.12, o.ringRho + gauss(rnd) * o.spread * 0.5)); const a = rnd() * TAU;
    if (o.scatter > 0 && rnd() < o.scatter) rho = 0.14 + 0.8 * rnd();   // tirages supplémentaires UNIQUEMENT si `scatter` > 0 : l'identité historique est intacte
    const c = f.at(rho, a);
    const r = f.rx * o.size * (0.5 + rnd()); const L = r * (1 + 4 * o.streak * rnd()); const op = o.opacity * (0.55 + 0.45 * rnd());
    if (subPixel(f, r * 0.7, minPx(f))) continue;   // LOD : tous les tirages faits, braise trop petite non tracée
    const dx = Math.cos(a) * L, dy = Math.sin(a) * L * (f.ry / f.rx);
    out.push(el('circle', { cx: c.x, cy: c.y, r: r * 2.6, fill: col, 'fill-opacity': 0.2 * op }));
    if (o.shape === 'lance') {   // losange pointu (réf. 10a) : pointes le long du rayon (×1,6), flancs perpendiculaires ; coeur blanc = même losange réduit
      const px = -Math.sin(a) * r * 0.85, py = Math.cos(a) * r * 0.85 * (f.ry / f.rx); const lz = (k: number): string => `M${P({ x: c.x - dx * 1.6 * k, y: c.y - dy * 1.6 * k })}L${P({ x: c.x + px * k, y: c.y + py * k })}L${P({ x: c.x + dx * 1.6 * k, y: c.y + dy * 1.6 * k })}L${P({ x: c.x - px * k, y: c.y - py * k })}Z`;
      out.push(el('path', { d: lz(1), fill: col, 'fill-opacity': op }));
      out.push(el('path', { d: lz(0.45), fill: '#ffffff', 'fill-opacity': 0.9 * op }));
      continue;
    }
    out.push(el('path', { d: `M${P({ x: c.x - dx, y: c.y - dy })}L${P({ x: c.x + dx, y: c.y + dy })}`, fill: 'none', stroke: col, 'stroke-width': r * 1.1, 'stroke-opacity': op, 'stroke-linecap': 'round' }));
    out.push(el('circle', { cx: c.x, cy: c.y, r: r * 0.7, fill: '#ffffff', 'fill-opacity': 0.9 * op }));
  }
  return el('g', {}, out);
}

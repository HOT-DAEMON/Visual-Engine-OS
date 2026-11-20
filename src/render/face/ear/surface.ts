import { mix } from '../../../core/color';
import { mulberry32 } from '../../../core/prng';
import { el, num, urlRef } from '../../../core/svg';
import type { Vec } from '../../../geometry/eye/primitives';
import type { EarModel } from '../../../face/ear/types';
import type { ProjectedEar } from '../../../face/ear/project';
import { box } from '../../../face/ear/plan-geom';
import type { Poly } from '../../../face/poly';
import type { FaceEars } from '../../../schema/face-ear';
import { polyPath } from '../path';
import type { EarPaint } from './paint';

/**
 * SURF-05 — DÉTAILS SECONDAIRES de la surface (§4 et §5 du cahier des charges) : pigmentation (rougeur du bord, zones plus sombres, lobule rosé, marbrures),
 * petits plis de compression, pores, vascularisation apparente, pilosité locale de l'entrée du conduit. Tous à 0 par défaut (`ears.surface`) et modulés par
 * `style.detail` (LOD : invisibles sous 0,15, pleins à 0,75) : ce sont des calques de rendu (jamais de géométrie), seedés par l'oreille (même oreille → mêmes détails).
 */
const lod = (d: number): number => { const t = Math.max(0, Math.min(1, (d - 0.15) / 0.6)); return t * t * (3 - 2 * t); };
const mean = (p: Poly): Vec => ({ x: p.reduce((s, q) => s + q.x, 0) / p.length, y: p.reduce((s, q) => s + q.y, 0) / p.length });
const inside = (p: Poly, x: number, y: number): boolean => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i]!, b = p[j]!; if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; };
const poly = (pe: ProjectedEar, id: string): Poly | undefined => pe.structures.find((q) => String(q.s.id) === id)?.poly;

export function surfaceLayers(id: string, pe: ProjectedEar, model: EarModel, P: EarPaint, e: FaceEars, hPx: number, defs: string[]): string {
  const sf = e.surface;
  const L = lod(e.style.detail);
  if (L <= 0 || (sf.pigmentation <= 0 && sf.folds <= 0 && sf.pores <= 0 && sf.vessels <= 0 && sf.hair <= 0)) return '';
  const anime = P.look === 'anime';
  const rnd = mulberry32(((e.seed ^ (model.side < 0 ? 0x51ed : 0x2701)) >>> 0) + 977);
  const hull = pe.rim;
  const b = box(hull);
  const out: string[] = [];
  const blur = (name: string, sd: number): string => { defs.push(el('filter', { id: `${id}-${name}`, x: '-20%', y: '-20%', width: '140%', height: '140%' }, [el('feGaussianBlur', { stdDeviation: num(sd) })])); return urlRef(`${id}-${name}`); };
  const red = mix(P.base, '#b83a30', 0.7), dark = mix(P.shade, '#4a1f18', 0.55);
  // Pigmentation : rougeur du bord, zones plus sombres (cavum, cymba), lobule rosé, marbrures.
  const pg = sf.pigmentation * L;
  if (pg > 0.01) {
    out.push(el('path', { d: polyPath(hull), fill: 'none', stroke: red, 'stroke-width': hPx * 0.09, opacity: num(0.62 * pg), filter: anime ? undefined : blur('pg1', hPx * 0.03), 'stroke-linejoin': 'round' }));
    for (const sid of ['cavum', 'cymba']) { const q = poly(pe, sid); if (q) out.push(el('path', { d: polyPath(q), fill: dark, opacity: num(0.5 * pg), filter: anime ? undefined : blur('pg2', hPx * 0.012) })); }
    const lb = poly(pe, 'lobule');
    if (lb) { const c = mean(lb); out.push(el('ellipse', { cx: num(c.x), cy: num(c.y + hPx * 0.02), rx: num(hPx * 0.1), ry: num(hPx * 0.07), fill: mix(P.base, '#e0626a', 0.8), opacity: num(0.55 * pg), filter: anime ? undefined : blur('pg3', hPx * 0.03) })); }
    if (!anime) for (let i = 0; i < 22; i++) { const x = b.x0 + rnd() * (b.x1 - b.x0), y = b.y0 + rnd() * (b.y1 - b.y0); if (inside(hull, x, y)) out.push(el('circle', { cx: num(x), cy: num(y), r: num(hPx * (0.012 + 0.025 * rnd())), fill: rnd() < 0.5 ? red : dark, opacity: num(0.28 * pg), filter: blur('pg4', hPx * 0.012) })); }
  }
  // Petits plis de compression : arcs fins en travers du cou du lobule, à la base du tragus et au raccord de la racine de l'hélix.
  const fl = sf.folds * L;
  if (fl > 0.01) {
    const arcs: string[] = [];
    const lb = poly(pe, 'lobule');
    if (lb) { const lbb = box(lb); const w = lbb.x1 - lbb.x0, h = lbb.y1 - lbb.y0; for (let i = 0; i < 3; i++) { const y = lbb.y0 + h * (0.12 + 0.13 * i); arcs.push(`M${num(lbb.x0 + w * 0.2)} ${num(y)}q${num(w * 0.3)} ${num(h * 0.07 * (1 + i * 0.4))} ${num(w * 0.6)} ${num(-h * 0.02)}`); } }
    const tr = poly(pe, 'tragus');
    if (tr) { const c = mean(tr); const r = hPx * 0.05; for (let i = 0; i < 2; i++) arcs.push(`M${num(c.x - r)} ${num(c.y + r * (0.9 + 0.4 * i))}q${num(r)} ${num(r * 0.5)} ${num(r * 2)} ${num(-r * 0.1)}`); }
    const cr = poly(pe, 'crus');
    if (cr) { const c = mean(cr); const r = hPx * 0.04; arcs.push(`M${num(c.x - r)} ${num(c.y - r * 0.9)}q${num(r)} ${num(-r * 0.3)} ${num(r * 2)} ${num(r * 0.1)}`); }
    out.push(el('path', { d: arcs.join(''), fill: 'none', stroke: dark, 'stroke-width': hPx * (anime ? 0.008 : 0.0065), opacity: num(0.9 * fl), 'stroke-linecap': 'round' }));
  }
  // Pores : semis régulier-irrégulier de petits points (réaliste seulement).
  const pr = sf.pores * L;
  if (pr > 0.01 && !anime) {
    const dots: string[] = [];
    const n = Math.round(260 * pr);
    for (let i = 0, k = 0; i < n * 4 && k < n; i++) { const x = b.x0 + rnd() * (b.x1 - b.x0), y = b.y0 + rnd() * (b.y1 - b.y0); if (!inside(hull, x, y)) continue; k++; dots.push(`M${num(x)} ${num(y)}h${num(hPx * 0.006)}`); }
    out.push(el('path', { d: dots.join(''), stroke: dark, 'stroke-width': hPx * 0.006, 'stroke-linecap': 'round', fill: 'none', opacity: num(0.55 * pr) }));
  }
  // Vascularisation apparente : fines veines bleu-rouge dans la scapha et le lobule.
  const vs = sf.vessels * L;
  if (vs > 0.01 && !anime) {
    const sc = poly(pe, 'scapha');
    const paths: string[] = [];
    if (sc) { const h = sc.length / 2; const mid = Array.from({ length: Math.floor(h / 2) }, (_, i) => { const a = sc[i * 2]!, c = sc[sc.length - 1 - i * 2]!; return { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 }; }); if (mid.length > 3) { paths.push('M' + mid.map((q) => `${num(q.x)} ${num(q.y)}`).join('L')); const k = Math.floor(mid.length / 2); const q = mid[k]!; paths.push(`M${num(q.x)} ${num(q.y)}l${num(hPx * 0.04)} ${num(hPx * 0.05)}l${num(hPx * 0.015)} ${num(hPx * 0.04)}`); paths.push(`M${num(q.x)} ${num(q.y)}l${num(-hPx * 0.03)} ${num(hPx * 0.04)}`); } }
    const lb = poly(pe, 'lobule');
    if (lb) { const c = mean(lb); paths.push(`M${num(c.x - hPx * 0.05)} ${num(c.y - hPx * 0.05)}q${num(hPx * 0.04)} ${num(hPx * 0.04)} ${num(hPx * 0.02)} ${num(hPx * 0.09)}`); }
    out.push(el('path', { d: paths.join(''), fill: 'none', stroke: mix('#5a4a9a', '#c0302e', 0.5), 'stroke-width': hPx * 0.008, opacity: num(0.85 * vs), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', filter: blur('vs', hPx * 0.003) }));
  }
  // Pilosité locale : poils fins qui sortent de l'entrée du conduit et du tragus.
  const hr = sf.hair * L;
  if (hr > 0.01) {
    const tr = poly(pe, 'tragus'), cn = poly(pe, 'canal');
    const src = cn ? mean(cn) : tr ? mean(tr) : undefined;
    if (src) {
      const hairs: string[] = [];
      const n = Math.round(10 + 22 * hr);
      for (let i = 0; i < n; i++) { const a = -Math.PI * 0.9 + rnd() * Math.PI * 1.1, r0 = hPx * (0.01 + 0.02 * rnd()), l = hPx * (0.025 + 0.035 * rnd()); const x0 = src.x + Math.cos(a) * r0, y0 = src.y + Math.sin(a) * r0; hairs.push(`M${num(x0)} ${num(y0)}q${num(Math.cos(a) * l * 0.6)} ${num(Math.sin(a) * l * 0.6 - l * 0.2)} ${num(Math.cos(a) * l)} ${num(Math.sin(a) * l)}`); }
      out.push(el('path', { d: hairs.join(''), fill: 'none', stroke: mix(P.shade, '#1c120b', 0.75), 'stroke-width': hPx * (anime ? 0.006 : 0.0032), opacity: num(0.85 * Math.min(1, hr * 1.4)), 'stroke-linecap': 'round' }));
    }
  }
  return out.length ? el('g', { 'clip-path': urlRef(`${id}-clip`) }, out) : '';
}

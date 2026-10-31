import { el, urlRef } from '../../core/svg';
import { mix } from '../../core/color';
import { reveal, tierOf } from '../muscle-tiers';
import { pathOf } from '../shape';
import type { V } from '../types';
import { toView, dirToView, type Camera, FRONT } from './camera';
import { ringPoint } from './loft';
import { DEFAULT_LIGHT, colorOf, paletteOf, tone, type LightRig } from './shade';
import type { Station, Volume, VolumeSet } from './types';
import { dot3, p3 } from './vec3';

export interface VRenderOpts {
  readonly skin: string; readonly camera?: Camera; readonly light?: LightRig;
  /** Niveau de présentation (0 enveloppes … 3 fibres, repères, mécanique). */
  readonly level?: 0 | 1 | 2 | 3;
  /** `skin` rendu final · `atoms` un volume = une couleur (preuve du morcellement). */
  readonly mode?: 'skin' | 'atoms';
  /** Cache les couches ≥ N (écorché : 4 = sans trapèze, pectoraux, deltoïdes… 6 = sans fibres ni tendons). */
  readonly hideFromLayer?: number;
  readonly joints?: boolean; readonly contact?: boolean; readonly uid?: string;
  /** `full` : ombres de contact, occlusion aux extrémités, 14 points par section, liserés de fibres · `fast` : 8 points, aucun calque d'ombre (≈ 2× moins de SVG). */
  readonly quality?: 'full' | 'fast';
  /** Tronc et cou seuls (sans bras, mains, deltoïdes) : lit les courbures du rachis et la saillie du ventre en profil. */
  readonly trunkOnly?: boolean;
  /** Force l'affichage de tous les paliers musculaires (écorché) au lieu de suivre la musculature. */
  readonly forceTier?: boolean;
}
const sm = (u: number): number => u * u * (3 - 2 * u);
const hashStr = (s: string): number => { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return x >>> 0; };
const v2 = (p: { x: number; y: number }): V => ({ x: p.x, y: p.y });
function hull(pts: V[]): V[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y), cr = (o: V, a: V, b: V): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x), lo: V[] = [], up: V[] = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2] as V, lo[lo.length - 1] as V, q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i] as V; while (up.length >= 2 && cr(up[up.length - 2] as V, up[up.length - 1] as V, q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}
interface Proj { readonly c: V[]; readonly ring: V[][]; readonly nrm: { x: number; y: number; z: number }[][]; readonly zc: number }
function project(vl: Volume, cam: Camera, R: number): Proj {
  const c: V[] = [], ring: V[][] = [], nrm: Proj['nrm'] = []; let zs = 0;
  for (const s of vl.stations) {
    const cv = toView(s.c, cam); c.push(v2(cv)); zs += cv.z;
    const rr: V[] = [], nn: Proj['nrm'][number] = [];
    for (let k = 0; k < R; k++) { const q = ringPoint(s, (k / R) * 2 * Math.PI); rr.push(v2(toView(q.p, cam))); nn.push(dirToView(q.n, cam)); }
    ring.push(rr); nrm.push(nn);
  }
  return { c, ring, nrm, zc: zs / vl.stations.length };
}
/** Contour : extrêmes latéraux par section (compact, lisse) ; enveloppe convexe quand le volume est vu dans son axe (raccourci). */
function outline(pr: Proj, flatEnds = false): V[] {
  const n = pr.c.length, all = pr.ring.flat();
  let w = 0; for (let i = 0; i < n; i++) for (const q of pr.ring[i] as V[]) w = Math.max(w, Math.hypot(q.x - (pr.c[i] as V).x, q.y - (pr.c[i] as V).y));
  const a = pr.c[0] as V, b = pr.c[n - 1] as V, len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1.6 * w) return hull(all);
  const Lf: V[] = [], Rt: V[] = []; let prev = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  for (let i = 0; i < n; i++) {
    const p0 = pr.c[Math.max(0, i - 1)] as V, p1 = pr.c[Math.min(n - 1, i + 1)] as V, tl = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const t = tl > 0.25 * w ? { x: (p1.x - p0.x) / tl, y: (p1.y - p0.y) / tl } : prev; prev = t;
    const pe = { x: -t.y, y: t.x }; let lo = Infinity, hi = -Infinity, ql = pr.c[i] as V, qh = ql;
    for (const q of pr.ring[i] as V[]) { const d = q.x * pe.x + q.y * pe.y; if (d < lo) { lo = d; ql = q; } if (d > hi) { hi = d; qh = q; } }
    Lf.push(ql); Rt.push(qh);
  }
  const cap = (c: V, o: V, rr: V, ll: V): V => { const hw = Math.hypot(rr.x - ll.x, rr.y - ll.y) * 0.3, dx = c.x - o.x, dy = c.y - o.y, d = Math.hypot(dx, dy) || 1; return { x: c.x + (dx / d) * hw, y: c.y + (dy / d) * hw }; };
  if (flatEnds) return [...Lf, ...Rt.reverse()];
  return [cap(a, pr.c[1] as V, Rt[0] as V, Lf[0] as V), ...Lf, cap(b, pr.c[n - 2] as V, Rt[n - 1] as V, Lf[n - 1] as V), ...Rt.reverse()];
}
const bbox = (p: V[]): { x0: number; y0: number; x1: number; y1: number } => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of p) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); } return { x0, y0, x1, y1 }; };

export interface VMarkup { readonly svg: string; readonly bounds: { x0: number; y0: number; x1: number; y1: number }; readonly drawn: number; readonly ids: readonly string[] }
/** Rendu SVG d'un VolumeSet : tri en profondeur (peintre), dégradé de section éclairé par les normales, occlusion ambiante aux extrémités, ombre de contact, fibres. */
export function renderVolumes(set: VolumeSet, o: VRenderOpts): VMarkup {
  const cam = o.camera ?? FRONT, L = o.light ?? DEFAULT_LIGHT, pal = paletteOf(o.skin), H = set.measures.h as number, vis = set.measures.vis as number, level = o.level ?? 3, uid = o.uid ?? 'vv';
  const fast = o.quality === 'fast', RS = fast ? 8 : 14, tier = tierOf(vis), defs: string[] = [], g: string[] = [], ids: string[] = [], allPts: V[] = [];
  const rel = (v: Volume): number => (o.forceTier || v.kind !== 'muscle' || v.tier === undefined ? 1 : reveal(tier, v.tier));
  const list = set.volumes.filter((v) => v.level <= level && (o.joints || v.kind !== 'joint') && (o.hideFromLayer === undefined || v.layer < o.hideFromLayer) && !(v.kind === 'muscle' && rel(v) < 0.04) && !(o.trunkOnly && (v.group === 'arm' || v.group === 'forearm' || v.group === 'hand' || v.id.startsWith('deltoid') || v.id.startsWith('joint.shoulder') || v.id.startsWith('joint.elbow') || v.id.startsWith('joint.wrist') || v.id.startsWith('knuckle'))));
  const bias = 0.004 * H;
  const keyed = list.map((v) => { const pr = project(v, cam, RS); return { v, pr, k: pr.zc + v.layer * bias }; }).sort((a, b) => a.k - b.k);
  let gi = 0; const gid = (): string => `${uid}${gi++}`;
  const edge = mix(pal.ink, o.skin, 0.25);
  for (const { v, pr } of keyed) {
    ids.push(v.id);
    const op = rel(v);
    if (o.mode === 'atoms') {
      const col = `hsl(${hashStr(v.group) % 360} 70% ${40 + (hashStr(v.id) % 25)}%)`;
      if (v.strand) { g.push(el('path', { d: pathOf(pr.c, false), fill: 'none', stroke: col, 'stroke-width': 0.006 * H })); continue; }
      const ol = v.sphere ? [] : outline(pr);
      if (v.sphere) { const c = pr.c[1] as V, r = (v.stations[1] as Station).a; g.push(el('circle', { cx: c.x, cy: c.y, r, fill: 'none', stroke: col, 'stroke-width': 0.004 * H })); continue; }
      g.push(el('path', { d: pathOf(ol), fill: col, 'fill-opacity': v.level === 0 ? 0.14 : 0.4, stroke: col, 'stroke-width': 0.003 * H, 'stroke-linejoin': 'round' })); allPts.push(...ol); continue;
    }
    if (v.sphere) {
      const c = pr.c[1] as V, r = (v.stations[1] as Station).a, id = gid();
      const lx = -L.key.x, ly = -L.key.y, nrm = Math.hypot(lx, ly) || 1;
      defs.push(el('radialGradient', { id, cx: c.x, cy: c.y, r, fx: c.x + (lx / nrm) * r * 0.4, fy: c.y + (ly / nrm) * r * 0.4, gradientUnits: 'userSpaceOnUse' }, [el('stop', { offset: 0, 'stop-color': pal.light }), el('stop', { offset: 0.55, 'stop-color': pal.skin }), el('stop', { offset: 1, 'stop-color': pal.shadow })]));
      g.push(el('circle', { cx: c.x, cy: c.y, r, fill: urlRef(id), 'fill-opacity': 0.9, stroke: edge, 'stroke-width': 0.003 * H, 'stroke-opacity': 0.5 })); allPts.push({ x: c.x - r, y: c.y - r }, { x: c.x + r, y: c.y + r }); continue;
    }
    if (v.strand) {
      const col = v.kind === 'tendon' ? mix(o.skin, pal.light, 0.5) : v.kind === 'vein' ? mix(o.skin, '#4d5f93', 0.42) : v.tone < 0 ? pal.shadow : pal.light;
      const runs: V[][] = []; let cur: V[] = [];
      pr.c.forEach((c, i) => { const nz = dirToView((v.stations[i] as Station).w, cam).z; if (nz > 0.05) cur.push(c); else if (cur.length) { runs.push(cur); cur = []; } });
      if (cur.length) runs.push(cur);
      const d = runs.filter((r) => r.length > 1).map((r) => pathOf(r, false)).join('');
      if (d) g.push(el('path', { d, fill: 'none', stroke: col, 'stroke-width': Math.max(0.0028 * H, 2 * (v.stations[0] as Station).a), 'stroke-linecap': 'round', 'stroke-opacity': (v.tone < 0 ? 0.5 : 0.6) * op }));
      continue;
    }
    const ol = outline(pr, v.kind === 'skin'), bb = bbox(ol), m = (v.stations.length / 2) | 0, mc = pr.c[m] as V, mn = pr.nrm[m] as Proj['nrm'][number], mr = pr.ring[m] as V[];
    allPts.push(...ol);
    // Perpendiculaire écran (section centrale) + largeur visible.
    const pa = pr.c[Math.max(0, m - 1)] as V, pb = pr.c[Math.min(pr.c.length - 1, m + 1)] as V, tl = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1;
    const t2 = tl > 1e-3 ? { x: (pb.x - pa.x) / tl, y: (pb.y - pa.y) / tl } : { x: 0, y: 1 }, pe = { x: -t2.y, y: t2.x };
    let hw = 1e-3; for (const q of mr) hw = Math.max(hw, Math.abs((q.x - mc.x) * pe.x + (q.y - mc.y) * pe.y));
    const sam: { s: number; t: number }[] = [];
    mr.forEach((q, k) => { const nv = mn[k] as { x: number; y: number; z: number }; if (nv.z > -0.02) sam.push({ s: ((q.x - mc.x) * pe.x + (q.y - mc.y) * pe.y) / hw, t: tone(p3(nv.x, nv.y, nv.z), L) + 0.14 * v.tone }); });
    sam.sort((a, b) => a.s - b.s);
    const at = (s: number): number => { if (!sam.length) return 0.55; if (s <= (sam[0] as { s: number }).s) return (sam[0] as { t: number }).t; for (let i = 0; i < sam.length - 1; i++) { const A = sam[i] as { s: number; t: number }, B = sam[i + 1] as { s: number; t: number }; if (s <= B.s) return A.t + (B.t - A.t) * ((s - A.s) / (B.s - A.s || 1)); } return (sam[sam.length - 1] as { t: number }).t; };
    const NS = fast ? 5 : 9, id = gid(), stops = Array.from({ length: NS }, (_, i) => { const s = -1 + (i * 2) / (NS - 1); return el('stop', { offset: i / (NS - 1), 'stop-color': colorOf(at(s), pal) }); });
    defs.push(el('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: mc.x - pe.x * hw, y1: mc.y - pe.y * hw, x2: mc.x + pe.x * hw, y2: mc.y + pe.y * hw }, stops));
    const d = pathOf(ol), isMus = v.kind === 'muscle' || v.kind === 'fat';
    if (isMus && !fast && o.contact !== false && v.level >= 2) {
      const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2, sc = 1 + Math.min(0.2, (0.007 * H) / Math.max(1, Math.min(bb.x1 - bb.x0, bb.y1 - bb.y0) / 2));
      g.push(el('path', { d, fill: pal.shadow, 'fill-opacity': 0.3 * op, transform: `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${sc.toFixed(3)}) translate(${(-cx).toFixed(1)} ${(-cy).toFixed(1)})` }));
    }
    g.push(el('path', { d, fill: urlRef(id), 'fill-opacity': op, stroke: edge, 'stroke-width': (v.level === 0 ? 0.0045 : 0.0028) * H, 'stroke-opacity': (v.level === 0 ? 0.5 : 0.34) * op, 'stroke-linejoin': 'round' }));
    // Occlusion ambiante : les extrémités (tendons, insertions) plongent sous les voisins.
    const ao = v.kind === 'muscle' ? 0.3 : v.kind === 'bone' ? 0.1 : v.level === 0 ? 0 : 0.12, a0 = pr.c[0] as V, a1 = pr.c[pr.c.length - 1] as V;
    if (ao > 0 && !fast && Math.hypot(a1.x - a0.x, a1.y - a0.y) > 4) {
      const ga = gid();
      defs.push(el('linearGradient', { id: ga, gradientUnits: 'userSpaceOnUse', x1: a0.x, y1: a0.y, x2: a1.x, y2: a1.y }, [el('stop', { offset: 0, 'stop-color': pal.shadow, 'stop-opacity': ao }), el('stop', { offset: 0.2, 'stop-color': pal.shadow, 'stop-opacity': 0 }), el('stop', { offset: 0.8, 'stop-color': pal.shadow, 'stop-opacity': 0 }), el('stop', { offset: 1, 'stop-color': pal.shadow, 'stop-opacity': ao })]));
      g.push(el('path', { d, fill: urlRef(ga), 'fill-opacity': op }));
    }
    // Fibres : lignes de la surface (θ fixe) le long du volume ; sillon sombre + liseré clair décalé vers la lumière.
    if (v.fibres.length && level >= 2 && vis > 0.05) {
      const dk: string[] = [], lt: string[] = [], lo = { x: -L.key.x, y: -L.key.y }, lln = Math.hypot(lo.x, lo.y) || 1, off = 0.0032 * H;
      for (const th of v.fibres) {
        let run: V[] = [];
        const flush = (): void => { if (run.length > 2) { dk.push(pathOf(run, false)); lt.push(pathOf(run.map((q) => ({ x: q.x + (lo.x / lln) * off, y: q.y + (lo.y / lln) * off })), false)); } run = []; };
        v.stations.forEach((s, i) => { const q = ringPoint(s, th), pv = toView(q.p, cam), nz = dirToView(q.n, cam).z; if (nz > 0.1 && i > 0 && i < v.stations.length - 1) run.push({ x: pv.x, y: pv.y }); else flush(); });
        flush();
      }
      if (dk.length) { g.push(el('path', { d: dk.join(''), fill: 'none', stroke: pal.shadow, 'stroke-width': 0.0034 * H, 'stroke-opacity': 0.42 * op * Math.min(1, vis * 2), 'stroke-linecap': 'round' })); if (!fast) g.push(el('path', { d: lt.join(''), fill: 'none', stroke: pal.light, 'stroke-width': 0.0024 * H, 'stroke-opacity': 0.26 * op * Math.min(1, vis * 2), 'stroke-linecap': 'round' })); }
    }
  }
  void dot3;
  void sm;
  const b = bbox(allPts), mg = 0.04 * H;
  return { svg: el('g', {}, [el('defs', {}, defs), ...g]), bounds: { x0: b.x0 - mg, y0: b.y0 - mg, x1: b.x1 + mg, y1: b.y1 + mg }, drawn: ids.length, ids };
}

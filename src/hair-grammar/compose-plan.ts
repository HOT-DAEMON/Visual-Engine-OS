import { analyzeComposition, AZ_BINS, EL_BINS, type Composition } from './compose';
import { emergeFrom } from './emerge';
import { sampleLock, type HairProfile } from './grammar';
import { aimOnShell, type View } from './head';
import type { LockSpec } from './lock';
import { paintLock } from './paint';
import { clamp, norm, prng, v3, type V2, type V3 } from './vec';

/**
 * DIRECTION DE COMPOSITION — le chemin inverse de `analyzeComposition` : une INTENTION de composition pilote la génération.
 *   hierarchy  parts visuelles cibles par famille (la masse dominante domine VRAIMENT) → échelle de largeur par famille ;
 *   reading    direction de lecture (rad, repère image, y vers le bas) → rotation d'ensemble des caps ;
 *   balance    moment gauche/droite cible (−1 = tout à gauche … +1) → échelle de largeur selon le côté de la racine ;
 *   channels   espaces négatifs voulus (couloirs dans le repère de tête, en H) → mèches qui les traversent retirées (plafond 22 %) ;
 *   focal      points focaux CONSTRUITS : épi (racines qui convergent), faisceau de pointes, mèche d'accent isolée ;
 *   density    carte de densité cible sur la coque → acceptation des racines proportionnelle ;
 *   relations  règles « famille fille ÉMERGE de famille mère » (`emerge.ts`) consommées par le générateur.
 * La boucle régénère, mesure, corrige (6 itérations au plus) jusqu'à tolérance, puis renvoie le journal des erreurs.
 */
export interface Channel { readonly from: V2; readonly to: V2; readonly half: number }
export interface FocalSpec { readonly kind: 'whorl' | 'tips' | 'accent'; readonly at: V2 }
export interface DensityField { readonly base: number; readonly blobs: readonly { readonly el: number; readonly az: number; readonly sigma: number; readonly gain: number }[] }
export interface RelationRule { readonly child: string; readonly parent: string; readonly t: readonly [number, number]; readonly peel: readonly [number, number] }
export interface CompositionSpec { readonly hierarchy?: Readonly<Record<string, number>>; readonly reading?: number; readonly balance?: number; readonly channels?: readonly Channel[]; readonly focal?: readonly FocalSpec[]; readonly density?: DensityField; readonly relations?: readonly RelationRule[] }
export interface ComposeResult { readonly specs: LockSpec[]; readonly composition: Composition; readonly journal: { readonly iter: number; readonly reading: number; readonly balance: number; readonly share: number }[] }

const wrapPi = (a: number): number => { let x = a; while (x > Math.PI) x -= 2 * Math.PI; while (x < -Math.PI) x += 2 * Math.PI; return x; };
const rotZ = (v: V3, a: number): V3 => v3(v.x * Math.cos(a) - v.y * Math.sin(a), v.x * Math.sin(a) + v.y * Math.cos(a), v.z);
const toScreen = (view: View, p: V2): V2 => ({ x: view.tx + view.s * p.x, y: view.ty + view.s * p.y });

/** Densité cible (0–1+) en (élévation, azimut) degrés. */
export const densityAt = (d: DensityField, el: number, az: number): number => d.base + d.blobs.reduce((s, b) => { const da = Math.abs(((az - b.az + 540) % 360) - 180); return s + b.gain * Math.exp(-(((el - b.el) / b.sigma) ** 2 + (da / b.sigma) ** 2) / 2); }, 0);
/** Carte cible dans la trame de `shellDensity` (lignes d'élévation 90→−30 par 20°, colonnes d'azimut −180→180 par 30°), normalisée à 1. */
export function densityTarget(d: DensityField): number[][] {
  const M = Array.from({ length: EL_BINS }, (_, r) => Array.from({ length: AZ_BINS }, (_, c) => Math.max(0, densityAt(d, 80 - r * 20, -165 + c * 30)))); const t = M.flat().reduce((s, v) => s + v, 0) || 1;
  return M.map((row) => row.map((v) => v / t));
}

interface State { wk: Record<string, number>; phi: number; lam: number }

/** Mèche visant un point image (asservissement visuel : rotation du cap + longueur, 8 itérations). */
function aimAt(P: HairProfile, view: View, base: LockSpec, target: V2): LockSpec {
  let L = base;
  for (let k = 0; k < 8; k++) {
    const p = paintLock(P.head, L, view); const a = p.blade.spine[0] as V2; const b = p.blade.spine.at(-1) as V2;
    const v1 = { x: b.x - a.x, y: b.y - a.y }; const v2 = { x: target.x - a.x, y: target.y - a.y };
    const dth = Math.atan2(v1.x * v2.y - v1.y * v2.x, v1.x * v2.x + v1.y * v2.y);
    L = { ...L, aim: norm(rotZ(L.aim, dth * 0.85)), length: L.length * clamp((Math.hypot(v2.x, v2.y) / Math.max(1e-6, Math.hypot(v1.x, v1.y))) ** 0.85, 0.6, 1.7) };
  }
  return L;
}

function focals(P: HairProfile, view: View, spec: CompositionSpec, seed: number): LockSpec[] {
  const g = prng(seed * 7919 + 13); const out: LockSpec[] = [];
  const mk = (id: string, el: number, az: number, aim: V3, len: number, w: number, tone: number, fam: string): LockSpec => ({ id, family: fam, root: { el, az }, aim: norm(aim), length: len, bend: 0.3, wave: { amp: 0.1, freq: 1, phase: g() }, flick: { amt: 0.3, len: 0.2 }, lift0: 0.06, lift1: 0.16, liftPow: 1.4, gravity: 0.05, width: w, peak: 0.4, taper: 1.4, tone, strands: 1, layer: 'front' });
  for (const f of spec.focal ?? []) {
    const s = toScreen(view, f.at); const sh = aimOnShell(P.head, view, s.x, s.y, 0.05) ?? { el: 70, az: 0 };
    if (f.kind === 'whorl') for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; out.push(mk(`whorl-${k}`, clamp(sh.el + (g() - 0.5) * 3, 40, 89), sh.az + (g() - 0.5) * 4, v3(Math.cos(a), Math.sin(a), 0.15), 0.28 + 0.12 * g(), 0.09, 0.5, 'whorl')); }
    if (f.kind === 'tips') for (let k = 0; k < 5; k++) out.push(aimAt(P, view, mk(`tipb-${k}`, 66 + 14 * g(), sh.az + (k - 2) * 14, v3((k - 2) * 0.1, 1, 0.3), 0.4, 0.1, 0.4 + 0.1 * k / 5, 'tipbundle'), s));
    if (f.kind === 'accent') out.push(aimAt(P, view, { ...mk('accent-0', 72, sh.az, v3(0, 1, 0.3), 0.6, 0.12, 1, 'accent'), program: [{ kind: 'straight', len: 2 }, { kind: 'arc', len: 2, angle: 0.5, ease: 1.6 }, { kind: 'tipFlip', len: 0.7, angle: -0.9 }] }, s));
  }
  return out;
}

function build(P: HairProfile, spec: CompositionSpec, st: State, seed: number, view: View): LockSpec[] {
  const g = prng(seed); const byFam = new Map<string, LockSpec[]>(); const all: LockSpec[] = [];
  const dmax = spec.density ? Math.max(0.01, ...Array.from({ length: 19 }, (_, i) => Array.from({ length: 24 }, (_, j) => densityAt(spec.density as DensityField, i * 5, -180 + j * 15))).flat()) : 1;
  for (const F of P.families) for (let i = 0; i < F.count; i++) {
    let L = sampleLock(P, F, i, g);
    for (let t = 0; spec.density && t < 14; t++) { if (g() < clamp(densityAt(spec.density, L.root.el, L.root.az) / dmax, 0, 1)) break; L = sampleLock(P, F, i, g); }
    const side = Math.sign(Math.sin((L.root.az * Math.PI) / 180)) || 1;
    L = { ...L, aim: norm(rotZ(L.aim, st.phi)), width: L.width * (st.wk[F.id] ?? 1) * Math.exp(st.lam * side) };
    (byFam.get(F.id) ?? byFam.set(F.id, []).get(F.id) as LockSpec[]).push(L); all.push(L);
  }
  for (const r of spec.relations ?? []) {
    const par = byFam.get(r.parent) ?? []; const kids = byFam.get(r.child) ?? [];
    kids.forEach((k, i) => { const m = par[i % Math.max(1, par.length)]; if (!m) return; const e = emergeFrom(P.head, m, k, { t: r.t[0] + (r.t[1] - r.t[0]) * g(), peel: r.peel[0] + (r.peel[1] - r.peel[0]) * g() }); all[all.indexOf(k)] = e; });
  }
  let out = all;
  if (spec.channels?.length) {
    const cut = new Set<number>();
    const painted = out.map((L) => paintLock(P.head, L, view));
    for (const ch of spec.channels) {
      const a = toScreen(view, ch.from); const b = toScreen(view, ch.to); const dx = b.x - a.x; const dy = b.y - a.y; const l2 = dx * dx + dy * dy || 1; const hw = ch.half * view.s;
      const hits = painted.map((p, i) => { const near = p.blade.spine.filter((q) => { const t = clamp(((q.x - a.x) * dx + (q.y - a.y) * dy) / l2, 0, 1); return Math.hypot(q.x - (a.x + t * dx), q.y - (a.y + t * dy)) < hw + (p.blade.half[0] ?? 0); }).length; return { i, f: near / p.blade.spine.length }; }).filter((h) => h.f > 0.15).sort((p, q) => q.f - p.f);
      for (const h of hits.slice(0, Math.floor(out.length * 0.22 / spec.channels.length) + 1)) cut.add(h.i);
    }
    out = out.filter((_, i) => !cut.has(i));
  }
  return [...out, ...focals(P, view, spec, seed)];
}

export function composeHair(P: HairProfile, spec: CompositionSpec, seed: number, view: View, iterations = 6): ComposeResult {
  const st: State = { wk: {}, phi: 0, lam: 0 }; const journal: ComposeResult['journal'] = [];
  const tgt = spec.hierarchy ? (() => { const t = Object.values(spec.hierarchy).reduce((s, v) => s + v, 0) || 1; return Object.fromEntries(Object.entries(spec.hierarchy).map(([k, v]) => [k, v / t * 0.92])); })() : null;
  let specs = build(P, spec, st, seed, view); let comp = analyzeComposition(P.head, specs, view);
  for (let it = 0; it < iterations; it++) {
    const re = spec.reading !== undefined ? wrapPi(spec.reading - comp.reading.angle) : 0; const be = spec.balance !== undefined ? spec.balance - comp.balance.moment : 0;
    let se = 0; if (tgt) for (const m of comp.masses) { const t = tgt[m.family]; if (t === undefined) continue; se = Math.max(se, Math.abs(t - m.share)); st.wk[m.family] = clamp((st.wk[m.family] ?? 1) * clamp((t / Math.max(0.02, m.share)) ** 0.6, 0.6, 1.6), 0.35, 3); }
    journal.push({ iter: it, reading: re, balance: be, share: se });
    if (Math.abs(re) < 0.12 && Math.abs(be) < 0.05 && se < 0.04) break;
    st.phi += 0.85 * re; st.lam = clamp(st.lam + 2.2 * be, -1.2, 1.2);
    specs = build(P, spec, st, seed, view); comp = analyzeComposition(P.head, specs, view);
  }
  return { specs, composition: comp, journal };
}

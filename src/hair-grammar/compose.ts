import { bladeOutline } from './blade';
import { blobs, close, fillPoly, makeGrid, type Blob, type Grid } from './compose-grid';
import { project, type HeadSpec, type View } from './head';
import { relationsOf, type Relation } from './occlusion';
import { paintLock, type PaintedLock } from './paint';
import { walk, type LockSpec } from './lock';
import { v3, type V2 } from './vec';

/**
 * GRAMMAIRE DE COMPOSITION — ce qui distingue 16 grosses mèches et 20 secondaires qui font une silhouette de 36 mèches posées au hasard :
 * leur FONCTION dans la composition. `analyzeComposition` MESURE sept choses sur une coiffure rendue (jamais sur le nombre de mèches) :
 *  1 hiérarchie des masses · 2 direction principale de lecture · 3 équilibre gauche/droite (repère de TÊTE, indépendant de la vue) ·
 *  4 espaces négatifs (trous de l'enveloppe, leur forme et leur alignement) · 5 points focaux (convergence de pointes, de racines, accent) ·
 *  6 lignes de force (contour + écoulement) · 7 densité (carte sur la coque : élévation × azimut) + graphe de relations entre familles.
 * `compose-plan.ts` fait le chemin inverse : une intention de composition pilote la génération.
 */
export interface MassInfo { readonly family: string; readonly weight: number; readonly share: number; readonly rank: number; readonly role: 'dominant' | 'secondary' | 'accent'; readonly centroid: V2; readonly count: number }
export interface Reading { readonly angle: number; readonly coherence: number }
export interface Balance { readonly left: number; readonly right: number; readonly moment: number }
export interface NegativeSpace { readonly ratio: number; readonly gaps: Blob[]; readonly speckle: number; readonly aligned: number; readonly envelope: number }
export interface Focal { readonly kind: 'whorl' | 'tips' | 'accent'; readonly at: V2; readonly strength: number }
export interface ForceLine { readonly kind: 'contour' | 'flow'; readonly pts: V2[]; readonly length: number; readonly angle: number }
export interface GroupEdge { readonly a: string; readonly b: string; readonly kind: 'overlap' | 'cross' | 'emerge' | 'parallel' | 'converge'; readonly weight: number }
export interface Composition {
  readonly masses: MassInfo[]; readonly hierarchy: { readonly dominantShare: number; readonly ratio: number };
  readonly reading: Reading; readonly balance: Balance; readonly negative: NegativeSpace; readonly focal: Focal[];
  readonly force: { readonly lines: ForceLine[]; readonly carry: number; readonly align: number };
  readonly density: number[][]; readonly relations: GroupEdge[]; readonly grid: Grid;
}

export const EL_BINS = 6; export const AZ_BINS = 12;
const area = (p: readonly V2[]): number => { let a = 0; for (let i = 0; i < p.length; i++) { const u = p[i] as V2; const v = p[(i + 1) % p.length] as V2; a += u.x * v.y - v.x * u.y; } return Math.abs(a) / 2; };
const dist = (a: V2, b: V2): number => Math.hypot(a.x - b.x, a.y - b.y);
const wrapPi = (a: number): number => { let x = a; while (x > Math.PI) x -= 2 * Math.PI; while (x < -Math.PI) x += 2 * Math.PI; return x; };

/** Carte de densité sur la coque : somme (largeur × pas) des échantillons de chaque mèche, normalisée à 1 ; lignes = élévation (haut → bas), colonnes = azimut. */
export function shellDensity(h: HeadSpec, specs: readonly LockSpec[]): number[][] {
  const D = Array.from({ length: EL_BINS }, () => new Array<number>(AZ_BINS).fill(0)); let tot = 0;
  for (const L of specs) {
    const S = walk(h, L, 28);
    for (let k = 0; k < S.length; k++) {
      const el = (Math.asin(Math.max(-1, Math.min(1, -S[k]!.p.y / h.ry))) * 180) / Math.PI; const az = (Math.atan2(S[k]!.p.x, S[k]!.p.z - h.cz) * 180) / Math.PI;
      const r = Math.min(EL_BINS - 1, Math.max(0, Math.floor((90 - el) / 20))); const c = Math.min(AZ_BINS - 1, Math.max(0, Math.floor((az + 180) / 30)));
      const w = L.width * (L.length / 28); (D[r] as number[])[c] = ((D[r] as number[])[c] as number) + w; tot += w;
    }
  }
  return D.map((row) => row.map((v) => v / Math.max(1e-9, tot)));
}

/** Corrélation de Pearson de deux cartes de densité (même forme). */
export function correlation(a: number[][], b: number[][]): number {
  const x = a.flat(); const y = b.flat(); const n = x.length; const mx = x.reduce((s, v) => s + v, 0) / n; const my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0; let sxx = 0; let syy = 0; for (let i = 0; i < n; i++) { sxy += ((x[i] as number) - mx) * ((y[i] as number) - my); sxx += ((x[i] as number) - mx) ** 2; syy += ((y[i] as number) - my) ** 2; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
}

export function analyzeComposition(h: HeadSpec, specs: readonly LockSpec[], view: View, painted: readonly PaintedLock[] = specs.map((L) => paintLock(h, L, view)), size = { w: 156, h: 150 }): Composition {
  // 1 · masses par famille.
  const fam = new Map<string, { w: number; n: number; cx: number; cy: number }>(); const areas = painted.map((p) => area(bladeOutline(p.blade)));
  painted.forEach((p, i) => { const f = p.spec.family; const m = fam.get(f) ?? { w: 0, n: 0, cx: 0, cy: 0 }; const mid = p.blade.spine[Math.floor(p.blade.spine.length / 2)] as V2; m.w += areas[i] as number; m.n++; m.cx += mid.x * (areas[i] as number); m.cy += mid.y * (areas[i] as number); fam.set(f, m); });
  const tot = [...fam.values()].reduce((s, m) => s + m.w, 0) || 1;
  const masses: MassInfo[] = [...fam.entries()].sort((p, q) => q[1].w - p[1].w).map(([family, m], rank) => ({ family, weight: m.w, share: m.w / tot, rank, role: rank === 0 ? 'dominant' : m.w / tot >= 0.12 ? 'secondary' : 'accent', centroid: { x: m.cx / Math.max(1e-9, m.w), y: m.cy / Math.max(1e-9, m.w) }, count: m.n }));
  const hierarchy = { dominantShare: masses[0]?.share ?? 0, ratio: (masses[0]?.share ?? 0) / Math.max(1e-9, masses[1]?.share ?? 1e-9) };
  // 2 · direction de lecture (somme vectorielle des tangentes, pondérée par l'aire locale).
  let rx = 0; let ry = 0; let rw = 0;
  for (const p of painted) for (let k = 1; k < p.blade.spine.length; k++) { const a = p.blade.spine[k - 1] as V2; const b = p.blade.spine[k] as V2; const l = Math.hypot(b.x - a.x, b.y - a.y); if (l < 1e-9) continue; const w = l * (p.blade.half[k] as number) * 2; rx += ((b.x - a.x) / l) * w; ry += ((b.y - a.y) / l) * w; rw += w; }
  const reading: Reading = { angle: Math.atan2(ry, rx), coherence: Math.hypot(rx, ry) / Math.max(1e-9, rw) };
  // 3 · équilibre G/D dans le repère de tête.
  let wl = 0; let wr = 0; let mx = 0;
  for (const L of specs) { const S = walk(h, L, 28); for (const s of S) { const w = L.width * (L.length / 28); if (s.p.x < 0) wl += w; else wr += w; mx += s.p.x * w; } }
  const balance: Balance = { left: wl / Math.max(1e-9, wl + wr), right: wr / Math.max(1e-9, wl + wr), moment: mx / Math.max(1e-9, wl + wr) / h.rx };
  // 4 · espaces négatifs : trous de l'enveloppe fermée.
  const g = makeGrid(size.w, size.h, 3); for (const p of painted) fillPoly(g, bladeOutline(p.blade), 1);
  const env = close(g, 3); let envN = 0; let cov = 0; for (let i = 0; i < g.data.length; i++) { if (env.data[i]) envN++; if (g.data[i]) cov++; }
  const gaps = blobs(g, (i) => env.data[i] === 1 && g.data[i] === 0).filter((b) => b.cells >= 1);
  const axis = reading.angle; const axial = (a: number): number => Math.abs(wrapPi(2 * (a - axis))) / 2;
  const big = gaps.filter((b) => b.cells >= 4);
  const negative: NegativeSpace = { ratio: (envN - cov) / Math.max(1, envN), gaps, speckle: gaps.length ? gaps.filter((b) => b.cells < 4).length / gaps.length : 0, aligned: big.length ? big.filter((b) => b.aspect > 1.5 && axial(b.angle) < 0.6).length / big.length : 0, envelope: envN };
  // 5 · points focaux : convergence de pointes / de racines, accent isolé.
  const tips = painted.map((p) => p.blade.spine.at(-1) as V2); const roots = painted.map((p) => p.blade.spine[0] as V2);
  const dense = (pts: V2[], r: number): { at: V2; n: number } | null => { let best: { at: V2; n: number } | null = null; for (const c of pts) { const near = pts.filter((q) => dist(q, c) <= r); if (!best || near.length > best.n) best = { at: { x: near.reduce((s, q) => s + q.x, 0) / near.length, y: near.reduce((s, q) => s + q.y, 0) / near.length }, n: near.length }; } return best; };
  const focal: Focal[] = []; const tipC = dense(tips, 0.1 * view.s); const rootC = dense(roots, 0.14 * view.s);
  if (tipC && tipC.n >= 3) focal.push({ kind: 'tips', at: tipC.at, strength: tipC.n / 6 });
  if (rootC && rootC.n >= 4) focal.push({ kind: 'whorl', at: rootC.at, strength: rootC.n / 8 });
  const meanTone = painted.reduce((s, p) => s + p.spec.tone, 0) / Math.max(1, painted.length);
  let acc: { at: V2; s: number } | null = null;
  painted.forEach((p, i) => { const tip = tips[i] as V2; const others = tips.filter((_, j) => j !== i); const iso = Math.min(3, Math.min(...others.map((q) => dist(q, tip)), 1e9) / (0.1 * view.s)); const len = dist(p.blade.spine[0] as V2, tip) / view.s; const s = len * Math.abs(p.spec.tone - meanTone) * iso; if (!acc || s > acc.s) acc = { at: tip, s }; });
  const A = acc as { at: V2; s: number } | null; if (A && A.s > 0.35) focal.push({ kind: 'accent', at: A.at, strength: A.s });
  focal.sort((p, q) => q.strength - p.strength);
  // 6 · lignes de force : contour (profil radial de l'enveloppe) + écoulement des masses dominantes.
  const c0 = project(view, v3(0, 0, h.cz)); const lines: ForceLine[] = [];
  const rad: (V2 | null)[] = []; for (let a = 0; a < 360; a += 4) { const th = (a * Math.PI) / 180; let best: V2 | null = null; for (let r = 4; r < 140; r += 1.5) { const x = c0.x + Math.cos(th) * r; const y = c0.y + Math.sin(th) * r; const cx = Math.floor(x / env.cell); const cy = Math.floor(y / env.cell); if (cx >= 0 && cy >= 0 && cx < env.nx && cy < env.ny && env.data[cy * env.nx + cx]) best = { x, y }; } rad.push(best); }
  let cur: V2[] = []; const flush = (): void => { if (cur.length >= 3) { let L = 0; for (let i = 1; i < cur.length; i++) L += dist(cur[i - 1] as V2, cur[i] as V2); lines.push({ kind: 'contour', pts: cur, length: L, angle: Math.atan2((cur.at(-1) as V2).y - (cur[0] as V2).y, (cur.at(-1) as V2).x - (cur[0] as V2).x) }); } cur = []; };
  let lastSign = 0; for (const q of rad) { if (!q) { flush(); lastSign = 0; continue; } const n = cur.length; if (n >= 2) { const a = cur[n - 2] as V2; const b = cur[n - 1] as V2; const sg = Math.sign((b.x - a.x) * (q.y - b.y) - (b.y - a.y) * (q.x - b.x)); if (lastSign !== 0 && sg !== 0 && sg !== lastSign) { const keep = b; flush(); cur = [keep]; } if (sg !== 0) lastSign = sg; } cur.push(q); }
  flush();
  const contourL = lines.reduce((s, l) => s + l.length, 0); const top3 = [...lines].sort((p, q) => q.length - p.length).slice(0, 3).reduce((s, l) => s + l.length, 0);
  const domFam = new Set(masses.slice(0, 2).map((m) => m.family)); const flows = painted.filter((p) => domFam.has(p.spec.family)).sort((p, q) => dist(q.blade.spine[0] as V2, q.blade.spine.at(-1) as V2) - dist(p.blade.spine[0] as V2, p.blade.spine.at(-1) as V2)).slice(0, 6);
  for (const p of flows) { const a = p.blade.spine[0] as V2; const b = p.blade.spine.at(-1) as V2; lines.push({ kind: 'flow', pts: p.blade.spine, length: dist(a, b), angle: Math.atan2(b.y - a.y, b.x - a.x) }); }
  const align = flows.length ? flows.reduce((s, p) => { const a = p.blade.spine[0] as V2; const b = p.blade.spine.at(-1) as V2; return s + Math.abs(wrapPi(Math.atan2(b.y - a.y, b.x - a.x) - reading.angle)); }, 0) / flows.length : Math.PI;
  const force = { lines, carry: contourL > 0 ? top3 / contourL : 0, align };
  // 7 · densité + graphe de relations entre familles.
  const density = shellDensity(h, specs);
  const rel = new Map<string, GroupEdge>(); const addEdge = (a: string, b: string, kind: GroupEdge['kind'], w: number): void => { const [p, q] = a <= b ? [a, b] : [b, a]; const k = `${p}|${q}|${kind}`; const e = rel.get(k); rel.set(k, { a: p, b: q, kind, weight: (e?.weight ?? 0) + w }); };
  const relations: Relation[] = relationsOf(painted);
  for (const r of relations) { const fa = (painted[r.a] as PaintedLock).spec.family; const fb = (painted[r.b] as PaintedLock).spec.family; addEdge(fa, fb, r.kind, r.intervals.reduce((s, i) => s + (i.a1 - i.a0), 0)); }
  const dirOf = (p: PaintedLock): number => { const a = p.blade.spine[0] as V2; const b = p.blade.spine.at(-1) as V2; return Math.atan2(b.y - a.y, b.x - a.x); };
  for (let i = 0; i < painted.length; i++) for (let j = i + 1; j < painted.length; j++) {
    const A2 = painted[i] as PaintedLock; const B2 = painted[j] as PaintedLock; if (A2.spec.family === B2.spec.family) continue;
    if (Math.abs(wrapPi(dirOf(A2) - dirOf(B2))) < 0.35 && dist(A2.blade.spine[Math.floor(A2.blade.spine.length / 2)] as V2, B2.blade.spine[Math.floor(B2.blade.spine.length / 2)] as V2) < 0.3 * view.s) addEdge(A2.spec.family, B2.spec.family, 'parallel', 1);
    if (dist(tips[i] as V2, tips[j] as V2) < 0.08 * view.s) addEdge(A2.spec.family, B2.spec.family, 'converge', 1);
  }
  return { masses, hierarchy, reading, balance, negative, focal, force, density, relations: [...rel.values()], grid: g };
}

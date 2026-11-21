import { inPoly } from '../face/poly';
import { bladeOutline, type Blade } from './blade';
import type { PaintedLock } from './paint';
import type { V2 } from './vec';

/**
 * GRAMMAIRE DE CHEVAUCHEMENT — de calques (back / front / over) à des RELATIONS SPATIALES et une occlusion LOCALE.
 * Pour chaque paire de mèches dont les lames se recouvrent, on relève des INTERVALLES : sur quelle portion de chaque mèche (t) elles
 * se recouvrent, laquelle passe devant (profondeur projetée comparée ÉCHANTILLON PAR ÉCHANTILLON), où ça commence et où ça finit.
 * Une paire qui s'alterne devant / derrière est un CROISEMENT : ses deux mèches sont découpées en tronçons, et tous les éléments
 * (mèches entières ou tronçons) sont ordonnés par un tri topologique des contraintes « devant → derrière » ; un cycle résiduel est
 * rompu sur l'arête de plus faible écart de profondeur. Seul l'ORDRE de dessin change : les formes sont les mêmes, la silhouette
 * d'ensemble est donc intacte. Les ombres de contact sont posées sur la mèche de derrière, le long du bord de celle de devant.
 */
export interface Interval { readonly a0: number; readonly a1: number; readonly b0: number; readonly b1: number; readonly front: 'a' | 'b'; readonly gap: number }
export interface Relation { readonly a: number; readonly b: number; readonly kind: 'overlap' | 'cross' | 'emerge'; readonly intervals: Interval[] }

interface Geo { readonly poly: V2[]; readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number }
const geoOf = (b: Blade): Geo => {
  const poly = bladeOutline(b); let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  for (const p of poly) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
  return { poly, x0, x1, y0, y1 };
};
const inside = (g: Geo, p: V2): boolean => p.x >= g.x0 && p.x <= g.x1 && p.y >= g.y0 && p.y <= g.y1 && inPoly(g.poly, p.x, p.y);
/** Zone morte de profondeur (unités H, ≈ 2 px à l'échelle des cellules) : en deçà, on garde le signe précédent (pas d'alternance parasite au cœur d'un X). */
const EPS = 0.02;
/** Écart de profondeur minimal (unités H) pour qu'un intervalle de croisement impose un ordre local : en deçà, l'ordre du dessinateur (celui de la coiffure) fait foi. */
export const GAP_MIN = 0.03;
/** Portion minimale (fraction de la longueur de chaque mèche) d'un intervalle pour compter comme croisement franc. */
export const SPAN_MIN = 0.03;


/**
 * Intervalles où la lame A recouvre la lame B (vus depuis A), découpés aux changements de signe de la profondeur.
 * `paired` : A et B sont deux brins d'un MÊME entrelacs (`weave`), paramétrés de la même façon — le point de B qui correspond à l'échantillon k de A
 * est alors l'échantillon k de B (même position dans la tresse), et non le point le plus proche, qui forme un plateau là où les brins se croisent.
 */
function runs(A: Blade, gB: Geo, B: Blade, paired = false, volume = false): Interval[] {
  const n = A.spine.length; const cover: boolean[] = [];
  for (let k = 0; k < n; k++) cover.push(inside(gB, A.spine[k] as V2) || inside(gB, A.left[k] as V2) || inside(gB, A.right[k] as V2));
  const out: Interval[] = []; let k = 0;
  while (k < n) {
    if (!cover[k]) { k++; continue; }
    let e = k; while (e + 1 < n && (cover[e + 1] || cover[e + 2])) e++;
    // Sous-intervalles de signe constant de (profondeur A − profondeur de B au point le plus proche de l'axe). Le point de B le plus proche est
    // calculé UNE fois par échantillon de A ; la portion de B recouverte est l'ÉTENDUE de ces points sur tout l'intervalle (et non celle des deux
    // extrémités : deux brins entrelacés, presque parallèles, voient leurs extrémités tomber sur le même point de l'autre — étendue nulle,
    // croisement franc jugé « faible »). Mesuré sur `weaveStrands` : étendue des extrémités 0 → 0,18.
    let s0 = k; let prev = 0; const nr = new Map<number, number>();
    // PROFONDEUR DE VOLUME : en mode `all`, chaque mèche est une dalle d'épaisseur `thick` ; deux dalles qui se pénètrent n'ont pas d'ordre de profondeur fiable (l'ordre
    // de la coiffure fait foi). `slab` = demi-somme des épaisseurs au couple d'échantillons (nulle hors mode volume et pour deux brins d'un même entrelacs).
    const slab = (ia: number, ib: number): number => (volume && !paired ? (((A.thick?.[ia] ?? 0) + (B.thick?.[ib] ?? 0)) / 2) : 0);
    const near = (kk: number): number => { if (paired) return Math.min(kk, B.spine.length - 1); const c = nr.get(kk); if (c !== undefined) return c; let bi = 0; let bd = Infinity; const p = A.spine[kk] as V2; for (let m = 0; m < B.spine.length; m++) { const q = B.spine[m] as V2; const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2; if (d < bd) { bd = d; bi = m; } } nr.set(kk, bi); return bi; };
    const flush = (from: number, to: number, sign: number): void => {
      if (to < from || sign === 0) return;
      let lo = Infinity; let hi = -Infinity; for (let j = from; j <= to; j++) { const m = near(j); if (m < lo) lo = m; if (m > hi) hi = m; }
      const mid = Math.floor((from + to) / 2); const gap = Math.max(0, Math.abs((A.depth[mid] as number) - (B.depth[near(mid)] as number)) - slab(mid, near(mid)));
      out.push({ a0: from / (n - 1), a1: to / (n - 1), b0: lo / (B.spine.length - 1), b1: hi / (B.spine.length - 1), front: sign > 0 ? 'a' : 'b', gap });
    };
    for (let j = k; j <= e; j++) {
      const d = (A.depth[j] as number) - (B.depth[near(j)] as number);
      const sg = Math.abs(d) - slab(j, near(j)) < EPS ? prev : Math.sign(d);
      if (prev !== 0 && sg !== prev) { flush(s0, j - 1, prev); s0 = j; }
      prev = sg;
    }
    flush(s0, e, prev); k = e + 1;
  }
  return out;
}

/** Toutes les relations de recouvrement d'un ensemble de mèches peintes. */
export function relationsOf(locks: readonly PaintedLock[], volume = false): Relation[] {
  const G = locks.map((l) => geoOf(l.blade)); const out: Relation[] = [];
  for (let i = 0; i < locks.length; i++) for (let j = i + 1; j < locks.length; j++) {
    const a = G[i] as Geo; const b = G[j] as Geo;
    if (a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0) continue;
    const A = locks[i] as PaintedLock; const B = locks[j] as PaintedLock;
    const swap = (r: Interval): Interval => ({ a0: r.b0, a1: r.b1, b0: r.a0, b1: r.a1, front: r.front === 'a' ? 'b' : 'a', gap: r.gap });
    const paired = A.spec.weave !== undefined && A.spec.weave === B.spec.weave;
    const iv = [...runs(A.blade, b, B.blade, paired, volume), ...runs(B.blade, a, A.blade, paired, volume).map(swap)];
    if (!iv.length) continue;
    const strong = iv.filter((r) => r.gap >= GAP_MIN && Math.min(r.a1 - r.a0, r.b1 - r.b0) >= SPAN_MIN);
    const fronts = new Set(strong.map((r) => r.front));
    const emerge = A.spec.parent?.id === B.spec.id || B.spec.parent?.id === A.spec.id;
    out.push({ a: i, b: j, kind: emerge ? 'emerge' : fronts.size > 1 ? 'cross' : 'overlap', intervals: iv });
  }
  return out;
}

/** Élément dessinable : une mèche entière (`whole`) ou un tronçon d'une mèche découpée (échantillons i0..i1 de la lame). */
export interface Item { readonly lock: number; readonly i0: number; readonly i1: number; readonly depth: number; readonly whole: boolean; readonly cut: boolean }
export interface Resolved { readonly order: Item[]; readonly relations: Relation[]; readonly interleaved: number[] }

const PIECES = 8;
/**
 * Une relation impose-t-elle un ordre local ? `emerge` : toujours (la fille reste sous sa mère). `cross` : seulement si les deux mèches
 * sont déclarées du même groupe de tressage (`LockSpec.weave`) — la profondeur de coque + décollement n'est PAS assez fiable pour trancher
 * tous les croisements d'une chevelure dense (mesuré : coupures et arêtes en escalier, voir docs/HAIR-OVERLAP.md).
 */
export const imposes = (r: Relation, locks: readonly PaintedLock[], mode: 'weave' | 'all' = 'weave'): boolean => r.kind === 'emerge' || (r.kind === 'cross' && (mode === 'all' || ((locks[r.a] as PaintedLock).spec.weave !== undefined && (locks[r.a] as PaintedLock).spec.weave === (locks[r.b] as PaintedLock).spec.weave)));
const meanDepth = (b: Blade, i0: number, i1: number): number => { let s = 0; for (let k = i0; k <= i1; k++) s += b.depth[k] as number; return s / (i1 - i0 + 1); };

/**
 * Ordre de dessin local. Base = ordre de la coiffure (ordre du tableau : celui que l'ajustement et l'auteur ont validé, jamais réordonné
 * à l'aveugle) ; seules les paires qui se CROISENT en alternance (ou une mèche ÉMERGENTE sous sa mère) imposent des contraintes
 * « devant → derrière », et seules ces mèches sont découpées en tronçons. Tri topologique stable : à contraintes égales, l'ordre d'origine.
 */
export function resolveOrder(locks: readonly PaintedLock[], relations: readonly Relation[] = relationsOf(locks), mode: 'weave' | 'all' = 'weave'): Resolved {
  const n = locks.length; const N = locks[0]?.blade.spine.length ?? 2;
  const cut = new Set<number>();
  for (const r of relations) if (r.kind === 'cross' && imposes(r, locks, mode)) { cut.add(r.a); cut.add(r.b); }
  const marks: number[][] = locks.map(() => []);
  for (const r of relations) {
    if (r.kind !== 'cross' || !imposes(r, locks, mode)) continue;
    for (const iv of r.intervals) { if (iv.gap < GAP_MIN || Math.min(iv.a1 - iv.a0, iv.b1 - iv.b0) < SPAN_MIN) continue; marks[r.a]?.push(iv.a0, iv.a1); marks[r.b]?.push(iv.b0, iv.b1); }
  }
  const items: Item[] = []; const byLock: number[][] = locks.map(() => []);
  for (let l = 0; l < n; l++) {
    const b = (locks[l] as PaintedLock).blade;
    if (!cut.has(l)) { byLock[l]?.push(items.length); items.push({ lock: l, i0: 0, i1: N - 1, depth: meanDepth(b, 0, N - 1), whole: true, cut: false }); continue; }
    // Coupes : PIECES tronçons réguliers + une coupe à chaque borne d'intervalle franc de cette mèche. Sans elles, un tronçon régulier (≈ 5 échantillons)
    // peut contenir à la fois un croisement et le changement d'ordre qui suit : ordre contradictoire, arête la plus faible rompue → mauvais brin devant
    // (observé sur `weaveStrands` : croisement à u = 0,28, inversion à u = 0,36, même tronçon [10-15]).
    const cuts = new Set<number>(); for (let p = 0; p <= PIECES; p++) cuts.add(Math.round((p * (N - 1)) / PIECES));
    for (const t of marks[l] ?? []) cuts.add(Math.min(N - 1, Math.max(0, Math.round(t * (N - 1)))));
    const bounds = [...cuts].sort((x, y) => x - y);
    for (let p = 0; p + 1 < bounds.length; p++) { const i0 = bounds[p] as number; const i1 = bounds[p + 1] as number; byLock[l]?.push(items.length); items.push({ lock: l, i0, i1, depth: meanDepth(b, i0, i1), whole: false, cut: true }); }
  }
  const covers = (lock: number, t0: number, t1: number): number[] => {
    const a = Math.round(Math.min(t0, t1) * (N - 1)); const b = Math.round(Math.max(t0, t1) * (N - 1));
    return (byLock[lock] ?? []).filter((k) => (items[k] as Item).i0 <= b && (items[k] as Item).i1 >= a);
  };
  const rank = (k: number): number => ({ back: 0, front: 1, over: 2 })[(locks[(items[k] as Item).lock] as PaintedLock).layer];
  // Arêtes devant → derrière (avec écart de profondeur), même groupe de couche seulement.
  const edges = new Map<string, { f: number; b: number; w: number }>();
  for (const r of relations) {
    if (!imposes(r, locks, mode)) continue;
    for (const iv of r.intervals) {
      if (r.kind === 'cross' && (iv.gap < GAP_MIN || Math.min(iv.a1 - iv.a0, iv.b1 - iv.b0) < SPAN_MIN)) continue;
      const fl = iv.front === 'a' ? r.a : r.b; const bl = iv.front === 'a' ? r.b : r.a;
      if (r.kind === 'emerge' && (locks[bl] as PaintedLock).spec.parent?.id !== (locks[fl] as PaintedLock).spec.id) continue;
      const fr = iv.front === 'a' ? [iv.a0, iv.a1] : [iv.b0, iv.b1]; const br = iv.front === 'a' ? [iv.b0, iv.b1] : [iv.a0, iv.a1];
      for (const f of covers(fl, fr[0] as number, fr[1] as number)) for (const b of covers(bl, br[0] as number, br[1] as number)) {
        if (rank(f) !== rank(b)) continue;
        const key = `${f}>${b}`; const old = edges.get(key);
        if (!old || old.w < iv.gap) edges.set(key, { f, b, w: iv.gap });
      }
    }
  }
  // Tri topologique stable (Kahn) : le devant attend le derrière ; ordre d'origine (couche, indice de mèche, tronçon) à égalité.
  const live = [...edges.values()].sort((p, q) => q.w - p.w);
  const done = new Array<boolean>(items.length).fill(false); const order: number[] = [];
  const key = (k: number): number => rank(k) * 1e6 + (items[k] as Item).lock * 100 + (items[k] as Item).i0;
  while (order.length < items.length) {
    const blocked = new Set<number>(); for (const e of live) if (!done[e.f] && !done[e.b]) blocked.add(e.f);
    let pick = -1;
    for (let k = 0; k < items.length; k++) if (!done[k] && !blocked.has(k) && (pick < 0 || key(k) < key(pick))) pick = k;
    if (pick < 0) { // cycle : on rompt l'arête de plus faible écart de profondeur encore active
      let wi = -1; for (let e = live.length - 1; e >= 0; e--) { const E = live[e] as { f: number; b: number }; if (!done[E.f] && !done[E.b]) { wi = e; break; } }
      if (wi < 0) break; live.splice(wi, 1); continue;
    }
    done[pick] = true; order.push(pick);
  }
  return { order: order.map((k) => items[k] as Item), relations: [...relations], interleaved: [...cut] };
}

/** Portions VISIBLES d'une mèche (non recouvertes par une mèche de devant) : où la mèche — ou la sous-couche — réapparaît. */
export function visibleSpans(lock: number, N: number, relations: readonly Relation[]): [number, number][] {
  const cov = new Array<boolean>(N).fill(false);
  for (const r of relations) for (const iv of r.intervals) {
    const mine = r.a === lock ? [iv.a0, iv.a1, iv.front === 'b'] : r.b === lock ? [iv.b0, iv.b1, iv.front === 'a'] : null;
    if (!mine || !mine[2]) continue;
    for (let k = Math.round((mine[0] as number) * (N - 1)); k <= Math.round((mine[1] as number) * (N - 1)); k++) cov[k] = true;
  }
  const out: [number, number][] = []; let s = -1;
  for (let k = 0; k <= N; k++) { const v = k < N && !cov[k]; if (v && s < 0) s = k; if (!v && s >= 0) { out.push([s / (N - 1), (k - 1) / (N - 1)]); s = -1; } }
  return out;
}

import { bladeOutline, smoothPath, type Blade } from './blade';
import type { HeadSpec, View } from './head';
import type { LockSpec } from './lock';
import { GAP_MIN, SPAN_MIN, imposes, relationsOf, resolveOrder, type Item, type Relation, type Resolved } from './occlusion';
import { INK, paintLock, type HairPainting, type PaintStyle, type PaintedLock } from './paint';
import type { V2 } from './vec';

/**
 * Rendu avec OCCLUSION LOCALE : même peinture de mèche que `paintHair`, mais dessinée dans l'ordre de `resolveOrder` — les mèches qui
 * se croisent sont découpées en tronçons (clip sur la lame, bords inflés du demi-trait pour garder le contour), et chaque mèche de
 * derrière reçoit une OMBRE DE CONTACT le long du bord de celle de devant (rognée par son propre contour).
 */
export interface ResolvedPainting extends HairPainting { readonly relations: Relation[]; readonly resolved: Resolved; readonly stats: { readonly locks: number; readonly cut: number; readonly crossings: number; readonly emerges: number; readonly shadows: number } }

/** Polygone de découpe d'un tronçon : lame i0..i1 prolongée d'un demi-échantillon, élargie latéralement de `lw`. */
function pieceClip(b: Blade, i0: number, i1: number, lw: number): V2[] {
  const n = b.spine.length; const L: V2[] = []; const R: V2[] = [];
  const get = (k: number): { l: V2; r: V2 } => { const kk = Math.min(n - 1, Math.max(0, k)); const l = b.left[kk] as V2; const r = b.right[kk] as V2; const d = Math.hypot(r.x - l.x, r.y - l.y) || 1; const ux = (r.x - l.x) / d; const uy = (r.y - l.y) / d; return { l: { x: l.x - ux * lw, y: l.y - uy * lw }, r: { x: r.x + ux * lw, y: r.y + uy * lw } }; };
  const mid = (a: number, c: number): { l: V2; r: V2 } => { const p = get(a); const q = get(c); return { l: { x: (p.l.x + q.l.x) / 2, y: (p.l.y + q.l.y) / 2 }, r: { x: (p.r.x + q.r.x) / 2, y: (p.r.y + q.r.y) / 2 } }; };
  const first = i0 > 0 ? mid(i0 - 1, i0) : get(i0); const last = i1 < n - 1 ? mid(i1, i1 + 1) : get(i1);
  L.push(first.l); R.push(first.r);
  for (let k = i0; k <= i1; k++) { const g = get(k); L.push(g.l); R.push(g.r); }
  L.push(last.l); R.push(last.r);
  return [...L, ...R.reverse()];
}

/** Bords de la lame de devant sur la portion recouverte : ombre de contact sur la mèche de derrière. */
function contact(front: Blade, a0: number, a1: number, back: PaintedLock, id: string): string {
  const n = front.spine.length; const k0 = Math.max(0, Math.round(a0 * (n - 1))); const k1 = Math.min(n - 1, Math.round(a1 * (n - 1)));
  if (k1 - k0 < 2) return '';
  const e = (pts: V2[]): string => smoothPath(pts.slice(k0, k1 + 1));
  return `<clipPath id="${id}"><path d="${smoothPath(bladeOutline(back.blade), true)}"/></clipPath><g clip-path="url(#${id})" fill="none" stroke="#000" stroke-width="2.2" opacity="0.3"><path d="${e(front.left)}"/><path d="${e(front.right)}"/></g>`;
}

export function paintHairResolved(h: HeadSpec, specs: readonly LockSpec[], view: View, st: PaintStyle = INK, mode: 'weave' | 'all' = 'weave'): ResolvedPainting {
  return renderResolved(specs.map((L) => paintLock(h, L, view, st)), st, mode);
}

/** Même rendu à partir de mèches DÉJÀ peintes (tests : lames fabriquées à la main, profondeurs contrôlées). */
export function renderResolved(locks: readonly PaintedLock[], st: PaintStyle = INK, mode: 'weave' | 'all' = 'weave', known?: Relation[]): ResolvedPainting {
  const relations = known ?? relationsOf(locks, mode === 'all'); const resolved = resolveOrder(locks, relations, mode);
  const extra = new Map<Item, string[]>(); let shadows = 0;
  const itemAt = (lock: number, t: number): Item | undefined => { const N = (locks[lock] as PaintedLock).blade.spine.length; const k = Math.round(t * (N - 1)); return resolved.order.find((it) => it.lock === lock && it.i0 <= k && it.i1 >= k); };
  relations.forEach((r, ri) => r.intervals.forEach((iv, ii) => {
    if (!imposes(r, locks, mode) || (r.kind === 'cross' && iv.gap < GAP_MIN) || Math.min(iv.a1 - iv.a0, iv.b1 - iv.b0) < SPAN_MIN) return;
    const fl = iv.front === 'a' ? r.a : r.b; const bl = iv.front === 'a' ? r.b : r.a;
    const fr = iv.front === 'a' ? [iv.a0, iv.a1] : [iv.b0, iv.b1]; const br = iv.front === 'a' ? [iv.b0, iv.b1] : [iv.a0, iv.a1];
    const it = itemAt(bl, ((br[0] as number) + (br[1] as number)) / 2); if (!it) return;
    const s = contact((locks[fl] as PaintedLock).blade, fr[0] as number, fr[1] as number, locks[bl] as PaintedLock, `oc${ri}_${ii}`);
    if (s) { (extra.get(it) ?? extra.set(it, []).get(it) as string[]).push(s); shadows++; }
  }));
  const parts: Record<'back' | 'front' | 'over', string[]> = { back: [], front: [], over: [] };
  resolved.order.forEach((it, k) => {
    const L = locks[it.lock] as PaintedLock;
    const body = it.whole ? L.svg : `<clipPath id="pc${k}"><path d="${smoothPath(pieceClip(L.blade, it.i0, it.i1, st.lineW), true)}"/></clipPath><g clip-path="url(#pc${k})">${L.svg}</g>`;
    parts[L.layer].push(body + (extra.get(it) ?? []).join(''));
  });
  const stats = { locks: locks.length, cut: resolved.order.filter((i) => i.cut).length, crossings: relations.filter((r) => r.kind === 'cross').length, emerges: relations.filter((r) => r.kind === 'emerge').length, shadows };
  return { back: parts.back.join(''), front: parts.front.join(''), over: parts.over.join(''), locks: [...locks], relations, resolved, stats };
}

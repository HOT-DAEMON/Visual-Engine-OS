import { loft, type Ctl } from './loft';
import type { Trunk } from './trunk';
import type { VGroup, VKind, Volume } from './types';
import { add3, mul3, type P3 } from './vec3';

export interface VSpec {
  readonly id: string; readonly name: string; readonly group: VGroup; readonly kind?: VKind; readonly side?: 'L' | 'R' | 'C';
  readonly parent?: string | null; readonly level?: 0 | 1 | 2 | 3; readonly layer: number; readonly tier?: number; readonly tone?: number;
  readonly fibres?: readonly number[]; readonly strand?: boolean; readonly origin?: string; readonly insertion?: string; readonly n?: number;
}
/** Fabrique un Volume depuis des points de contrôle (valeurs par défaut explicites : muscle, niveau 2, côté central). */
export const vol = (s: VSpec, ctl: readonly Ctl[]): Volume => ({
  id: s.id, name: s.name, group: s.group, kind: s.kind ?? 'muscle', side: s.side ?? 'C', parent: s.parent ?? null, level: s.level ?? 2, layer: s.layer,
  ...(s.tier !== undefined ? { tier: s.tier } : {}), stations: loft(ctl, s.n ?? 9), fibres: s.fibres ?? [], tone: s.tone ?? 0,
  ...(s.strand ? { strand: true } : {}), ...(s.origin ? { origin: s.origin } : {}), ...(s.insertion ? { insertion: s.insertion } : {}),
});
/** Ancre sur la peau du tronc : hauteur y, angle ψ, demi-largeur tangentielle a, demi-épaisseur b (px). */
export interface Anchor { readonly y: number; readonly psi: number; readonly a: number; readonly b: number; readonly lift?: number }
/** Muscle de surface : suit la peau du tronc (le centre est enfoncé de 35 % de son épaisseur par défaut) ; `hint` = normale de peau. */
export function surf(tr: Trunk, s: VSpec, anchors: readonly Anchor[]): Volume {
  return vol(s, anchors.map((q) => { const { p, n } = tr.point(q.y, q.psi, q.lift ?? q.b * 0.35); return { c: p, a: q.a, b: q.b, hint: n }; }));
}
/** Même muscle de l'autre côté : ψ → −ψ, id suffixé. */
export const both = (tr: Trunk, s: Omit<VSpec, 'side'>, anchors: readonly Anchor[]): Volume[] => [
  surf(tr, { ...s, id: `${s.id}.L`, side: 'L', parent: s.parent ? `${s.parent}.L` : null }, anchors),
  surf(tr, { ...s, id: `${s.id}.R`, side: 'R', parent: s.parent ? `${s.parent}.R` : null }, anchors.map((q) => ({ ...q, psi: -q.psi }))),
];
export const lift3 = (p: P3, n: P3, k: number): P3 => add3(p, mul3(n, k));
/** Petit générateur déterministe (mulberry32) : variations d'irrégularité reproductibles. */
export function rng(seed: number): () => number { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

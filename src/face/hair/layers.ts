import type { Vec } from '../../geometry/eye/primitives';
import { orient, type Poly } from '../poly';
import { growLock, lockFrom, lockLen, type HairCtx } from './flow';
import { arcAt } from './hairline';
import type { HairLock, TierMass } from './types';

const lerpV = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Étage d'une mèche (0 = le plus long, le plus au fond) : tirage uniforme sur `tiers.count` étages. */
export const tierOf = (ctx: HairCtx): number => Math.min(ctx.h.tiers.count - 1, Math.floor(ctx.rnd() * ctx.h.tiers.count));

/** Facteur de longueur d'un étage : chaque étage est plus court que le précédent de `step` (longueurs ÉTAGÉES). */
export const tierScale = (ctx: HairCtx, tier: number): number => 1 - ctx.h.tiers.step * tier;

/**
 * Enveloppe RADIALE d'un nuage de points autour de `C` : pour chacune de `bins` directions, le point le plus éloigné.
 * Donne la silhouette d'un étage (même pour les coiffures non pendantes où l'enveloppe verticale de `scalp.ts` ne convient pas).
 */
export function radialEnvelope(points: Vec[], C: Vec, bins = 32): Poly | null {
  const far: (Vec | null)[] = Array.from({ length: bins }, () => null);
  const r = (q: Vec): number => Math.hypot(q.x - C.x, q.y - C.y);
  for (const q of points) {
    const k = Math.min(bins - 1, Math.floor(((Math.atan2(q.y - C.y, q.x - C.x) + Math.PI) / (2 * Math.PI)) * bins));
    const cur = far[k];
    if (!cur || r(q) > r(cur)) far[k] = q;
  }
  const kept = far.filter((q): q is Vec => q !== null);
  return kept.length < 6 ? null : orient(kept);
}

/**
 * Sous-couches VISIBLES : pour chaque étage ≥ 1, la silhouette (enveloppe radiale) de ses mèches, dessinée sous elles
 * dans un ton plus sombre / décalé en teinte (`tiers.underTone / underHue / underVisible`) : on voit des couches de
 * cheveux superposées, pas une seule nappe. Rien n'est produit sans étage ni opacité demandés.
 */
export function tierMasses(ctx: HairCtx, locks: HairLock[]): TierMass[] {
  if (ctx.h.tiers.count < 2 || ctx.h.tiers.underVisible < 0.02) return [];
  const out: TierMass[] = [];
  for (let t = 1; t < ctx.h.tiers.count; t++) {
    const pts = locks.filter((l) => (l.tier ?? 0) === t && l.layer === 'front' && (l.kind === 'lock' || l.kind === 'flow')).flatMap((l) => l.poly);
    const poly = radialEnvelope(pts, ctx.C);
    if (poly) out.push({ poly: ctx.guard.fit(poly), tier: t });
  }
  return out;
}

/**
 * Grosses masses (niveau d'épaisseur « mass ») : quelques mèches très larges de la coiffure, rendues en grands aplats
 * sous les mèches moyennes. `grow` donne la ligne médiane depuis la racine (même champ de direction que les autres mèches).
 */
export function massLocks(ctx: HairCtx, grow: (R: Vec) => Vec[]): HairLock[] {
  const n = Math.round(ctx.h.strands.mass * 8);
  const out: HairLock[] = [];
  for (let i = 0; i < n; i++) {
    const s = -1 + (2 * (i + ctx.rnd())) / n;
    const R = lerpV(ctx.hl.at(s), arcAt(ctx.arc, s), 0.55 + 0.45 * ctx.rnd());
    out.push(...lockFrom(ctx, grow(R), { width: ctx.lm.W * (0.1 + 0.08 * ctx.rnd()) * ctx.gain(s), rank: 'mass', tone: -(0.1 + 0.25 * ctx.rnd()), layer: 'front', sharp: 0.55, tier: tierOf(ctx), edgeFade: ctx.h.tips.edgeFade, flick: ctx.h.tips.flick, ragged: ctx.h.tips.irregular }));
  }
  return out;
}

/**
 * Poils très fins (niveau « hairline ») : de simples traits qui suivent la direction d'une mèche existante, décalés
 * latéralement de 0,3–0,9 largeur de mèche et démarrés entre la racine et le milieu. Rang `hairline`, translucides.
 */
export function hairlineStrands(ctx: HairCtx, parents: HairLock[]): HairLock[] {
  const n = Math.round(ctx.h.strands.hairline * 160);
  const pool = parents.filter((l) => l.spine && l.spine.length > 8 && l.layer !== 'over' && l.rank !== 'plait' && l.rank !== 'hairline');
  if (n === 0 || pool.length === 0) return [];
  const out: HairLock[] = [];
  for (let i = 0; i < n; i++) {
    const par = pool[Math.floor(ctx.rnd() * pool.length)] as HairLock;
    const sp = par.spine as Vec[];
    const from = Math.floor(ctx.rnd() * sp.length * 0.5);
    const off = (ctx.rnd() < 0.5 ? -1 : 1) * (0.3 + 0.6 * ctx.rnd()) * (par.w0 ?? ctx.lm.W * 0.03);
    const c = sp.slice(from).map((q, k, a) => {
      // Normale locale au parent ; le trait s'écarte progressivement (diverge) au lieu de rester parallèle.
      const b = a[Math.min(a.length - 1, k + 1)] as Vec;
      const z = a[Math.max(0, k - 1)] as Vec;
      const l = Math.hypot(b.x - z.x, b.y - z.y) || 1;
      const g = off * (0.4 + 0.6 * (k / Math.max(1, a.length - 1)));
      return { x: q.x - ((b.y - z.y) / l) * g, y: q.y + ((b.x - z.x) / l) * g };
    });
    out.push(...lockFrom(ctx, c, { width: ctx.lm.W * (0.0014 + 0.0016 * ctx.rnd()), rank: 'hairline', tone: par.tone + (ctx.rnd() - 0.4) * 0.5, layer: par.layer === 'back' ? 'back' : 'front', sharp: 1, raw: true, kind: 'lock', tier: par.tier, fade: 0.55 }));
  }
  return out;
}

export { growLock, lockLen };

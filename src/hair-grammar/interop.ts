import type { HairLock, HairLockGeom, HairLockRing, LockKind, LockRank } from '../face/hair/types';
import { bladeOutline, type Blade } from './blade';
import type { HeadSpec } from './head';
import type { LockGeom } from './local-geometry';
import type { PaintedLock } from './paint';
import type { RingBands } from './spec-ring';
import type { V2 } from './vec';

/**
 * CONTRAT D'INTEROPÉRABILITÉ entre les deux moteurs capillaires.
 *   - moteur PRINCIPAL (`src/face/hair`, `src/render/face/hair-*`) : `HairLock` = polygone + rang + ton + calque + ligne médiane ;
 *   - moteur de GRAMMAIRE (`src/hair-grammar`) : `LockSpec` 3D → `Blade` 2D → SVG.
 * Le pont n'est pas « les deux savent se rendre » mais un contrat vérifiable : `grammarToHairLocks` produit, pour chaque mèche peinte,
 * un `HairLock` qui respecte les INVARIANTS ci-dessous (`checkHairLockContract`), dans le repère du visage du moteur principal
 * (similitude calée sur les deux yeux : `frameFromEyes`). Sens inverse FAIT : `HairLock.geom` est lu par `celBands`/`lockMarkup`/`hairGloss` (docs/HAIR-GEOM-BRIDGE.md).
 *
 * Invariants : polygone fermé de ≥ 8 points tous finis, aire > 0 ; ton ∈ [−1, 1] ; ligne médiane de ≥ 4 points, première = racine ;
 * largeur racine `w0` > 0 ; rang cohérent avec la largeur relative ; étage `tier` ∈ [0, 3] ; calque ∈ {front, back, over} ;
 * contour (`edge`) réservé aux rangs mass/main ; `geom` (si présent) : tableaux alignés sur la ligne médiane, largeurs ≥ 0 (la pointe est nulle), occlusion ∈ [0, 1].
 */
export interface Frame { readonly k: number; readonly cos: number; readonly sin: number; readonly tx: number; readonly ty: number }

/** Similitude (échelle + rotation + translation) qui envoie les yeux de la grammaire (gR, gL) sur ceux du moteur principal (mR, mL). */
export function frameFromEyes(gR: V2, gL: V2, mR: V2, mL: V2): Frame {
  const gx = gL.x - gR.x; const gy = gL.y - gR.y; const mx = mL.x - mR.x; const my = mL.y - mR.y; const k = Math.hypot(mx, my) / Math.max(1e-9, Math.hypot(gx, gy));
  const a = Math.atan2(my, mx) - Math.atan2(gy, gx); const cos = Math.cos(a); const sin = Math.sin(a);
  return { k, cos, sin, tx: mR.x - k * (cos * gR.x - sin * gR.y), ty: mR.y - k * (sin * gR.x + cos * gR.y) };
}
export const applyFrame = (f: Frame, p: V2): V2 => ({ x: f.k * (f.cos * p.x - f.sin * p.y) + f.tx, y: f.k * (f.sin * p.x + f.cos * p.y) + f.ty });

const area = (p: readonly V2[]): number => { let a = 0; for (let i = 0; i < p.length; i++) { const u = p[i] as V2; const v = p[(i + 1) % p.length] as V2; a += u.x * v.y - v.x * u.y; } return Math.abs(a) / 2; };
const KIND: Record<string, LockKind> = { fringe: 'fringe', nearSide: 'cheek', farSide: 'lock', sweep: 'flow', mass: 'lock' };

/** Rang d'épaisseur du moteur principal d'après la largeur maximale de la lame relative à la largeur de tête (en unités image). */
export function rankOf(b: Blade, headW: number): LockRank { const w = 2 * Math.max(...b.half) / headW; return w >= 0.3 ? 'mass' : w >= 0.13 ? 'main' : w >= 0.05 ? 'fine' : 'hairline'; }

export interface InteropOpts { readonly frame: Frame; readonly head: HeadSpec; readonly headW: number }
/** Mèche peinte, éventuellement accompagnée de sa géométrie locale (`paintLockPro` → `ProLock`) : si elle y est, elle passe dans la `HairLock`. */
export type PaintedWithGeom = PaintedLock & { readonly geom?: LockGeom; readonly ring?: RingBands };

/** Reflet transversal → `HairLockRing` dans le repère du moteur principal : points par la similitude, poids et force inchangés (sans unité). */
export function toHairLockRing(r: RingBands, f: Frame): HairLockRing {
  const p = (q: V2): V2 => applyFrame(f, q);
  return { highlight: r.highlight.map(p), strength: r.strength, shade: r.shade.map((s) => ({ poly: s.poly.map(p), from: p(s.from), to: p(s.to), w0: s.w0, w1: s.w1 })) };
}

/**
 * Géométrie locale du moteur de grammaire → `HairLockGeom` du moteur principal, dans son repère (largeur × échelle k de la similitude ; le reste est sans unité).
 * `ring` (+ la similitude complète, car les points tournent et se translatent) : le reflet transversal retenu par la garde de rendu, s'il y en a un.
 */
export function toHairLockGeom(g: LockGeom, k: number, ring?: { readonly bands: RingBands; readonly frame: Frame }): HairLockGeom {
  return { width: g.width.map((w) => w * k), twist: [...g.twist], backface: [...g.backface], occlusion: [...g.occlusion], exposure: [...g.exposure], ...(ring ? { ring: toHairLockRing(ring.bands, ring.frame) } : {}) };
}

export function grammarToHairLocks(painted: readonly PaintedWithGeom[], o: InteropOpts): HairLock[] {
  const lens = painted.map((p) => Math.hypot((p.blade.spine.at(-1) as V2).x - (p.blade.spine[0] as V2).x, (p.blade.spine.at(-1) as V2).y - (p.blade.spine[0] as V2).y));
  const order = [...lens].sort((a, b) => b - a);
  return painted.map((p, i): HairLock => {
    const rank = rankOf(p.blade, o.headW); const tier = Math.min(3, Math.floor((order.indexOf(lens[i] as number) / Math.max(1, order.length)) * 4));
    const poly = bladeOutline(p.blade).map((q) => applyFrame(o.frame, q)); const spine = p.blade.spine.map((q) => applyFrame(o.frame, q));
    return {
      poly, rank, tone: Math.max(-1, Math.min(1, p.spec.tone)), layer: p.layer, edge: rank === 'mass' || rank === 'main', kind: KIND[p.spec.family] ?? 'lock',
      spine, w0: 2 * (p.blade.half[Math.round(p.blade.half.length * 0.4)] as number) * o.frame.k, profile: 'ribbon', tier,
      ...(p.geom ? { geom: toHairLockGeom(p.geom, o.frame.k, p.ring ? { bands: p.ring, frame: o.frame } : undefined) } : {}),
      ...(p.spec.root.el > 60 ? { zone: 'top' as const } : {}),
    };
  });
}

export interface ContractIssue { readonly index: number; readonly rule: string }
export function checkHairLockContract(locks: readonly HairLock[], headW: number): ContractIssue[] {
  const out: ContractIssue[] = [];
  locks.forEach((l, index) => {
    const bad = (rule: string): void => { out.push({ index, rule }); };
    if (l.poly.length < 8 || l.poly.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) bad('poly: ≥ 8 points finis');
    else if (area(l.poly) <= 1e-6) bad('poly: aire > 0');
    if (!(l.tone >= -1 && l.tone <= 1)) bad('tone ∈ [−1, 1]');
    if (!l.spine || l.spine.length < 4) bad('spine ≥ 4 points'); else if (l.poly.length && Math.hypot(l.spine[0]!.x - l.poly[0]!.x, l.spine[0]!.y - l.poly[0]!.y) > headW) bad('spine[0] près de la racine');
    if (!(l.w0 !== undefined && l.w0 > 0)) bad('w0 > 0');
    if (l.tier === undefined || l.tier < 0 || l.tier > 3) bad('tier ∈ [0, 3]');
    if (l.edge && (l.rank === 'fine' || l.rank === 'hairline')) bad('edge réservé à mass/main');
    if (!['front', 'back', 'over'].includes(l.layer)) bad('layer valide');
    if (l.geom) {
      const g = l.geom; const n = l.spine?.length ?? 0;
      if (g.width.length !== n || g.twist.length !== n || g.backface.length !== n || g.occlusion.length !== n) bad('geom : tableaux alignés sur la spine');
      // Une pointe se termine à largeur NULLE (profil effilé) : on exige des largeurs finies ≥ 0 dont une au moins > 0, pas partout > 0.
      else if (g.width.some((w) => !(w >= 0) || !Number.isFinite(w)) || !g.width.some((w) => w > 0) || g.twist.some((t) => !Number.isFinite(t)) || g.occlusion.some((o) => !(o >= 0 && o <= 1))) bad('geom : largeurs finies ≥ 0 (une > 0), torsion finie, occlusion ∈ [0, 1]');
      if (g.ring) {
        const r = g.ring; const pts = [...r.highlight, ...r.shade.flatMap((s) => [...s.poly, s.from, s.to])];
        if (r.highlight.length < 4 || pts.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)) || !(r.strength >= 0 && r.strength <= 1)) bad('ring : bande ≥ 4 points finis, force ∈ [0, 1]');
        else if (r.shade.some((s) => !(s.w0 >= 0 && s.w0 <= 1 && s.w1 >= 0 && s.w1 <= 1) || s.w1 > s.w0 + 1e-9) || r.shade.some((s, j) => j > 0 && (Math.hypot((r.shade[j - 1] as { to: V2 }).to.x - s.from.x, (r.shade[j - 1] as { to: V2 }).to.y - s.from.y) > 1e-6 || Math.abs((r.shade[j - 1] as { w1: number }).w1 - s.w0) > 1e-9))) bad('ring : ombre aux poids ∈ [0, 1], non croissants, segments raccordés');
      }
    }
  });
  return out;
}

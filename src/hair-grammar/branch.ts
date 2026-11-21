import type { CurveSegment } from './curve-program';
import { emergeFrom, emergenceContinuity, tangentAt, type EmergeOpts } from './emerge';
import type { HairProfile } from './grammar';
import type { HeadSpec } from './head';
import { walk, type LockSpec } from './lock';
import { clamp, prng, sub, type V3 } from './vec';

/**
 * RAMIFICATION — une mèche n'est pas toujours une lame isolée : elle peut SE SÉPARER (fourche), en REJOINDRE une autre, S'ENROULER (boucle) ou
 * s'effiler en POINTES LIBRES. Tout repose sur ce qui existe déjà : `emergeFrom` (racine exacte sur la mère, cap de la mère, détachement progressif) et
 * le programme de courbes (`loop` est un segment de plus). Aucun nouveau chemin de rendu : les filles sont des mèches ordinaires, donc vérifiées
 * (`geom.emerge`, `geom.self`), réparées, ordonnées (`occlusion.ts`) et peintes comme les autres.
 *   splitLock  : la mère s'arrête à t, `ways` branches (2 ou 3) naissent de sa pointe et s'écartent d'un éventail `spread` ;
 *   joinLocks  : une fille naît de A en `ta` et SA POINTE ATTEINT B en `tb` (longueur et courbure résolues, écart mesuré) ;
 *   loopLock   : un enroulement de `turns` tours inséré dans le programme, rayon et position donnés ;
 *   fray       : `n` fines mèches échelonnées sur la fin de la mèche (pointes libres), qui s'en détachent à tour de rôle.
 */
/** Seuils de jonction (ceux de `compose-verify.ts` : écart 0,01 H, angle 12°, largeur ≤ 0,5). */
export const JOIN_OK = { gap: 0.01, angle: 12, width: 0.5 } as const;
const passes = (h: HeadSpec, parent: LockSpec, c: LockSpec): boolean => { const k = emergenceContinuity(h, parent, c); return k.gap <= JOIN_OK.gap && k.angleDeg <= JOIN_OK.angle && k.widthRatio <= JOIN_OK.width; };

/**
 * Émergence VÉRIFIÉE : essaie `t`, puis des positions de plus en plus proches de la racine de la mère (pas de 0,04, jusqu'à 0,3), et garde la première qui
 * passe les seuils de jonction. Dans un creux de la coque (nuque, mâchoire) le décollement effectif de la fille peut être retiré dès la racine et la jonction
 * ouvre un écart : une autre position règle le problème sans rien tordre. `null` si aucune ne passe (la fille n'est alors pas posée).
 */
export function emergeChecked(h: HeadSpec, parent: LockSpec, child: LockSpec, o: EmergeOpts): LockSpec | null {
  for (let t = o.t; t >= 0.3; t -= 0.04) { const c = emergeFrom(h, parent, child, { ...o, t }); if (passes(h, parent, c)) return c; }
  return null;
}

export interface SplitOpts { readonly t: number; readonly ways?: 2 | 3; /** Éventail total (rad). */ readonly spread?: number; readonly follow?: number }
export interface Split { readonly trunk: LockSpec; readonly branches: LockSpec[] }

export function splitLock(h: HeadSpec, L: LockSpec, o: SplitOpts): Split {
  const ways = o.ways ?? 2; const spread = o.spread ?? 0.9; const t = clamp(o.t, 0.3, 0.85);
  // Le tronc s'arrête juste après la fourche, sans s'effiler à zéro : les branches naissent de sa pointe encore large.
  const trunk: LockSpec = { ...L, length: L.length * (t + 0.05), taper: Math.min(L.taper, 0.55), peak: Math.max(L.peak, 0.45) };
  const share = ways === 2 ? 0.66 : 0.52;
  const mk = (k: number): LockSpec => {
    const o2 = (k / (ways - 1)) * 2 - 1;
    return { ...L, id: `${L.id}-b${k}`, width: L.width * share, length: L.length * (1 - t) * 1.1, peak: 0.3, strands: Math.max(1, L.strands - 1), tone: clamp(L.tone + o2 * 0.12, -1, 1), bend: 0, flick: { ...L.flick, amt: L.flick.amt * 0.6 }, wave: { ...L.wave, amp: L.wave.amp * 0.5 } };
  };
  // Point de fourche sur le tronc : le plus proche de la pointe où TOUTES les branches passent les seuils ; à défaut, celles qui passent au meilleur point.
  let best: LockSpec[] = [];
  for (const tf of [0.9, 0.84, 0.78, 0.72, 0.66]) {
    const got = Array.from({ length: ways }, (_, k) => { const c = emergeFrom(h, trunk, mk(k), { t: tf, peel: ((k / (ways - 1)) * 2 - 1) * spread / 2, follow: o.follow ?? 0.5 }); return passes(h, trunk, c) ? c : null; }).filter((c): c is LockSpec => c !== null);
    if (got.length > best.length) best = got; if (got.length === ways) break;
  }
  return best.length >= 2 ? { trunk, branches: best } : { trunk: L, branches: [] };
}

export interface FrayOpts { readonly from?: number; readonly n?: number; readonly spread?: number }

/** Pointes libres : `n` mèches fines et courtes qui se détachent de la fin de `L`, à des positions échelonnées, de côtés alternés. */
export function fray(h: HeadSpec, L: LockSpec, o: FrayOpts = {}): LockSpec[] {
  const n = clamp(Math.round(o.n ?? 3), 1, 6); const from = clamp(o.from ?? 0.7, 0.4, 0.9); const spread = o.spread ?? 0.35;
  // Une pointe libre est un BRIN FIN qui prolonge le fil de la mèche en s'en écartant à peine (≤ 20°), plus long que large (rapport ≥ 15), à pointe effilée :
  // des angles de détachement plus grands et des lames courtes et larges donnaient des « fers de lance » (vu sur les planches, d'où ces bornes).
  return Array.from({ length: n }, (_, k): LockSpec | null => {
    const t = from + ((0.94 - from) * (k + 0.5)) / n; const sg = k % 2 === 0 ? 1 : -1; const f = 0.45 + 0.55 * ((k + 1) / n);
    const child: LockSpec = { ...L, id: `${L.id}-f${k}`, width: L.width * 0.16, length: L.length * (0.28 + 0.07 * ((k * 5) % 3)), peak: 0.4, taper: 1.6, strands: 0, tone: clamp(L.tone + 0.3, -1, 1), bend: 0, flick: { amt: 0, len: 0.2 }, wave: { amp: 0, freq: 1, phase: 0 }, gravity: Math.min(1, L.gravity + 0.1) };
    return emergeChecked(h, L, child, { t, peel: sg * spread * f, follow: 0.45 });
  }).filter((c): c is LockSpec => c !== null);
}

/** Programme d'une mèche avec un enroulement : courbure d'ensemble de `L`, puis boucle (rayon en H, position `at` 0–1, `turns` tours), puis la suite de la courbure. */
export function loopProgram(L: LockSpec, o: { readonly at: number; readonly radius: number; readonly turns?: number; readonly dir?: 1 | -1 }): CurveSegment[] {
  const turns = o.turns ?? 1; const at = clamp(o.at, 0.1, 0.8);
  // Rayon minimal d'un smoothstep : Ls/(3π·turns) → Ls = 3π·turns·r.
  const f = clamp((3 * Math.PI * turns * o.radius) / Math.max(1e-6, L.length), 0.08, 0.9 - at);
  const rest = Math.max(0.05, 1 - at - f);
  return [{ kind: 'arc', len: at, angle: L.bend * at }, { kind: 'loop', len: f, turns, dir: o.dir ?? 1 }, { kind: 'arc', len: rest, angle: L.bend * rest }];
}
export const loopLock = (L: LockSpec, o: { readonly at: number; readonly radius: number; readonly turns?: number; readonly dir?: 1 | -1 }): LockSpec => ({ ...L, program: loopProgram(L, o) });

/** Écart 3D (unités H) entre la pointe de `child` et le point de `target` à la position `t`. */
export function joinGap(h: HeadSpec, child: LockSpec, target: LockSpec, t: number): number {
  const tip = walk(h, child, 28).at(-1)?.p; const T = tangentAt(h, target, t).p;
  return tip ? Math.hypot(tip.x - T.x, tip.y - T.y, tip.z - T.z) : Infinity;
}

/**
 * Une fille de `a` (née en `ta`) dont la pointe atteint `b` en `tb`. Deux inconnues — longueur et angle de détachement — résolues par une grille
 * grossière puis une recherche par motifs à pas décroissants (le décollement de la pointe est celui de `b`, donc la pointe arrive à la bonne altitude).
 */
export function joinLocks(h: HeadSpec, a: LockSpec, ta: number, b: LockSpec, tb: number, template: Partial<LockSpec> = {}): LockSpec {
  const A = tangentAt(h, a, ta); const B = tangentAt(h, b, tb); const d = Math.hypot(B.p.x - A.p.x, B.p.y - A.p.y, B.p.z - A.p.z);
  const base: LockSpec = { ...a, id: template.id ?? `${a.id}-j${b.id}`, width: a.width * 0.35, peak: 0.45, taper: 0.7, strands: 0, bend: 0, flick: { amt: 0, len: 0.2 }, wave: { amp: 0, freq: 1, phase: 0 }, ...template };
  const make = (len: number, peel: number): LockSpec => ({ ...emergeFrom(h, a, { ...base, length: len }, { t: ta, peel, follow: 0.3 }), lift1: Math.max(0.01, B.off), join: { id: b.id, t: tb } });
  const cost = (len: number, peel: number): number => joinGap(h, make(len, peel), b, tb);
  let best = { len: d * 1.2, peel: 0, c: Infinity };
  for (let i = 0; i <= 24; i++) for (let j = 0; j <= 8; j++) { const peel = -2.4 + (4.8 * i) / 24; const len = d * (0.8 + (1.4 * j) / 8); const c = cost(len, peel); if (c < best.c) best = { len, peel, c }; }
  for (let step = 0.2, ls = 0.2 * d; step > 0.002; step *= 0.5, ls *= 0.5) for (let it = 0; it < 3; it++) for (const [dl, dp] of [[ls, 0], [-ls, 0], [0, step], [0, -step], [ls, step], [-ls, -step], [ls, -step], [-ls, step]] as const) { const len = Math.max(0.05, best.len + dl); const peel = best.peel + dp; const c = cost(len, peel); if (c < best.c) best = { len, peel, c }; }
  return make(best.len, best.peel);
}

export interface BranchSpec {
  readonly split?: { readonly prob: number; readonly ways?: 2 | 3; readonly t?: readonly [number, number]; readonly spread?: number };
  readonly fray?: { readonly prob: number; readonly n?: readonly [number, number]; readonly from?: number };
  readonly loop?: { readonly prob: number; readonly radius?: readonly [number, number]; readonly at?: readonly [number, number]; readonly turns?: number };
  /** Familles concernées (défaut : toutes sauf `back`). */
  readonly families?: readonly string[];
}

/** Dernière passe du générateur : applique la ramification aux mèches RACINES (ni filles, ni programmées), de façon déterministe. */
export function branchHair(P: HairProfile, specs: readonly LockSpec[], B: BranchSpec, seed = 1): LockSpec[] {
  const g = prng(seed * 6151 + 29); const out: LockSpec[] = []; const extra: LockSpec[] = [];
  const mix = (r: readonly [number, number] | undefined, d: readonly [number, number]): number => { const x = r ?? d; return x[0] + (x[1] - x[0]) * g(); };
  for (const L of specs) {
    const eligible = !L.parent && !L.program && !L.weave && L.layer !== 'back' && L.length >= 0.3 && (B.families ? B.families.includes(L.family) : true);
    // Un seul tirage par mèche (déterminisme indépendant des autres choix) : fourche, boucle ou pointes libres, jamais deux à la fois.
    const u = g();
    const ps = B.split?.prob ?? 0; const pl = B.loop?.prob ?? 0; const pf = B.fray?.prob ?? 0;
    if (!eligible) { out.push(L); continue; }
    if (u < ps) { const s = splitLock(P.head, L, { t: mix(B.split?.t, [0.45, 0.7]), ways: B.split?.ways ?? 2, spread: B.split?.spread ?? 0.9 }); out.push(s.trunk); extra.push(...s.branches); }
    else if (u < ps + pl) out.push(loopLock(L, { at: mix(B.loop?.at, [0.3, 0.55]), radius: mix(B.loop?.radius, [0.03, 0.05]), turns: B.loop?.turns ?? 1, dir: g() < 0.5 ? 1 : -1 }));
    else if (u < ps + pl + pf) { out.push(L); extra.push(...fray(P.head, L, { n: Math.round(mix(B.fray?.n, [2, 4])), from: B.fray?.from ?? 0.7 })); }
    else out.push(L);
  }
  return [...out, ...extra];
}

/** Direction de la jonction pour les vérifications : vecteur de B vers la pointe de `child` (unités H). */
export const joinOffset = (h: HeadSpec, child: LockSpec, target: LockSpec, t: number): V3 => sub(walk(h, child, 28).at(-1)?.p as V3, tangentAt(h, target, t).p);

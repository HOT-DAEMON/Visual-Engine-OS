import { clamp } from '../../core/math';
import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams, HairStyle, HairTexture } from '../../schema';
import type { FaceLandmarks } from '../landmarks';
import type { Poly } from '../poly';
import type { HairBoundary } from './boundary/types';
import type { Guard } from './guard';
import type { Hairline } from './hairline';
import { rot, smoothstep, sub, unit } from './noise';
import { conformReach, cutSpine, reachOk, type ReachMode } from './reach';
import { cone, plait, ribbon } from './ribbon';
import { flickTip, raggedTip } from './tips';
import { displace, resample, samplesFor, textureSpec, type TexSpec } from './texture';
import type { HairLock, LockKind, LockRank } from './types';

/**
 * Définition d'une coiffure = champ de direction + longueur + largeur. `radial/sweep/back` pondèrent trois
 * directions locales (radiale depuis le crâne, balayée loin de la raie, tirée vers l'arrière) ; `gravity`
 * courbe la mèche vers le bas. Longueurs en fraction de H, largeurs en fraction de W.
 */
export interface StyleDef {
  readonly radial: number;
  readonly sweep: number;
  readonly back: number;
  readonly gravity: number;
  readonly len: readonly [number, number];
  readonly jitter: number;
  readonly off: readonly [number, number];
  readonly mainW: readonly [number, number];
  readonly sharp: number;
  readonly hang?: boolean;
}

export const STYLES: Record<Exclude<HairStyle, 'bald'>, StyleDef> = {
  buzz: { radial: 1, sweep: 0, back: 0, gravity: 0, len: [0.012, 0], jitter: 0.1, off: [0.004, 0], mainW: [0.01, 0], sharp: 0.2 },
  short: { radial: 0.4, sweep: 0.6, back: 0.3, gravity: 0.12, len: [0.07, 0.06], jitter: 0.25, off: [0.01, 0.02], mainW: [0.026, 0.012], sharp: 0.6 },
  spiky: { radial: 1, sweep: 0, back: 0.7, gravity: 0, len: [0.07, 0.07], jitter: 0.4, off: [0.008, 0.02], mainW: [0.03, 0.016], sharp: 1 },
  curly: { radial: 0.8, sweep: 0.3, back: 0.1, gravity: 0.25, len: [0.15, 0.12], jitter: 0.35, off: [0.05, 0.08], mainW: [0.04, 0.02], sharp: 0.4 },
  afro: { radial: 1, sweep: 0, back: 0.15, gravity: 0.04, len: [0.22, 0.2], jitter: 0.55, off: [0.1, 0.15], mainW: [0.05, 0.025], sharp: 0.2 },
  bob: { radial: 0.9, sweep: 0.35, back: 0, gravity: 1.5, len: [0.3, 0.1], jitter: 0.12, off: [0.018, 0.03], mainW: [0.034, 0.014], sharp: 0.5, hang: true },
  long: { radial: 0.9, sweep: 0.35, back: 0, gravity: 1.2, len: [0.5, 0.3], jitter: 0.12, off: [0.018, 0.03], mainW: [0.034, 0.014], sharp: 0.5, hang: true },
  ponytail: { radial: 0.3, sweep: 0.2, back: 0.9, gravity: 0, len: [0.1, 0.05], jitter: 0.18, off: [0.008, 0.02], mainW: [0.026, 0.012], sharp: 0.6 },
  bun: { radial: 0.3, sweep: 0.2, back: 0.9, gravity: 0, len: [0.1, 0.05], jitter: 0.18, off: [0.008, 0.02], mainW: [0.026, 0.012], sharp: 0.6 },
  braids: { radial: 0.2, sweep: 0.8, back: 0.4, gravity: 0.1, len: [0.09, 0.05], jitter: 0.18, off: [0.008, 0.02], mainW: [0.026, 0.012], sharp: 0.6 },
};

/** Contexte partagé par tous les générateurs de mèches d'une chevelure. */
export interface HairCtx {
  readonly h: FaceParams['hair'];
  readonly lm: FaceLandmarks;
  readonly hl: Hairline;
  /** Lisière complète (front, pattes, oreilles, nuque) : l'implantation `hl` en est le tronçon `front`. */
  readonly boundary: HairBoundary;
  readonly arc: Vec[];
  readonly guard: Guard;
  readonly rnd: () => number;
  readonly nz: (x: number) => number;
  readonly tex: HairTexture;
  readonly spec: TexSpec;
  readonly def: StyleDef;
  /** Centre des directions radiales et abscisse de la raie. */
  readonly C: Vec;
  readonly partX: number;
  /** Gain d'enveloppe à l'abscisse normalisée s ∈ [−1, 1] (asymétrie de silhouette) : 1 = neutre. */
  readonly gain: (s: number) => number;
  /** Gonflement de la masse (fraction de W) ajouté à l'enveloppe pour toutes les textures. */
  readonly puffW: number;
  /** Retombée des racines relevées à la raie : (R) → { dir ajustée, gravité ajoutée }. */
  readonly lift: (R: Vec, dir: Vec) => { dir: Vec; gravity: number };
}

/** Direction initiale locale à la racine R : mélange radial / balayage loin de la raie / vers l'arrière, + jitter. */
export function initialDir(ctx: HairCtx, R: Vec): Vec {
  const { def, C, partX } = ctx;
  const sg = R.x - partX < 0 ? -1 : 1;
  const rad = unit(sub(R, C));
  const v = {
    x: rad.x * def.radial + sg * def.sweep + sg * 0.2 * def.back,
    y: rad.y * def.radial + 0.35 * def.sweep - def.back,
  };
  const base = rot(unit(v), (ctx.rnd() - 0.5) * 2 * def.jitter);
  return ctx.lift(R, base).dir;
}

/** Longueur cible d'une mèche (px) : style, volume/longueur, variation d'une mèche à l'autre, rétrécissement par la texture. */
export function lockLen(ctx: HairCtx, fine: boolean): number {
  const { h, def, lm } = ctx;
  const grow = def.hang ? h.length : h.volume;
  const base = (def.len[0] + def.len[1] * grow) * lm.H * (1 + ctx.puffW * 4);
  return base * (1 + (ctx.rnd() - 0.5) * h.lengthVariance * 1.4) * (fine ? 0.85 : 1) * ctx.spec.shrink;
}

/**
 * RETOMBÉE des coiffures pendantes (`docs/HAIR-EDGE.md`) : sans elle, les mèches tombaient en parallèles verticales de longueur quasi égale, d'où une
 * silhouette en RECTANGLE arrondi. Trois effets mesurés sur des références de cheveux longs :
 *  - `rise`  : l'ourlet REMONTE vers l'extérieur (les mèches de côté sont plus courtes que celles du centre : bas en U, pas en bande) ;
 *  - `conv`  : la chevelure CONVERGE vers le cou sous la mâchoire (part de |x| rentrée à la pointe, progressive) ;
 *  - `amp`   : ONDULATION lente et COHÉRENTE (même phase pour toutes les mèches : la nappe ondule d'un bloc), nulle à la mâchoire, pleine plus bas.
 */
export const FALL = {
  long: { rise: 0.3, conv: 0.16, amp: 0.03, lambda: 0.62 },
  bob: { rise: 0.12, conv: 0.09, amp: 0.008, lambda: 0.5 },
} as const;

/** Ordonnée d'arrêt d'une mèche pendante après remontée de l'ourlet vers l'extérieur (identité hors coiffure pendante). */
export function fallEnd(ctx: HairCtx, rootX: number, yEnd: number): number {
  const F = FALL[ctx.h.style as keyof typeof FALL];
  if (!F || !ctx.def.hang || yEnd <= ctx.lm.jawY) return yEnd;
  const out = smoothstep(clamp((Math.abs(rootX) / (ctx.lm.W / 2) - 0.45) / 0.7, 0, 1));
  return ctx.lm.jawY + (yEnd - ctx.lm.jawY) * (1 - F.rise * out);
}

/** Convergence vers le cou et ondulation cohérente de la ligne médiane, sous la mâchoire (identité hors coiffure pendante). */
export function fallWarp(ctx: HairCtx, pts: Vec[], yEnd: number): Vec[] {
  const F = FALL[ctx.h.style as keyof typeof FALL];
  const { jawY, W, H } = ctx.lm;
  if (!F || !ctx.def.hang || yEnd <= jawY) return pts;
  const phase = ((ctx.h.seed * 2654435761) >>> 0) / 4294967296 * 6.2832;
  return pts.map((q) => {
    if (q.y <= jawY) return q;
    const u = clamp((q.y - jawY) / (yEnd - jawY), 0, 1);
    const wave = F.amp * W * smoothstep(clamp((q.y - jawY) / (0.12 * H), 0, 1)) * Math.sin((2 * Math.PI * (q.y - jawY)) / (F.lambda * H) + phase);
    return { x: q.x - Math.sign(q.x) * Math.abs(q.x) * F.conv * u ** 1.4 + wave, y: q.y };
  });
}

/** Ligne médiane : intégration pas à pas de la direction avec courbure de gravité ; arrêt à `yEnd` pour les mèches pendantes. */
export function growLock(ctx: HairCtx, R: Vec, len: number, opts: { dir?: Vec; yEnd?: number; gravity?: number } = {}): Vec[] {
  const { H } = ctx.lm;
  let dir = opts.dir ?? initialDir(ctx, R);
  const g = (opts.gravity ?? ctx.def.gravity) + ctx.lift(R, dir).gravity;
  const yEnd = opts.yEnd === undefined ? undefined : fallEnd(ctx, R.x, opts.yEnd);
  const n = opts.yEnd === undefined ? 16 : clamp(Math.ceil(len / (0.02 * H)), 16, 90);
  const ds = len / n;
  const pts: Vec[] = [R];
  let pos = R;
  for (let i = 0; i < n; i++) {
    dir = unit({ x: dir.x, y: dir.y + (g * ds) / (0.08 * H) });
    pos = { x: pos.x + dir.x * ds, y: pos.y + dir.y * ds };
    pts.push(pos);
    if (yEnd !== undefined && pos.y >= yEnd && dir.y > 0.2) break;
  }
  return yEnd === undefined ? pts : fallWarp(ctx, pts, yEnd);
}

/** Courbe de R vers E (mèches ramenées vers une attache) : tangente de départ = direction locale. */
export function capTo(ctx: HairCtx, R: Vec, E: Vec): Vec[] {
  const d = Math.hypot(E.x - R.x, E.y - R.y) || 1;
  const d0 = initialDir(ctx, R);
  const u = unit(sub(E, R));
  const P1 = { x: R.x + d0.x * 0.4 * d, y: R.y + d0.y * 0.4 * d };
  const P2 = { x: E.x - u.x * 0.3 * d, y: E.y - u.y * 0.3 * d - 0.1 * d };
  return Array.from({ length: 13 }, (_, i) => {
    const t = i / 12;
    const w = [(1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t ** 3];
    return { x: w[0]! * R.x + w[1]! * P1.x + w[2]! * P2.x + w[3]! * E.x, y: w[0]! * R.y + w[1]! * P1.y + w[2]! * P2.y + w[3]! * E.y };
  });
}

export interface LockOpts {
  readonly width: number;
  readonly rank: LockRank;
  readonly tone: number;
  readonly layer: 'front' | 'back' | 'over';
  readonly sharp?: number;
  /** Mode du garde-fou (mèches avant) ; ignoré à l'arrière (cachées par la tête). */
  readonly mode?: 'cap' | 'fringe' | 'cheek';
  /** Pas de texture (ligne déjà finale : frange, bord de chignon, grande mèche en S). */
  readonly raw?: boolean;
  /** Forme / rôle, étage, fondus (voir `HairLock`). */
  readonly kind?: LockKind;
  readonly tier?: number;
  readonly fade?: number;
  readonly edgeFade?: number;
  /** Profil `cone` : base épaisse, bords droits, pointe d'aiguille (`power` : concavité). */
  readonly profile?: 'ribbon' | 'cone';
  readonly power?: number;
  /** Texture de CETTE mèche (mélange de textures) ; défaut : celle de la coiffure. */
  readonly tex?: HairTexture;
  /** Pointe retroussée (0–1) vers l'extérieur de la tête (signe de l'abscisse de la racine). */
  readonly flick?: number;
  /** Pointe irrégulière (0–1). */
  readonly ragged?: number;
  /** Pas de garde-fou binaire : le drapé (cheveux simulés) a déjà résolu les contacts avec le visage. */
  readonly noGuard?: boolean;
  /** Largeur relative de la racine (0–1, défaut 0,8) : une racine étroite se fond sous la sous-couche au lieu de former un bout plat. */
  readonly root?: number;
  /** Borne de l'ENVELOPPE réelle (polygone) par la portée de la coiffure (`reach.ts`, `docs/HAIR-REACH-POLY.md`). Absent : non borné (queue, chignon, tresses, mèches simulées). */
  readonly reach?: ReachMode;
  /** Pièce d'une coiffure attachée (voir `HairLock.part`). */
  readonly part?: 'tail' | 'bun' | 'braid';
}

const lineLength = (c: Vec[]): number => c.reduce((a, p, i) => (i ? a + Math.hypot(p.x - (c[i - 1] as Vec).x, p.y - (c[i - 1] as Vec).y) : 0), 0);
/** Ligne raccourcie rééchantillonnée en Catmull-Rom (au moins `n` points) : quelques points ne font pas un coude à angle droit. */
const smoothSpine = (c: Vec[], n: number): Vec[] => {
  if (c.length >= n || c.length < 3) return c;
  const m = c.length - 1, out: Vec[] = [];
  const at = (i: number): Vec => c[Math.max(0, Math.min(m, i))] as Vec;
  for (let k = 0; k < n; k++) {
    const t = (k / (n - 1)) * m, i = Math.min(m - 1, Math.floor(t)), u = t - i;
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const f = (a: number, b: number, c2: number, d: number): number => 0.5 * (2 * b + (-a + c2) * u + (2 * a - 5 * b + 4 * c2 - d) * u * u + (-a + 3 * b - 3 * c2 + d) * u ** 3);
    out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
  }
  return out;
};
const samplesOf = (c: Vec[], sp: TexSpec): number => samplesFor(Math.hypot((c[c.length - 1] as Vec).x - (c[0] as Vec).x, (c[c.length - 1] as Vec).y - (c[0] as Vec).y) * 1.25, sp);

/**
 * Ligne médiane → mèche(s) : texture, pointe retroussée, ruban (ou cône, ou tresse en texture `braided`), pointe
 * irrégulière, puis garde-fou sur chaque sommet avant. Les champs `spine/w0/sharp/profile` décrivent le ruban
 * AVANT garde-fou : le rendu s'en sert pour le dégradé, les bandes cel et l'ombre portée (il rogne par le polygone final).
 */
export function lockFrom(ctx: HairCtx, centre: Vec[], o: LockOpts): HairLock[] {
  const tex = o.tex ?? ctx.tex;
  const spec = o.tex ? textureSpec(tex, ctx.h.curl, ctx.lm.W, ctx.lm.H) : ctx.spec;
  const wide = o.rank === 'main' || o.rank === 'mass' ? spec.wide : 1;
  // Côté de la mèche : un sommet repoussé hors de la zone du visage l'est de CE côté (pas du signe de sa propre abscisse). C'est le côté où la ligne médiane s'éloigne le plus de l'axe
  // (une mèche enracinée au sommet du crâne tombe d'un côté) ; ligne qui reste sur l'axe (|x| < 0,05 W) : pas d'indication.
  let sideX = 0;
  for (const q of centre) if (Math.abs(q.x) > Math.abs(sideX)) sideX = q.x;
  const rootSide: -1 | 1 | undefined = Math.abs(sideX) > 0.05 * ctx.lm.W ? (sideX < 0 ? -1 : 1) : undefined;
  const guardPoly = (poly: Poly): Poly => (o.layer === 'front' && !o.noGuard ? ctx.guard.fit(poly, o.mode ?? 'cap', rootSide) : poly);
  const meta = { kind: o.kind ?? ('lock' as LockKind), tier: o.tier ?? 0, fade: o.fade ?? 0, edgeFade: o.edgeFade ?? 0, ...(o.reach ? { bounded: true } : {}), ...(o.part ? { part: o.part } : {}) };
  if (tex === 'braided' && o.rank === 'main' && !o.raw) {
    let c = resample(centre, 36);
    // Tresse devant le visage : la ligne s'arrête à l'entrée de la zone interdite (sinon un segment à cheval sur la ligne médiane était écrasé de part et d'autre en bande qui traverse les yeux).
    if (o.layer === 'front' && !o.noGuard) {
      const clipped = ctx.guard.clip(c, o.mode ?? 'cap');
      if (clipped === null) return [];
      if (clipped !== c) c = resample(clipped, 36);
    }
    return plait(c, o.width * 0.9).segs.map((poly, i) => ({ poly: guardPoly(o.reach ? conformReach(ctx, c, poly, o.reach).poly : poly), rank: 'plait', tone: i % 2 === 0 ? o.tone : o.tone - 0.18, layer: o.layer, edge: true, ...meta }));
  }
  let c = o.raw ? centre : displace(resample(centre, samplesOf(centre, spec)), spec, ctx.rnd() * 6.283, ctx.nz);
  if (o.flick) c = flickTip(c, (c[0] as Vec).x < 0 ? -1 : 1, o.flick);
  // La ligne s'arrête à l'entrée de la zone interdite du visage : sinon le garde-fou écrase le ruban (large) en coin collé sur l'implantation (`docs/HAIR-EDGE.md`).
  let shortened = false;
  // Coiffure pendante : les mèches de corps (`main`/`fine`) qui tombent à travers la zone du visage sont DÉVIÉES sur le côté par le garde-fou (elles longent le visage), pas coupées.
  const drapes = ctx.def.hang && (o.rank === 'main' || o.rank === 'fine') && (o.kind ?? 'lock') === 'lock';
  if (o.layer === 'front' && !o.noGuard && !o.raw && o.kind !== 'cheek' && !drapes) {
    const before = c.length;
    const clipped = ctx.guard.clip(c, o.mode ?? 'cap');
    if (clipped === null) return [];
    shortened = clipped !== c && clipped.length !== before;
    c = shortened ? smoothSpine(clipped, 12) : clipped;
  }
  const w0 = o.width * wide;
  let sharp = o.sharp ?? ctx.def.sharp;
  // Axe borné APRÈS ondulation et retroussé de la pointe (ils le déplacent) : COUPÉ à la frontière de portée (pas de points empilés), la pointe se referme.
  let cut = false;
  if (o.reach) {
    const r = cutSpine(ctx, c, o.reach);
    if (r === null) return [];
    c = r.spine;
    cut = r.cut;
    if (cut && lineLength(c) < 0.012 * ctx.lm.H) return [];
    if (cut) sharp = Math.max(sharp, 0.7);
  }
  // Un ruban plus LARGE que long n'est pas une mèche mais un bloc : une ligne raccourcie (zone du visage, portée) ne porte que la largeur qu'elle peut tenir (longueur / 3) ;
  // sous 12 % de la largeur voulue, la mèche est abandonnée (`docs/HAIR-EDGE.md`).
  let wMax = Infinity;
  if (shortened || cut) {
    sharp = Math.max(sharp, 0.7);
    wMax = lineLength(c) / 3;
    if (wMax < 0.12 * w0) return [];
  }
  const ragSeed = o.ragged ? ctx.rnd() * 2 - 1 : 0;
  const build = (w: number, sh: number): Poly => {
    const q = o.profile === 'cone' ? cone(c, w, o.power ?? 1) : ribbon(c, w, sh, o.root);
    return o.ragged ? raggedTip(q, o.ragged, ragSeed, w * 1.1) : q;
  };
  let w = Math.min(w0, wMax);
  let poly = build(w, sharp);
  // Enveloppe trop large pour la portée : le MÊME ruban est reconstruit plus mince (pointe refermée) avant tout écrasement de sommets (`conformReach` ne sert plus que de filet).
  if (o.reach) {
    const ok = reachOk(ctx, o.reach);
    for (const k of [0.8, 0.64, 0.5, 0.4]) {
      if (poly.every(ok)) break;
      w = Math.min(w0, wMax) * k;
      sharp = Math.max(sharp, 0.75);
      poly = build(w, sharp);
    }
    poly = conformReach(ctx, c, poly, o.reach).poly;
  }
  return [{ poly: guardPoly(poly), rank: o.rank, tone: o.tone, layer: o.layer, edge: o.rank === 'main' || o.rank === 'mass', spine: c, w0: w, sharp, profile: o.profile ?? 'ribbon', power: o.power ?? 1, rootW: o.root, ...meta }];
}

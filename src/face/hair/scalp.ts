import { clamp } from '../../core/math';
import type { Vec } from '../../geometry/eye/primitives';
import { orient, type Poly } from '../poly';
import type { HairCtx } from './flow';
import { SHELL, capShell, type Reach } from './boundary/shell';
import type { WingInfo } from './boundary/wings';
import { arcAt } from './hairline';
import { resolveEar } from './sides';
import { liftBump } from './volume';
import { ribbon } from './ribbon';
import type { BareScalp } from './types';

/**
 * Sous-couche racine et cuir chevelu : la sous-couche est la COQUE de la chevelure (`boundary/shell.ts`) : son bord intérieur est la
 * lisière (implantation, pattes, arche de l'oreille), son bord extérieur le contour du crâne épaissi selon la coiffure et le volume,
 * qui descend sur les côtés jusqu'au-dessus de l'oreille. Les mèches sont dessinées PAR-DESSUS : c'est ce qui sépare le volume
 * capillaire du cuir chevelu.
 */
export function capBase(ctx: HairCtx): { base: Poly; scalp: Poly; wings: { left: WingInfo; right: WingInfo }; crown: number } {
  const { h, lm, hl, arc, guard, def } = ctx;
  const crown = (def.off[0] + def.off[1] * h.volume + ctx.puffW) * lm.W;
  const spec = SHELL[h.style as Exclude<typeof h.style, 'bald'>];
  // Archétype simulé avec masses de région : tempes et pattes viennent des masses, la coque garde seulement le dessus.
  const own = h.sim.enabled && h.sim.regions;
  // Oreille couverte : l'aile passe devant l'oreille ; sinon elle s'arrête au-dessus (jamais de couverture involontaire d'une oreille « libre »).
  const reachOf = (name: 'left' | 'right'): Reach => (own || !spec || spec.reach === 'none' ? 'none' : resolveEar(ctx, h.sides[name].ear) === 'covered' ? 'cover' : 'ear');
  const shell = capShell({ lm, boundary: ctx.boundary, crown, side: spec?.side ?? 1, reach: { left: reachOf('left'), right: reachOf('right') }, gain: ctx.gain, bump: (x) => liftBump(h, ctx.partX, lm.W, lm.H, x), C: ctx.C });
  const scalp = orient([...hl.pts, ...[...arc].reverse()]);
  const base = guard.fit(orient(shell.ring));
  const wings = { left: { reach: reachOf('left'), yEnd: shell.yEnd.left }, right: { reach: reachOf('right'), yEnd: shell.yEnd.right } };
  return { base, scalp, wings, crown };
}

const ellipse = (cx: number, cy: number, rx: number, ry: number): Poly => Array.from({ length: 28 }, (_, i) => ({ x: cx + rx * Math.cos((2 * Math.PI * i) / 28), y: cy + ry * Math.sin((2 * Math.PI * i) / 28) }));

/** Zones où le cuir chevelu se voit : raie (largeur `partWidth`) et plaques d'éclaircissement (front, sommet). */
export function bareScalp(ctx: HairCtx): BareScalp {
  const { h, lm, hl, partX } = ctx;
  const { W, H } = lm;
  const parted = ['short', 'curly', 'bob', 'long', 'ponytail', 'bun', 'braids'].includes(h.style);
  let part: Poly | null = null;
  if (parted && h.partWidth > 0.04) {
    const P0 = { x: partX, y: hl.yAt(partX) };
    const c: Vec[] = Array.from({ length: 12 }, (_, i) => {
      const u = i / 11;
      return { x: P0.x + (partX * 0.75 - P0.x) * u + Math.sin(Math.PI * u) * 0.015 * W * (ctx.nz(h.seed * 0.001) > 0 ? 1 : -1), y: P0.y + (-H / 2 + 0.01 * H - P0.y) * u };
    });
    part = ribbon(c, (0.004 + 0.016 * h.partWidth) * W * 2, 0, 1);
  }
  const t = h.thinning;
  const thin = t > 0.03 ? [ellipse(partX * 0.5, hl.yAt(0) - (0.03 + 0.05 * t) * H * 0.8, (0.1 + 0.16 * t) * W, (0.03 + 0.05 * t) * H), ellipse(partX * 0.3, -H / 2 + 0.12 * H, (0.08 + 0.12 * t) * W, (0.03 + 0.04 * t) * H)] : [];
  return { part, thin };
}

/** Une racine existe-t-elle ici ? Densité globale, éclaircissement (front + sommet), variation de zone à zone. */
export function keepRoot(ctx: HairCtx, s: number, t: number): boolean {
  const { h, nz } = ctx;
  let dens = 0.35 + 0.65 * h.density;
  const front = Math.max(0, 1 - t * 2.2) * (1 - Math.abs(s) ** 1.5);
  const crown = 0.9 * Math.exp(-(((t - 0.82) / 0.2) ** 2)) * (1 - Math.abs(s) * 0.6);
  dens *= 1 - h.thinning * 0.85 * (front + crown);
  dens *= 1 - h.densityVariance * 0.6 * ((nz(s * 3.1 + 11) + nz(t * 3.1 + 23)) / 4 + 0.5);
  return ctx.rnd() < clamp(dens, 0.05, 1);
}

/** Silhouette (profil extérieur par tranches) d'un ensemble de sommets : masse sombre derrière la tête (bob / long). */
export function envelope(points: Vec[], y0: number, y1: number, bins = 28): Poly | null {
  const prof: Vec[] = [];
  for (let i = 0; i < bins; i++) {
    const a = y0 + ((y1 - y0) * i) / bins;
    const b = y0 + ((y1 - y0) * (i + 1)) / bins;
    const xs = points.filter((q) => q.y >= a && q.y < b).map((q) => Math.abs(q.x));
    if (xs.length) prof.push({ x: Math.max(...xs), y: (a + b) / 2 });
  }
  if (prof.length < 3) return null;
  return orient([...prof, ...[...prof].reverse().map((q) => ({ x: -q.x, y: q.y }))]);
}

export { arcAt };

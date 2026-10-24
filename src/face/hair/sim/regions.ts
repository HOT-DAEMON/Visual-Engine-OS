import { clamp } from '../../../core/math';
import type { Vec } from '../../../geometry/eye/primitives';
import type { FaceLandmarks } from '../../landmarks';
import type { Poly } from '../../poly';
import { lockFrom, type HairCtx } from '../flow';
import { arcAt } from '../hairline';
import { smoothstep } from '../noise';
import type { HairLock } from '../types';
import type { Profile } from './profiles';

/**
 * MASSES DE RÉGION : tempes, pattes, mèches de joue, nuque, zones rasées. Chaque masse est une bande PLEINE le long du contour
 * du crâne (enfant du visage : tout dérive de `hw(y)` et des repères). Limites par zone (vérifiées par `verify/hair-zones.ts`) :
 *   tempe  : au plus 0,11 W vers l'intérieur, au-dessus de la bande des yeux ;
 *   yeux   : au plus 0,035 W (l'œil reste dégagé : bord externe à 0,045 W du contour) ;
 *   joue   : au plus 0,10 W vers l'intérieur, sous la bande des yeux, jusqu'à la mâchoire ;
 *   nuque  : derrière la tête et le cou, jamais devant.
 */
export const TEMPLE_MAX = 0.11;
export const EYE_BAND_MAX = 0.035;
export const CHEEK_MAX = 0.1;

export interface Region { readonly locks: HairLock[]; readonly shaved: Poly[] }

/** Profondeur maximale (fraction de W) d'une masse de côté à l'ordonnée y : 3 zones raccordées en douceur. */
export function depthLimit(lm: FaceLandmarks, y: number): number {
  const { H, eyeY } = lm;
  const toEye = smoothstep(clamp((y - (eyeY - 0.155 * H)) / (0.055 * H), 0, 1));
  const fromEye = smoothstep(clamp((y - (eyeY + 0.04 * H)) / (0.07 * H), 0, 1));
  return (TEMPLE_MAX + (EYE_BAND_MAX - TEMPLE_MAX) * toEye + (CHEEK_MAX - EYE_BAND_MAX) * fromEye) ;
}

/** Bande pleine entre le contour (décalé vers l'extérieur de `out`) et une ligne intérieure de profondeur `depth(y)`. */
function band(sg: number, ys: number[], hw: (y: number) => number, depth: (y: number) => number, out: number): Poly {
  const outer: Vec[] = ys.map((y) => ({ x: sg * (hw(y) + out), y }));
  const inner: Vec[] = ys.map((y) => ({ x: sg * (hw(y) - Math.max(0, depth(y))), y }));
  return [...outer, ...inner.reverse()];
}

const steps = (a: number, b: number, n: number): number[] => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

/** Étendue verticale de la bande tempe + patte : début, fin de la tempe, fin de la patte (source unique pour la construction ET la vérification). */
export function sideSpan(lm: FaceLandmarks, rg: Profile['region']): { y0: number; y1: number; yEnd: number } {
  const y0 = lm.hair.templeY - 0.02 * lm.H;
  const y1 = Math.min(lm.hair.templeY + rg.temple * lm.H, lm.eyeY + 0.02 * lm.H);
  const y2 = Math.min(y1 + rg.burn * lm.H, lm.jawY);
  return { y0, y1, yEnd: Math.max(y1 + 0.02 * lm.H, y2) };
}

/** Masses de région d'une coiffure (tempes + pattes d'un seul tenant, mèches de joue, nuque, zones rasées). */
export function regionMasses(ctx: HairCtx, prof: Profile, rank: HairLock['rank'] = 'mass'): Region {
  const { lm, guard } = ctx;
  const { W, H } = lm;
  const rg = prof.region;
  const sil = prof.sil;
  const hw = guard.hw;
  const locks: HairLock[] = [];
  const shaved: Poly[] = [];
  const yT = lm.hair.templeY;
  const out = (0.006 + 0.03 * (sil.width - 1)) * W;
  const push = (poly: Poly, o: Partial<HairLock> & { spine: Vec[]; w0: number }): void => {
    locks.push({ poly, rank, tone: -0.1, layer: 'front', edge: true, kind: 'lock', sharp: 0.3, profile: 'ribbon', sim: true, ...o });
  };

  // --- zones rasées : repousse sombre sur les côtés (et la nuque), sous la masse du dessus ---
  if (sil.shave.sides) {
    for (const sg of [-1, 1]) {
      const yTop = yT - (0.04 + 0.1 * sil.shave.height) * H;
      const ys = steps(yTop, lm.eyeY - 0.02 * H, 10);
      shaved.push(band(sg, ys, hw, (y) => Math.min(0.12 * W, depthLimit(lm, y) * W + 0.01 * W), 0.004 * W));
    }
  }

  // --- tempe + patte : une bande continue le long du contour, longueur propre à la coiffure ---
  const th = rg.temple * rg.thick;
  const shavedSides = sil.shave.sides && rg.temple === 0;
  if (!shavedSides && (rg.temple > 0 || rg.burn > 0)) {
    for (const sg of [-1, 1] as const) {
      const { y0, y1, yEnd } = sideSpan(lm, rg);
      const wT = (0.075 + 0.02 * th) * W;
      const wB = 0.05 * W * rg.thick;
      const prof2 = (y: number): number => {
        const u = clamp((y - y1) / (yEnd - y1 || 1), 0, 1);
        const base = y <= y1 ? wT : wT + (wB - wT) * smoothstep(clamp(u * 2, 0, 1));
        const tip = y <= y1 ? 1 : 1 - smoothstep(clamp((u - 0.5) / 0.5, 0, 1)) ** 1.5;
        return Math.min(base, depthLimit(lm, y) * W) * Math.max(0.02, tip);
      };
      const ys = steps(y0, yEnd, 18);
      const poly = band(sg, ys, hw, prof2, out);
      const spine: Vec[] = ys.map((y) => ({ x: sg * (hw(y) - 0.5 * prof2(y)), y }));
      push(poly, { spine, w0: (wT + wB) / 2, tone: -0.15, zone: 'side' });
    }
  }

  // --- mèches de joue : mèche pointue qui longe la joue, centre borné par la profondeur de zone ---
  if (rg.cheek > 0 && rg.cheekSide !== 'none') {
    const sides = rg.cheekSide === 'both' ? [-1, 1] : rg.cheekSide === 'left' ? [-1] : [1];
    for (const sg of sides) {
      const yA = Math.min(yT + (rg.temple + 0.02) * H, lm.eyeY - 0.04 * H);
      const yB = Math.min(yA + rg.cheek * H, lm.jawY + 0.02 * H);
      const w = 0.036 * W * rg.thick;
      const spine: Vec[] = steps(yA, yB, 14).map((y, i, a) => {
        const u = i / (a.length - 1);
        const cd = Math.max(0.012 * W, depthLimit(lm, y) * W - 0.5 * w - 0.004 * W);
        const wave = Math.sin(u * Math.PI * 1.4) * 0.006 * W;
        return { x: sg * (hw(y) - Math.min(cd, (0.02 + 0.07 * smoothstep(u)) * W) + wave * 0), y };
      });
      for (const l of lockFrom(ctx, spine, { width: w, rank: 'main', tone: -0.05, layer: 'front', sharp: 0.92, raw: true, kind: 'cheek', noGuard: true })) locks.push({ ...l, sim: true, zone: 'cheek' });
    }
  }

  // --- nuque : masse arrière CACHÉE par la tête et le cou tant qu'elle est courte ; elle ne déborde sur les côtés du cou
  // (sous la mâchoire) que pour une coiffure longue (au-delà de 0,12 H sous la mâchoire). Rasée / courte = rien de visible. ---
  const showBelow = Math.max(0, rg.nape - 0.12);
  if (rg.nape > 0.03 && !sil.shave.nape) {
    const y0 = lm.hair.sideY + 0.25 * (lm.jawY - lm.hair.sideY);
    const yEnd = lm.jawY + Math.max(0.03 * H, showBelow * H);
    const ys = steps(y0, yEnd, 14);
    const spread = (0.012 + 0.05 * Math.min(1, showBelow / 0.2) + 0.03 * (sil.width - 1)) * W;
    const xAt = (y: number): number => (y <= lm.jawY ? hw(y) - 0.012 * W : (showBelow > 0 ? Math.max(lm.neck.half + spread, hw(lm.jawY) * 0.85) : 0.8 * lm.neck.half));
    const taper = (y: number): number => (y < yEnd - 0.06 * H ? 1 : Math.sqrt(Math.max(0.05, 1 - (y - (yEnd - 0.06 * H)) / (0.06 * H))));
    const right: Vec[] = ys.map((y) => ({ x: xAt(y) * taper(y), y }));
    const poly = [...right, ...right.map((q) => ({ x: -q.x, y: q.y })).reverse()];
    locks.push({ poly, rank: 'mass', tone: -0.3, layer: 'back', edge: true, kind: 'lock', sim: true, zone: 'nape', spine: ys.map((y) => ({ x: 0, y })), w0: 0.2 * W, sharp: 0.2, profile: 'ribbon' });
  }
  return { locks, shaved };
}

/**
 * MASSE DE VOLUME DU DESSUS : polygone plein entre la ligne d'implantation et le contour du crâne REHAUSSÉ. Hauteur = `sil.top`,
 * largeur = `sil.width`, sommet déporté du côté du balayage (`sil.sweep`) ; la zone rasée (`sil.shave`) resserre les côtés.
 * La ligne médiane (entre les deux bords) sert de repère aux bandes blanches continues du rendu encre.
 */
export function volumeMass(ctx: HairCtx, prof: Profile): HairLock | null {
  const { lm, hl, arc } = ctx;
  const { W, H } = lm;
  const sil = prof.sil;
  const n = 26;
  const outer: Vec[] = [];
  const inner: Vec[] = [];
  const mid: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const s = -1 + (2 * i) / n;
    const B = arcAt(arc, s);
    const A = hl.at(s);
    const w = Math.max(0, 1 - Math.abs(s) ** 2.2);
    const peak = Math.exp(-(((s - sil.sweep * 0.35) / 0.7) ** 2));
    const taper = sil.shave.sides ? Math.max(0, 1 - Math.max(0, Math.abs(s) - 0.55) / 0.3) : 1;
    const up = (0.05 + 0.1 * (sil.top - 0.6)) * H * (0.4 + 0.6 * peak) * w * taper;
    const x = B.x + (sil.width - 1) * 0.06 * W * Math.sign(s) * Math.abs(s) ** 2 + sil.sweep * 0.05 * W * w;
    const o = { x, y: B.y - up };
    outer.push(o);
    inner.push({ x: A.x, y: A.y + 0.01 * H });
    mid.push({ x: (o.x + A.x) / 2, y: o.y + 0.38 * (A.y - o.y) });
  }
  if (outer.every((q, i) => Math.abs(q.y - (inner[i] as Vec).y) < 1e-3)) return null;
  return { poly: [...outer, ...inner.reverse()], rank: 'mass', tone: -0.2, layer: 'front', edge: true, kind: 'lock', sim: true, zone: 'top', spine: mid, w0: 0.1 * W * sil.top, sharp: 0.3, profile: 'ribbon' };
}

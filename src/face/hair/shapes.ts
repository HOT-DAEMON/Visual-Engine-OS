import type { Vec } from '../../geometry/eye/primitives';
import { arcAt } from './hairline';
import type { HairCtx } from './flow';
import { lockFrom } from './flow';
import { smoothstep, unit } from './noise';
import type { HairLock } from './types';

const lerpV = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const TAU = Math.PI * 2;

/** Racine tirée sur le crâne : abscisse normalisée s, profondeur t (0 = ligne d'implantation, 1 = contour du crâne). */
function rootAt(ctx: HairCtx, s: number, t: number): Vec {
  return lerpV(ctx.hl.at(s), arcAt(ctx.arc, s), t);
}

/** Direction « vers l'extérieur et le haut » depuis le centre du crâne : `up` ∈ [0,1] pondère la composante verticale. */
function outward(ctx: HairCtx, R: Vec, up: number): Vec {
  const r = unit({ x: R.x - ctx.C.x, y: R.y - ctx.C.y });
  return unit({ x: r.x, y: r.y - up });
}

/**
 * Ligne médiane d'une GRANDE MÈCHE EN S : une demi-période complète de sinusoïde le long de l'axe de départ
 * (haut → bas → haut de l'onde = un « S » souple), enveloppe qui démarre doucement (racine tangente à l'axe),
 * affaissement `(1 − float)` : à `float` = 1 aucune gravité, la mèche flotte loin de la tête.
 */
export function sCentre(R: Vec, dir: Vec, len: number, amp: number, phase: number, float: number): Vec[] {
  const N = 30;
  const n = { x: -dir.y, y: dir.x };
  return Array.from({ length: N + 1 }, (_, i) => {
    const u = i / N;
    const env = smoothstep(Math.min(1, u / 0.18));
    const off = amp * len * env * Math.sin(TAU * u + phase);
    const sag = (1 - float) * 0.35 * len * u * u;
    return { x: R.x + dir.x * len * u + n.x * off, y: R.y + dir.y * len * u + n.y * off + sag };
  });
}

/**
 * Grandes mèches larges, souples, ondulées en S, qui flottent loin du crâne (rang `mass`, forme `flow`).
 * Portée = `span · H`, modulée par le gain de silhouette du côté de la racine (asymétrie). 60 % devant (elles
 * recouvrent le sommet), 40 % derrière (profondeur, ton plus sombre).
 */
export function flowLocks(ctx: HairCtx): HairLock[] {
  const { h, lm, rnd } = ctx;
  const f = h.flow;
  if (!(f.mode === 'ribbons' || f.mode === 'mixed') || f.ribbons === 0) return [];
  const out: HairLock[] = [];
  for (let i = 0; i < f.ribbons; i++) {
    const s = -1 + (2 * (i + 0.15 + 0.7 * rnd())) / f.ribbons;
    const R = rootAt(ctx, s, 0.6 + 0.4 * rnd());
    const g = ctx.gain(s);
    const len = (0.07 + 0.5 * f.span) * lm.H * (0.55 + 0.6 * rnd()) * g;
    const dir = outward(ctx, R, 0.35 + 0.45 * rnd());
    const back = rnd() < 0.4;
    const c = sCentre(R, dir, len, (0.06 + 0.16 * f.sWave) * (rnd() < 0.5 ? -1 : 1), rnd() * 0.9 - 0.45, f.float);
    out.push(...lockFrom(ctx, c, { width: lm.W * (0.05 + 0.05 * rnd()) * (0.8 + 0.4 * g), rank: 'mass', tone: back ? -0.3 - 0.2 * rnd() : (rnd() - 0.55) * 0.5 * h.highlight, layer: back ? 'back' : 'front', sharp: 0.92, raw: true, kind: 'flow', fade: 0.25 + 0.5 * h.tips.fade, edgeFade: h.tips.edgeFade, flick: h.tips.flick, ragged: h.tips.irregular }));
  }
  return out;
}

/**
 * Paquets RIGIDES en cônes : épais à la base (largeur pleine à la racine), bords droits qui deviennent concaves
 * (aiguille) selon `coneSharp`, orientés vers le haut et l'arrière (éventail ±0,35 rad autour de l'axe du paquet).
 * Les cônes se regroupent par paquets de 2–4 autour d'une racine commune, comme les mèches figées en anime.
 */
export function coneLocks(ctx: HairCtx): HairLock[] {
  const { h, lm, rnd } = ctx;
  const f = h.flow;
  if (!(f.mode === 'cones' || f.mode === 'mixed') || f.cones === 0) return [];
  const out: HairLock[] = [];
  const clusters = Math.max(1, Math.round(f.cones / 3));
  const per = Math.ceil(f.cones / clusters);
  let made = 0;
  for (let k = 0; k < clusters && made < f.cones; k++) {
    const s = -0.85 + (1.7 * (k + 0.5)) / clusters + (rnd() - 0.5) * 0.12;
    const axis = unit({ x: s * 0.55 + (rnd() - 0.5) * 0.3, y: -1 });
    for (let j = 0; j < per && made < f.cones; j++, made++) {
      const R = rootAt(ctx, s + (rnd() - 0.5) * 0.12, 0.7 + 0.3 * rnd());
      const a = (rnd() - 0.5) * 0.7 + (j - (per - 1) / 2) * 0.22;
      const d = unit({ x: axis.x * Math.cos(a) - axis.y * Math.sin(a), y: axis.x * Math.sin(a) + axis.y * Math.cos(a) });
      const len = (0.1 + 0.2 * rnd() + 0.1 * h.silhouette.lift) * lm.H * ctx.gain(s);
      const bend = (rnd() - 0.5) * 0.14;
      const c = Array.from({ length: 12 }, (_, i) => {
        const u = i / 11;
        return { x: R.x + (d.x + bend * u) * len * u, y: R.y + d.y * len * u };
      });
      out.push(...lockFrom(ctx, c, { width: lm.W * (0.09 + 0.07 * rnd()), rank: 'mass', tone: -(0.05 + 0.3 * rnd()) * (0.4 + h.highlight), layer: 'front', profile: 'cone', power: 1 + 0.6 * f.coneSharp, raw: true, kind: 'cone', edgeFade: h.tips.edgeFade, ragged: h.tips.irregular * 0.5 }));
    }
  }
  return out;
}

/**
 * Mèches libres et VOLUTES qui s'échappent de la masse, sans gravité : départ sur le contour du crâne, direction
 * radiale tournée, puis la direction s'enroule (rotation croissante) jusqu'à une boucle ouverte. Très fines, pointe d'aiguille,
 * fondu d'opacité vers la pointe (elles se perdent dans le fond).
 */
export function wispLocks(ctx: HairCtx): HairLock[] {
  const { h, lm, rnd } = ctx;
  const n = h.flow.wisps;
  const out: HairLock[] = [];
  for (let i = 0; i < n; i++) {
    const s = -1 + (2 * (i + rnd())) / n;
    const R = rootAt(ctx, s, 0.9 + 0.1 * rnd());
    const d0 = outward(ctx, R, 0.2 + 0.5 * rnd());
    let th = Math.atan2(d0.y, d0.x) + (rnd() - 0.5) * 1.2;
    const turn = (rnd() < 0.5 ? -1 : 1) * (0.5 + 2 * rnd());
    const len = (0.12 + 0.28 * rnd()) * lm.H * ctx.gain(s) * (0.6 + 0.8 * h.flow.span);
    const N = 24;
    const ds = len / N;
    const c: Vec[] = [R];
    for (let k = 0; k < N; k++) {
      const u = k / N;
      th += (turn / N) * (0.3 + 2.2 * u);
      const p = c[c.length - 1] as Vec;
      c.push({ x: p.x + Math.cos(th) * ds, y: p.y + Math.sin(th) * ds * (1 - 0.15 * (1 - h.flow.float)) });
    }
    const back = rnd() < 0.3;
    out.push(...lockFrom(ctx, c, { width: lm.W * (0.007 + 0.008 * rnd()), rank: 'fine', tone: back ? -0.2 : 0.2 + 0.5 * rnd() * h.highlight, layer: back ? 'back' : 'front', sharp: 1, raw: true, kind: 'wisp', fade: 0.75 }));
  }
  return out;
}

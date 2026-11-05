import { clamp } from '../../../core/math';
import { mulberry32 } from '../../../core/prng';
import type { Vec } from '../../../geometry/eye/primitives';
import { lockFrom, growLock, type HairCtx } from '../flow';
import type { HairLock } from '../types';
import type { Reach } from './shell';

export interface WingInfo {
  readonly reach: Reach;
  readonly yEnd: number;
}

/**
 * MÈCHES DES AILES : la coque couvre les tempes (du coin de l'implantation jusqu'au-dessus de l'oreille) ; ces mèches la garnissent. Chaque
 * racine est posée entre la lisière (bord intérieur) et le contour épaissi, la mèche suit le crâne VERS LE BAS (méridienne de la tête vue
 * de face : verticale, légèrement ouverte vers l'extérieur) et s'arrête à la fin de l'aile, au-dessus de l'oreille quand elle doit rester
 * dégagée. Générateur aléatoire PROPRE (graine dérivée) : le flux des autres mèches n'est pas décalé. `buzz` : pas de mèche, la
 * repousse rase est portée par la coque seule.
 */
export function wingLocks(ctx: HairCtx, wings: { readonly left: WingInfo; readonly right: WingInfo }, crown: number): HairLock[] {
  const { h, lm, boundary: b } = ctx;
  if (h.style === 'buzz') return [];
  const { W, H } = lm;
  const rnd = mulberry32((h.seed ^ 0x3a7d51) >>> 0);
  const out: HairLock[] = [];
  const wMain = (ctx.def.mainW[0] + ctx.def.mainW[1] * h.volume) * W * 0.8;
  for (const sg of [-1, 1] as const) {
    const info = sg === 1 ? wings.right : wings.left;
    if (info.reach === 'none') continue;
    const yCorner = sg === 1 ? b.marks.cornerY.right : b.marks.cornerY.left;
    const y0 = yCorner - 0.025 * H;
    const span = Math.max(0.02 * H, info.yEnd - y0);
    const n = clamp(Math.round((6 + 22 * h.density) * (span / (0.16 * H))), 5, 30);
    for (let i = 0; i < n; i++) {
      const y = y0 + span * ((i + rnd()) / n) * 0.82;
      // Entre la lisière (marge de la bande des pattes) et le contour épaissi : plus l'épaisseur est grande, plus la racine peut être loin.
      const xIn = b.skull.a(y) - b.sideburn.margin(y);
      const u = rnd();
      const x = xIn + (b.skull.a(y) + 0.5 * crown * ctx.gain(sg) - xIn) * u;
      const R: Vec = { x: sg * x, y };
      // Bas biseauté : les mèches de l'extérieur (côté du contour, qui tourne vers l'arrière) sont plus courtes que celles de la lisière.
      const taper = 1 - 0.5 * u ** 1.3;
      const len = Math.max(0.03 * H, (info.yEnd - y) * taper + (rnd() - 0.5) * 0.015 * H);
      const dir = { x: sg * (0.02 + 0.05 * rnd()), y: 1 };
      const centre = growLock(ctx, R, len, { dir: { x: dir.x / Math.hypot(dir.x, dir.y), y: dir.y / Math.hypot(dir.x, dir.y) }, gravity: 0 });
      const tone = -(0.1 + 0.4 * rnd()) * h.highlight - 0.12;
      out.push(...lockFrom(ctx, centre, { width: wMain * (0.7 + 0.6 * rnd()), rank: 'main', tone, layer: 'front', kind: 'lock', edgeFade: h.tips.edgeFade, fade: h.tips.fade * 0.6, ragged: h.tips.irregular }));
    }
  }
  return out;
}

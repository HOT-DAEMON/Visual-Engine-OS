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
    const y0 = yCorner - 0.07 * H;
    const span = Math.max(0.02 * H, info.yEnd - y0);
    const n = clamp(Math.round((6 + 22 * h.density) * (span / (0.16 * H))), 5, 30);
    for (let i = 0; i < n; i++) {
      const y = y0 + span * ((i + rnd()) / n) ** 1.15 * 0.85;
      // Entre la lisière (marge de la bande des pattes) et le contour épaissi : plus l'épaisseur est grande, plus la racine peut être loin.
      const xIn = b.skull.a(y) - b.sideburn.margin(y);
      const u = rnd();
      const x = xIn + (b.skull.a(y) + 0.5 * crown * ctx.gain(sg) - xIn) * u;
      const R: Vec = { x: sg * x, y };
      // Bas biseauté : les mèches de l'extérieur (côté du contour, qui tourne vers l'arrière) sont plus courtes que celles de la lisière.
      const taper = 1 - 0.5 * u ** 1.3;
      const len = Math.max(0.03 * H, (info.yEnd - y) * taper + (rnd() - 0.5) * 0.015 * H);
      // La mèche suit la MÉRIDIENNE du crâne : la pente du contour (da/dy) donne la dérive horizontale, qui s'éteint vers le bas (la
      // mèche tombe droit sous l'effet de la gravité). Une racine étroite se fond sous la coque : pas de bout plat aligné aux tempes.
      const slope = clamp((b.skull.a(y + 0.01 * H) - b.skull.a(y - 0.01 * H)) / (0.02 * H), -0.1, 0.3);
      const dir = { x: sg * (slope * (1 - 0.6 * u) + 0.02 * rnd()), y: 1 };
      const dn = Math.hypot(dir.x, dir.y);
      // Jamais au-delà du contour épaissi : une pointe qui s'évase hors de la coque lit comme une aile plaquée sur le crâne.
      const xMax = (yy: number): number => b.skull.a(yy) + 0.5 * crown * ctx.gain(sg);
      const centre = growLock(ctx, R, len, { dir: { x: dir.x / dn, y: dir.y / dn }, gravity: 0.15 }).map((q) => ({ x: sg * Math.min(Math.abs(q.x), xMax(q.y)), y: q.y }));
      const tone = -(0.1 + 0.4 * rnd()) * h.highlight - 0.04;
      out.push(...lockFrom(ctx, centre, { width: wMain * (0.7 + 0.6 * rnd()), rank: 'main', tone, layer: 'front', kind: 'lock', edgeFade: h.tips.edgeFade, fade: h.tips.fade * 0.6, ragged: h.tips.irregular, root: 0.25, sharp: 0.75, reach: 'cranial' }));
    }
  }
  return out;
}

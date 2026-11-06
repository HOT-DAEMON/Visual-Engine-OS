import { smooth } from '../math';
import type { EngineHead } from './face-model';
import { PX, spy, sy } from './units';

/** Section du cou à la hauteur y (U) : demi-largeur a (moteur de visage : `lm.neck.half`, évasement vers les trapèzes), centre zc et demi-profondeur b (moteur de crâne : faces antérieure `xFront` et postérieure `xBack`). */
export interface NeckSection { readonly a: number; readonly zc: number; readonly b: number }

/** Évasement du bas du cou : +10 % de la largeur sur les 0,2 U du bas (le socle de la planche) [mesuré]. */
const FLARE = 0.1;

export function neckSection(e: EngineHead, y: number, y1: number): NeckSection {
  const n = e.sk.neck, yp = spy(y), zf = e.fit.zPorion + n.xFront(yp) * PX, zb = e.fit.zPorion + n.xBack(yp) * PX;
  const flare = 1 + FLARE * smooth((y - (y1 - 0.2)) / 0.2);
  return { a: e.lm.neck.half * PX * flare, zc: (zf + zb) / 2, b: Math.max(0.02, ((zf - zb) / 2) * e.fit.neckScale * flare) };
}
export const neckTopY = (e: EngineHead): number => sy(e.sk.neck.yTop);

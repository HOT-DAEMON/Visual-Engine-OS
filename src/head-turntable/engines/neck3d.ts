import { smooth } from '../math';
import { SkullParams } from '../../skull/types';
import type { EngineHead } from './face-model';
import { PX, spy, sy } from './units';

/** Section du cou à la hauteur y (U) : demi-largeur a (moteur de visage : `lm.neck.half`, évasement vers les trapèzes), centre zc et demi-profondeur b (moteur de crâne : faces antérieure `xFront` et postérieure `xBack`). */
export interface NeckSection { readonly a: number; readonly zc: number; readonly b: number }

/** Évasement du bas du cou : +10 % de la largeur sur les 0,2 U du bas (le socle de la planche) [mesuré]. */
const FLARE = 0.1;

/**
 * JONCTION COU → ÉPAULES (têtes issues d'un visage). Le cou n'est plus un cylindre qui se coupe net : sur les `SHOULDER.len` U du bas il s'évase vers les trapèzes (largeur ×(1 + k·t²)),
 * k = `SHOULDER.k0 + SHOULDER.kTrap × skull.trapezius` (le même axe que le moteur de crâne : `trapezius` = « montée du trapèze vers l'épaule ») ; la nuque se creuse puis rejoint C7 (`skull.c7`) :
 * le dos du cou recule de `SHOULDER.back × c7 × t²` alors que le devant (creux sus-sternal) reste. La planche garde son évasement mesuré de 10 %.
 */
export const SHOULDER = { len: 0.3, k0: 0.12, kTrap: 0.36, back: 0.05 } as const;

export function neckSection(e: EngineHead, y: number, y1: number): NeckSection {
  const n = e.sk.neck, yp = spy(y), zf = e.fit.zPorion + n.xFront(yp) * PX, zb = e.fit.zPorion + n.xBack(yp) * PX;
  if ((e.fit as { mandLandmarks?: boolean }).mandLandmarks) {
    const k = SkullParams.parse(e.fit.skull), t = smooth((y - (y1 - SHOULDER.len)) / SHOULDER.len), kk = SHOULDER.k0 + SHOULDER.kTrap * k.trapezius;
    const zbS = zb - SHOULDER.back * k.c7 * t * t;
    return { a: e.lm.neck.half * PX * (1 + kk * t * t), zc: (zf + zbS) / 2, b: Math.max(0.02, ((zf - zbS) / 2) * e.fit.neckScale * (1 + 0.5 * kk * t * t)) };
  }
  const flare = 1 + FLARE * smooth((y - (y1 - 0.2)) / 0.2);
  return { a: e.lm.neck.half * PX * flare, zc: (zf + zb) / 2, b: Math.max(0.02, ((zf - zb) / 2) * e.fit.neckScale * flare) };
}
export const neckTopY = (e: EngineHead): number => sy(e.sk.neck.yTop);

import { Resolver, type Correction } from '../core/resolve';
import type { FaceParams } from '../schema';
import type { Frame } from './frame';
import type { CPoint, SkullParams } from './types';
import type { VaultPts } from './vault';

/**
 * COU ET NUQUE EN PROFIL. Le cou est un prisme incliné (la tête avance sur lui de `tilt`) de profondeur AP `depth`. Face postérieure :
 * ligne droite + lordose cervicale (creux) + saillie de C7 + rampe du trapèze. Face antérieure : dessous du menton (pente imposée par l'angle
 * cervico-mentonnier), point de gorge T (intersection dessous du menton / face antérieure), cartilage thyroïde, évasement vers le sternum.
 * Relation : angle cervico-mentonnier = 90° + pente du dessous du menton + inclinaison du cou (les trois restent cohérents par construction).
 */
export interface NeckGeo {
  readonly front: CPoint[];
  readonly back: CPoint[];
  readonly tiltDeg: number;
  readonly depth: number;
  readonly yBase: number;
  readonly yC7: number;
  readonly yTop: number;
  readonly throat: CPoint;
  readonly xBack: (y: number) => number;
  readonly xFront: (y: number) => number;
  readonly corrections: readonly Correction[];
}

const RAD = Math.PI / 180;
export function neckGeometry(face: FaceParams, sk: SkullParams, fr: Frame, vault: VaultPts): NeckGeo {
  const { H, x } = fr;
  const R = new Resolver();
  const tiltDeg = 5 + 23 * sk.neckTilt;
  const yTop = fr.f.inion * H + 0.1 * H;
  // Gorge : à `shelf` du menton, le long du dessous du menton dont la pente β = angle cervico-mentonnier − 90° (la face antérieure du cou est quasi verticale).
  const beta = Math.max(5, Math.min(40, face.neck.cervicomentalDeg - 90)) * RAD;
  const shelf = (0.16 + 0.1 * ((face.neck.cervicomentalDeg - 85) / 65)) * H;
  const sag = 0.012 * H * face.neck.thickness;
  const tx = x.menton - shelf * Math.cos(beta);
  const ty = H + shelf * Math.sin(beta);
  // Le cou visible mesure au moins 0,18 H sous la gorge (sinon le cartilage thyroïde et la base se croisent) ; consigné si la longueur demandée est ramenée.
  const yBase = R.limit('neck-length-room', 'neck.length', H * (1.14 + 0.5 * face.neck.length), ty + sag + 0.18 * H, Infinity, 'le cou visible mesure au moins 0,18 H sous la gorge');
  const yC7 = yBase - 0.06 * H;
  const throat: CPoint = { x: tx, y: ty + sag, s: 0.55, id: 'throat' };
  // Face antérieure : légèrement vers l'avant en descendant (vers le sternum). Face postérieure = antérieure − profondeur(y) ; la profondeur croît vers la base
  // (le cou s'élargit vers le thorax) et avec l'inclinaison de la tête sur le cou.
  const xFront = (y: number): number => tx + 0.05 * (y - ty);
  const d0 = (0.34 + 0.16 * sk.neckDepth) * H;
  const depthAt = (y: number): number => d0 + Math.max(0, y - ty) * (0.5 * Math.tan(tiltDeg * RAD) + 0.06);
  const u = (y: number): number => Math.max(0, Math.min(1, (y - yTop) / (yC7 - yTop)));
  const raw = (y: number): number => xFront(y) - depthAt(y);
  // La nuque ne s'écarte jamais de l'inion de plus de 0,16 H ni ne le dépasse : sinon ressaut ou occiput « posé » sur le cou (consigné si ramené).
  const shift = R.limit('nape-near-inion', 'neck.depth', raw(yTop), vault.nuchalTop.x + 0.03 * H, vault.nuchalTop.x + 0.16 * H, 'la nuque reste entre 0,03 H et 0,16 H en avant de l’inion') - raw(yTop);
  const xBack = (y: number): number => raw(y) + shift + 0.02 * H * sk.lordosis * Math.sin(Math.PI * u(y)) - 0.03 * H * sk.c7 * Math.exp(-(((u(y) - 0.92) / 0.08) ** 2));
  const depth = depthAt(ty) ;
  const thy = sk.thyroid;
  const avail = yBase - throat.y;
  const yTh = throat.y + 0.3 * avail;
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
  const front: CPoint[] = [
    { x: lerp(x.menton, tx, 0.38), y: lerp(H, ty, 0.38) + sag * 0.5 + 0.004 * H },
    { x: lerp(x.menton, tx, 0.72), y: lerp(H, ty, 0.72) + sag * 0.9 },
    throat,
    { x: xFront(throat.y + 0.14 * avail) + 0.006 * H * thy, y: throat.y + 0.14 * avail },
    { x: xFront(yTh) + 0.022 * H * thy, y: yTh, id: 'thyroid' },
    { x: xFront(throat.y + 0.5 * avail) + 0.004 * H * thy, y: throat.y + 0.5 * avail },
    { x: xFront(throat.y + 0.8 * avail) + 0.012 * H * face.neck.flare, y: throat.y + 0.8 * avail },
    { x: xFront(yBase) + 0.05 * H * face.neck.flare, y: yBase, s: 1, id: 'baseFront' },
  ];
  const trap = 0.35 + 0.5 * sk.trapezius;
  const xc7 = xBack(yC7);
  const back: CPoint[] = [
    { x: xc7 - 0.27 * H * trap, y: yBase, s: 1, id: 'baseBack' },
    { x: xc7 - 0.15 * H * trap, y: yC7 + 0.042 * H },
    { x: xc7 - 0.05 * H * trap, y: yC7 + 0.014 * H },
    { x: xc7, y: yC7, id: 'c7' },
    { x: xBack(lerp(yTop, yC7, 0.62)), y: lerp(yTop, yC7, 0.62) },
    { x: xBack(lerp(yTop, yC7, 0.3)), y: lerp(yTop, yC7, 0.3), id: 'nape' },
    { x: xBack(yTop), y: yTop, id: 'nuchalGroove' },
  ];
  return { front, back, tiltDeg, depth, yBase, yC7, yTop, throat, xBack, xFront, corrections: R.applied };
}

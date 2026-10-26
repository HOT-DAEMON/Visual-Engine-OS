import type { Frame } from './frame';
import type { CPoint, SkullParams } from './types';

/**
 * VOÛTE CRÂNIENNE (peau) du front à l'occiput, puis jusqu'à la base de l'occiput. Points nommés (repères craniométriques usuels) :
 * supraglabelle → bosse frontale → front haut (bregma) → vertex → pariétal → lambda → opisthocrânion (point le plus postérieur) → inion.
 * Le front s'incline de 4° à 30° (`foreheadSlope`) ; la plénitude de la voûte (`vaultHeight`) reporte le coin avant-haut ; l'occiput
 * (`occiput`) recule l'opisthocrânion ; la protubérance (`inion`) sort la base de l'occiput.
 */
export interface VaultPts { readonly front: CPoint[]; readonly back: CPoint[]; readonly nuchalTop: CPoint }

export function vaultPoints(fr: Frame, sk: SkullParams): VaultPts {
  const { H, f, x } = fr;
  const slope = Math.tan(((4 + 26 * sk.foreheadSlope) * Math.PI) / 180);
  const yFe = f.supra * 0.55 * H;
  const xFe = x.front - (f.glabella * H - yFe) * slope + 0.02 * H * sk.frontalBulge;
  const yGl = f.glabella * H;
  const full = 0.7 + 0.6 * (1 - sk.vaultHeight);
  const xFt = xFe - 0.075 * H * full * (1 + 0.4 * sk.foreheadSlope);
  const xV = -0.02 * H + 0.14 * H * (sk.vaultPeak - 0.45);
  const xO = x.back - 0.03 * H * (sk.occiput - 0.5);
  const yO = f.occiput * H;
  const yIn = f.inion * H;
  const back: CPoint[] = [
    { x: xV, y: 0, id: 'vertex' },
    { x: xV + (xO - xV) * 0.45, y: 0.034 * H },
    { x: xV + (xO - xV) * 0.8, y: 0.1 * H, id: 'lambda' },
    { x: xO * 0.99, y: yO - 0.14 * H },
    { x: xO, y: yO, id: 'opisthocranion' },
    { x: xO * 0.965, y: yO + (yIn - yO) * 0.55 },
    { x: xO * 0.93 + 0.035 * H * (sk.inion - 0.4), y: yIn, id: 'inion' },
  ];
  const front: CPoint[] = [
    { x: x.front - 0.002 * H, y: yGl - 0.052 * H, id: 'supraglabella' },
    { x: xFe, y: yFe, id: 'frontalEminence' },
    { x: xFt, y: 0.075 * H, id: 'bregma' },
    { x: xFt + (xV - xFt) * 0.55, y: 0.016 * H },
  ];
  return { front, back, nuchalTop: back[back.length - 1] as CPoint };
}

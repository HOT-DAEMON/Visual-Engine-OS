import type { Frame } from './frame';
import type { CPoint, SkullParams } from './types';
import { archAmp, VAULT_SHAPE } from './vault-shapes';

/**
 * VOÛTE CRÂNIENNE (peau) du front à l'occiput, puis jusqu'à la base de l'occiput. Points nommés (repères craniométriques usuels) :
 * supraglabelle → bosse frontale → front haut (bregma) → vertex → pariétal → lambda → opisthocrânion (point le plus postérieur) → inion.
 * Le front s'incline de 4° à 30° (`foreheadSlope`) ; la plénitude de la voûte (`vaultHeight`) reporte le coin avant-haut ; l'occiput
 * (`occiput`) recule l'opisthocrânion ; la protubérance (`inion`) sort la base de l'occiput.
 */
export interface VaultPts { readonly front: CPoint[]; readonly back: CPoint[]; readonly nuchalTop: CPoint }

/**
 * LECTURE DES MESURES DE VOÛTE PAR LE PROFIL 2D (`docs/SKULL-PROFILE-2D.md`). La silhouette de profil est l'ENVELOPPE de toutes les coupes : elle lit les mesures qui changent la profondeur ou la hauteur du contour
 * (sommet, éminence pariétale, occiput, inion, glabelle, bosse frontale) et PAS celles qui ne changent que la largeur (`cranialBreadth`, `templeBreadth`, `frontalBreadth`, temporal, asymétries : elles se lisent de face et de dessus).
 * Amplitudes en fraction de H (conventions d'anatomie artistique, bornées ; 0 = nominal, contour identique à l'ancien).
 */
export const PROFILE_VAULT = { flatTop: 0.4, flatBregma: 0.2, flatLambda: 0.18, bulgeX: 0.014, bulgeY: 0.009, parietalDy: 0.25, parietalDt: 0.08, occFlat: 0.01, occFlatLow: 0.035, occRound: 0.011, slopeX: 0.02, glabellaX: 0.012, nuchalX: 0.014, frontalFlatX: 0.01,
  /** Passe 2 (`docs/SKULL-VAULT-2.md`) : arcade (par unité de l'amplitude 3D `archAmp`, donc échelonnée par `browRidge` comme en 3D), éminence frontale, crête métopique (médiane : elle fait la silhouette), chignon et protubérance occipitale. */
  archX: 0.014, eminenceX: 0.009, metopicX: 0.006, bunX: 0.03, inionSizeX: 0.012 } as const;

export function vaultPoints(fr: Frame, sk: SkullParams): VaultPts {
  const { H, f, x } = fr;
  const slope = Math.tan(((4 + 26 * sk.foreheadSlope) * Math.PI) / 180);
  const yFe = f.supra * 0.55 * H;
  const P = PROFILE_VAULT, xFe0 = x.front - (f.glabella * H - yFe) * slope + 0.02 * H * sk.frontalBulge - P.frontalFlatX * H * sk.frontalFlat;
  // Reliefs du front (même forme que la 3D : `vault-shapes.ts`) : éminence = bosse locale (le bregma ne suit pas) ; arcade = avance de la supraglabelle ; crête métopique = tout l'arc médian, du bregma à la glabelle.
  const archU = archAmp(sk.browArch, sk.browRidge) / VAULT_SHAPE.arch.amp, mx = P.metopicX * H * sk.metopicRidge, xFe = xFe0 + P.eminenceX * H * sk.frontalEminence + mx;
  const yGl = f.glabella * H;
  const full = 0.7 + 0.6 * (1 - sk.vaultHeight);
  const xFt = xFe0 - 0.075 * H * full * (1 + 0.4 * sk.foreheadSlope) + 0.5 * mx;
  const xV = -0.02 * H + 0.14 * H * (sk.vaultPeak - 0.45);
  const xO = x.back - 0.03 * H * (sk.occiput - 0.5);
  const yO = f.occiput * H;
  const yIn = f.inion * H;
  // Sommet : plat (+) = les épaules de la calotte montent vers le niveau du vertex ; pointu (−) = elles descendent. Éminence pariétale : repoussée vers l'arrière et le haut par `parietalBulge`, déplacée par `parietalHeight` / `parietalAzimuth`.
  const flat = sk.parietalFlat, tL = Math.min(0.95, Math.max(0.55, 0.8 + P.parietalDt * sk.parietalAzimuth));
  const pb = { x: -P.bulgeX * H * sk.parietalBulge, y: -P.bulgeY * H * sk.parietalBulge };
  // Occiput : plat (+) = verticale ; rond (−) = rentre. Pente (+ fuyant) : le bas de l'occiput recule vers l'avant. Ligne nuchale : l'inion sort vers l'arrière.
  const bun = P.bunX * H * sk.occipitalBun;   // chignon : bosse de l'écaille (l'opisthocrânion recule de `bun`, ses voisins d'une fraction)
  const oF = sk.occipitalFlat, oUp = oF >= 0 ? P.occFlat * oF : P.occRound * oF, oLow = oF >= 0 ? P.occFlatLow * oF : P.occRound * oF * 1.2;
  const back: CPoint[] = [
    { x: xV, y: 0, id: 'vertex' },
    { x: xV + (xO - xV) * 0.45, y: 0.034 * H * (1 - P.flatTop * flat) },
    { x: xV + (xO - xV) * tL + pb.x - 0.2 * bun, y: 0.1 * H * (1 - P.flatLambda * flat) * (1 - P.parietalDy * sk.parietalHeight) + pb.y, id: 'lambda' },
    { x: xO * (0.99 + oUp) - 0.6 * bun, y: yO - 0.14 * H },
    { x: xO - bun, y: yO, id: 'opisthocranion' },
    { x: xO * (0.965 + oLow) + P.slopeX * H * sk.occipitalSlope - 0.55 * bun, y: yO + (yIn - yO) * 0.55 },
    { x: xO * 0.93 + 0.035 * H * (sk.inion - 0.4) + P.slopeX * H * sk.occipitalSlope * 1.3 - P.nuchalX * H * sk.nuchalLine - 0.25 * bun - P.inionSizeX * H * sk.inionSize, y: yIn, id: 'inion' },
  ];
  const front: CPoint[] = [
    { x: x.front - 0.002 * H + P.glabellaX * H * sk.glabella + P.archX * H * archU + 0.5 * mx, y: yGl - 0.052 * H, id: 'supraglabella' },
    { x: xFe, y: yFe, id: 'frontalEminence' },
    { x: xFt, y: 0.075 * H * (1 - P.flatBregma * flat), id: 'bregma' },
    { x: xFt + (xV - xFt) * 0.55, y: 0.016 * H * (1 - P.flatTop * flat) },
  ];
  return { front, back, nuchalTop: back[back.length - 1] as CPoint };
}

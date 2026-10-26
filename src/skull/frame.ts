import { faceLandmarks } from '../face/landmarks';
import { Resolver, type Correction } from '../core/resolve';
import type { FaceParams } from '../schema';
import type { SkullParams } from './types';

/**
 * CADRE DE PROPORTIONS DU PROFIL : toutes les hauteurs viennent des repères du visage de FACE (`faceLandmarks`, source unique), ramenées à
 * la hauteur sommet → menton (`f` = fraction de H). Les profondeurs (x, avant > 0, origine = porion) sont calculées ici à partir des axes
 * du visage (nez, lèvres, menton) et du crâne (`SkullParams`). Aucune valeur n'est tirée au hasard ici : fonction pure.
 */
export interface Frame {
  readonly H: number;
  /** Échelle px de l'hôte de face → px du profil (hauteurs identiques par construction). */
  readonly S: number;
  readonly hostH: number;
  /** Hauteurs (fractions de H, depuis le sommet). */
  readonly f: Record<'eye' | 'nasion' | 'glabella' | 'supra' | 'rhinion' | 'tip' | 'sub' | 'lsTop' | 'ls' | 'stomion' | 'li' | 'liBot' | 'sulcus' | 'pogonion' | 'porion' | 'inion' | 'occiput' | 'jawY' | 'hairline' | 'temple', number>;
  /** Profondeurs (px, origine au porion, l'avant vers +x). */
  readonly x: Record<'glabella' | 'nasion' | 'sub' | 'tip' | 'ls' | 'li' | 'stomion' | 'sulcus' | 'pogonion' | 'menton' | 'front' | 'back', number>;
  readonly corrections: readonly Correction[];
}

const HF = 400;
export function skullFrame(face: FaceParams, sk: SkullParams, H: number): Frame {
  const lm = faceLandmarks(face, HF * 0.8, HF);
  const base = lm.chinY + HF / 2;
  const S = H / base;
  const fy = (y: number): number => (y + HF / 2) / base;
  const R = new Resolver();
  const fEye = fy(lm.eyeY);
  const fNasion = fEye - (0.018 + 0.03 * face.nose.root.height);
  const fGl = fNasion - 0.042 - 0.012 * sk.browRidge;
  const fSub = fy(lm.noseBaseY);
  const fMouth = fy(lm.mouthY);
  const fSul = fy(lm.chin.sulcusY);
  const f = {
    eye: fEye, nasion: fNasion, glabella: fGl, supra: fGl - 0.05, rhinion: fNasion + 0.45 * (fSub - fNasion), tip: fy(lm.noseTipY), sub: fSub,
    lsTop: fy(lm.lips.topY), ls: (fy(lm.lips.topY) + fMouth) / 2, stomion: fMouth, li: (fMouth + fy(lm.lips.bottomY)) / 2, liBot: fy(lm.lips.bottomY),
    sulcus: fSul, pogonion: fSul + 0.55 * (1 - fSul), porion: fEye + 0.035, inion: fEye + 0.09, occiput: fGl + 0.02, jawY: fy(lm.jawY), hairline: fy(lm.hair.centerY), temple: fy(lm.hair.templeY),
  };
  const L = (0.8 + 0.06 * sk.length) * H;
  const Lf = 0.54 * L;
  const Lb = 0.46 * L;
  const xGl = Lf;
  const xNas = xGl - (0.012 + 0.028 * face.nose.root.depth + 0.012 * sk.browRidge) * H;
  const xSub = xGl - 0.018 * H + 0.05 * H * sk.maxilla;
  const xPg = xSub - 0.004 * H + (face.chin.projection - 0.5) * 0.07 * H;
  const nasalLen = (fSub - fNasion) * H;
  const xTip = xSub + nasalLen * (0.5 + 0.22 * face.nose.tip.projection);
  // Ligne E (pointe du nez → pogonion) : les lèvres restent derrière elle (contrainte anatomique consignée si elle ramène une valeur).
  const eLine = (fy_: number): number => xTip + ((xPg - xTip) * (fy_ - f.tip)) / (f.pogonion - f.tip);
  const xLs = R.limit('lip-e-line-upper', 'lips.upper', xSub + 0.014 * H + 0.03 * H * face.mouth.upperLip, eLine(f.ls) - 0.05 * H, eLine(f.ls) + 0.006 * H, 'la lèvre supérieure reste derrière la ligne E (nez → menton)');
  const xLi = R.limit('lip-e-line-lower', 'lips.lower', xLs - 0.002 * H + 0.02 * H * (face.mouth.lowerLip - face.mouth.upperLip), eLine(f.li) - 0.045 * H, eLine(f.li) + 0.008 * H, 'la lèvre inférieure reste derrière la ligne E');
  const xSt = Math.min(xLs, xLi) - 0.016 * H;
  const xSl = (xLi + xPg) / 2 - 0.012 * H * (0.4 + face.chin.mentolabial);
  return { H, S, hostH: HF, f, x: { glabella: xGl, nasion: xNas, sub: xSub, tip: xTip, ls: xLs, li: xLi, stomion: xSt, sulcus: xSl, pogonion: xPg, menton: xPg - 0.055 * H, front: Lf, back: -Lb }, corrections: R.applied };
}

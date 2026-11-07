import { clamp } from '../../core/math';
import { platysmaTension as platysma } from '../../neck/anatomy';
import type { FaceParams } from '../../schema';
import type { FaceLandmarks } from '../landmarks';
import type { Derived } from './dependencies';
import type { NeckGeo } from './types';

/**
 * Cou (T9). Angle cervico-mentonnier EFFECTIF = angle propre (`neck.cervicomentalDeg`) − effets de l'articulation : l'inclinaison de la tête vers le bas
 * (`headPitchDeg`) et l'abaissement de la mandibule ferment l'angle. La largeur du cou ne lit PAS la projection du menton (sauf couplage explicite `chinCoupling`).
 * En vue de face l'angle ne se voit pas directement : il règle la PROFONDEUR de l'ombre portée du menton sur le cou et la tension du platysma — c'est ce que le rendu lit.
 */
export function neckGeometry(p: FaceParams, lm: FaceLandmarks, d: Derived): NeckGeo {
  const a = p.deform.articulation;
  const { H } = lm;
  // Ouverture normalisée de la mandibule (0–1) : abaissement / abaissement maximal.
  const open = clamp(lm.jaw.drop / (0.08 * H), 0, 1);
  // 0,8° d'angle perdu par degré d'inclinaison ; 8° perdus à ouverture maximale ; plage physiologique 70°–160°.
  const cervicomentalDeg = clamp(p.neck.cervicomentalDeg - 0.8 * a.headPitchDeg - 8 * open, 70, 160);
  // Tension du platysma : formule UNIQUE du moteur de cou (`neck/anatomy.ts`).
  const platysmaTension = platysma(p.neck.platysma, a.headPitchDeg, open, a.clench);
  // Profondeur de l'ombre : base dépendante du menton (`Derived`), accrue quand l'angle se ferme (115° = neutre ; 50° d'écart = ×1,77).
  const shadowReachPx = Math.max(0.3 * d.submentalReachPx, d.submentalReachPx * (1 + (115 - cervicomentalDeg) / 65));
  const half = lm.neck.half;
  return {
    cervicomentalDeg,
    halfWidthPx: half,
    submentalBand: { c: { x: 0, y: lm.chinY + 0.4 * shadowReachPx }, rx: half * 0.9, ry: Math.max(0.004 * H, 0.5 * shadowReachPx), rotDeg: 0 },
    platysmaTension,
    shadowReachPx,
  };
}

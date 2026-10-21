import { clamp } from '../../core/math';
import { catmullRom } from '../curve';
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
  // Tension du platysma : ouverture, inclinaison (en valeur absolue) et serrage, pondérés par le contrat `neck.platysma`.
  const platysmaTension = clamp(p.neck.platysma * (0.6 * open + 0.5 * (Math.abs(a.headPitchDeg) / 30) + 0.4 * a.clench), 0, 1);
  // Profondeur de l'ombre : base dépendante du menton (`Derived`), accrue quand l'angle se ferme (115° = neutre ; 50° d'écart = ×1,77).
  const shadowReachPx = Math.max(0.3 * d.submentalReachPx, d.submentalReachPx * (1 + (115 - cervicomentalDeg) / 65));
  const half = lm.neck.half;
  const scm = (s: -1 | 1): NeckGeo['scm']['left'] => catmullRom([{ x: s * half * 0.95, y: lm.jawY }, { x: s * half * 0.7, y: lm.chinY + 0.3 * (lm.neck.bottomY - lm.chinY) }, { x: s * half * 0.3, y: lm.neck.bottomY }], false, 6);
  return {
    cervicomentalDeg,
    halfWidthPx: half,
    submentalBand: { c: { x: 0, y: lm.chinY + 0.4 * shadowReachPx }, rx: half * 0.9, ry: Math.max(0.004 * H, 0.5 * shadowReachPx), rotDeg: 0 },
    scm: { left: scm(-1), right: scm(1) },
    platysmaTension,
    shadowReachPx,
  };
}

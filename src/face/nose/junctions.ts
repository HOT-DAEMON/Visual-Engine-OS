import { catmullRom, lerp } from '../curve';
import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import type { FaceLandmarks } from '../landmarks';
import type { NoseFrame } from './frame';
import type { NoseAlaGeo, NoseJunctionsGeo } from './types';

/**
 * Raccords du nez avec le reste du visage. Un composant qui « flotte » devant la tête est un composant sans raccord : ici chaque
 * frontière du nez avec un voisin est une COURBE nommée, avec la profondeur d'ombre qui lui correspond.
 *  - glabelle ↔ front : encoche sous la glabelle, creusée par l'enfoncement de la racine ;
 *  - paroi ↔ orbite : creux naso-jugal, du canthus interne vers le bas, le long de la paroi jusqu'à la crête alaire ;
 *  - aile ↔ joue : sillon alaire, le long du bord extérieur de l'aile ;
 *  - nez ↔ région nasolabiale : pli naso-génien, de l'aile vers la commissure, creusé quand la bouche s'ouvre ou sourit.
 */
export function junctionGeometry(p: FaceParams, F: NoseFrame, lm: FaceLandmarks, alae: { left: NoseAlaGeo; right: NoseAlaGeo }): NoseJunctionsGeo {
  const j = p.nose.junction;
  const H = F.H;
  const orbital = (s: -1 | 1): Vec[] => {
    const crest = s === 1 ? alae.right.crest : alae.left.crest;
    // Du canthus interne (juste sous l'œil) à la crête alaire, en passant par la paroi (légèrement à l'extérieur d'elle).
    return catmullRom([{ x: s * F.canthusHalf * 1.02, y: lm.eyeY + 0.012 * H }, { x: s * lerp(F.canthusHalf, Math.abs(crest.x), 0.4), y: lerp(lm.eyeY, crest.y, 0.55) }, { x: crest.x * 1.04, y: crest.y }], false, 8);
  };
  // Sillon alaire : le bord extérieur de l'aile, décalé de 1,5 px vers l'extérieur.
  const groove = (a: NoseAlaGeo): Vec[] => a.outerEdge.map((q) => ({ x: q.x + a.side * 1.5, y: q.y }));
  const nasolabial = (s: -1 | 1, ala: NoseAlaGeo): Vec[] => {
    const corner: Vec = { x: s * lm.lips.half * 1.02, y: lm.lips.cornerY - 0.01 * H };
    const start: Vec = { x: s * F.alarX * 0.95, y: F.baseY - 0.008 * H };
    // Le pli s'écarte de la ligne médiane à mi-chemin (bombé vers l'extérieur) avant de rejoindre la commissure.
    return catmullRom([start, { x: s * F.alarX * 1.22, y: lerp(start.y, corner.y, 0.5) }, corner], false, 8).concat(ala.side === s ? [] : []);
  };
  const tissue = lm.jaw.tissue.nasolabialDeepen;
  return {
    glabella: { c: { x: 0, y: F.rootY - 0.025 * H }, rx: F.rootHalf * 1.8, ry: 0.03 * H, depth: (1 - j.glabella) * (0.3 + 0.7 * p.nose.root.depth) },
    orbital: { left: orbital(-1), right: orbital(1), depth: 1 - j.orbital },
    alarGroove: { left: groove(alae.left), right: groove(alae.right), depth: 1 - j.cheek },
    nasolabial: { left: nasolabial(-1, alae.left), right: nasolabial(1, alae.right), depth: Math.min(1, j.nasolabial * (1 + tissue)) },
  };
}

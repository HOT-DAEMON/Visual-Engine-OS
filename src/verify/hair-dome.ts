import { faceLandmarks } from '../face';
import { hairGeometry, type HairGeometry } from '../face/hair';
import { TUCK, rimGap } from '../face/hair/tuck';
import type { RandomFace } from '../generation/random-face';
import { check, type Check } from './types';

/**
 * VÉRIFICATION DE L'ÉPAULE DU DÔME, DE LA SOUS-COUCHE ET DU BALAYAGE DU VISAGE (`docs/HAIR-DOME-ROUND.md`, `docs/HAIR-FIT-SIDE.md`), trois couches. Seuils issus de mesures
 * (40 visages par coiffure, graines 9000 + 71 k, `docs/HAIR-DOME-VERIFY.md`) :
 *  - géométrie : aucune arête de mèche de dessus ne balaie le visage d'une joue à l'autre sous les sourcils (mesuré : 0 sur tout le corpus après correction ; bob 9568 avant : une bande
 *    de 0,88 W au niveau de la bouche) ;
 *  - anatomie  : la sous-couche ne dépasse pas des mèches (afro) : part des sommets du bord de coque sans mèche à moins de 0,03 W vers l'intérieur ;
 *  - style     : l'épaule du dôme d'un afro est ARRONDIE : demi-largeur de la coque au sommet du crâne / demi-largeur maximale (carré : proche de 0,85 ; rond : 0,69 à 0,78 mesuré).
 */
export const DOME_LIMITS = {
  /** Longueur d'arête (× W) à partir de laquelle une arête sous les sourcils « balaye » le visage. */
  sweepEdge: 0.6,
  /** Nombre d'arêtes de balayage toléré. */
  sweepMax: 0,
  /** Part maximale des sommets du bord de coque sans mèche (< `probe` × W vers l'intérieur) : mesuré p90 0,10, max 0,14 avec rentrage. */
  gapShare: 0.3,
  /** Distance de sondage vers l'intérieur (× W). */
  probe: 0.03,
  /** Rapport demi-largeur au sommet / demi-largeur maximale de la coque : mesuré max 0,78 avec l'épaule (0,85 avant). */
  shoulder: 0.81,
} as const;

/** Arêtes de mèches de dessus plus longues que `sweepEdge` × W et entièrement sous la limite des sourcils. */
export function faceSweepEdges(geo: HairGeometry, W: number, browY: number): number {
  let n = 0;
  for (const l of geo.locks) {
    if (l.layer !== 'front') continue;
    for (let k = 0; k < l.poly.length; k++) {
      const a = l.poly[k]!, b = l.poly[(k + 1) % l.poly.length]!;
      if (Math.min(a.y, b.y) > browY && Math.abs(b.x - a.x) > DOME_LIMITS.sweepEdge * W) n++;
    }
  }
  return n;
}

/** Demi-largeur de la coque à hauteur du sommet du crâne (± 0,03 H) / demi-largeur maximale de la coque. */
export function shoulderRatio(geo: HairGeometry, H: number): number {
  const base = geo.base[0];
  if (!base) return 0;
  const top = geo.boundary.skull.topY;
  const near = base.filter((v) => Math.abs(v.y - top) < 0.03 * H).map((v) => Math.abs(v.x));
  const wide = base.reduce((m, v) => Math.max(m, Math.abs(v.x)), 1e-9);
  return Math.max(0, ...near) / wide;
}

export function checkHairDome(face: RandomFace, override?: HairGeometry): Check[] {
  const p = face.params;
  if (p.hair.style === 'bald') return [];
  const lm = faceLandmarks(p, face.width, face.height);
  const geo = override ?? hairGeometry(p, lm);
  if (!geo) return [];
  const L = DOME_LIMITS;
  const out: Check[] = [];
  out.push(check('geometry', 'hair-no-face-sweep', '<=', faceSweepEdges(geo, lm.W, lm.browLimitY), L.sweepMax, 'une mèche balaye le visage d\'une joue à l\'autre sous les sourcils (sommet projeté du mauvais côté)'));
  if (p.hair.style in TUCK && geo.base[0]) {
    out.push(check('anatomy', 'dome-base-hugs-strands', '<=', rimGap(geo.base[0], geo.boundary.skull, lm.W, { x: 0, y: lm.hair.sideY }, geo.locks, L.probe), L.gapShare, 'la sous-couche dépasse des mèches (croissant de teinte de racine)'));
    out.push(check('style', 'dome-shoulder-round', '<=', shoulderRatio(geo, lm.H), L.shoulder, 'l\'épaule du dôme est carrée (dessus aplati, « champignon »)'));
  }
  return out;
}

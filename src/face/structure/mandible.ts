import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import { jawline } from '../jaw/regions';
import { jawSilhouette } from '../jaw/structure';
import type { FaceLandmarks } from '../landmarks';
import { halfWidthAt, rightSamples } from '../outline';
import { polylineLength } from '../curve';
import type { MandibleGeo } from './types';

const mirror = (q: Vec): Vec => ({ x: -q.x, y: q.y });

/**
 * Mandibule (T3, T4) : les régions osseuses lues sur le contour RÉEL du visage (`lm.outline`) — jamais redessinées à côté.
 * Contour échantillonné de haut en bas, `y` strictement croissant : chaque région est une tranche d'ordonnées.
 *   branche montante : de la tempe au gonion · corps horizontal : du gonion au coin du menton · bord inférieur : tout le contour bas.
 * Les régions molles qui la recouvrent (masséter, région préauriculaire) sont des polygones calculés ici, pour que le rendu ne les invente pas.
 */
export function mandibleGeometry(p: FaceParams, lm: FaceLandmarks): MandibleGeo {
  const { W, H } = lm;
  const r = rightSamples(lm.outline, 24);
  const g = lm.outline.keys.gonion;
  const c = lm.outline.keys.chinCorner;
  const templeY = -H / 2 + p.templeY * H;
  // Branche montante : du temple (y = templeY) au gonion ; corps : du gonion au coin du menton.
  const ramus = r.filter((q) => q.y >= templeY && q.y <= g.y);
  const body = r.filter((q) => q.y >= g.y && q.y <= c.y);
  // Transition préauriculaire : bande le long de la branche, vers l'INTÉRIEUR du visage ; sa largeur croît avec `preauricular` (fondu) et la profondeur de la mandibule.
  const w = (0.018 + 0.045 * p.mandible.preauricular) * W * (0.7 + 0.6 * p.mandible.depth);
  const strip = [...ramus, ...[...ramus].reverse().map((q): Vec => ({ x: q.x - w, y: q.y }))];
  // Masséter : ellipse allongée le long de la branche, de l'arcade zygomatique (eyeY + 0,1 H) au gonion.
  const yTop = lm.eyeY + 0.1 * H;
  const yMid = (yTop + g.y) / 2;
  // Volume = repos + serrage ; plus il est gros, plus l'ellipse est large. Le relief (définition) agit sur le rendu, pas sur la forme.
  const vol = Math.min(1, p.softTissue.masseter.volume + 0.6 * p.deform.articulation.clench);
  const mass = (s: -1 | 1): MandibleGeo['masseter']['left'] => ({ c: { x: s * halfWidthAt(lm.outline, yMid) * 0.78, y: yMid }, rx: (0.03 + 0.03 * vol) * W, ry: Math.max(0.01 * H, (g.y - yTop) * 0.5), rotDeg: s * 6 });
  return {
    silhouette: jawSilhouette(p, W),
    ramus,
    gonion: g,
    gonialDeg: lm.jaw.gonialDeg,
    body,
    bodyLengthPx: polylineLength(body),
    lowerBorder: jawline(lm),
    preauricular: { right: strip, left: strip.map(mirror) },
    masseter: { left: mass(-1), right: mass(1) },
  };
}

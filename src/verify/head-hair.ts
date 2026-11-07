import { faceLandmarks } from '../face';
import { buildBoundary } from '../face/hair/boundary';
import { faceYToU, regionFromBoundary } from '../head-turntable/hair-bridge';
import { regionField, signedDistance, smoothRegion, U_PER_DEG } from '../head-turntable/hair-region';
import type { RandomFace } from '../generation/random-face';
import { sharpTeeth } from './hair-shape';
import { check, type Check } from './types';

/**
 * VÉRIFICATION DE LA LISIÈRE SUR LA TÊTE EN ROTATION (3 couches) : la région des cheveux de la tête tournante est dérivée de la lisière du visage
 * (`hair-bridge.ts`) ; on contrôle qu'elle lui reste fidèle et qu'elle est habitable.
 *  - géométrie : la région est fermée et finie ; chaque point visible de la lisière du visage tombe sur le bord de la région (±0,012 U) ;
 *  - anatomie  : yeux, sourcils et bouche sont HORS de la région des cheveux, à tout azimut où ils sont visibles ;
 *  - style     : le tracé déroulé (lisière lissée) n'a ni angle aigu ni marche : pas de dents quand la tête tourne.
 */
export function checkHeadHair(face: RandomFace): Check[] {
  const p = face.params;
  if (p.hair.style === 'bald') return [];
  const lm = faceLandmarks(p, face.width, face.height);
  const b = buildBoundary(p, lm), out: Check[] = [];
  const raw = regionFromBoundary(b), region = smoothRegion(raw), F = regionField(region);
  out.push(check('geometry', 'head-hair-region-finite', '==', region.every(([a, y]) => Number.isFinite(a) && Number.isFinite(y)) ? 1 : 0, 1, 'la région des cheveux contient un sommet non fini'));
  // Fidélité : les points RÉELS de la lisière (hors points artificiels du sommet) sont sur le bord de la région lissée.
  let worst = 0;
  for (const q of b.loop) if (Math.abs(q.az) < Math.PI - 0.05) worst = Math.max(worst, Math.abs(signedDistance(F, (q.az * 180) / Math.PI, faceYToU(b, q.y))));
  out.push(check('geometry', 'head-hair-edge-fidelity', '<=', worst, 0.012, 'la région des cheveux s\'écarte de la lisière du visage'));
  // Anatomie : points d'un visage de face (centre des yeux, des sourcils, de la bouche) → (azimut, U) puis distance signée.
  const S = b.skull;
  const probe = (x: number, y: number): number => signedDistance(F, (Math.asin(Math.max(-1, Math.min(1, x / S.a(y)))) * 180) / Math.PI, faceYToU(b, y));
  const feats = [lm.orbit.left, lm.orbit.right].flatMap((o) => [{ x: o.cx, y: o.cy }, { x: o.cx, y: o.cy - 0.1 * lm.H }]).concat([{ x: 0, y: lm.mouthY }]);
  out.push(check('anatomy', 'head-hair-features-clear', '<=', Math.max(...feats.map((f) => probe(f.x, f.y))), 0, 'un œil, un sourcil ou la bouche est dans la région des cheveux'));
  // Style : le tracé déroulé, en longueur de surface.
  const line = region.filter(([a, y]) => y > 0 && Math.abs(a) < 180).map(([a, y]) => ({ x: a * U_PER_DEG, y }));
  out.push(check('style', 'head-hair-edge-smooth', '<=', sharpTeeth(line, 0.02), 2, 'la lisière déroulée a des angles aigus (dents en rotation)', 'warn'));
  return out;
}

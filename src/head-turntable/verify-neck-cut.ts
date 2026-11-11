import { neckMeshes, PART } from './mesh';
import { CUT_TILT_DEG, isBellHead } from './engines/neck3d';
import { refView, renderHead, defaultFrame } from './render';
import type { HeadTurnSpec, TurnRender } from './types';
import { check, type Check } from './verify-types';

/**
 * COUPE OBLIQUE DU COU (têtes issues d'un visage ; `engines/neck3d.ts` `CUT_SLOPE`). Trois couches, mesurées sur le MAILLAGE et sur l'IMAGE, pas sur la formule :
 *  - géométrie : les points de la dernière rangée sont coplanaires (écart < 1e-6 U), la coupe tient dans le cadre commun (y ≤ 1,5 U), la différence de hauteur devant / derrière est bornée ;
 *  - anatomie : le devant (côté manubrium) est PLUS BAS que la nuque et la pente mesurée est dans la plage anatomique (T1 ≈ 25° ; plan de l'orifice thoracique jusqu'à ≈ 45°) ;
 *  - style : sur la vue de la planche (tangage 17,73°) le plan de coupe ne forme plus un « socle » (≤ 5 % des pixels du cou), et il reste bien peint quand la caméra le voit (tangage 60° : non vacuant).
 * Planche (cou à coupe horizontale mesurée) : aucun contrôle (`[]`).
 */
interface Cut { readonly slopeDeg: number; readonly planarity: number; readonly lowest: number; readonly dropFrontBack: number }
export function cutOf(spec: HeadTurnSpec): Cut {
  const cut = neckMeshes(spec)[1]!, K = cut.P.length - 1, ring = cut.P.slice(0, K);
  const front = ring[0]!, back = ring[K / 2]!, dz = front.z - back.z, dy = front.y - back.y;
  // Plan par le centre et la normale du maillage de coupe : écart max des points de la dernière rangée.
  const c = cut.P[K]!, n = cut.N[0]!, dev = Math.max(...ring.map((p) => Math.abs((p.x - c.x) * n.x + (p.y - c.y) * n.y + (p.z - c.z) * n.z)));
  return { slopeDeg: (Math.atan2(dy, dz) * 180) / Math.PI, planarity: dev, lowest: Math.max(...ring.map((p) => p.y)), dropFrontBack: dy };
}

export const share = (r: TurnRender): number => { let cut = 0, neck = 0; for (let i = 0; i < r.ids.length; i++) { if (r.ids[i] === PART.neckCut) cut++; else if (r.ids[i] === PART.neck) neck++; } return cut / Math.max(1, cut + neck); };

/** Les trois couches lisent les mêmes mesures : calculées UNE fois par spec (deux rendus + un maillage). */
const MEMO = new WeakMap<HeadTurnSpec, { geometry: Check[]; anatomy: Check[]; style: Check[] }>();
export function neckCutChecks(spec: HeadTurnSpec): { geometry: Check[]; anatomy: Check[]; style: Check[] } {
  let hit = MEMO.get(spec); if (!hit) MEMO.set(spec, (hit = compute(spec)));
  return hit;
}
function compute(spec: HeadTurnSpec): { geometry: Check[]; anatomy: Check[]; style: Check[] } {
  const out = { geometry: [] as Check[], anatomy: [] as Check[], style: [] as Check[] };
  if (!isBellHead(spec.engine)) return out;
  const m = cutOf(spec);
  out.geometry.push(check('geometry', 'head.neck.cut.planar', 'Coupe du cou : écart (U) des points de la dernière rangée au plan de coupe (coplanaires)', m.planarity, 0, 1e-6));
  out.geometry.push(check('geometry', 'head.neck.cut.frame', 'Coupe du cou : point le plus bas (U) dans le cadre commun des planches (≤ 1,5 U pour 1,55 U de cadre)', m.lowest, 0, 1.5));
  out.geometry.push(check('geometry', 'head.neck.cut.drop', 'Coupe du cou : devant moins nuque, différence de hauteur (U ; > 0 = devant plus bas)', m.dropFrontBack, 0.03, 0.3));
  out.anatomy.push(check('anatomy', 'head.anat.neck.cut.tilt', `Pente du plan de coupe (°) [orifice thoracique : devant plus bas ; T1 ≈ 25°, plan de l'orifice jusqu'à ≈ 45° ; réglage ${CUT_TILT_DEG}°]`, m.slopeDeg, 15, 45));
  const r = renderHead(refView(0), spec, { frame: defaultFrame(520), ss: 2 }), r60 = renderHead({ yaw: 0, pitch: 60 }, spec, { frame: defaultFrame(520), ss: 2 });
  out.style.push(check('style', 'head.style.neck.cut.socle', 'Plan de coupe / cou à 0° sur la planche (tangage 17,73°) : pas de « socle » (part des pixels du cou)', share(r), 0, 0.05));
  out.style.push(check('style', 'head.style.neck.cut.seen', 'Plan de coupe à 60° de tangage : il est peint quand la caméra le voit (part des pixels du cou ; non vacuant)', share(r60), 0.05, 0.9));
  return out;
}

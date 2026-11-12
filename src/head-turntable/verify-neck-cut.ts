import { neckCutRing, PART } from './mesh';
import { CUT_TILT_DEG, isBellHead } from './engines/neck3d';
import { defaultFrame, renderHead } from './render';
import type { HeadTurnSpec, TurnRender, View } from './types';
import { check, type Check } from './verify-types';

/**
 * BAS DU COU (têtes issues d'un visage). Le cou n'est plus refermé par un plan : il se prolonge et le rendu le coupe par une ligne horizontale du cadre (`neck-clip.ts`), comme les références
 * `rotation-3d/01` (voir `docs/HEAD-TURNTABLE-NECK-CUT.md`, suite 2). L'ANNEAU OBLIQUE de l'orifice thoracique (`neckCutRing`) reste le repère anatomique du bas du cou. Trois couches, mesurées sur le MAILLAGE et l'IMAGE :
 *  - géométrie : les points de l'anneau sont coplanaires (écart < 1e-6 U), l'anneau tient dans le cadre commun (y ≤ 1,5 U), la différence de hauteur devant / derrière est bornée ;
 *  - anatomie : le devant (manubrium) est PLUS BAS que la nuque, pente dans la plage anatomique (T1 ≈ 25° ; plan de l'orifice jusqu'à ≈ 45°) ;
 *  - style : AUCUN pixel de plan de coupe (« seau » elliptique) sous les vues à tangage > 0 qui le montraient, et le bas du cou y est une DROITE (largeur de la dernière rangée ≥ 90 % de celle 6 rangées plus haut ; une ellipse se resserre).
 * Planche (cou à coupe horizontale mesurée) : aucun contrôle (`[]`).
 */
interface Cut { readonly slopeDeg: number; readonly planarity: number; readonly lowest: number; readonly dropFrontBack: number }
export function cutOf(spec: HeadTurnSpec): Cut {
  const ring = neckCutRing(spec, 64), K = ring.length, front = ring[0]!, back = ring[K / 2]!, dz = front.z - back.z, dy = front.y - back.y, t = dy / dz;
  const dev = Math.max(...ring.map((p) => Math.abs(p.y - front.y - t * (p.z - front.z))));
  return { slopeDeg: (Math.atan2(dy, dz) * 180) / Math.PI, planarity: dev, lowest: Math.max(...ring.map((p) => p.y)), dropFrontBack: dy };
}

/** Pixels de plan de coupe (part des pixels de cou + coupe) : 0 pour les têtes issues d'un visage, > 0,15 pour la planche (le « socle » mesuré). */
export const share = (r: TurnRender): number => { let cut = 0, neck = 0; for (let i = 0; i < r.ids.length; i++) { if (r.ids[i] === PART.neckCut) cut++; else if (r.ids[i] === PART.neck) neck++; } return cut / Math.max(1, cut + neck); };

/** Largeur (pixels de cou) d'une rangée, et rangée la plus basse portant du cou. */
const rowWidth = (r: TurnRender, y: number): number => { let n = 0; for (let x = 0; x < r.w; x++) { const id = r.ids[y * r.w + x]; if (id === PART.neck || id === PART.neckCut) n++; } return n; };
/** Rapport largeur de la dernière rangée du cou / largeur 6 rangées plus haut (1 = bord droit ; une ellipse d'envers se resserre : < 0,6). */
export function bottomRatio(r: TurnRender): number {
  let bot = -1; for (let y = r.h - 1; y >= 0 && bot < 0; y--) if (rowWidth(r, y) > 0) bot = y;
  return bot < 7 ? 0 : rowWidth(r, bot) / Math.max(1, rowWidth(r, bot - 6));
}

/** Vues qui montraient le « seau » : tangage > 0 (caméra sous le menton), de face, de trois quarts et de profil. */
export const BUCKET_VIEWS: readonly View[] = [{ yaw: 90, pitch: 30 }, { yaw: 0, pitch: 60 }, { yaw: 45, pitch: 40 }, { yaw: 135, pitch: 30 }];

/** Les trois couches lisent les mêmes mesures : calculées UNE fois par spec (un maillage + une rangée de rendus). */
const MEMO = new WeakMap<HeadTurnSpec, { geometry: Check[]; anatomy: Check[]; style: Check[] }>();
export function neckCutChecks(spec: HeadTurnSpec): { geometry: Check[]; anatomy: Check[]; style: Check[] } {
  let hit = MEMO.get(spec); if (!hit) MEMO.set(spec, (hit = compute(spec)));
  return hit;
}
function compute(spec: HeadTurnSpec): { geometry: Check[]; anatomy: Check[]; style: Check[] } {
  const out = { geometry: [] as Check[], anatomy: [] as Check[], style: [] as Check[] };
  if (!isBellHead(spec.engine)) return out;
  const m = cutOf(spec);
  out.geometry.push(check('geometry', 'head.neck.cut.planar', 'Anneau de l\'orifice thoracique : écart (U) des points au plan (coplanaires)', m.planarity, 0, 1e-6));
  out.geometry.push(check('geometry', 'head.neck.cut.frame', 'Anneau de l\'orifice thoracique : point le plus bas (U) dans le cadre commun des planches (≤ 1,5 U pour 1,55 U de cadre)', m.lowest, 0, 1.5));
  out.geometry.push(check('geometry', 'head.neck.cut.drop', 'Anneau de l\'orifice thoracique : devant moins nuque, différence de hauteur (U ; > 0 = devant plus bas)', m.dropFrontBack, 0.03, 0.3));
  out.anatomy.push(check('anatomy', 'head.anat.neck.cut.tilt', `Pente de l\'orifice thoracique (°) [devant plus bas ; T1 ≈ 25°, plan de l\'orifice jusqu\'à ≈ 45° ; réglage ${CUT_TILT_DEG}°]`, m.slopeDeg, 15, 45));
  const rs = BUCKET_VIEWS.map((v) => renderHead(v, spec, { frame: defaultFrame(520), ss: 2 }));
  out.style.push(check('style', 'head.style.neck.cut.bucket', 'Pas de « seau » : part de pixels de plan de coupe (pire vue de tangage 30° – 60°)', Math.max(...rs.map(share)), 0, 0));
  out.style.push(check('style', 'head.style.neck.cut.flat', 'Bas du cou = droite du cadre : largeur de la dernière rangée / 6 rangées plus haut (pire vue ; une ellipse < 0,6)', Math.min(...rs.map(bottomRatio)), 0.9, 1.15));
  return out;
}

import type { BodyInput, NeckAnchor } from '../body';
import { bodyFrame } from '../body/frame';
import { BodyParams } from '../body/types';
import { renderVolumesPixel, type VolumeSet } from '../body/volume';
import { reliefHeight, type Shape } from '../body/volume/back-relief';
import { RELIEF_REPLACES } from '../body/volume/pixel';
import type { VCheck } from './volume';

const chk = (id: string, layer: VCheck['layer'], ok: boolean, detail: string): VCheck => ({ id, layer, ok, detail });
const CAM = { yaw: 180, pitch: 0, pivot: { x: 0, y: 0, z: 0 } };
const pts = (s: Shape): readonly (readonly [number, number])[] => (s.kind === 'blob' ? [s.c] : s.pts);
const find = (set: VolumeSet, id: string): Shape | undefined => set.relief?.shapes.find((s) => s.id === id);

/**
 * CONTRÔLES DU RELIEF DU HAUT DU DOS (itération 08), trois couches. Tous les seuils ont été posés APRÈS mesure sur les 13 archétypes (valeurs observées citées à côté).
 *  GÉOMÉTRIE : (1) toutes les formes du champ sont dans le tronc : |x| ≤ demi-largeur max du tronc + 0,02 h, y entre la base du cou − 0,02 h et la crête iliaque + 0,03 h ;
 *              (2) symétrie du champ : énergie Σ|h| du côté gauche / droit entre 0,9 et 1,1 (observé 0,97–0,99).
 *  ANATOMIE  : (3) portée verticale de la lame entre 4,5 et 6,5 vertèbres (anatomie : 5–6 ; observé 5,1–5,4) ; (4) bord médial à 0,20–0,34 de x.acr de la ligne médiane (observé 0,270–0,275) ;
 *              (5) épine ascendante vers l'acromion de 0,5 à 1,6 vertèbre (observé 0,86–1,24) ; (6) angle inférieur entre 6,0 et 9,5 vertèbres sous C7, soit T6–T9 (littérature : T7, parfois T8 ;
 *              observé 7,2–9,3 : l'adulte est à ≈ T9, bas de la fourchette — écart hérité de l'itération 04, voir docs/BODY-JUNCTIONS-08-REMAINING.md).
 *  STYLE     : image de dos à 460 px de haut avec / sans relief : (7) la silhouette ne change pas (≤ 20 pixels d'alpha ; observé 0) ; (8) le relief se voit : ≥ 3 % du corps modifié si vis ≥ 0,25
 *              (observé 5,5–8,3 %), sinon ≥ 0,3 % (observé 0,5–1,7 %) ; (9) il est doux : saut de luminance max entre voisins, dans la zone modifiée, ≤ 66/255 (observé 12,6–61,7 ; sans relief 55–65 —
 *              un premier essai à pentes non limitées atteignait 83–89 et dessinait un liseré dur) ; (10) les volumes remplacés restent dans les données mais ne sont plus dessinés (rhomboïde, infra-épineux, grand rond…).
 */
export function backReliefChecks(set: VolumeSet, raw: BodyInput, a: NeckAnchor): VCheck[] {
  const r = set.relief, out: VCheck[] = [];
  if (!r) return [chk('back.geo.relief-bounds', 'geometry', false, 'aucun champ de relief dans le jeu de volumes')];
  const H = r.H, f = bodyFrame(BodyParams.parse(raw), a), tk = set.byId.get('trunk')!, m = set.measures, vis = m.vis as number;
  const u = ((m.t12Y as number) - (m.c7Y as number)) / 12, XA = Math.abs(set.landmarks.get('acromion.L')!.x);
  // (1) bornes
  const xMax = Math.max(...tk.stations.map((s) => Math.abs(s.c.x) + s.a)), all = r.shapes.flatMap((s) => pts(s));
  const bx = Math.max(...all.map((p) => Math.abs(p[0]))), by0 = Math.min(...all.map((p) => p[1])), by1 = Math.max(...all.map((p) => p[1]));
  out.push(chk('back.geo.relief-bounds', 'geometry', bx <= xMax + 0.02 * H && by0 >= f.y.base - 0.02 * H && by1 <= f.y.crop + 0.03 * H,
    `formes dans |x| ≤ ${(bx / H).toFixed(3)} h (tronc : ${(xMax / H).toFixed(3)} + 0,02) et y ∈ [${(by0 / H).toFixed(3)}, ${(by1 / H).toFixed(3)}] h (cou − 0,02 … crête + 0,03 : ${((f.y.base - 0.02 * H) / H).toFixed(3)}, ${((f.y.crop + 0.03 * H) / H).toFixed(3)})`));
  // (2) symétrie : énergie |h| de chaque côté sur une grille
  let eL = 0, eR = 0; for (let j = 0; j < 90; j++) for (let i = 1; i < 70; i++) { const y = a.baseY + j * 0.012 * H, x = i * 0.0145 * H; eL += Math.abs(reliefHeight(r, x, y)); eR += Math.abs(reliefHeight(r, -x, y)); }
  out.push(chk('back.geo.relief-mirror', 'geometry', eL / eR >= 0.9 && eL / eR <= 1.1, `énergie du champ gauche / droite = ${(eL / eR).toFixed(2)} (0,9–1,1)`));
  // (3)–(6) anatomie, côté gauche (le droit est contrôlé par (2))
  const bl = find(set, 'blade.L'), sp = find(set, 'spine.L'), ia = find(set, 'inferior-angle.L');
  if (!bl || !sp || !ia || bl.kind !== 'poly' || sp.kind !== 'line' || ia.kind !== 'blob') return [...out, chk('back.ana.scapula-span', 'anatomy', false, 'lame, épine ou angle inférieur manquants dans le champ')];
  const ys = bl.pts.map((p) => p[1]), span = (Math.max(...ys) - Math.min(...ys)) / u, med = Math.min(...bl.pts.map((p) => Math.abs(p[0]))) / XA, rise = (sp.pts[0]![1] - sp.pts[sp.pts.length - 1]![1]) / u, lvl = (ia.c[1] - (m.c7Y as number)) / u;
  out.push(chk('back.ana.scapula-span', 'anatomy', span >= 4.5 && span <= 6.5, `la lame couvre ${span.toFixed(2)} vertèbres (4,5–6,5 ; anatomie 5–6)`));
  out.push(chk('back.ana.scapula-medial', 'anatomy', med >= 0.2 && med <= 0.34, `bord médial à ${med.toFixed(3)} × x.acr de la ligne médiane (0,20–0,34)`));
  out.push(chk('back.ana.spine-inclined', 'anatomy', rise >= 0.5 && rise <= 1.6, `l'épine monte de ${rise.toFixed(2)} vertèbre vers l'acromion (0,5–1,6)`));
  out.push(chk('back.ana.inferior-angle-level', 'anatomy', lvl >= 6 && lvl <= 9.5, `angle inférieur à ${lvl.toFixed(2)} vertèbres sous C7 (6,0–9,5 = T6–T9 ; T7–T8 attendu : ${lvl > 8.5 ? 'bas de la fourchette' : 'dans la zone usuelle'})`));
  // (7)–(9) style : deux rendus de dos
  const R = (on: boolean) => renderVolumesPixel(set, { skin: '#c99a76', heightPx: 460, camera: CAM, uid: `br${on ? 1 : 0}`, backRelief: on }), on = R(true), off = R(false), A = on.pixels, B = off.pixels, w = A.w, h = A.h;
  const lum = (P: Uint8ClampedArray, i: number): number => 0.3 * P[i]! + 0.59 * P[i + 1]! + 0.11 * P[i + 2]!;
  let dAlpha = 0, body = 0, ch = 0, mxJ = 0;
  for (let i = 0; i < A.rgba.length; i += 4) { if (Math.abs(A.rgba[i + 3]! - B.rgba[i + 3]!) > 8) dAlpha++; if (A.rgba[i + 3]! > 200) body++; }
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = (y * w + x) * 4; if (Math.abs(A.rgba[i]! - B.rgba[i]!) <= 6) continue; ch++;
    if (A.rgba[i + 3]! >= 250) mxJ = Math.max(mxJ, Math.abs(lum(A.rgba, i) - lum(A.rgba, i + 4)), Math.abs(lum(A.rgba, i) - lum(A.rgba, i + w * 4)));
  }
  const share = (100 * ch) / Math.max(1, body), need = vis >= 0.25 ? 3 : 0.3;
  out.push(chk('back.sty.relief-silhouette', 'style', dAlpha <= 20, `le relief change ${dAlpha} pixels d'alpha (≤ 20) : la silhouette n'est pas touchée`));
  out.push(chk('back.sty.relief-visible', 'style', share >= need, `${ch} pixels modifiés = ${share.toFixed(1)} % du corps (≥ ${need} % pour vis = ${vis.toFixed(2)})`));
  out.push(chk('back.sty.relief-soft', 'style', mxJ <= 66, `saut de luminance max entre voisins dans la zone du relief : ${mxJ.toFixed(1)}/255 (≤ 66 ; ancien rendu à bâtonnets : 55–65)`));
  const drawn = new Set(on.ids), repl = set.volumes.filter((v) => RELIEF_REPLACES.test(v.id)), stillDrawn = repl.filter((v) => drawn.has(v.id));
  out.push(chk('back.sty.relief-replaces-sticks', 'style', repl.length >= 10 && stillDrawn.length === 0, `${repl.length} volumes remplacés présents dans les données, ${stillDrawn.length} encore dessinés (0 attendu)`));
  return out;
}

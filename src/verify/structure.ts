import { faceLandmarks, halfWidthAt, noseGeometry, type FaceLandmarks, type NoseGeometry } from '../face';
import { facePose } from '../face/deform';
import { mouthGeometry, type MouthGeo } from '../face/mouth';
import { inPoly, polyArea, type Poly } from '../face/poly';
import { structureGeometry, type StructureGeometry } from '../face/structure';
import { applyStylization, relationsOf } from '../face/stylize';
import type { RandomFace } from '../generation/random-face';
import { FaceParams } from '../schema';
import { check, type Check } from './types';

/**
 * VÉRIFICATION DU MOTEUR DE STRUCTURE (T14) — les trois couches du cahier des charges, chiffrées et reproductibles :
 *   géométrie : tout est fini, non dégénéré, contenu là où il doit l'être ;
 *   anatomie  : chaque région est à sa place relative, les trois déformations respectent leurs invariants ;
 *   style     : les relations essentielles survivent à l'exagération, le mode de rendu ne touche pas à la géométrie.
 * (Les mesures sur l'IMAGE rendue sont dans `scripts/lib/verify-render.ts` : elles demandent un rastériseur.)
 * Ces contrôles ne s'exécutent que pour `anatomyEngine: 'structured'` : sur un visage `classic` ils renvoient une liste vide.
 */
export interface StructureContext {
  readonly p: FaceParams;
  readonly lm: FaceLandmarks;
  readonly nose: NoseGeometry;
  readonly g: StructureGeometry;
  readonly mouth: MouthGeo;
}

export function structureContext(face: RandomFace): StructureContext {
  const p = face.params;
  const lm = faceLandmarks(p, face.width, face.height);
  const nose = noseGeometry(p, lm);
  return { p, lm, nose, g: structureGeometry(p, lm, nose), mouth: mouthGeometry(p, lm) };
}

const fin = (pts: readonly { x: number; y: number }[]): boolean => pts.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y));
const blobOk = (b: { c: { x: number; y: number }; rx: number; ry: number }): boolean => fin([b.c]) && b.rx > 0 && b.ry > 0 && Number.isFinite(b.rx) && Number.isFinite(b.ry);
const inside = (poly: Poly, inner: Poly): number => (inner.length === 0 ? 1 : inner.filter((q) => inPoly(poly, q.x, q.y)).length / inner.length);

/** Empreinte de la GÉOMÉTRIE (coordonnées arrondies à 1e-6) : égale ⇒ même anatomie, quel que soit le mode de rendu. */
export function geometryDigest(p: FaceParams, W: number, H: number): string {
  const lm = faceLandmarks(p, W, H);
  const nose = noseGeometry(p, lm);
  const m = mouthGeometry(p, lm);
  const g = structureGeometry(p, lm, nose);
  const r = (n: number): number => Math.round(n * 1e6) / 1e6;
  const pts = (a: readonly { x: number; y: number }[]): number[] => a.flatMap((q) => [r(q.x), r(q.y)]);
  return JSON.stringify([pts(g.mandible.lowerBorder), pts(nose.silhouette), pts(m.closure), pts(m.upperLip), pts(m.lowerLip), pts(nose.regions.base.poly), r(g.neck.cervicomentalDeg)]);
}

/** COUCHE GÉOMÉTRIE de la structure. */
export function structureGeometryChecks(c: StructureContext): Check[] {
  const { p, lm, nose, g, mouth } = c;
  if (p.anatomyEngine !== 'structured') return [];
  const o: Check[] = [];
  const k = (id: string, cmp: '<=' | '>=' | '==', v: number, lim: number, msg: string, sev: 'error' | 'warn' = 'error'): void => void o.push(check('geometry', id, cmp, v, lim, msg, sev));
  const R = nose.regions;
  const polys: Poly[] = [R.sidewalls.left.poly, R.sidewalls.right.poly, R.domes.left.poly, R.domes.right.poly, R.base.poly, R.columella.poly, R.philtrum.poly, R.nostrils.left.aperture, R.nostrils.right.aperture, mouth.upperLip, mouth.lowerLip];
  k('structure-nose-finite', '==', polys.every(fin) ? 1 : 0, 1, 'un sommet des régions du nez n\'est pas fini');
  k('structure-nose-polys-nondegenerate', '>=', Math.min(...polys.map((q) => Math.abs(polyArea(q)))), 0.5, 'un polygone de région du nez est dégénéré');
  k('structure-sidewall-width-positive', '>=', Math.min(R.sidewalls.left.meanWidthPx, R.sidewalls.right.meanWidthPx), 0.3, 'une paroi latérale du nez a une largeur nulle');
  k('structure-aperture-in-outer', '>=', Math.min(inside(R.nostrils.left.outer, R.nostrils.left.aperture), inside(R.nostrils.right.outer, R.nostrils.right.aperture)), 0.98, 'l\'ouverture d\'une narine sort de son contour');
  k('structure-domes-in-tip', '>=', Math.min(inside(nose.tip.poly, R.domes.left.poly), inside(nose.tip.poly, R.domes.right.poly)), 0.9, 'un dôme alaire sort de la pointe');
  k('structure-philtrum-length', '>=', R.philtrum.lengthPx, 0.02 * lm.H, 'le philtrum est trop court (le nez touche la lèvre)');
  const blobs = [g.chin.dimple, g.chin.upper, g.chin.lateral.left, g.chin.lateral.right, g.chin.lower, g.mandible.masseter.left, g.mandible.masseter.right, g.neck.submentalBand, g.tissue.submental.blob, g.tissue.perioral.upper, g.tissue.perioral.lower, ...[g.tissue.cheeks.left, g.tissue.cheeks.right].flatMap((ch) => [ch.zygoma, ch.volume, ch.hollow, ch.masseterBlend])];
  k('structure-blobs-valid', '==', blobs.every(blobOk) ? 1 : 0, 1, 'un volume mou a un centre ou des rayons invalides');
  k('structure-mandible-body-positive', '>=', g.mandible.bodyLengthPx, 1, 'le corps de la mandibule est de longueur nulle');
  k('structure-closure-monotone-x', '<=', Math.max(0, ...mouth.closure.slice(1).map((q, i) => (mouth.closure[i] as { x: number }).x - q.x)), 1e-9, 'la ligne de fermeture se replie en x');
  k('structure-corners-inside-contour', '<=', mouth.halfWidth, 0.8 * halfWidthAt(lm.outline, Math.min(lm.chinY - 1e-3, lm.mouthY)) + 1e-6, 'une commissure touche le contour');
  k('structure-cervicomental-range', '>=', Math.min(g.neck.cervicomentalDeg - 70, 160 - g.neck.cervicomentalDeg), 0, 'angle cervico-mentonnier hors de 70°–160°');
  return o;
}

/** COUCHE ANATOMIE de la structure. */
export function structureAnatomyChecks(c: StructureContext): Check[] {
  const { p, lm, nose, g, mouth } = c;
  if (p.anatomyEngine !== 'structured') return [];
  const o: Check[] = [];
  const k = (id: string, cmp: '<=' | '>=' | '==', v: number, lim: number, msg: string, sev: 'error' | 'warn' = 'error', tol = 1e-6): void => void o.push(check('anatomy', id, cmp, v, lim, msg, sev, tol));
  const R = nose.regions;
  k('structure-columella-above-lip', '>=', lm.lips.topY - R.columella.bottomY, 0.01 * lm.H, 'la columelle descend sur la lèvre supérieure');
  k('structure-domes-above-nostrils', '>=', Math.min(R.nostrils.left.outer.reduce((s, q) => s + q.y, 0) / R.nostrils.left.outer.length - R.domes.left.c.y, R.nostrils.right.outer.reduce((s, q) => s + q.y, 0) / R.nostrils.right.outer.length - R.domes.right.c.y), 0, 'un dôme alaire est sous les narines');
  k('structure-groove-outside-nostril', '>=', Math.min(...[R.grooves.left, R.grooves.right].map((gr, i) => Math.min(...gr.line.map((q) => Math.abs(q.x))) - Math.abs((i === 0 ? nose.nostrils.left : nose.nostrils.right).c.x) * 0.9)), 0, 'un sillon alaire est à l\'intérieur d\'une narine');
  k('structure-masseter-between-zygoma-and-gonion', '>=', Math.min(g.mandible.masseter.right.c.y - g.tissue.cheeks.right.zygoma.c.y, g.mandible.gonion.y - g.mandible.masseter.right.c.y), 0, 'le masséter n\'est pas entre la pommette et l\'angle de la mâchoire');
  const s = g.mandible.silhouette;
  k('structure-jaw-width-decomposition', '==', s.outerHalf, Math.min(0.495 * lm.W, s.boneHalf + s.muscleHalf + s.fatHalf), 'la silhouette de la mâchoire n\'est pas la somme os + muscle + graisse', 'error', 1e-6);
  k('structure-silhouette-covers-bone', '>=', s.outerHalf, s.boneHalf - 1e-6, 'les tissus mous rétrécissent la mâchoire sous son os');
  // Maintien du volume des lèvres : même visage SANS expression → rapport des aires.
  const rest = mouthGeometry(FaceParams.parse({ ...p, deform: { ...p.deform, expression: {} } }), lm);
  const ratio = (mouth.areas.upper + mouth.areas.lower) / (rest.areas.upper + rest.areas.lower);
  k('structure-lip-volume-preserved', '>=', Math.min(ratio, 1 / ratio), 0.93, 'l\'expression change le volume des lèvres de plus de 7 %');
  // Dents inférieures et lèvre inférieure LIÉES à la mandibule : au centre elles descendent d'au moins autant qu'aux commissures.
  const mid = (mouth.closure.length - 1) / 2;
  const dropAt = (i: number): number => (mouth.lowerLip[i] as { y: number }).y - (mouth.closure[i] as { y: number }).y;
  // Bouche ouverte : le centre de la lèvre doit descendre nettement plus (≥ 30 % de plus) que le voisinage de la commissure ; une descente uniforme serait une lèvre libre.
  if (mouth.gapPx > 0.004 * lm.H) k('structure-lower-lip-skinned-to-jaw', '>=', dropAt(mid) - dropAt(2), 0.3 * dropAt(mid), 'la lèvre inférieure descend uniformément : elle n\'est pas liée à la mandibule');
  if (mouth.cavity.length) k('structure-lower-teeth-in-cavity', '>=', inside(mouth.cavity.length ? [...mouth.cavity] : [], mouth.lowerTeeth), 0.9, 'les dents inférieures sortent de la cavité');
  const pose = facePose(p, lm, g.tissue.cheeks);
  k('structure-cheek-stretch-bounded', '<=', Math.max(pose.cheeks.left.stretch, pose.cheeks.right.stretch, 1 / pose.cheeks.left.stretch, 1 / pose.cheeks.right.stretch), 1.6, 'la joue est étirée ou comprimée de plus de 60 % : le champ de tissu est excessif', 'warn');
  return o;
}

/** COUCHE STYLE de la structure. */
export function structureStyleChecks(c: StructureContext, W: number, H: number): Check[] {
  const { p, lm } = c;
  if (p.anatomyEngine !== 'structured') return [];
  const o: Check[] = [];
  const k = (id: string, cmp: '<=' | '>=' | '==', v: number, lim: number, msg: string, sev: 'error' | 'warn' = 'error'): void => void o.push(check('style', id, cmp, v, lim, msg, sev));
  // Relations essentielles : chacune doit avoir une marge ≥ 0, quelle que soit l'exagération.
  for (const rel of relationsOf(lm)) k(`structure-relation:${rel.id}`, '>=', rel.margin, 0, rel.message);
  // Idempotence du profil : l'appliquer deux fois = l'appliquer une fois.
  const once = applyStylization(p);
  k('structure-stylization-idempotent', '==', JSON.stringify(applyStylization(once)) === JSON.stringify(once) ? 1 : 0, 1, 'le profil de stylisation n\'est pas idempotent');
  // Le mode de rendu et le niveau de détail ne reconstruisent pas l'anatomie : même empreinte géométrique.
  const d0 = geometryDigest(p, W, H);
  const same = (patch: Record<string, unknown>): boolean => geometryDigest(FaceParams.parse({ ...p, ...patch }), W, H) === d0;
  const modes = (['realistic', 'anime', 'ink'] as const).every((m) => same({ renderMode: m }));
  k('structure-render-mode-keeps-geometry', '==', modes ? 1 : 0, 1, 'changer le mode de rendu a modifié la géométrie');
  k('structure-detail-keeps-geometry', '==', same({ stylization: { ...p.stylization, detail: 0, outline: 1 } }) ? 1 : 0, 1, 'le niveau de détail ou les contours ont modifié la géométrie');
  k('structure-outline-bounded', '<=', p.stylization.outline, 1, 'intensité des contours hors [0, 1]');
  return o;
}

/** Les trois couches de la structure, dans l'ordre. */
export function checkStructure(face: RandomFace): Check[] {
  const c = structureContext(face);
  return [...structureGeometryChecks(c), ...structureAnatomyChecks(c), ...structureStyleChecks(c, face.width, face.height)];
}

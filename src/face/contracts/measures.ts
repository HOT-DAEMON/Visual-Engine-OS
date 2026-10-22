import { faceLandmarks } from '../landmarks';
import { noseGeometry } from '../nose';
import { measureStructure, structureGeometry } from '../structure';
import { earGeometry } from '../ears-geometry';
import { mouthGeometry } from '../mouth';
import { applyStylization } from '../stylize';
import type { FaceParams } from '../../schema';
import { polyArea, type Poly } from '../poly';

/**
 * MESURES OBSERVABLES du visage : le vocabulaire unique des contrats, des invariants et des tests de dépendance.
 * Règle : une mesure est calculée sur la GÉOMÉTRIE produite (jamais lue dans un paramètre), en pixels ou en degrés, finie, déterministe.
 * Les 16 mesures de la structure (`measureStructure`) sont reprises telles quelles ; le nez et la bouche s'y ajoutent.
 */
export function measureFace(p0: FaceParams, W: number, H: number): Record<string, number> {
  // Le visage RENDU est le visage stylisé (idempotent) : on mesure la même chose que ce qui est dessiné.
  const p = applyStylization(p0);
  const lm = faceLandmarks(p, W, H);
  const nose = noseGeometry(p, lm);
  const g = structureGeometry(p, lm, nose);
  const ch = g.tissue.cheeks.right;
  const ear = earGeometry(p, lm)[0];
  return {
    ...measureStructure(p, W, H),
    'nose.lengthPx': nose.baseY - nose.root.y,
    'nose.widthPx': nose.widthPx,
    'nose.baseY': nose.baseY,
    'nose.columellaBottomY': nose.columella.bottomY,
    'mouth.halfWidthPx': lm.lips.half,
    'mouth.cornerY': lm.lips.cornerY,
    'mouth.upperLipPx': lm.lips.upperH,
    'mouth.lowerLipPx': lm.lips.lowerH,
    'mouth.openPx': lm.lips.openH,
    // Joues (côté droit : le visage structuré est symétrique avant `asymmetry`) : aires des volumes (π·rx·ry) et largeur latérale.
    'cheek.zygomaArea': Math.PI * ch.zygoma.rx * ch.zygoma.ry,
    'cheek.volumeArea': Math.PI * ch.volume.rx * ch.volume.ry,
    'cheek.hollowArea': Math.PI * ch.hollow.rx * ch.hollow.ry,
    'cheek.masseterBlendArea': Math.PI * ch.masseterBlend.rx * ch.masseterBlend.ry,
    'cheek.lateralWidthPx': ch.lateralWidthPx,
    'cheek.foldLengthPx': polyLen(g.tissue.folds.nasolabial.right) + polyLen(g.tissue.folds.perioral.right),
    // Détails du menton : creux, sillon, pli sous la lèvre, tampon.
    'chin.heightPx': g.chin.heightPx,
    'chin.projectionPx': g.chin.projectionPx,
    'chin.flatness': g.chin.flatness,
    'chin.dimpleArea': Math.PI * g.chin.dimple.rx * g.chin.dimple.ry,
    'chin.grooveLengthPx': polyLen(g.chin.groove),
    'chin.sulcusY': lm.chin.sulcusY,
    'chin.padArea': Math.PI * g.tissue.perioral.lower.rx * g.tissue.perioral.lower.ry,
    'neck.submentalPx': g.tissue.submental.thicknessPx,
    // Yeux, crâne, oreilles : positions et tailles sur les repères.
    'eye.lineY': lm.eyeY,
    'eye.gapPx': lm.innerCanthus.right.x - lm.innerCanthus.left.x,
    'eye.leftY': lm.innerCanthus.left.y,
    'eye.rightY': lm.innerCanthus.right.y,
    'cranium.templeY': (lm.outline.right[0] as { p3: { y: number } }).p3.y,
    'mandible.gonionY': lm.jaw.gonion.y,
    'mouth.centerY': lm.mouthY,
    'ear.heightPx': ear ? 2 * ear.ry : 0,
    'ear.widthPx': ear ? 2 * ear.rx : 0,
    'ear.tiltDeg': ear ? ear.tiltDeg : 0,
    // Empreintes de forme par groupe (somme des aires des polygones, longueurs des polylignes et aires des ellipses du groupe) :
    // toute modification GÉOMÉTRIQUE d'une région la change ; un paramètre qui ne change aucune empreinte n'agit que sur l'ombrage.
    ...shapeGroups('philtrum.shape', { philtrum: (nose.regions as unknown as Record<string, unknown>).philtrum }),
    ...shapeGroups('nose.shape', { ...omit(nose.regions as unknown as Record<string, unknown>, 'philtrum'), tip: nose.tip, alae: nose.alae, dorsum: nose.dorsum, nostrilGeo: nose.nostrils }),
    ...shapeGroups('nasolabial.shape', { junctions: nose.junctions }),
    ...shapeGroups('mouth.shape', mouthGeometry(p, lm) as unknown as Record<string, unknown>),
  };
}

/** Composant propriétaire de chaque mesure : préfixe avant le point (`mandible.*` → `mandible`). */
export const componentOf = (measure: string): string => measure.split('.')[0] as string;

/** Longueur d'une polyligne (px). */
const polyLen = (a: readonly { x: number; y: number }[]): number => a.slice(1).reduce((t, q, i) => t + Math.hypot(q.x - a[i]!.x, q.y - a[i]!.y), 0);

/** Empreinte scalaire d'une forme quelconque : Σ |aire| des polygones (≥ 3 points) + Σ longueurs des polylignes + Σ π·rx·ry des ellipses, récursivement. */
export function shapeSum(x: unknown): number {
  if (Array.isArray(x)) {
    const isVec = x.length > 1 && x.every((q) => q && typeof q === 'object' && typeof (q as { x?: unknown }).x === 'number' && typeof (q as { y?: unknown }).y === 'number');
    if (isVec) return (x.length >= 3 ? Math.abs(polyArea(x as Poly)) : 0) + polyLen(x as { x: number; y: number }[]);
    return x.reduce((t: number, e) => t + shapeSum(e), 0);
  }
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    if (typeof o.rx === 'number' && typeof o.ry === 'number') return Math.PI * o.rx * o.ry;
    if (typeof o.x === 'number' && typeof o.y === 'number') return 0;
    return Object.keys(o).sort().reduce((t, k) => t + shapeSum(o[k]), 0);
  }
  return 0;
}

/** Une mesure `prefix.<groupe>` par clé de premier niveau (groupes vides ignorés). */
function shapeGroups(prefix: string, o: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(o).sort()) { const v = shapeSum(o[k]); if (v > 0 || Array.isArray(o[k]) || typeof o[k] === 'object') out[`${prefix}.${k}`] = v; }
  return out;
}

const omit = (o: Record<string, unknown>, k: string): Record<string, unknown> => Object.fromEntries(Object.entries(o).filter(([key]) => key !== k));

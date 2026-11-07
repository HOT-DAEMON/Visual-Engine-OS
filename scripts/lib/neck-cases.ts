import { frontSilhouette, neckModelFor, profileSilhouette } from '../../src/neck';
import { NeckSystem } from '../../src/schema/neck-system';
import { decodePng } from '../../src/regression/png';
import { cellSvg } from './board';
import { rasterPng } from './raster';

/**
 * CAS DE PREUVE VISUELLE DU COU : un cas par paramètre de `NeckSystem` (la garde `tests/neck-visible.test.ts` exige que CHAQUE feuille du schéma soit couverte).
 * Un cas change UN paramètre (valeur forte, pas une nuance) par rapport à une base commune et mesure l'écart sur trois vues : pixels de la vue de face,
 * silhouette de face, silhouette de profil. Un paramètre est PROUVÉ s'il dépasse au moins un seuil (0,6 % des pixels de la BOÎTE DU COU, ou 1 % de H de silhouette) — et la vue qui le prouve est consignée
 * (la profondeur du cou ne se voit pas de face : elle est prouvée de profil, et le dit).
 */
export interface NeckCase { readonly id: string; readonly base?: Record<string, unknown>; readonly patch: Record<string, unknown>; readonly yaw?: number; readonly label: string }

/** Base : cou de 0,42 H (visible), humain, masse moyenne, peau tendue assez pour que les reliefs affleurent. */
const BASE_SYS = { modifiers: { mass: 0.35, age: 0.5 }, musculature: { tension: 0.5 }, surface: { skinTension: 0.6 } };
const sys = (s: Record<string, unknown>): Record<string, unknown> => ({ system: s });

export const CASES: readonly NeckCase[] = [
  { id: 'dimensions.depthRatio', label: 'profondeur AP ×1,6', patch: sys({ dimensions: { depthRatio: 1.45 } }) },
  { id: 'dimensions.topWidth', label: 'largeur du haut ×0,65', patch: sys({ dimensions: { topWidth: 0.65 } }) },
  { id: 'profile.taper', label: 'cône (large en bas)', patch: sys({ profile: { taper: 0.9 } }) },
  { id: 'profile.waist', label: 'sablier', patch: sys({ profile: { waist: 1 } }) },
  { id: 'profile.curvature', label: 'courbure sagittale', patch: sys({ profile: { curvature: 0.45 } }) },
  { id: 'profile.sCurve', label: 'cou en S', patch: sys({ profile: { sCurve: 0.3 } }) },
  { id: 'profile.crossSection', label: 'section rectangulaire', patch: sys({ profile: { crossSection: 0.4 } }) },
  { id: 'profile.segments', label: 'segments (anneaux)', patch: sys({ species: 'fantasy', profile: { segments: 8 } }) },
  { id: 'orientation.pitchDeg', label: 'cou penché en avant 30°', patch: sys({ orientation: { pitchDeg: 30 } }) },
  { id: 'orientation.rollDeg', label: 'inclinaison latérale 12°', patch: sys({ orientation: { rollDeg: 12 } }) },
  { id: 'orientation.torsionDeg', label: 'torsion 50°', patch: sys({ orientation: { torsionDeg: 50 } }) },
  { id: 'orientation.axisOffset', label: 'axe décalé', patch: sys({ orientation: { axisOffset: 0.5 } }) },
  { id: 'asymmetry.leftRightBias', label: 'côté droit plus massif', patch: sys({ asymmetry: { leftRightBias: 0.9 } }) },
  { id: 'asymmetry.frontBackBias', label: 'face plus épaisse que la nuque', patch: sys({ asymmetry: { frontBackBias: 0.9 } }) },
  { id: 'asymmetry.localVariation', label: 'irrégularités locales', patch: sys({ asymmetry: { localVariation: 1, seed: 9 } }) },
  { id: 'asymmetry.seed', label: 'graine (variation 1)', base: sys({ asymmetry: { localVariation: 1, seed: 1 } }), patch: sys({ asymmetry: { localVariation: 1, seed: 77 } }) },
  { id: 'musculature.trapezius', label: 'trapèzes volumineux', base: sys({ musculature: { trapezius: 0.1 } }), patch: sys({ musculature: { trapezius: 1 } }) },
  { id: 'musculature.separation', label: 'sillons musculaires marqués', base: { muscles: 0.9, ...sys({ musculature: { separation: 0 } }) }, patch: { muscles: 0.9, ...sys({ musculature: { separation: 1 } }) } },
  { id: 'musculature.tendonVisibility', label: 'tendons visibles', base: { muscles: 0.9, ...sys({ musculature: { tendonVisibility: 0, tension: 0.9 }, modifiers: { mass: 0.1 } }) }, patch: { muscles: 0.9, ...sys({ musculature: { tendonVisibility: 1, tension: 0.9 }, modifiers: { mass: 0.1 } }) } },
  { id: 'musculature.tension', label: 'cou tendu', patch: sys({ musculature: { tension: 1 }, modifiers: { mass: 0.1 } }) },
  { id: 'softTissue.foldDepth', label: 'plis profonds', base: sys({ softTissue: { foldDepth: 0 }, modifiers: { mass: 0.9, age: 0.9 } }), patch: sys({ softTissue: { foldDepth: 1 }, modifiers: { mass: 0.9, age: 0.9 } }) },
  { id: 'softTissue.foldDistribution', label: 'plis sur toute la longueur', base: sys({ softTissue: { foldDistribution: 0, foldDepth: 1 }, modifiers: { mass: 0.9, age: 0.9 } }), patch: sys({ softTissue: { foldDistribution: 1, foldDepth: 1 }, modifiers: { mass: 0.9, age: 0.9 } }) },
  { id: 'softTissue.dewlap', label: 'fanon', patch: sys({ softTissue: { dewlap: 1 } }) },
  { id: 'reliefs.larynx', label: 'larynx forcé', base: sys({ reliefs: { larynx: 0 } }), patch: sys({ reliefs: { larynx: 1 } }) },
  { id: 'reliefs.hyoid', label: 'hyoïde forcé', base: sys({ reliefs: { hyoid: 0 } }), patch: sys({ reliefs: { hyoid: 1 } }) },
  { id: 'reliefs.trachea', label: 'trachée forcée', base: sys({ reliefs: { trachea: 0 } }), patch: sys({ reliefs: { trachea: 1 } }) },
  { id: 'reliefs.vessels', label: 'jugulaire forcée', base: sys({ reliefs: { vessels: 0 } }), patch: sys({ reliefs: { vessels: 1 } }) },
  { id: 'reliefs.clavicle', label: 'clavicules forcées', base: sys({ reliefs: { clavicle: 0 } }), patch: sys({ reliefs: { clavicle: 1 } }) },
  { id: 'species', label: 'dragon (sans larynx ni SCM)', patch: sys({ species: 'dragon' }) },
  { id: 'style.mode', label: 'mode caricature', patch: sys({ style: { mode: 'caricature' } }) },
  { id: 'style.exaggeration', label: 'exagération 1', patch: sys({ style: { exaggeration: 1 } }) },
  { id: 'style.simplification', label: 'simplification 1', base: { muscles: 0.9, ...sys({ modifiers: { mass: 0.1 } }) }, patch: { muscles: 0.9, ...sys({ modifiers: { mass: 0.1 }, style: { simplification: 1 } }) } },
  { id: 'style.angularity', label: 'facettes (angularité 1)', patch: sys({ style: { angularity: 1 } }) },
  { id: 'style.silhouettePriority', label: 'silhouette prioritaire', base: { muscles: 0.9, ...sys({ modifiers: { mass: 0.1 } }) }, patch: { muscles: 0.9, ...sys({ modifiers: { mass: 0.1 }, style: { silhouettePriority: 1 } }) } },
  { id: 'modifiers.age', label: 'âge avancé', base: sys({ modifiers: { age: 0 } }), patch: sys({ modifiers: { age: 1 } }) },
  { id: 'modifiers.mass', label: 'corpulence maximale', base: sys({ modifiers: { mass: 0 } }), patch: sys({ modifiers: { mass: 1 } }) },
  { id: 'pose.headTranslate', label: 'tête avancée', patch: sys({ pose: { headTranslate: 1 } }) },
  { id: 'pose.compression', label: 'compression axiale', patch: sys({ pose: { compression: 0.8 } }) },
  { id: 'pose.stretch', label: 'étirement', patch: sys({ pose: { stretch: 0.8 } }) },
  { id: 'pose.twistShare', label: 'part de rotation suivie (lacet 70°)', yaw: 70, base: sys({ pose: { twistShare: 0.2 } }), patch: sys({ pose: { twistShare: 0.9 } }) },
  { id: 'pose.tissueLag', label: 'inertie du fanon et de l\'écharpe', base: sys({ softTissue: { dewlap: 0.6 }, attachments: [{ kind: 'scarf', at: 0.8, size: 0.5, count: 1, color: '#2f6fa8' }] }), patch: sys({ softTissue: { dewlap: 0.6 }, pose: { tissueLag: 1 }, attachments: [{ kind: 'scarf', at: 0.8, size: 0.5, count: 1, color: '#2f6fa8' }] }) },
  { id: 'pose.bodyLanguage', label: 'expression « honte »', patch: sys({ pose: { bodyLanguage: 'shame', bodyLanguageAmount: 1 } }) },
  { id: 'pose.bodyLanguageAmount', label: 'intensité de l\'expression', base: sys({ pose: { bodyLanguage: 'shame', bodyLanguageAmount: 0 } }), patch: sys({ pose: { bodyLanguage: 'shame', bodyLanguageAmount: 1 } }) },
  { id: 'strategies', label: 'stratégie « chain » (honte)', base: sys({ pose: { bodyLanguage: 'shame', bodyLanguageAmount: 1 } }), patch: sys({ pose: { bodyLanguage: 'shame', bodyLanguageAmount: 1 }, strategies: ['chain'], profile: { segments: 4 } }) },
  { id: 'operators.length_warp', label: 'opérateur length_warp', patch: { ...sys({ operators: [{ op: 'length_warp', amount: 1, at: 0.55, span: 0.5, side: 0 }] }) } },
  { id: 'operators.width_profile_warp', label: 'opérateur width_profile_warp', patch: { ...sys({ operators: [{ op: 'width_profile_warp', amount: 1, at: 0.55, span: 0.5, side: 0 }] }) } },
  { id: 'operators.depth_profile_warp', label: 'opérateur depth_profile_warp', patch: { ...sys({ operators: [{ op: 'depth_profile_warp', amount: 1, at: 0.55, span: 0.5, side: 0 }] }) } },
  { id: 'operators.centerline_bend', label: 'opérateur centerline_bend', patch: { ...sys({ operators: [{ op: 'centerline_bend', amount: 1, at: 0.55, span: 0.5, side: 0 }] }) } },
  { id: 'operators.local_bulge', label: 'opérateur local_bulge', patch: { ...sys({ operators: [{ op: 'local_bulge', amount: 1, at: 0.55, span: 0.5, side: 1 }] }) } },
  { id: 'operators.local_compression', label: 'opérateur local_compression', patch: { ...sys({ operators: [{ op: 'local_compression', amount: 1, at: 0.55, span: 0.5, side: 0 }] }) } },
  { id: 'operators.asymmetric_deformation', label: 'opérateur asymmetric_deformation', patch: { ...sys({ operators: [{ op: 'asymmetric_deformation', amount: 1, at: 0.55, span: 0.5, side: 0 }] }) } },
  { id: 'operators.muscle_exaggeration', label: 'opérateur muscle_exaggeration', base: { muscles: 0.8, ...sys({ modifiers: { mass: 0.2 }, musculature: { tension: 0.6 } }) }, patch: { muscles: 0.8, ...sys({ modifiers: { mass: 0.2 }, musculature: { tension: 0.6 }, operators: [{ op: 'muscle_exaggeration', amount: 1, at: 0.55, span: 0.5, side: 1 }] }) } },
  { id: 'operators.fold_amplification', label: 'opérateur fold_amplification', patch: { ...sys({ operators: [{ op: 'fold_amplification', amount: 1, at: 0.55, span: 0.5, side: 0 }] }) } },
  { id: 'operators.silhouette_simplification', label: 'opérateur silhouette_simplification', base: { muscles: 0.8, ...sys({ modifiers: { mass: 0.2 }, musculature: { tension: 0.6 } }) }, patch: { muscles: 0.8, ...sys({ modifiers: { mass: 0.2 }, musculature: { tension: 0.6 }, operators: [{ op: 'silhouette_simplification', amount: 1, at: 0.55, span: 0.5, side: 0 }] }) } },
  { id: 'operators.topology_extension', label: 'opérateur topology_extension', patch: { ...sys({ operators: [{ op: 'topology_extension', amount: 1, at: 0.55, span: 0.5, side: 0 }] }) } },
  { id: 'operators.surface_ripple', label: 'opérateur surface_ripple', patch: { ...sys({ operators: [{ op: 'surface_ripple', amount: 1, at: 0.55, span: 0.5, side: 0 }] }) } },
  { id: 'surface.pattern', label: 'écailles', patch: sys({ surface: { pattern: 'scales', size: 0.12 } }) },
  { id: 'surface.layout', label: 'spirale vs rangées', base: sys({ surface: { pattern: 'scales', layout: 'rows', size: 0.12 } }), patch: sys({ surface: { pattern: 'scales', layout: 'spiral', size: 0.12 } }) },
  { id: 'surface.size', label: 'éléments ×3', base: sys({ surface: { pattern: 'scales', size: 0.1 } }), patch: sys({ surface: { pattern: 'scales', size: 0.3 } }) },
  { id: 'surface.density', label: 'densité 1 vs 0', base: sys({ surface: { pattern: 'scales', density: 0, size: 0.14 } }), patch: sys({ surface: { pattern: 'scales', density: 1, size: 0.14 } }) },
  { id: 'surface.overlap', label: 'imbrication 1 vs 0', base: sys({ surface: { pattern: 'scales', overlap: 0, size: 0.14 } }), patch: sys({ surface: { pattern: 'scales', overlap: 1, size: 0.14 } }) },
  { id: 'surface.variation', label: 'variation 1 vs 0', base: sys({ surface: { pattern: 'scales', variation: 0, size: 0.14 } }), patch: sys({ surface: { pattern: 'scales', variation: 1, size: 0.14 } }) },
  { id: 'surface.smoothThroat', label: 'gorge lisse', base: sys({ surface: { pattern: 'scales', smoothThroat: 0, size: 0.14 } }), patch: sys({ surface: { pattern: 'scales', smoothThroat: 0.9, size: 0.14 } }) },
  { id: 'surface.skinTension', label: 'peau tendue', base: { muscles: 0.9, ...sys({ surface: { skinTension: 0 }, modifiers: { mass: 0.1 }, musculature: { tension: 0.2 } }) }, patch: { muscles: 0.9, ...sys({ surface: { skinTension: 1 }, modifiers: { mass: 0.1 }, musculature: { tension: 0.2 } }) } },
  { id: 'surface.elementColor', label: 'couleur propre des éléments', base: sys({ surface: { pattern: 'scales', size: 0.14 } }), patch: sys({ surface: { pattern: 'scales', size: 0.14, elementColor: '#2f8f4e' } }) },
  { id: 'attachments', label: 'collier + crête', patch: sys({ attachments: [{ kind: 'collar', at: 0.7, size: 0.6, count: 1, color: '#b0442a' }, { kind: 'crest', at: 0.9, size: 0.4, count: 8, color: '#7b3b3b' }] }) },
];

const merge = (a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof a[k] === 'object' && !Array.isArray(a[k]) ? merge(a[k] as Record<string, unknown>, v as Record<string, unknown>) : v;
  return out;
};
/** Cou de base commun + surcharge d'un cas. */
export const neckPatch = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({ neck: merge({ visible: true, length: 0.42, system: BASE_SYS }, extra) });

export interface Measure { readonly pixels: number; readonly front: number; readonly profile: number; readonly view: 'face' | 'silhouette' | 'profil' | 'aucune' }

/** Écart entre deux configurations du cou : fraction de pixels différents, écart de silhouette de face et de profil (en fraction de H). */
export function measure(base: Record<string, unknown>, patch: Record<string, unknown>, yaw = 0, seed = 321): Measure {
  const a = cellSvg({ seed, patch: neckPatch(base), focus: 'neck' }, 220, 280), b = cellSvg({ seed, patch: neckPatch(patch), focus: 'neck' }, 220, 280);
  const ra = decodePng(rasterPng(a.svg)), rb = decodePng(rasterPng(b.svg));
  // Boîte du cou (px de la cellule) : du menton à la base, sur toute la largeur de la base. Seuil relatif à CETTE aire, pas à celle de la cellule entière.
  const lm = a.meta.lm, [bx0, by0] = a.meta.px(-lm.neck.half * 1.4, lm.chinY), [bx1, by1] = a.meta.px(lm.neck.half * 1.4, lm.neck.bottomY);
  const x0 = Math.max(0, Math.floor(bx0)), x1 = Math.min(ra.width, Math.ceil(bx1)), y0 = Math.max(0, Math.floor(by0)), y1 = Math.min(ra.height, Math.ceil(by1));
  let n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * ra.width + x; if (Math.max(Math.abs(ra.data[i * 4]! - rb.data[i * 4]!), Math.abs(ra.data[i * 4 + 1]! - rb.data[i * 4 + 1]!), Math.abs(ra.data[i * 4 + 2]! - rb.data[i * 4 + 2]!)) > 12) n++; }
  const ma = neckModelFor(a.meta.params, a.meta.lm, yaw), mb = neckModelFor(b.meta.params, b.meta.lm, yaw);
  const fa = frontSilhouette(ma), fb = frontSilhouette(mb), pa = profileSilhouette(ma), pb = profileSilhouette(mb), H = a.meta.lm.H;
  const dist = (p: readonly { x: number; y: number }[], q: readonly { x: number; y: number }[]): number => Math.max(...p.map((v, i) => Math.abs(v.x - q[Math.min(i, q.length - 1)]!.x)), 0) / H;
  const front = Math.max(dist(fa.left, fb.left), dist(fa.right, fb.right)), profile = Math.max(dist(pa.front, pb.front), dist(pa.back, pb.back));
  const pixels = n / Math.max(1, (x1 - x0) * (y1 - y0));
  const view = pixels >= 0.006 ? 'face' : front >= 0.01 ? 'silhouette' : profile >= 0.01 ? 'profil' : 'aucune';
  return { pixels, front, profile, view };
}

/** Feuilles du schéma (chemins pointés), tableaux compris comme une seule entrée. */
export function schemaLeaves(): string[] {
  const walk = (o: unknown, path: string): string[] => (o && typeof o === 'object' && !Array.isArray(o) ? Object.entries(o).flatMap(([k, v]) => walk(v, path ? `${path}.${k}` : k)) : [path]);
  return walk(NeckSystem.parse({}), '');
}

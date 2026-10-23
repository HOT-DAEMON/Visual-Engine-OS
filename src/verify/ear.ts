import { resolveAppearance } from '../appearance';
import { parseHex } from '../core/color';
import { earGeometry, earEngine, type EarGeo, type FaceLandmarks } from '../face';
import { FAMILIES } from '../face/ear/families';
import { projectEar, VIEW_YAW, type ViewName } from '../face/ear/project';
import type { StructureId } from '../face/ear/types';
import { polyArea, inPoly, type Poly } from '../face/poly';
import { renderEars } from '../render/face/ears';
import type { FaceParams } from '../schema';
import { check, type Check } from './types';

const finite = (p: readonly { x: number; y: number }[]): boolean => p.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y));
const lum = (hex: string): number => { const [r, g, b] = parseHex(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
const VIEWS: ViewName[] = ['face', 'three-quarter', 'profile', 'close-up'];

/** Segments qui se croisent dans un contour fermé (0 attendu : le contour est simple). */
function selfIntersections(p: Poly): number {
  const n = p.length;
  let c = 0;
  const ccw = (a: Poly[number], b: Poly[number], d: Poly[number]): number => (b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x);
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    const a = p[i]!, b = p[(i + 1) % n]!, d = p[j]!, e = p[(j + 1) % n]!;
    if (ccw(a, b, d) * ccw(a, b, e) < 0 && ccw(d, e, a) * ccw(d, e, b) < 0) c++;
  }
  return c;
}

/**
 * COUCHES DE VÉRIFICATION DE L'OREILLE (moteur `morphology`) : cohérence GÉOMÉTRIQUE (nombres, polygones, contour simple, vues identiques, attache),
 * cohérence ANATOMIQUE (structures requises, ordre vertical, alignements sur les yeux et la bouche, asymétrie bornée), STYLE ARTISTIQUE (palette cel,
 * contraste, cohérence avec la peau, traits homogènes). Aucune valeur n'est lue dans un paramètre : tout est mesuré sur la géométrie produite.
 */
export function checkEars(p: FaceParams, lm: FaceLandmarks, skin: string): Check[] {
  if (!p.ears.visible || earEngine(p) !== 'morphology') return [];
  const ears = earGeometry(p, lm);
  const o: Check[] = [];
  for (const e of ears) o.push(...earGeometryChecks(e), ...earAnatomyChecks(p, lm, e));
  if (ears.length === 2) {
    const [a, b] = ears as [EarGeo, EarGeo];
    const h = Math.max(a.placement!.hPx, b.placement!.hPx);
    o.push(check('anatomy', 'ear-bilateral-height', '<=', Math.abs(a.placement!.hPx - b.placement!.hPx) / h, 0.02, 'les deux oreilles ont des hauteurs trop différentes (asymétrie bornée par le moteur)'));
    const wA = a.model!.widthRatio, wB = b.model!.widthRatio;
    o.push(check('anatomy', 'ear-bilateral-width', '<=', Math.abs(wA - wB) / Math.max(wA, wB), 0.05 + 0.5 * p.ears.style.asymmetry, 'les deux oreilles ont des largeurs trop différentes'));
  }
  o.push(...earStyleChecks(p, lm, skin));
  return o;
}

export function earGeometryChecks(e: EarGeo): Check[] {
  const m = e.model!;
  const pl = e.placement!;
  const s = e.side < 0 ? 'L' : 'R';
  const o: Check[] = [];
  const polys: Poly[] = [m.outline, ...m.structures.map((x) => x.poly)];
  o.push(check('geometry', `ear-finite-${s}`, '==', polys.every(finite) ? 1 : 0, 1, `un sommet de l'oreille ${s} n'est pas fini`));
  o.push(check('geometry', `ear-outline-simple-${s}`, '<=', selfIntersections(m.outline), 0, `le contour de l'oreille ${s} se croise lui-même`));
  const tiny = m.structures.filter((x) => x.kind !== 'ext' && Math.abs(polyArea(x.poly)) < 2e-5);
  o.push(check('geometry', `ear-structures-nondegenerate-${s}`, '<=', tiny.length, 0, `structures dégénérées dans l'oreille ${s} : ${tiny.map((x) => x.id).join(', ')}`));
  // Les structures de relief (hors bandes qui suivent le contour) restent dans le pavillon.
  const out = m.structures.filter((x) => (x.kind === 'ridge' || x.kind === 'blob' || x.kind === 'cavity') && x.id !== 'lobule' && !String(x.id).startsWith('antihelix:groove')).filter((x) => x.poly.filter((q) => inPoly(m.outline, q.x, q.y)).length / x.poly.length < 0.55);
  o.push(check('geometry', `ear-structures-inside-${s}`, '<=', out.length, 0, `structures hors du pavillon (${s}) : ${out.map((x) => x.id).join(', ')}`));
  // Continuité du contour : angle de rotation maximal entre deux segments consécutifs (spline lisse → aucune cassure franche sauf pointe voulue).
  const n = m.outline.length;
  let worst = 0;
  for (let i = 0; i < n; i++) {
    const a = m.outline[i]!, b = m.outline[(i + 1) % n]!, c = m.outline[(i + 2) % n]!;
    const t1 = Math.atan2(b.y - a.y, b.x - a.x), t2 = Math.atan2(c.y - b.y, c.x - b.x);
    let d = Math.abs(t2 - t1);
    if (d > Math.PI) d = 2 * Math.PI - d;
    worst = Math.max(worst, (d * 180) / Math.PI);
  }
  o.push(check('geometry', `ear-outline-turn-${s}`, '<=', worst, 75, `le contour de l'oreille ${s} a une cassure franche (rotation > 75° entre deux segments)`, 'warn'));
  // Même modèle dans les quatre vues : l'ordonnée de chaque repère est IDENTIQUE (la caméra tourne autour de l'axe vertical).
  const proj = VIEWS.map((v) => projectEar(m, pl, VIEW_YAW[v] * e.side, v));
  let dy = 0;
  for (const q of proj) for (const [k, pt] of Object.entries(q.landmarks)) dy = Math.max(dy, Math.abs(pt.y - (proj[0]!.landmarks[k] as { y: number }).y));
  o.push(check('geometry', `ear-views-same-model-${s}`, '<=', dy, 1e-6, `les quatre vues de l'oreille ${s} n'ont pas les mêmes ordonnées : géométries incompatibles`));
  o.push(check('geometry', `ear-views-finite-${s}`, '==', proj.every((q) => finite(q.plate) && finite(q.rim)) ? 1 : 0, 1, `une vue de l'oreille ${s} contient un sommet non fini`));
  // Attache au crâne : la racine de l'hélix est le pivot de la rotation locale ; son abscisse est la surface du crâne à son ordonnée + l'écartement du pavillon
  // (sin α · u · H, u = position de la racine dans le plan). Vrai pour toute rotation, tout tangage.
  const crus = proj[0]!.landmarks.crus as { x: number; y: number };
  const uCrus = (m.landmarks.crus as { x: number }).x;
  o.push(check('geometry', `ear-attached-${s}`, '==', Math.abs(crus.x), pl.skullX(crus.y) + Math.sin((pl.openingDeg * Math.PI) / 180) * uCrus * pl.hPx, `la racine de l'hélix ${s} n'est pas sur la surface du crâne`, 'error', 1e-6));
  return o;
}

export function earAnatomyChecks(p: FaceParams, lm: FaceLandmarks, e: EarGeo): Check[] {
  const m = e.model!;
  const pl = e.placement!;
  const s = e.side < 0 ? 'L' : 'R';
  const o: Check[] = [];
  const ids = new Set(m.structures.map((x) => String(x.id).split(':')[0]));
  // Structures requises par la famille (pondérée) présentes, interdites absentes.
  const missing: string[] = [];
  const extra: string[] = [];
  for (const sid of Object.keys(m.resolved.present) as StructureId[]) {
    const want = m.resolved.present[sid];
    const has = ids.has(sid) || (sid === 'cavum' && ids.has('cavum')) ;
    if (want && !has && sid !== 'lobule') missing.push(sid);
    if (!want && ids.has(sid) && sid !== 'canal') extra.push(sid);
  }
  void FAMILIES;
  o.push(check('anatomy', `ear-required-structures-${s}`, '<=', missing.length, 0, `structures requises absentes (${s}) : ${missing.join(', ')}`));
  o.push(check('anatomy', `ear-forbidden-structures-${s}`, '<=', extra.length, 0, `structures interdites présentes (${s}) : ${extra.join(', ')}`));
  // Ordre vertical sur l'axe : fossa/cymba au-dessus de la racine de l'hélix, au-dessus du cavum, au-dessus de l'antitragus, au-dessus du bas du lobule.
  const cy = (id: string): number => { const x = m.structures.find((q) => q.id === id); return x ? x.poly.reduce((t, q) => t + q.y, 0) / x.poly.length : NaN; };
  const crusY = m.landmarks.crus!.y;
  const chain = [['cymba', cy('cymba')], ['crus', crusY], ['cavum', cy('cavum')], ['lobuleBottom', m.landmarks.lobuleBottom!.y]] as const;
  const broken = chain.filter((c, i) => i > 0 && Number.isFinite(c[1]) && Number.isFinite(chain[i - 1]![1]) && c[1] <= chain[i - 1]![1]);
  o.push(check('anatomy', `ear-vertical-order-${s}`, '<=', broken.length, 0, `ordre vertical brisé (${s}) : cymba < racine de l'hélix < cavum < bas du lobule`));
  if (m.resolved.present.tragus && m.resolved.present.antitragus) o.push(check('anatomy', `ear-tragus-before-antitragus-${s}`, '<=', m.landmarks.tragus!.x, m.landmarks.antitragus!.x, `le tragus doit être en avant de l'antitragus (${s})`));
  // Alignements sur les repères du visage (demandés) : racine de l'hélix sur la ligne des yeux ; bas du lobule sur la ligne de la bouche.
  const a = e.align!;
  if (p.ears.anchors.eye >= 1) o.push(check('anatomy', `ear-crus-on-eye-line-${s}`, '<=', Math.abs(a.crusToEyeLine), 0.5, `la racine de l'hélix (fosse triangulaire) ${s} n'est pas sur la ligne des yeux`));
  if (p.ears.anchors.mouth >= 1 && m.resolved.present.lobule) {
    const corrected = a.corrections.length > 0;
    o.push(check('anatomy', `ear-lobule-on-mouth-line-${s}`, '<=', Math.abs(a.lobuleToMouthLine), corrected ? 0.2 * lm.H : 0.5, `le bas du lobule ${s} n'est pas sur la ligne de la bouche`, corrected ? 'warn' : 'error'));
  }
  // L'oreille ne dépasse pas la zone sourcils → menton.
  o.push(check('anatomy', `ear-within-face-height-${s}`, '>=', pl.topY, -lm.H / 2, `le haut de l'oreille ${s} dépasse le sommet du crâne`));
  o.push(check('anatomy', `ear-above-chin-${s}`, '<=', pl.topY + pl.hPx, lm.chinY, `le bas de l'oreille ${s} descend sous le menton`));
  // La géométrie ne dépend pas des cheveux (la visibilité est mesurée à part, `ear/visibility.ts`) : elle existe toujours, même masquée.
  o.push(check('anatomy', `ear-geometry-kept-under-hair-${s}`, '>=', e.poly.length, 3, `la géométrie de l'oreille ${s} doit rester même masquée`));
  return o;
}

function earStyleChecks(p: FaceParams, lm: FaceLandmarks, skin: string): Check[] {
  const o: Check[] = [];
  const ra = resolveAppearance(skin, p.skin);
  const svg = renderEars(p, lm, skin, ra, undefined, []).join('');
  const fills = new Set([...svg.matchAll(/fill="(#[0-9a-fA-F]{6})"/g)].map((x) => (x[1] as string).toLowerCase()));
  const widths = new Set([...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((x) => Number(x[1]).toFixed(1)));
  if (p.ears.style.look === 'anime') o.push(check('style', 'ear-cel-palette', '<=', fills.size, 14, "palette de l'oreille trop riche pour un rendu cel (≤ 14 couleurs de remplissage)", 'warn'));
  o.push(check('style', 'ear-stroke-homogeneity', '<=', widths.size, 16, "trop d'épaisseurs de trait différentes dans l'oreille", 'warn'));
  const kind = p.ears.material.kind ?? FAMILIES[p.ears.family].defaultMaterial;
  if (kind === 'skin') o.push(check('style', 'ear-matches-skin', '<=', Math.abs(lum(skin) - lum(ra.shadow)), 0.5, "l'ombre de l'oreille s'éloigne trop de la peau du visage", 'warn'));
  o.push(check('style', 'ear-shade-contrast', '>=', Math.abs(lum(ra.light) - lum(ra.shadow)), 0.04, "contraste lumière/ombre de l'oreille trop faible pour lire le relief", 'warn'));
  return o;
}

import { resolveAppearance } from '../appearance';
import { parseHex } from '../core/color';
import { earGeometry, earEngine, type EarGeo, type FaceLandmarks } from '../face';
import { FAMILIES } from '../face/ear/families';
import { projectEar, attachShear, anteriorEdge, VIEW_YAW, type ViewName } from '../face/ear/project';
import type { StructureId } from '../face/ear/types';
import { polyArea, inPoly, type Poly } from '../face/poly';
import { renderEars } from '../render/face/ears';
import type { FaceParams } from '../schema';
import { check, type Check } from './types';
import { earPass6Checks } from './ear-pass6';

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
  for (const e of ears) o.push(...earGeometryChecks(e), ...earAnatomyChecks(p, lm, e), ...earPass6Checks(e));
  if (ears.length === 2) {
    const [a, b] = ears as [EarGeo, EarGeo];
    const h = Math.max(a.placement!.hPx, b.placement!.hPx);
    o.push(check('anatomy', 'ear-bilateral-height', '<=', Math.abs(a.placement!.hPx - b.placement!.hPx) / h, 0.02 + 0.35 * p.ears.style.asymmetry + 0.1 * p.ears.style.exaggeration, 'les deux oreilles ont des hauteurs trop différentes (la hauteur découle du niveau de la racine de l’hélix, qui dépend de la forme : tolérance = 2 % + part de l’asymétrie et de l’exagération demandées)'));
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
  o.push(check('geometry', `ear-outline-turn-${s}`, '<=', worst, 75 + 70 * Math.max(0, Math.min(1, m.resolved.flat['pole.tip'] ?? 0)) + 35 * Math.max(0, m.resolved.flat['helix.darwin'] ?? 0), `le contour de l'oreille ${s} a une cassure franche (rotation au-delà de 75° entre deux segments, élargie par une pointe ou un tubercule demandés)`, 'warn'));
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
  o.push(check('geometry', `ear-attached-${s}`, '==', Math.abs(crus.x), pl.skullX(crus.y) + Math.sin((pl.openingDeg * Math.PI) / 180) * uCrus * pl.hPx + attachShear(pl, crus.y, uCrus, anteriorEdge(m)((m.landmarks.crus as { y: number }).y)), `la racine de l'hélix ${s} n'est pas sur la surface du crâne`, 'error', 1e-6));
  // Passe 5 : le bord antérieur (jonction lobule-joue, tragus, bord antérieur) touche la tête sur toute sa longueur, SANS bande de peau intermédiaire. Écart mesuré de face, en fraction de la hauteur d'oreille.
  if (pl.headX) {
    const hx = pl.headX;
    const ant = m.segments.filter((sg) => sg.id === 'C06' || sg.id === 'C05' || sg.id === 'C04');
    let gap = 0;
    for (const sg of ant) for (let k = sg.from; k <= sg.to; k++) { const q = proj[0]!.plate[k % m.outline.length] as { x: number; y: number }; gap = Math.max(gap, Math.abs(q.x) - hx(q.y)); }
    o.push(check('geometry', `ear-anterior-touches-head-${s}`, '<=', gap / pl.hPx, 0.06, `le bord antérieur de l'oreille ${s} est décollé de la tête de ${((gap / pl.hPx) * 100).toFixed(1)} % de sa hauteur`));
  }
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
  // Passe 5 — proportions du pavillon (références `references/orreil`) : la conque (cavum + cymba) occupe une part franche de l'aire, et aucune grande zone de peau lisse ne sépare l'hélix du lobule.
  if (m.resolved.present.cavum !== false) {
    const area = Math.abs(polyArea(m.outline));
    const conch = ['cavum', 'cymba'].reduce((t, id) => { const x = m.structures.find((q) => q.id === id); return t + (x ? Math.abs(polyArea(x.poly)) : 0); }, 0);
    o.push(check('anatomy', `ear-concha-share-${s}`, '>=', conch / area, 0.2, `la conque de l'oreille ${s} est trop petite (${((conch / area) * 100).toFixed(0)} % de l'aire, plancher 20 %) : la région hélix → lobule paraît trop vaste`, 'warn'));
    // Part de l'aire du pavillon NON couverte par une structure (hors lobule, qui est une masse molle) : échantillonnage sur grille.
    const covers = m.structures.filter((x) => x.kind !== 'ext' && x.id !== 'lobule' && !String(x.id).startsWith('scapha:'));
    const xs = m.outline.map((q) => q.x), ys = m.outline.map((q) => q.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    let inside = 0, bare = 0;
    for (let i = 0; i < 40; i++) for (let j = 0; j < 60; j++) {
      const qx = x0 + ((i + 0.5) / 40) * (x1 - x0), qy = y0 + ((j + 0.5) / 60) * (y1 - y0);
      if (!inPoly(m.outline, qx, qy)) continue;
      inside++;
      if (!covers.some((c) => inPoly(c.poly, qx, qy))) bare++;
    }
    o.push(check('anatomy', `ear-bare-share-${s}`, '<=', inside ? bare / inside : 0, 0.5, `trop de peau lisse dans le pavillon ${s} (${inside ? Math.round((bare / inside) * 100) : 0} % de l'aire sans structure) : l'oreille manque de relief anatomique`, 'warn'));
  }
  if (m.resolved.present.tragus && m.resolved.present.antitragus) o.push(check('anatomy', `ear-tragus-before-antitragus-${s}`, '<=', m.landmarks.tragus!.x, m.landmarks.antitragus!.x, `le tragus doit être en avant de l'antitragus (${s})`));
  // Alignements sur les repères du visage (demandés) : racine de l'hélix sur la ligne des yeux ; bas du lobule sur la ligne de la bouche.
  const a = e.align!;
  if (p.ears.anchors.eye >= 1) o.push(check('anatomy', `ear-crus-on-eye-line-${s}`, '<=', Math.abs(a.crusToEyeLine), 0.5, `la racine de l'hélix (fosse triangulaire) ${s} n'est pas sur la ligne des yeux`));
  if (p.ears.anchors.mouth >= 1 && m.resolved.present.lobule) {
    const corrected = a.corrections.length > 0;
    o.push(check('anatomy', `ear-lobule-on-line-${s}`, '<=', Math.abs(a.lobuleToLine - (p.ears.attach.scale - 1) * (a.lobuleLineY - lm.eyeY)), corrected ? 0.2 * lm.H : 0.5 + (p.ears.attach.scale !== 1 || (m.resolved.flat['lobule.stretch'] ?? 0) > 0 ? 0.015 * e.placement!.hPx : 0), `le bas du lobule ${s} n'est pas à l'écart attendu de la ligne visée (base du nez ; l’échelle relative attach.scale décale le lobule de (échelle − 1) × (ligne − yeux))`, corrected ? 'warn' : 'error'));
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
  // Palette perçue : deux teintes à moins de 16 niveaux par canal sont UN ton (les structures ont des variantes de ton quasi identiques, pas des tons distincts).
  const fills = new Set([...svg.matchAll(/fill="#([0-9a-fA-F]{6})"/g)].map((x) => [0, 2, 4].map((i) => Math.round(parseInt((x[1] as string).slice(i, i + 2), 16) / 16)).join('.')));
  const widths = new Set([...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((x) => Number(x[1]).toFixed(1)));
  if (p.ears.style.look === 'anime') o.push(check('style', 'ear-cel-palette', '<=', fills.size, 14 + 2 * Object.values(p.ears.surface).filter((v) => v > 0).length, "palette de l'oreille trop riche pour un rendu cel (≤ 14 couleurs de remplissage, +2 par détail de surface actif)", 'warn'));
  o.push(check('style', 'ear-stroke-homogeneity', '<=', widths.size, 16 + 2 * Object.values(p.ears.surface).filter((v) => v > 0).length + (p.ears.material.glow > 0.02 ? 3 : 0), "trop d'épaisseurs de trait différentes dans l'oreille (≤ 16, +2 par détail de surface actif, +3 si émission)", 'warn'));
  const kind = p.ears.material.kind ?? FAMILIES[p.ears.family].defaultMaterial;
  if (kind === 'skin') o.push(check('style', 'ear-matches-skin', '<=', Math.abs(lum(skin) - lum(ra.shadow)), 0.5, "l'ombre de l'oreille s'éloigne trop de la peau du visage", 'warn'));
  o.push(check('style', 'ear-shade-contrast', '>=', Math.abs(lum(ra.light) - lum(ra.shadow)), 0.04, "contraste lumière/ombre de l'oreille trop faible pour lire le relief", 'warn'));
  return o;
}

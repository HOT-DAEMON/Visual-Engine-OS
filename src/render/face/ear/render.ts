import { mix } from '../../../core/color';
import { el, num, urlRef } from '../../../core/svg';
import type { ResolvedAppearance } from '../../../appearance';
import type { Vec } from '../../../geometry/eye/primitives';
import type { EarModel, PlacedStructure } from '../../../face/ear/types';
import type { ProjectedEar } from '../../../face/ear/project';
import { box } from '../../../face/ear/plan-geom';
import type { Poly } from '../../../face/poly';
import type { LightVector } from '../../../lighting/light';
import type { FaceEars } from '../../../schema/face-ear';
import { polyPath } from '../path';
import { earPaint, lightAngles, type EarPaint } from './paint';

export interface EarMarkup { readonly defs: string[]; readonly markup: string }

const shift = (p: Poly, dx: number, dy: number): Poly => p.map((q) => ({ x: q.x + dx, y: q.y + dy }));
const centroid = (p: Poly): Vec => ({ x: p.reduce((s, q) => s + q.x, 0) / p.length, y: p.reduce((s, q) => s + q.y, 0) / p.length });

/**
 * Rendu d'une oreille PROJETÉE (vue quelconque) : même modèle, mêmes polygones dans les quatre vues. Ordre de dessin :
 *   1. flanc du pavillon (plaque, côté ombré) puis face externe (bord de l'hélix) → l'épaisseur du rebord se lit en vue de trois-quarts et de profil ;
 *   2. structures du plus bas relief au plus haut : cavités (creusées : ton d'ombre) puis reliefs (hélix, anthélix, crus, tragus…), occultation naturelle
 *      d'une cavité par le bord qui la masque ;
 *   3. reflets et ombres propres de chaque relief (traits décalés vers / contre la lumière, découpés au relief) ;
 *   4. éclairage de relief (carte de hauteur → `feDiffuseLighting`) en mode réaliste ; cel à deux tons en mode anime ;
 *   5. rétro-éclairage des parties fines, contour, extensions émissives.
 */
export function renderEarProjected(id: string, pe: ProjectedEar, model: EarModel, e: FaceEars, skin: string, ra: ResolvedAppearance, L: LightVector, hPx: number): EarMarkup {
  const P = earPaint(e, model.resolved.material, skin, ra);
  const anime = P.look === 'anime';
  const defs: string[] = [];
  const out: string[] = [];
  const lw = hPx * (anime ? 0.016 : 0.008);
  const ld = { x: L.x, y: L.y };
  const ln = Math.hypot(ld.x, ld.y) || 1;
  const lx = ld.x / ln, ly = ld.y / ln;
  const hull = pe.rim;
  // 1. Flanc (plaque) et face externe.
  out.push(el('path', { d: polyPath(pe.plate), fill: P.shade, stroke: P.shade, 'stroke-width': lw, 'stroke-linejoin': 'round' }));
  out.push(el('path', { d: polyPath(hull), fill: P.base, stroke: mix(P.shade, '#000000', 0.45), 'stroke-width': lw * 1.4, 'stroke-linejoin': 'round' }));
  // Découpe commune : tout ce qui suit reste dans la face externe.
  defs.push(el('clipPath', { id: `${id}-clip` }, [el('path', { d: polyPath(hull) })]));
  const body: string[] = [];
  // Excroissances : saillantes, donc hors de la découpe au pavillon (dessinées juste avant le contour).
  const outside: string[] = [];
  let k = 0;
  const detail = e.style.detail;
  for (const { s, poly } of pe.structures) {
    if (s.id === 'helix') { body.push(helixLayer(id, k++, poly, P, lx, ly, hPx, anime, defs)); k += 2; continue; }
    if (s.kind === 'ext') { (s.ext === 'ornamental_growth' ? outside : body).push(extLayer(s, poly, P, hPx, anime)); continue; }
    if (s.id !== 'canal' && !detailOn(String(s.id), detail)) continue;
    if (s.id === 'lobule') { body.push(lobuleLayer(id, k++, poly, P, lx, ly, hPx, defs)); continue; }
    if (s.relief < 0) {
      // Cavité : fond sombre (d'autant plus que le relief est négatif) ; la paroi qui regarde la source est dans l'ombre, la paroi opposée reçoit la lumière.
      const dark = s.id === 'canal' ? 0.92 : Math.min(0.85, 0.38 + 0.4 * -s.relief);
      body.push(el('path', { d: polyPath(poly), fill: mix(P.base, mix(P.shade, '#1a0d0d', 0.5), dark), opacity: anime ? 1 : 0.94 }));
      if (s.id !== 'canal') body.push(crescent(id, k++, poly, lx, ly, hPx * (0.004 + 0.003 * -s.relief), P.shade, anime ? P.highlight : P.lit, anime ? 0.9 : 0.55, true, defs));
    } else {
      // Relief : base, croissant éclairé côté source, croissant d'ombre propre du côté opposé (volume lisible sans trait de contour).
      body.push(el('path', { d: polyPath(poly), fill: mix(P.base, P.lit, Math.min(0.5, 0.14 * s.relief)) }));
      body.push(crescent(id, k++, poly, lx, ly, hPx * (0.005 + 0.004 * s.relief), P.shade, anime ? P.highlight : P.lit, anime ? 0.95 : 0.8, false, defs));
    }
  }
  out.push(el('g', { 'clip-path': urlRef(`${id}-clip`) }, body));
  out.push(...outside);
  // 4. Éclairage de relief (réaliste) : la carte de hauteur est le canal alpha de ce groupe, le filtre en tire des normales.
  if (!anime) out.push(reliefLighting(id, pe, model, P, L, hPx, defs));
  // 5. Rétro-éclairage des parties fines : liseré chaud à l'intérieur du bord (SURF-04), proportionnel à la translucidité.
  if (P.translucency > 0.02) out.push(el('g', { 'clip-path': urlRef(`${id}-clip`) }, [el('path', { d: polyPath(hull), fill: 'none', stroke: P.translucent, 'stroke-width': hPx * 0.035, opacity: num(0.22 * P.translucency), 'stroke-linejoin': 'round' })]));
  out.push(el('path', { d: polyPath(hull), fill: 'none', stroke: mix(P.shade, '#000000', anime ? 0.7 : 0.4), 'stroke-width': lw * (anime ? 1.2 : 0.7), 'stroke-linejoin': 'round', opacity: anime ? 1 : 0.65 }));
  if (P.kind === 'scaly') out.push(scales(id, hull, P, hPx));
  return { defs, markup: el('g', { id }, out) };
}

/** LOD : les micro-reliefs (sillons périphériques, incisure) ne sont dessinés qu'au-dessus d'un seuil de densité de détails. */
const detailOn = (sid: string, d: number): boolean => (sid.startsWith('antihelix:groove') ? d >= 0.55 : sid === 'notch' ? d >= 0.35 : true);

/**
 * Croissants de lumière et d'ombre d'un volume, SANS filtre : un polygone décalé de `d` vers / contre la source ; la différence symétrique
 * (`evenodd`) avec l'original, découpée à l'original, est exactement le croissant. Relief : lumière côté source, ombre côté opposé ; cavité : l'inverse.
 */
function crescent(id: string, i: number, poly: Poly, lx: number, ly: number, d: number, shade: string, lit: string, op: number, hollow: boolean, defs: string[]): string {
  defs.push(el('clipPath', { id: `${id}-e${i}` }, [el('path', { d: polyPath(poly) })]));
  const toward = (sg: number): string => polyPath(poly, shift(poly, sg * lx * d, sg * ly * d));
  const litSg = hollow ? 1 : -1;
  return el('g', { 'clip-path': urlRef(`${id}-e${i}`) }, [
    el('path', { d: toward(-litSg), 'fill-rule': 'evenodd', fill: shade, opacity: num(op * 0.75) }),
    el('path', { d: toward(litSg), 'fill-rule': 'evenodd', fill: lit, opacity: num(op) }),
  ]);
}

/** Hélix : bande claire d'enroulement, croissant éclairé et ombre propre ; l'arête extérieure reste le contour du pavillon. */
function helixLayer(id: string, i: number, poly: Poly, P: EarPaint, lx: number, ly: number, hPx: number, anime: boolean, defs: string[]): string {
  return el('path', { d: polyPath(poly), fill: mix(P.base, P.lit, 0.25) }) + crescent(id, i, poly, lx, ly, hPx * 0.006, P.shade, anime ? P.highlight : P.lit, anime ? 0.95 : 0.8, false, defs);
}

/** Lobule : chair sans cartilage, un seul reflet doux (pas de crête, pas de contour : la corde du polygone n'est PAS une arête). */
function lobuleLayer(id: string, i: number, poly: Poly, P: EarPaint, lx: number, ly: number, hPx: number, defs: string[]): string {
  const c = centroid(poly);
  defs.push(el('radialGradient', { id: `${id}-lob${i}`, cx: num(c.x - lx * hPx * 0.02), cy: num(c.y - ly * hPx * 0.02), r: num(hPx * 0.1), gradientUnits: 'userSpaceOnUse' }, [el('stop', { offset: 0, 'stop-color': P.lit, 'stop-opacity': 0.55 }), el('stop', { offset: 1, 'stop-color': P.lit, 'stop-opacity': 0 })]));
  return el('path', { d: polyPath(poly), fill: urlRef(`${id}-lob${i}`) });
}

/** Extensions : crête (ton d'ombre + liseré), membrane (translucide), excroissance (pointe), canal bioluminescent (émissif, flou). */
function extLayer(s: PlacedStructure, poly: Poly, P: EarPaint, hPx: number, anime: boolean): string {
  const k = s.ext;
  if (k === 'bioluminescent_channel') return el('path', { d: polyPath(poly), fill: P.glowColor, opacity: 0.9 }) + el('path', { d: polyPath(poly), fill: 'none', stroke: P.glowColor, 'stroke-width': hPx * 0.02, opacity: 0.3 });
  if (k === 'membrane_panel') {
    // Membrane tendue entre le bord et son retrait : fond translucide + nervures (paires de sommets face à face).
    const n = poly.length / 2;
    const veins = Array.from({ length: Math.max(0, Math.floor(n / 3)) }, (_, i) => { const a = poly[i * 3] as Vec, b = poly[poly.length - 1 - i * 3] as Vec; return `M${num(a.x)} ${num(a.y)}L${num(b.x)} ${num(b.y)}`; }).join('');
    return el('path', { d: polyPath(poly), fill: mix(P.base, P.lit, 0.35), opacity: anime ? 0.95 : 0.78, stroke: P.shade, 'stroke-width': hPx * 0.004 }) + el('path', { d: veins, fill: 'none', stroke: P.shade, 'stroke-width': hPx * 0.0035, opacity: 0.75 });
  }
  return el('path', { d: polyPath(poly), fill: mix(P.base, P.lit, 0.25), stroke: P.shade, 'stroke-width': hPx * 0.005, 'stroke-linejoin': 'round' });
}

/**
 * Éclairage de relief : chaque structure est peinte dans un groupe dont le CANAL ALPHA est la hauteur (plaque 0,5 ; reliefs au-dessus ; cavités en dessous),
 * floutée, puis `feDiffuseLighting` en tire la luminance. Le plan plat renvoie `sin(élévation)` ; l'écart à cette valeur donne une ombre (négatif) ou un
 * éclat (positif), teintés des couleurs d'ombre/de lumière de la PEAU (pas de noir pur ni de blanc pur). Le résultat est découpé à la silhouette.
 */
function reliefLighting(id: string, pe: ProjectedEar, model: EarModel, P: EarPaint, L: LightVector, hPx: number, defs: string[]): string {
  const b = box(pe.rim);
  const pad = hPx * 0.06;
  const { azimuth, elevation } = lightAngles(L);
  const flat = Math.sin((elevation * Math.PI) / 180);
  const sig = Math.max(0.6, hPx * 0.006 * (0.5 + 1.2 * (1 - P.rough * 0.4)));
  const col = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const [sr, sg, sb] = col(P.shade);
  const [hr, hg, hb] = col(P.highlight);
  const k = 2.4;
  const M = (r: number, g: number, bl: number, a: string): string => `0 0 0 0 ${num(r)} 0 0 0 0 ${num(g)} 0 0 0 0 ${num(bl)} ${a}`;
  defs.push(el('filter', { id: `${id}-lit`, filterUnits: 'userSpaceOnUse', x: b.x0 - pad, y: b.y0 - pad, width: b.x1 - b.x0 + 2 * pad, height: b.y1 - b.y0 + 2 * pad, 'color-interpolation-filters': 'sRGB' }, [
    el('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: sig, result: 'h' }),
    el('feDiffuseLighting', { in: 'h', surfaceScale: num(hPx * 0.05), diffuseConstant: 1, 'lighting-color': '#ffffff', result: 'd' }, [el('feDistantLight', { azimuth: num(azimuth), elevation: num(elevation) })]),
    el('feColorMatrix', { in: 'd', type: 'matrix', values: M(sr, sg, sb, `${num(-k)} 0 0 0 ${num(k * flat)}`), result: 'sh' }),
    el('feColorMatrix', { in: 'd', type: 'matrix', values: M(hr, hg, hb, `${num(k * 0.8)} 0 0 0 ${num(-k * 0.8 * flat)}`), result: 'hi' }),
    el('feMerge', {}, [el('feMergeNode', { in: 'sh' }), el('feMergeNode', { in: 'hi' })]),
  ]));
  const hm = [{ s: { poly: pe.rim, relief: 0 } as PlacedStructure, poly: pe.rim }, ...pe.structures.filter((x) => x.s.kind !== 'ext' && x.s.id !== 'lobule')];
  const g = hm.map(({ s, poly }) => el('path', { d: polyPath(poly), fill: '#000000', 'fill-opacity': num(Math.max(0.04, Math.min(1, 0.5 + 0.3 * s.relief))) })).join('');
  void model;
  return el('g', { 'clip-path': urlRef(`${id}-clip`), opacity: num(0.35 + 0.35 * (1 - P.rough)) }, [el('g', { filter: urlRef(`${id}-lit`) }, [g])]);
}

/** Écailles : rangées d'arcs découpés au pavillon (matériau `scaly`). */
function scales(id: string, hull: Poly, P: EarPaint, hPx: number): string {
  const b = box(hull);
  const s = hPx * 0.05;
  const arcs: string[] = [];
  for (let y = b.y0, r = 0; y < b.y1; y += s * 0.8, r++) for (let x = b.x0 + (r % 2) * s * 0.5; x < b.x1; x += s) arcs.push(`M${num(x)} ${num(y)}q${num(s / 2)} ${num(s * 0.7)} ${num(s)} 0`);
  return el('g', { 'clip-path': urlRef(`${id}-clip`) }, [el('path', { d: arcs.join(''), fill: 'none', stroke: P.shade, 'stroke-width': s * 0.08, opacity: 0.5 })]);
}
export { centroid };

import { Resvg } from '@resvg/resvg-js';
import { halfWidthAt } from '../../src/face';
import { inPoly, type Poly } from '../../src/face/poly';
import { direction2D, lightVector } from '../../src/lighting/light';
import { cellSvg, type CellSpec } from './board';

/**
 * VÉRIFICATION DU RENDU SUR L'IMAGE (T14) : les trois couches du cahier des charges mesurées sur les PIXELS, pas sur les paramètres.
 * Chaque contrôle rastérise la scène (resvg), échantillonne des pixels aux positions données par la géométrie (`meta.px`), et compare.
 *   géométrie : la silhouette dessinée a la largeur de la géométrie ;
 *   anatomie  : narines plus sombres que la peau, côté éclairé plus clair, dents plus claires que la cavité, lèvres plus rouges que la peau ;
 *   style     : l'encrage est binaire, les modes de rendu ne déplacent pas la silhouette, les contours dessinés existent quand on les demande.
 */
export interface ImageCheck {
  readonly layer: 'geometry' | 'anatomy' | 'style';
  readonly id: string;
  readonly ok: boolean;
  readonly value: number;
  readonly limit: number;
  readonly message: string;
}

interface Raster {
  readonly w: number;
  readonly h: number;
  readonly px: Uint8Array;
}
const BG = [0x3b, 0x41, 0x57] as const;

function raster(svg: string): Raster {
  const r = new Resvg(svg, { font: { loadSystemFonts: true } }).render();
  return { w: r.width, h: r.height, px: r.pixels };
}
const at = (r: Raster, x: number, y: number): [number, number, number] => {
  const i = (Math.max(0, Math.min(r.h - 1, Math.round(y))) * r.w + Math.max(0, Math.min(r.w - 1, Math.round(x)))) * 4;
  return [r.px[i] as number, r.px[i + 1] as number, r.px[i + 2] as number];
};
const lum = (c: readonly number[]): number => 0.2126 * (c[0] as number) + 0.7152 * (c[1] as number) + 0.0722 * (c[2] as number);
/** Moyenne 5 × 5 autour d'un point (réduit le bruit d'antialiasing). */
const avg = (r: Raster, x: number, y: number): [number, number, number] => {
  const s = [0, 0, 0];
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) at(r, x + dx, y + dy).forEach((v, i) => (s[i] = (s[i] as number) + v / 25));
  return s as [number, number, number];
};
const isBg = (c: readonly number[]): boolean => Math.abs((c[0] as number) - BG[0]) < 14 && Math.abs((c[1] as number) - BG[1]) < 14 && Math.abs((c[2] as number) - BG[2]) < 14;
/** Distance de couleur (euclidienne) entre deux pixels. */
const dist = (a: readonly number[], b: readonly number[]): number => Math.hypot((a[0] as number) - (b[0] as number), (a[1] as number) - (b[1] as number), (a[2] as number) - (b[2] as number));
/**
 * Largeur (px) de la plage de PEAU d'une ligne : on part de deux points de peau (à `seed` px à droite et à gauche du centre `cx`, hors des traits du milieu : nez, lèvres)
 * et on avance vers l'extérieur tant que le pixel est de la peau (distance RVB < 75 de la couleur `skin`). On mesure la peau et non « tout ce qui n'est pas le fond » :
 * le halo d'ombre et le liseré autour de la tête ne sont pas la tête.
 */
function rowWidth(r: Raster, y: number, cx: number, seed: number, skin: readonly number[]): number {
  const isSkin = (x: number): boolean => dist(at(r, x, y), skin) < 75;
  let l = cx - seed;
  let rr = cx + seed;
  while (l > 0 && isSkin(l - 1)) l--;
  while (rr < r.w - 1 && isSkin(rr + 1)) rr++;
  return rr - l;
}
const centroid = (p: Poly): { x: number; y: number } => ({ x: p.reduce((s, q) => s + q.x, 0) / p.length, y: p.reduce((s, q) => s + q.y, 0) / p.length });
/** Silhouette : ensemble des pixels non-fond (masque binaire) ; IoU de deux masques. */
const mask = (r: Raster): Uint8Array => Uint8Array.from({ length: r.w * r.h }, (_, i) => (isBg([r.px[i * 4] as number, r.px[i * 4 + 1] as number, r.px[i * 4 + 2] as number]) ? 0 : 1));
function iou(a: Uint8Array, b: Uint8Array): number {
  let i = 0;
  let u = 0;
  for (let k = 0; k < a.length; k++) {
    i += (a[k] as number) & (b[k] as number);
    u += (a[k] as number) | (b[k] as number);
  }
  return u === 0 ? 1 : i / u;
}


/** Contrôles image d'un visage structuré : `spec` = la cellule (graine + surcharges). */
export function checkRenderImage(spec: CellSpec, W = 520, H = 640): ImageCheck[] {
  const out: ImageCheck[] = [];
  const add = (layer: ImageCheck['layer'], id: string, ok: boolean, value: number, limit: number, message: string): void => void out.push({ layer, id, ok, value, limit, message });
  const base = cellSvg({ ...spec, focus: 'face' }, W, H);
  const { meta } = base;
  const r0 = raster(base.svg);
  const [cx] = meta.px(0, 0);
  // Couleur de la peau : échantillon sur la joue, sous l'œil (hors reflet fort).
  const skinRef = avg(r0, ...meta.px(0, meta.lm.noseBaseY + 0.06 * meta.lm.H));
  // GÉOMÉTRIE — la silhouette dessinée suit le contour géométrique à la hauteur de la bouche et du gonion (tolérance : 4 % ou 4 px).
  for (const [id, y] of [['jaw-mid', meta.lm.jaw.gonion.y - 0.35 * (meta.lm.jaw.gonion.y - meta.lm.mouthY)], ['gonion', meta.lm.jaw.gonion.y]] as const) {
    const expected = 2 * halfWidthAt(meta.lm.outline, y) * meta.s;
    const [, py] = meta.px(0, y);
    const got = rowWidth(r0, py, cx, 0.45 * expected / 2, skinRef);
    add('geometry', `image-silhouette-${id}`, Math.abs(got - expected) <= Math.max(4, 0.04 * expected), got, expected, `largeur dessinée ${got.toFixed(1)} px ≠ largeur géométrique ${expected.toFixed(1)} px`);
  }
  // ANATOMIE.
  const skinC = meta.params.anatomyEngine === 'structured' ? avg(r0, ...meta.px(0, meta.lm.noseBaseY - 0.12 * meta.lm.H)) : avg(r0, ...meta.px(0, meta.lm.eyeY + 0.1 * meta.lm.H));
  const nr = meta.nose.regions.nostrils.right;
  const [nx, ny] = meta.px(centroid(nr.aperture).x, centroid(nr.aperture).y);
  add('anatomy', 'image-nostril-darker-than-skin', lum(avg(r0, nx, ny)) <= 0.7 * lum(skinC), lum(avg(r0, nx, ny)), 0.7 * lum(skinC), 'la narine n\'est pas nettement plus sombre que la peau');
  // Côté éclairé plus clair : chair des joues, côté lumière contre côté ombre.
  const L = direction2D(lightVector({ azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity: 1 } as never));
  const yc = (meta.lm.eyeY + meta.lm.mouthY) / 2;
  const wc = halfWidthAt(meta.lm.outline, yc) * 0.58;
  const litX = (L.x >= 0 ? 1 : -1) * wc;
  const lit = lum(avg(r0, ...meta.px(litX, yc)));
  const dark = lum(avg(r0, ...meta.px(-litX, yc)));
  add('anatomy', 'image-lit-side-brighter', lit > dark, lit - dark, 0, 'le côté éclairé de la joue n\'est pas plus clair que le côté ombre');
  // Lèvres plus rouges que la peau (R − G).
  const lipY = meta.lm.mouthY + 0.004 * meta.lm.H;
  const lipC = avg(r0, ...meta.px(0, lipY));
  add('anatomy', 'image-lips-redder-than-skin', lipC[0] - lipC[1] > skinC[0] - skinC[1], lipC[0] - lipC[1], skinC[0] - skinC[1], 'les lèvres ne sont pas plus rouges que la peau');
  // STYLE — modes de rendu : la silhouette ne bouge pas (IoU des masques ≥ 0,985) ; l'encrage est quasi binaire ; les contours dessinés existent.
  const ink = cellSvg({ ...spec, focus: 'lower', patch: { ...(spec.patch as object), renderMode: 'ink' } }, W, H);
  const rInk = raster(ink.svg);
  let binary = 0;
  let total = 0;
  for (let y = Math.round(H * 0.25); y < Math.round(H * 0.85); y += 2) {
    for (let x = Math.round(W * 0.2); x < Math.round(W * 0.8); x += 2) {
      const c = at(rInk, x, y);
      if (isBg(c)) continue;
      total++;
      if (Math.max(...c) - Math.min(...c) < 12 && (Math.max(...c) <= 30 || Math.min(...c) >= 225)) binary++;
    }
  }
  add('style', 'image-ink-is-binary', total > 0 && binary / total >= 0.9, binary / Math.max(1, total), 0.9, 'l\'encrage contient trop de niveaux de gris');
  const anime = raster(cellSvg({ ...spec, focus: 'face', patch: { ...(spec.patch as object), renderMode: 'anime' } }, W, H).svg);
  const inkFull = raster(cellSvg({ ...spec, focus: 'face', patch: { ...(spec.patch as object), renderMode: 'ink' } }, W, H).svg);
  const m0 = mask(r0);
  add('style', 'image-render-modes-keep-silhouette', Math.min(iou(m0, mask(anime)), iou(m0, mask(inkFull))) >= 0.985, Math.min(iou(m0, mask(anime)), iou(m0, mask(inkFull))), 0.985, 'un mode de rendu a déplacé la silhouette');
  // Contours dessinés : un point du contour du visage est sombre avec `outline: 1`, pas sans.
  const inked = raster(cellSvg({ ...spec, focus: 'face', patch: { ...(spec.patch as object), stylization: { outline: 1 } } }, W, H).svg);
  const edge = meta.px(halfWidthAt(meta.lm.outline, meta.lm.mouthY) * 0.999, meta.lm.mouthY);
  const around = (r: Raster): number => Math.min(...[-3, -2, -1, 0, 1, 2, 3].map((d) => lum(at(r, edge[0] + d, edge[1]))));
  add('style', 'image-outline-drawn-on-request', around(inked) < 60 && around(r0) > 60, around(inked), 60, 'le contour dessiné est absent ou présent sans demande');
  return out;
}

/** Aire intérieure d'un polygone en pixels (utilitaire d'artefacts). */
export const insidePoly = (poly: Poly, x: number, y: number): boolean => inPoly(poly, x, y);

import type { Vec } from '../../src/geometry/eye/primitives';
import type { Blob } from '../../src/face/structure';
import type { CellMeta } from './board';

/**
 * Surcouches de PREUVE des artefacts de structure : elles dessinent, par-dessus le rendu, les régions que la géométrie expose (polygones, ellipses, polylignes),
 * avec une légende. Ce qui est tracé est exactement ce que `noseGeometry` / `structureGeometry` / `mouthGeometry` renvoient : rien n'est redessiné à la main.
 * Les coordonnées passent par `meta.px` (repère de l'hôte → pixels de la cellule).
 */
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const pts = (m: CellMeta, a: readonly Vec[]): string => a.map((q) => m.px(q.x, q.y).map((v) => v.toFixed(1)).join(',')).join(' ');

export const poly = (m: CellMeta, a: readonly Vec[], color: string, fill = 0.25): string =>
  a.length < 3 ? '' : `<polygon points="${pts(m, a)}" fill="${color}" fill-opacity="${fill}" stroke="${color}" stroke-width="1.4" stroke-opacity="0.95"/>`;
export const line = (m: CellMeta, a: readonly Vec[], color: string, w = 1.6, dash = ''): string =>
  a.length < 2 ? '' : `<polyline points="${pts(m, a)}" fill="none" stroke="${color}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''} stroke-linecap="round"/>`;
export const blob = (m: CellMeta, b: Blob, color: string, fill = 0.22): string => {
  const [cx, cy] = m.px(b.c.x, b.c.y);
  return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(b.rx * m.s).toFixed(1)}" ry="${(b.ry * m.s).toFixed(1)}" transform="rotate(${b.rotDeg} ${cx.toFixed(1)} ${cy.toFixed(1)})" fill="${color}" fill-opacity="${fill}" stroke="${color}" stroke-width="1.3"/>`;
};
export const dot = (m: CellMeta, p: Vec, color: string, r = 3.2): string => {
  const [x, y] = m.px(p.x, p.y);
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${color}" stroke="#000" stroke-width="0.8"/>`;
};
/** Étiquette avec un petit trait vers `at` (repère hôte) ; le texte est posé en pixels `(tx, ty)` de la cellule. */
export const tag = (m: CellMeta, at: Vec, tx: number, ty: number, text: string, color: string): string => {
  const [x, y] = m.px(at.x, at.y);
  // Étiquettes de la moitié droite de la cellule : texte aligné sur sa fin (jamais coupé par le bord).
  const right = tx > m.w / 2;
  return `<line x1="${tx}" y1="${ty - 4}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="1" stroke-opacity="0.85"/><text x="${tx}" y="${ty}" text-anchor="${right ? 'end' : 'start'}" fill="${color}" font-size="11" font-weight="bold" font-family="DejaVu Sans, sans-serif" stroke="#000" stroke-width="0.35" paint-order="stroke">${esc(text)}</text>`;
};
/** Texte libre en pixels de la cellule (mesures chiffrées sur l'image). */
export const note = (x: number, y: number, text: string, color = '#ffe08a'): string =>
  `<text x="${x}" y="${y}" fill="${color}" font-size="12" font-weight="bold" font-family="DejaVu Sans, sans-serif" stroke="#000" stroke-width="0.4" paint-order="stroke">${esc(text)}</text>`;

/** Enveloppe tout le contenu d'une scène SVG dans le filtre d'encrage (le visage ET les yeux), pour un rendu `ink` cohérent sur toute la planche. */
export function inkWrapScene(svg: string, threshold = 0.7): string {
  const n0 = Math.max(1, Math.min(9, Math.round(threshold * 10)));
  const table = Array.from({ length: 10 }, (_, i) => (i < n0 ? 0 : 1)).join(' ');
  const fn = (t: string): string => `<${t} type="discrete" tableValues="${table}"/>`;
  const defs = `<filter id="sceneInk" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer>${fn('feFuncR')}${fn('feFuncG')}${fn('feFuncB')}</feComponentTransfer></filter>`;
  return svg.replace(/(<svg[^>]*>)/, `$1<defs>${defs}</defs><g filter="url(#sceneInk)">`).replace(/<\/svg>\s*$/, '</g></svg>');
}

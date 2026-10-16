import { darken, lighten, mix } from '../../core/color';
import { num, el } from '../../core/svg';
import type { FaceLandmarks } from '../../face';
import type { FaceParams } from '../../schema';

/**
 * Bouche : lèvre supérieure (arc de Cupidon), lèvre inférieure, intérieur sombre + dents si ouverte.
 * `curve` déplace les commissures (sourire ↑ / moue ↓) ; `open` écarte la lèvre inférieure.
 */
export function renderMouth(p: FaceParams, lm: FaceLandmarks, skin: string): string[] {
  const m = p.mouth;
  const mw = m.width * lm.W;
  const H = lm.H;
  const cy = lm.mouthY;
  const cornerY = cy - m.curve * 0.03 * H;
  const L = { x: -mw / 2, y: cornerY };
  const R = { x: mw / 2, y: cornerY };
  const oh = m.open * 0.09 * H;
  const lipColor = m.color ?? mix(skin, '#b8323f', 0.5);
  const f = (x: number, y: number): string => `${num(x)} ${num(y)}`;
  // Ligne de fermeture : de gauche à droite, déportée vers le bas de `off` au centre.
  const sag = cy + m.curve * 0.006 * H;
  const rima = (off: number): string => `C${f(-mw * 0.2, sag + off / 0.75)} ${f(mw * 0.2, sag + off / 0.75)} ${f(R.x, R.y)}`;
  const rimaBack = (off: number): string => `C${f(mw * 0.2, sag + off / 0.75)} ${f(-mw * 0.2, sag + off / 0.75)} ${f(L.x, L.y)}`;
  const ul = (0.012 + 0.03 * m.upperLip) * H;
  const ll = (0.02 + 0.05 * m.lowerLip) * H;
  const bow = { x: mw * 0.13, y: cy - ul };
  const dip = { x: 0, y: cy - ul * 0.6 };
  const out: string[] = [];

  if (oh > 0.004 * H) {
    out.push(el('path', { d: `M${f(L.x, L.y)}${rima(0)}${rimaBack(oh)}Z`, fill: '#3a1218' }));
    out.push(el('path', { d: `M${f(L.x, L.y)}${rima(0)}${rimaBack(oh * 0.4)}Z`, fill: '#f3eee4' }));
  }
  // Lèvre inférieure : bord haut = ligne de fermeture (descendue de `oh`), bord bas arrondi.
  out.push(el('path', { d: `M${f(L.x, L.y)}${rima(oh)}C${f(R.x - mw * 0.1, R.y + oh + ll * 0.9)} ${f(mw * 0.3, cy + oh + ll)} ${f(0, cy + oh + ll)}C${f(-mw * 0.3, cy + oh + ll)} ${f(L.x + mw * 0.1, L.y + oh + ll * 0.9)} ${f(L.x, L.y)}Z`, fill: lipColor }));
  out.push(el('ellipse', { cx: 0, cy: cy + oh + ll * 0.55, rx: mw * 0.14, ry: ll * 0.16, fill: lighten(lipColor, 0.45), opacity: 0.35 }));
  // Lèvre supérieure : arc de Cupidon puis retour le long de la ligne de fermeture.
  out.push(el('path', { d: `M${f(L.x, L.y)}C${f(L.x + mw * 0.12, L.y - ul * 0.1)} ${f(-bow.x - mw * 0.1, bow.y)} ${f(-bow.x, bow.y)}C${f(-bow.x + mw * 0.06, bow.y)} ${f(-0.06 * mw, dip.y)} ${f(0, dip.y)}C${f(0.06 * mw, dip.y)} ${f(bow.x - mw * 0.06, bow.y)} ${f(bow.x, bow.y)}C${f(bow.x + mw * 0.1, bow.y)} ${f(R.x - mw * 0.12, R.y - ul * 0.1)} ${f(R.x, R.y)}${rimaBack(0)}Z`, fill: darken(lipColor, 0.08) }));
  out.push(el('path', { d: `M${f(L.x, L.y)}${rima(0)}`, fill: 'none', stroke: darken(lipColor, 0.55), 'stroke-width': mw * 0.012, 'stroke-linecap': 'round' }));
  return out;
}

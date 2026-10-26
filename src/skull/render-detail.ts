import { mix } from '../core/color';
import { el, num } from '../core/svg';
import type { SkullGeo } from './geometry';
import { smoothPath } from './spline';
import type { CPoint, V2 } from './types';

/** Détails d'encre du visage et du cou en profil : sourcil, œil, aile du nez et narine, sillon naso-génien, ligne des lèvres, mandibule, sterno-cléido-mastoïdien, trapèze, plis de la nuque. */
export interface Ink { readonly line: string; readonly soft: string; readonly hair: string; readonly shade: string }

const q = (a: V2, b: V2, c: V2): string => `M${num(a.x)} ${num(a.y)}Q${num(b.x)} ${num(b.y)} ${num(c.x)} ${num(c.y)}`;
export function faceDetails(g: SkullGeo, ink: Ink, genericEye = true): string[] {
  const { H, frame: fr } = g;
  const { x, f } = fr;
  const sk = (id: string): CPoint => g.skin.get(id) as CPoint;
  const out: string[] = [];
  const lw = H * 0.0042;
  const stroke = (d: string, c: string, w: number, o = 1): string => el('path', { d, fill: 'none', stroke: c, 'stroke-width': num(w), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: num(o) });
  // Œil et sourcil génériques : seulement si aucune donnée d'œil de la face n'est fournie (sinon `render-eye.ts` les dessine à partir du moteur d'yeux).
  if (genericEye) {
    // Œil : fente palpébrale (lames sup. et inf.), iris, cils, pli ; sa cornée affleure derrière le plan nasion-glabelle.
    const xc = x.nasion - 0.012 * H, yc = f.eye * H;
  
    out.push(el('path', { d: `M${num(xc - 0.042 * H)} ${num(yc + 0.002 * H)}Q${num(xc - 0.02 * H)} ${num(yc - 0.016 * H)} ${num(xc + 0.012 * H)} ${num(yc - 0.004 * H)}L${num(xc + 0.012 * H)} ${num(yc + 0.003 * H)}Q${num(xc - 0.02 * H)} ${num(yc + 0.012 * H)} ${num(xc - 0.042 * H)} ${num(yc + 0.002 * H)}Z`, fill: '#f5f1ea' }));
    out.push(el('ellipse', { cx: num(xc - 0.004 * H), cy: num(yc - 0.002 * H), rx: num(0.0075 * H), ry: num(0.0115 * H), fill: mix(ink.line, '#5a3b25', 0.55) }));
    out.push(el('ellipse', { cx: num(xc - 0.002 * H), cy: num(yc - 0.005 * H), rx: num(0.0022 * H), ry: num(0.0032 * H), fill: '#ffffff', opacity: 0.9 }));
    out.push(stroke(q({ x: xc - 0.046 * H, y: yc + 0.003 * H }, { x: xc - 0.02 * H, y: yc - 0.022 * H }, { x: xc + 0.015 * H, y: yc - 0.006 * H }), ink.line, lw * 1.9));
    out.push(stroke(q({ x: xc - 0.036 * H, y: yc + 0.004 * H }, { x: xc - 0.01 * H, y: yc + 0.015 * H }, { x: xc + 0.011 * H, y: yc + 0.004 * H }), ink.line, lw * 0.8, 0.8));
    for (let i = 0; i < 3; i++) out.push(stroke(`M${num(xc - 0.004 * H + i * 0.006 * H)} ${num(yc - 0.0125 * H - i * 0.0006 * H)}l${num(0.013 * H)} ${num(-0.006 * H + i * 0.0015 * H)}`, ink.line, lw * 0.9));
    out.push(stroke(q({ x: xc - 0.04 * H, y: yc - 0.026 * H }, { x: xc - 0.012 * H, y: yc - 0.034 * H }, { x: xc + 0.008 * H, y: yc - 0.02 * H }), ink.soft, lw * 0.9, 0.55));
    // Sourcil : arc plein, plus épais en avant, qui suit l'arcade (glabelle → queue).
    const yb = (f.glabella + f.eye) / 2 * H - 0.004 * H;
    out.push(el('path', { d: `M${num(xc + 0.026 * H)} ${num(yb + 0.002 * H)}Q${num(xc - 0.012 * H)} ${num(yb - 0.016 * H)} ${num(xc - 0.068 * H)} ${num(yb + 0.006 * H)}Q${num(xc - 0.012 * H)} ${num(yb - 0.006 * H)} ${num(xc + 0.026 * H)} ${num(yb + 0.011 * H)}Z`, fill: ink.hair }));

  }
  // Nez : sillon alaire, aile, narine.
  const sub = sk('subnasale'), tip = sk('pronasale');
  out.push(stroke(q({ x: tip.x - 0.068 * H, y: tip.y - 0.016 * H }, { x: tip.x - 0.092 * H, y: tip.y + 0.012 * H }, { x: sub.x - 0.034 * H, y: sub.y - 0.002 * H }), ink.soft, lw * 1.1, 0.8));
  out.push(el('ellipse', { cx: num((tip.x + sub.x) / 2 + 0.006 * H), cy: num(tip.y + 0.003 * H), rx: num(0.011 * H), ry: num(0.0048 * H), transform: `rotate(-22 ${num((tip.x + sub.x) / 2 + 0.006 * H)} ${num(tip.y + 0.003 * H)})`, fill: ink.shade }));
  out.push(stroke(q({ x: tip.x - 0.066 * H, y: sub.y - 0.03 * H }, { x: tip.x - 0.04 * H, y: sub.y - 0.036 * H }, { x: tip.x - 0.022 * H, y: sub.y - 0.016 * H }), ink.soft, lw, 0.7));
  // Bouche : ligne des lèvres vers la commissure, pli naso-génien, sillon sous la lèvre.
  const st = sk('stomion'), sl = sk('sublabiale');
  out.push(stroke(q(st, { x: st.x - 0.03 * H, y: st.y + 0.0 * H }, { x: st.x - 0.062 * H, y: st.y + 0.006 * H }), ink.line, lw * 1.25));
  out.push(stroke(q({ x: sub.x - 0.05 * H, y: sub.y + 0.004 * H }, { x: sub.x - 0.094 * H, y: st.y - 0.03 * H }, { x: st.x - 0.078 * H, y: st.y + 0.012 * H }), ink.soft, lw, 0.6));
  out.push(stroke(q({ x: sl.x - 0.002 * H, y: sl.y }, { x: sl.x - 0.022 * H, y: sl.y - 0.002 * H }, { x: sl.x - 0.04 * H, y: sl.y + 0.006 * H }), ink.soft, lw, 0.6));
  // Mandibule : bord inférieur gonion → menton (sous la peau, trait doux) et arête du masséter.
  const go = g.bone.lm.gonion as V2, gn = g.bone.lm.gnathion as V2;
  out.push(stroke(q(go, { x: (go.x + gn.x) / 2, y: gn.y + 0.012 * H }, { x: gn.x - 0.02 * H, y: gn.y + 0.012 * H }), ink.soft, lw * 1.1, 0.6));
  out.push(stroke(q({ x: go.x + 0.01 * H, y: go.y - 0.02 * H }, { x: go.x + 0.06 * H, y: go.y - 0.1 * H }, { x: 0.07 * H, y: go.y - 0.17 * H }), ink.soft, lw, 0.35));
  return out;
}

/** Lèvres : vermillon supérieur et inférieur (cales entre le contour et la ligne de bouche), peints sous les traits. */
export function lipsLayer(g: SkullGeo, color: string, line: string): string[] {
  const { H, frame: fr } = g;
  const sk = (id: string): CPoint => g.skin.get(id) as CPoint;
  const vs = sk('vermilionSup'), ls = sk('labraleSup'), st = sk('stomion'), li = sk('labraleInf'), vi = sk('vermilionInf');
  const cm = { x: st.x - 0.058 * H, y: st.y + 0.004 * H };
  void fr;
  const up = `M${num(vs.x)} ${num(vs.y)}Q${num(ls.x + 0.002 * H)} ${num(ls.y - 0.004 * H)} ${num(ls.x)} ${num(ls.y)}Q${num(st.x + 0.002 * H)} ${num(st.y - 0.004 * H)} ${num(st.x)} ${num(st.y)}L${num(cm.x)} ${num(cm.y)}Q${num(vs.x - 0.04 * H)} ${num(vs.y + 0.006 * H)} ${num(vs.x)} ${num(vs.y)}Z`;
  const lo = `M${num(st.x)} ${num(st.y)}Q${num(li.x + 0.004 * H)} ${num(li.y - 0.006 * H)} ${num(li.x)} ${num(li.y)}Q${num(vi.x + 0.002 * H)} ${num(vi.y - 0.002 * H)} ${num(vi.x)} ${num(vi.y)}Q${num(vi.x - 0.03 * H)} ${num(vi.y - 0.008 * H)} ${num(cm.x)} ${num(cm.y)}Z`;
  return [el('path', { d: up, fill: color }), el('path', { d: lo, fill: color, opacity: 0.92 }), el('path', { d: `M${num(li.x - 0.002 * H)} ${num(li.y - 0.012 * H)}q${num(0.004 * H)} ${num(0.004 * H)} ${num(0.002 * H)} ${num(0.01 * H)}`, fill: 'none', stroke: line, 'stroke-width': num(H * 0.002), opacity: 0.0 })];
}

export function neckDetails(g: SkullGeo, ink: Ink): string[] {
  const { H, neck } = g;
  const out: string[] = [];
  const stroke = (d: string, w: number, o: number): string => el('path', { d, fill: 'none', stroke: ink.soft, 'stroke-width': num(w), 'stroke-linecap': 'round', opacity: num(o) });
  const m = g.bone.lm.mastoid as V2;
  // Sterno-cléido-mastoïdien : deux bords de la mastoïde vers l'incisure sternale (fait voir la nuque de côté et la structure du cou).
  const top = { x: m.x + 0.01 * H, y: m.y + 0.01 * H };
  const bot = { x: neck.xFront(neck.yBase) - 0.05 * H, y: neck.yBase };
  const mid = { x: (top.x + bot.x) / 2 + 0.03 * H, y: (top.y + bot.y) / 2 };
  out.push(stroke(smoothPath([top, mid, bot]), H * 0.0038, 0.55));
  out.push(stroke(smoothPath([{ x: top.x - 0.03 * H, y: top.y + 0.02 * H }, { x: mid.x - 0.045 * H, y: mid.y }, { x: bot.x - 0.06 * H, y: bot.y }]), H * 0.003, 0.35));
  // Trapèze : arête qui descend de la nuque vers l'épaule ; plis horizontaux de la nuque.
  const nape = g.skin.get('nape') as V2;
  out.push(stroke(smoothPath([{ x: neck.xBack(nape.y + 0.05 * H) + 0.035 * H, y: nape.y + 0.05 * H }, { x: neck.xBack(nape.y + 0.14 * H) + 0.045 * H, y: nape.y + 0.14 * H }, { x: neck.xBack(neck.yC7 - 0.02 * H) + 0.05 * H, y: neck.yC7 - 0.02 * H }]), H * 0.0035, 0.35));
  for (let i = 0; i < 3; i++) { const y = neck.yTop + (0.05 + 0.045 * i) * H; out.push(stroke(`M${num(neck.xBack(y) + 0.012 * H)} ${num(y)}q${num(0.03 * H)} ${num(0.008 * H)} ${num(0.06 * H)} ${num(0.002 * H)}`, H * 0.0028, 0.3)); }
  return out;
}

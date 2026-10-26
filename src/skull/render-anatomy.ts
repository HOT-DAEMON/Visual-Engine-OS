import { el, num } from '../core/svg';
import { polyIndex, type SkullGeo } from './geometry';
import { smoothPath } from './spline';
import type { V2 } from './types';

/**
 * COUCHE OSSEUSE (mode `anatomy`/`bone`) : crâne (voûte, face, base), orbite, arcade zygomatique, mandibule (corps, gonion, ramus, coronoïde, condyle),
 * dents, sutures (coronale, squameuse, lambdoïde), ligne temporale, mastoïde, colonne cervicale C1–C7 avec leurs épineuses, hyoïde, puis les MARQUEURS de
 * profondeur de tissu (trait os → peau) et les repères. Tout est tiré de `SkullGeo.bone` : aucune coordonnée propre à ce fichier hors proportions locales.
 */
export interface BoneColors { readonly bone: string; readonly line: string; readonly shade: string; readonly marker: string; readonly landmark: string }

export function boneLayer(g: SkullGeo, c: BoneColors, markers: boolean): string[] {
  const { H, bone, frame: fr, neck } = g;
  const L = bone.lm;
  const P = (id: string): V2 => L[id] as V2;
  const o: string[] = [];
  const lw = H * 0.0036;
  const stroke = (d: string, w = lw, col = c.line, op = 1, dash?: string): string => el('path', { d, fill: 'none', stroke: col, 'stroke-width': num(w), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: num(op), ...(dash ? { 'stroke-dasharray': dash } : {}) });
  // Voûte osseuse : la peau décalée vers l'intérieur de la profondeur du cuir chevelu (os = peau − tissu), de la supraglabelle à l'inion.
  const seg = g.poly.slice(polyIndex(g, 'inion'), polyIndex(g, 'supraglabella') + 1).filter((_, k) => k % 5 === 0);
  const front = seg.map((p, k, a) => {
    const q = a[Math.max(0, k - 1)] as V2, r = a[Math.min(a.length - 1, k + 1)] as V2;
    const dx = r.x - q.x, dy = r.y - q.y, l = Math.hypot(dx, dy) || 1;
    const d = 0.022 * H * (0.75 + 0.5 * g.params.scalp);
    return { x: p.x - (dy / l) * d, y: p.y + (dx / l) * d };
  });
  const cranium = [
    P('supraglabella:bone'), ...[...front].reverse().slice(1, -1), P('inion:bone'),
    { x: P('inion:bone').x + 0.07 * H, y: P('inion:bone').y + 0.035 * H }, P('mastoid'), { x: 0.045 * H, y: P('porion').y + 0.085 * H },
    { x: 0.2 * H, y: P('prosthion').y + 0.006 * H }, P('prosthion'), P('nasospinale'), { x: P('nasospinale').x - 0.012 * H, y: P('nasospinale').y - 0.06 * H },
    P('rhinion:bone'), P('nasion:bone'), P('glabella:bone'),
  ];
  o.push(el('path', { d: smoothPath(cranium, true), fill: c.bone, stroke: c.line, 'stroke-width': num(lw * 1.3), 'stroke-linejoin': 'round' }));
  // Orbite (rebord latéral vu de profil), globe, arcade zygomatique, mastoïde, conduit auditif.
  const eyeY = fr.f.eye * H;
  o.push(el('ellipse', { cx: num(P('orbitale').x + 0.005 * H), cy: num(eyeY), rx: num(0.036 * H), ry: num(0.05 * H), fill: c.shade, stroke: c.line, 'stroke-width': num(lw), opacity: 0.85 }));
  o.push(el('circle', { cx: num(P('orbitale').x + 0.012 * H), cy: num(eyeY), r: num(0.03 * H), fill: '#f4efe6', stroke: c.line, 'stroke-width': num(lw * 0.7) }));
  const zy = P('zygomaxillare'), pt = { x: 0.03 * H, y: P('porion').y - 0.018 * H };
  o.push(el('path', { d: `${smoothPath([zy, { x: (zy.x + pt.x) / 2, y: (zy.y + pt.y) / 2 + 0.012 * H }, pt])}L${num(pt.x)} ${num(pt.y - 0.02 * H)}${smoothPath([{ x: pt.x, y: pt.y - 0.02 * H }, { x: (zy.x + pt.x) / 2, y: (zy.y + pt.y) / 2 - 0.012 * H }, { x: zy.x, y: zy.y - 0.03 * H }]).replace(/^M[^C]*/, 'L' + num(pt.x) + ' ' + num(pt.y - 0.02 * H))}Z`, fill: c.bone, stroke: c.line, 'stroke-width': num(lw) }));
  o.push(el('circle', { cx: 0, cy: num(P('porion').y), r: num(0.011 * H), fill: c.line }));
  // Sutures : lignes ondulées (déterministes) coronale, squameuse, lambdoïde ; ligne temporale.
  const wave = (a: V2, b: V2, k: number): V2[] => Array.from({ length: 9 }, (_, i) => { const t = i / 8; return { x: a.x + (b.x - a.x) * t + Math.sin(i * 2.1 + k) * 0.004 * H, y: a.y + (b.y - a.y) * t + Math.cos(i * 1.7 + k) * 0.004 * H }; });
  const bregma = P('bregma:bone'), pter = P('pterion'), lam = P('lambda:bone'), ast = P('asterion');
  o.push(stroke(smoothPath(wave(bregma, pter, 1)), lw * 0.8, c.line, 0.75));
  o.push(stroke(smoothPath(wave(lam, ast, 2)), lw * 0.8, c.line, 0.75));
  o.push(stroke(smoothPath([pter, { x: 0.02 * H, y: pter.y - 0.04 * H }, { x: -0.1 * H, y: pter.y - 0.015 * H }, ast]), lw * 0.8, c.line, 0.6));
  o.push(stroke(smoothPath([{ x: P('glabella:bone').x - 0.02 * H, y: P('glabella:bone').y - 0.04 * H }, { x: 0.15 * H, y: pter.y - 0.12 * H }, { x: 0.0, y: pter.y - 0.14 * H }, { x: -0.12 * H, y: pter.y - 0.03 * H }]), lw * 0.8, c.line, 0.4, '4 3'));
  // Mandibule : symphyse → alvéole → coronoïde → échancrure sigmoïde → condyle → bord postérieur du ramus → gonion → bord inférieur.
  const go = P('gonion'), co = P('condyle'), cr = P('coronoid');
  // Corps mandibulaire de hauteur réaliste : arcade alvéolaire quasi horizontale au niveau des dents, puis bord antérieur du ramus jusqu'à la coronoïde.
  const stm = g.skin.get('stomion') as V2;
  const mand = [P('pogonion:bone'), P('infradentale'), { x: (P('infradentale').x + cr.x) / 2 + 0.03 * H, y: stm.y + 0.03 * H }, { x: cr.x + 0.03 * H, y: stm.y + 0.04 * H }, cr, { x: (cr.x + co.x) / 2, y: co.y + 0.022 * H }, { x: co.x, y: co.y - 0.005 * H }, { x: co.x - 0.012 * H, y: co.y + 0.04 * H }, go, { x: (go.x + P('gnathion').x) / 2, y: P('gnathion').y + 0.006 * H }, P('gnathion')];
  o.push(el('path', { d: smoothPath(mand, true), fill: c.bone, stroke: c.line, 'stroke-width': num(lw * 1.3), 'stroke-linejoin': 'round' }));
  o.push(el('circle', { cx: num(co.x), cy: num(co.y - 0.004 * H), r: num(0.014 * H), fill: c.bone, stroke: c.line, 'stroke-width': num(lw) }));
  // Dents : incisives supérieure et inférieure, ligne d'occlusion.
  const pr = P('prosthion'), idt = P('infradentale'), st = g.skin.get('stomion') as V2;
  o.push(el('path', { d: `M${num(pr.x - 0.006 * H)} ${num(pr.y)}L${num(pr.x + 0.016 * H)} ${num(pr.y)}L${num(pr.x + 0.012 * H)} ${num(st.y + 0.002 * H)}L${num(pr.x - 0.004 * H)} ${num(st.y + 0.002 * H)}Z`, fill: '#f7f2e6', stroke: c.line, 'stroke-width': num(lw * 0.8) }));
  o.push(el('path', { d: `M${num(idt.x - 0.004 * H)} ${num(idt.y)}L${num(idt.x + 0.014 * H)} ${num(idt.y)}L${num(idt.x + 0.014 * H)} ${num(st.y + 0.004 * H)}L${num(idt.x + 0.002 * H)} ${num(st.y + 0.004 * H)}Z`, fill: '#f7f2e6', stroke: c.line, 'stroke-width': num(lw * 0.8) }));
  o.push(stroke(`M${num(pr.x + 0.014 * H)} ${num(st.y + 0.003 * H)}L${num(0.17 * H)} ${num(st.y + 0.005 * H)}`, lw * 0.9, c.line, 0.8));
  // Colonne cervicale : corps (cercles), épineuses (vers la nuque), disques ; hyoïde sous le menton.
  for (const v of bone.vertebrae) {
    // Arc postérieur : de la face arrière du corps à la pointe de l'épineuse (fine, effilée), puis corps vertébral.
    o.push(el('path', { d: `M${num(v.c.x - v.r * 0.5)} ${num(v.c.y - v.r * 0.45)}L${num(v.spine.x)} ${num(v.spine.y - lw * 0.8)}L${num(v.spine.x)} ${num(v.spine.y + lw * 0.8)}L${num(v.c.x - v.r * 0.5)} ${num(v.c.y + v.r * 0.45)}Z`, fill: c.bone, stroke: c.line, 'stroke-width': num(lw * 0.9), 'stroke-linejoin': 'round' }));
    o.push(el('ellipse', { cx: num(v.c.x), cy: num(v.c.y), rx: num(v.r * 0.85), ry: num(v.r * 0.62), fill: c.bone, stroke: c.line, 'stroke-width': num(lw) }));
  }
  o.push(stroke(smoothPath([{ x: neck.throat.x + 0.02 * H, y: neck.throat.y - 0.025 * H }, { x: neck.throat.x - 0.012 * H, y: neck.throat.y - 0.006 * H }, { x: neck.throat.x - 0.03 * H, y: neck.throat.y - 0.03 * H }]), lw * 2, c.line));
  if (markers) {
    for (const t of bone.tissue) o.push(stroke(`M${num(t.bone.x)} ${num(t.bone.y)}L${num(t.skin.x)} ${num(t.skin.y)}`, lw * 1.1, c.marker, 0.95));
    for (const t of bone.tissue) { o.push(el('circle', { cx: num(t.bone.x), cy: num(t.bone.y), r: num(lw * 1.5), fill: c.landmark })); o.push(el('circle', { cx: num(t.skin.x), cy: num(t.skin.y), r: num(lw * 1.5), fill: c.marker })); }
  }
  return o;
}

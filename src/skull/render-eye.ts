import { mix } from '../core/color';
import { el, num } from '../core/svg';
import type { ProfileEyeData } from './eye-data';
import type { SkullGeo } from './geometry';
import type { Ink } from './render-detail';
import type { V2 } from './types';

/**
 * ŒIL ET SOURCIL EN PROFIL — branchés sur le moteur d'yeux (`ProfileEyeData`), plus de dessin générique.
 * En vue de profil l'œil est une lentille dont la pointe (canthus externe) regarde vers l'arrière ; la cornée bombe devant, l'iris est vu par la
 * tranche (ellipse étroite), les cils partent vers l'avant et le haut. TOUTES les grandeurs viennent de l'œil de face :
 *   hauteur de la fente = `heightH · H` (même échelle que la face) ; profondeur = 0,38 × largeur frontale (la fente se raccourcit en perspective) ;
 *   iris = rayon × hauteur ; cils = nombre, longueur, courbure, allongement externe ; sourcil = hauteur, épaisseur, arc, inclinaison, longueur mesurés sur la face.
 * `profileEyeGeometry` est PURE et lue par la vérification (mesures face/profil), le rendu ne fait que la dessiner.
 */
export interface ProfileEyeGeo {
  readonly cx: number; readonly cy: number; readonly hp: number; readonly dp: number;
  readonly top: number; readonly bottom: number;
  readonly A: V2; readonly T: V2; readonly F: V2; readonly B: V2;
  readonly iris: { readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number };
  readonly brow: { readonly xFront: number; readonly xTail: number; readonly yFront: number; readonly yTail: number; readonly th: number; readonly arch: number };
}

export function profileEyeGeometry(g: SkullGeo, d: ProfileEyeData): ProfileEyeGeo {
  const { H, frame: fr } = g;
  const cx = fr.x.nasion - 0.012 * H + 0.004 * H;
  const cy = fr.f.eye * H;
  const hp = d.heightH * H;
  const dp = Math.min(0.1 * H, Math.max(0.4 * hp, 0.38 * d.widthH * H));
  const top = cy - d.upperFraction * hp, bottom = cy + (1 - d.upperFraction) * hp;
  // Le canthus externe est un peu plus haut ou plus bas que l'interne selon l'inclinaison de la fente de face (borné : ± 20 % de la hauteur).
  const lift = Math.max(-0.2, Math.min(0.2, Math.tan((-d.tiltDeg * Math.PI) / 180) * 0.35)) * hp;
  const A = { x: cx - dp, y: cy + lift };
  const T = { x: cx - 0.06 * dp, y: top }, F = { x: cx, y: cy }, B = { x: cx - 0.05 * dp, y: bottom };
  const ry = Math.min(0.5, d.iris.radius) * hp * 0.98, rx = Math.max(0.0045 * H, 0.3 * ry);
  const iris = { cx: cx - rx * 0.85, cy: cy + (1 - 2 * d.upperFraction) * 0.02 * hp, rx, ry };
  // Sourcil : sommet mesuré sur la face (au-dessus de la ligne des yeux), tenu sous l'arcade (supra-glabelle) ; la tête part du plan du front.
  const gl = g.skin.get('glabella') as V2;
  const th = Math.max(0.0035 * H, d.brow.thickness * hp);
  const yFront0 = Math.min(top - th / 2 - 0.003 * H, Math.max(fr.f.supra * H + 0.004 * H + th / 2, cy - d.brow.topH * H + th));
  // La tête du sourcil reste DANS le contour : abscisse de la peau au niveau du sourcil (interpolée sur le polygone, côté face), moins une marge.
  let xs = -Infinity;
  for (let i = 0; i < g.poly.length - 1; i++) { const a = g.poly[i] as V2, b = g.poly[i + 1] as V2; if (a.y !== b.y && (a.y - yFront0) * (b.y - yFront0) <= 0) xs = Math.max(xs, a.x + ((b.x - a.x) * (yFront0 - a.y)) / (b.y - a.y)); }
  const xFront = Math.min(gl.x, Number.isFinite(xs) ? xs : gl.x) - 0.008 * H;
  const len = Math.min(d.brow.lengthH * H * 0.55, xFront - (cx - dp) + 0.03 * H);
  const tilt = Math.tan((d.brow.tiltDeg * Math.PI) / 180);
  return { cx, cy, hp, dp, top, bottom, A, T, F, B, iris, brow: { xFront, xTail: xFront - len, yFront: yFront0, yTail: yFront0 - tilt * len * 0.5, th, arch: d.brow.arch * 0.35 * Math.max(th, 0.02 * H) } };
}

const P = (a: V2): string => `${num(a.x)} ${num(a.y)}`;
export function eyeLayer(g: SkullGeo, d: ProfileEyeData, ink: Ink): { defs: string[]; markup: string[] } {
  const e = profileEyeGeometry(g, d);
  const { H } = g;
  const lw = H * 0.0042;
  const lens = `M${P(e.A)}Q${num(e.cx - 0.55 * e.dp)} ${num(e.top - 0.12 * e.hp)} ${P(e.T)}Q${num(e.cx + 0.012 * H)} ${num(e.top + 0.1 * e.hp)} ${P(e.F)}Q${num(e.cx + 0.006 * H)} ${num(e.bottom - 0.08 * e.hp)} ${P(e.B)}Q${num(e.cx - 0.5 * e.dp)} ${num(e.bottom + 0.05 * e.hp)} ${P(e.A)}Z`;
  const defs = [
    el('clipPath', { id: 'sk-eye-clip' }, [el('path', { d: lens })]),
    el('radialGradient', { id: 'sk-iris', cx: 0.7, cy: 0.5, r: 0.8 }, [el('stop', { offset: 0, 'stop-color': d.iris.center }), el('stop', { offset: 0.6, 'stop-color': d.iris.mid }), el('stop', { offset: 1, 'stop-color': d.iris.edge })]),
  ];
  const out: string[] = [el('path', { d: lens, fill: d.sclera })];
  const eyeInner = [
    el('ellipse', { cx: num(e.iris.cx), cy: num(e.iris.cy), rx: num(e.iris.rx), ry: num(e.iris.ry), fill: 'url(#sk-iris)' }),
    el('ellipse', { cx: num(e.iris.cx + e.iris.rx * 0.1), cy: num(e.iris.cy), rx: num(e.iris.rx * 0.55), ry: num(e.iris.ry * 0.42), fill: d.pupil }),
    el('ellipse', { cx: num(e.iris.cx + e.iris.rx * 0.2), cy: num(e.iris.cy - e.iris.ry * 0.38), rx: num(e.iris.rx * 0.28), ry: num(e.iris.ry * 0.16), fill: '#ffffff', opacity: 0.92 }),
    // Ombre portée de la paupière haute sur le globe (cel : un aplat, pas un dégradé).
    el('path', { d: `M${P({ x: e.A.x, y: e.top })}L${P({ x: e.cx + 0.02 * H, y: e.top })}L${P({ x: e.cx + 0.02 * H, y: e.top + 0.28 * e.hp })}Q${num(e.cx - 0.4 * e.dp)} ${num(e.top + 0.18 * e.hp)} ${P({ x: e.A.x, y: e.A.y })}Z`, fill: mix(d.sclera, '#5a3b3b', 0.35), opacity: 0.55 }),
  ];
  out.push(el('g', { 'clip-path': 'url(#sk-eye-clip)' }, eyeInner));
  const stroke = (dd: string, c: string, w: number, o = 1): string => el('path', { d: dd, fill: 'none', stroke: c, 'stroke-width': num(w), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: num(o) });
  const upper = `M${P(e.A)}Q${num(e.cx - 0.55 * e.dp)} ${num(e.top - 0.12 * e.hp)} ${P(e.T)}Q${num(e.cx + 0.012 * H)} ${num(e.top + 0.1 * e.hp)} ${P(e.F)}`;
  out.push(stroke(upper, d.lashUpper.color, lw * (d.lashUpper.liner ? 2.6 : 1.9)));
  out.push(stroke(`M${P(e.F)}Q${num(e.cx + 0.006 * H)} ${num(e.bottom - 0.08 * e.hp)} ${P(e.B)}Q${num(e.cx - 0.5 * e.dp)} ${num(e.bottom + 0.05 * e.hp)} ${P(e.A)}`, ink.line, lw * 0.8, 0.8));
  // Pli palpébral : arc au-dessus de la paupière, à la hauteur du pli de l'œil de face (0 = aucun).
  if (d.creaseHeight > 0.02) { const ch = Math.min(0.6, d.creaseHeight) * e.hp; out.push(stroke(`M${num(e.A.x + 0.2 * e.dp)} ${num(e.top - 0.1 * e.hp)}Q${num(e.cx - 0.4 * e.dp)} ${num(e.top - ch)} ${num(e.cx - 0.02 * e.dp)} ${num(e.top - 0.35 * ch)}`, ink.soft, lw * 0.9, 0.6)); }
  // Cils supérieurs : part de la lisière palpébrale, vers l'avant et le haut ; longueur = longueur de face × hauteur de la fente (× allongement externe).
  const n = Math.max(0, Math.min(10, d.lashUpper.count));
  for (let i = 0; i < n; i++) {
    const t = 0.35 + (0.65 * (i + 1)) / n;
    const bx = e.A.x + (e.F.x - e.A.x) * t, by = (e.A.y + (e.T.y - e.A.y) * Math.min(1, t * 1.15)) + (t > 0.85 ? (e.F.y - e.T.y) * (t - 0.85) * 3 : 0);
    const L = d.lashUpper.length * e.hp * (1 + d.lashUpper.outer * t) * (0.8 + 0.4 * t);
    const a = (-12 - 40 * t) * (Math.PI / 180);
    const ex = bx + Math.cos(a) * L, ey = by + Math.sin(a) * L;
    out.push(stroke(`M${num(bx)} ${num(by)}Q${num(bx + Math.cos(a) * L * 0.6)} ${num(by + Math.sin(a) * L * 0.6 - d.lashUpper.curl * L * 0.12)} ${num(ex)} ${num(ey - d.lashUpper.curl * L * 0.22)}`, d.lashUpper.color, lw * 0.9));
  }
  if (d.lashLowerCount > 0) for (let i = 0; i < Math.min(4, d.lashLowerCount); i++) { const t = 0.5 + 0.12 * i; out.push(stroke(`M${num(e.A.x + (e.B.x - e.A.x) * t)} ${num(e.bottom + 0.03 * e.hp)}l${num(0.006 * H)} ${num(0.008 * H)}`, d.lashUpper.color, lw * 0.6, 0.7)); }
  // Sourcil : ruban qui suit l'arcade, plus épais à la tête, effilé en queue (`taper`) ; arc selon `arch`.
  const b = e.brow;
  const mid = { x: (b.xFront + b.xTail) / 2, y: (b.yFront + b.yTail) / 2 - b.arch };
  const w0 = b.th, w1 = b.th * (1 - 0.85 * d.brow.taper);
  out.push(el('path', { d: `M${num(b.xFront)} ${num(b.yFront - w0 / 2)}Q${num(mid.x)} ${num(mid.y - w0 / 2 - w1 / 4)} ${num(b.xTail)} ${num(b.yTail - w1 / 2)}Q${num(mid.x)} ${num(mid.y + w0 / 2 + w1 / 4)} ${num(b.xFront)} ${num(b.yFront + w0 / 2)}Z`, fill: d.brow.color }));
  return { defs, markup: out };
}

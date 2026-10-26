import { mix } from '../core/color';
import { el, num } from '../core/svg';
import { polyIndex, type SkullGeo } from './geometry';
import { smoothPath } from './spline';
import type { V2 } from './types';

/**
 * CHEVEUX EN PROFIL (coiffures de la vue de profil seulement : `short`, `undercut`, `updo` ; les coiffures complètes du moteur de cheveux ne sont pas
 * encore projetées, voir docs/SKULL-PROFILE-REMAINING.md). La masse est le contour du crâne décalé vers l'extérieur d'une épaisseur qui s'annule aux
 * deux extrémités (naissance du front, naissance de la nuque) ; la ligne d'implantation passe devant l'oreille, sous elle (cachée), puis derrière
 * jusqu'à la nuque. `napeHairline` règle la hauteur de la naissance de la nuque : la nuque est d'autant plus DÉGAGÉE qu'elle est haute.
 */
export interface HairOut { readonly back: string[]; readonly front: string[]; readonly napeY: number }

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export function hairLayer(g: SkullGeo, color: string, light: { x: number; y: number }, ink: string): HairOut | null {
  const sk = g.params;
  if (sk.hair === 'none') return null;
  const { H, poly, frame: fr } = g;
  const iV = polyIndex(g, 'vertex');
  const napeHL = sk.hair === 'updo' ? Math.max(sk.napeHairline, 0.8) : sk.hair === 'undercut' ? Math.max(sk.napeHairline, 0.65) : sk.napeHairline;
  const yN = lerp(fr.f.inion * H + 0.2 * H, fr.f.inion * H + 0.02 * H, napeHL);
  const iN = poly.findIndex((p, i) => i < iV && p.y <= yN);
  const yF = fr.f.hairline * H;
  let iF = poly.findIndex((p, i) => i > iV && p.y >= yF);
  if (iN < 0 || iV < 0) return null;
  if (iF < 0) iF = poly.length - 1;
  const seg = poly.slice(iN, iF + 1);
  const n = seg.length;
  const tMax = (sk.hair === 'undercut' ? 0.03 : 0.036) * H;
  const th = (i: number): number => { const s = i / (n - 1); return tMax * Math.min(1, 4 * s * (1 - s)) ** 0.55; };
  const outer = seg.map((p, i) => {
    const a = seg[Math.max(0, i - 1)] as V2, b = seg[Math.min(n - 1, i + 1)] as V2;
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dy / l) * th(i), y: p.y - (dx / l) * th(i) };
  });
  const por = fr.f.porion * H;
  const N = seg[0] as V2, F = seg[n - 1] as V2;
  const inner: V2[] = [F, { x: F.x - 0.14 * H, y: yF + 0.02 * H }, { x: 0.11 * H, y: por - 0.13 * H }, { x: 0.07 * H, y: por - 0.02 * H }, { x: -0.01 * H, y: por + 0.035 * H }, { x: -0.085 * H, y: por + 0.075 * H }, { x: N.x + 0.012 * H, y: N.y + 0.01 * H }];
  const sampled = outer.filter((_, i) => i % 3 === 0 || i === n - 1);
  const hairD = `${smoothPath(sampled)}${smoothPath(inner).replace(/^M[^C]*/, 'L' + num(F.x) + ' ' + num(F.y))}Z`;
  const shade = mix(color, '#000000', 0.38), lit = mix(color, '#ffffff', 0.3);
  const lx = light.x, ly = light.y, ln = Math.hypot(lx, ly) || 1;
  const body: string[] = [el('path', { d: hairD, fill: color })];
  // Mèches : lignes qui suivent le crâne à une fraction de l'épaisseur ; reflet sur la voûte ; ombre du côté opposé à la lumière.
  for (let k = 1; k <= 6; k++) {
    const r = k / 7;
    const pts = seg.map((p, i) => ({ x: lerp(p.x, (outer[i] as V2).x, r), y: lerp(p.y, (outer[i] as V2).y, r) })).filter((_, i) => i % 4 === 0);
    body.push(el('path', { d: smoothPath(pts), fill: 'none', stroke: shade, 'stroke-width': num(H * 0.0034), opacity: 0.42, 'stroke-linecap': 'round' }));
  }
  // Reflet : sur la partie haute du crâne, à 60 % de l'épaisseur (jamais décalé hors de la masse).
  body.push(el('path', { d: smoothPath(seg.map((p, i) => ({ x: lerp(p.x, (outer[i] as V2).x, 0.62), y: lerp(p.y, (outer[i] as V2).y, 0.62) })).filter((_, i) => i % 4 === 0 && i > n * 0.35 && i < n * 0.85)), fill: 'none', stroke: lit, 'stroke-width': num(H * 0.011), opacity: 0.5, 'stroke-linecap': 'round' }));
  void lx; void ly; void ln;
  const clipId = 'sk-hair-clip';
  const defs = el('clipPath', { id: clipId }, [el('path', { d: hairD })]);
  const shadow = el('g', { 'clip-path': `url(#${clipId})` }, [el('path', { d: `${hairD}M${num(-(lx / ln) * 0.05 * H)} ${num(-(ly / ln) * 0.05 * H)}`, fill: 'none' }), el('path', { d: smoothPath(outer.filter((_, i) => i % 3 === 0 && i < n * 0.45)), fill: 'none', stroke: shade, 'stroke-width': num(H * 0.03), opacity: 0.5 })]);
  const front: string[] = [defs, ...body, shadow, el('path', { d: hairD, fill: 'none', stroke: ink, 'stroke-width': num(H * 0.0032), 'stroke-linejoin': 'round' })];
  const back: string[] = [];
  if (sk.hair === 'updo') {
    const bx = lerp(fr.x.back, 0, 0.18), by = 0.075 * H, r = 0.088 * H;
    back.push(el('circle', { cx: num(bx), cy: num(by), r: num(r), fill: color, stroke: ink, 'stroke-width': num(H * 0.0032) }));
    for (let k = 0; k < 4; k++) back.push(el('path', { d: `M${num(bx - r * 0.8 + k * r * 0.4)} ${num(by + r * 0.7)}Q${num(bx - r * 0.2 + k * r * 0.3)} ${num(by - r * 0.2)} ${num(bx + r * 0.7 - k * r * 0.25)} ${num(by - r * 0.7)}`, fill: 'none', stroke: shade, 'stroke-width': num(H * 0.0032), opacity: 0.5 }));
    back.push(el('path', { d: `M${num(N.x - 0.01 * H)} ${num(N.y + 0.01 * H)}q${num(-0.012 * H)} ${num(0.07 * H)} ${num(0.004 * H)} ${num(0.12 * H)}`, fill: 'none', stroke: color, 'stroke-width': num(H * 0.006), 'stroke-linecap': 'round' }));
  }
  return { back, front, napeY: yN };
}

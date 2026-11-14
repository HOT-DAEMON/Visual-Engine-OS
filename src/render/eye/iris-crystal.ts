import { darken, lighten, mix } from '../../core/color';
import { el } from '../../core/svg';
import type { z } from 'zod';
import type { IrisDetail as IrisDetailSchema } from '../../schema/eye-iris-pupil';
import { P } from './helpers';
import type { IrisFrame, IrisPalette } from './iris-strands';

type Rnd = () => number;
type IrisDetail = z.infer<typeof IrisDetailSchema>;
type Facets = NonNullable<IrisDetail['facets']>;
type Bubbles = NonNullable<IrisDetail['bubbles']>;
const TAU = Math.PI * 2;

/**
 * FACETTES : `rings` couronnes de `count` quadrilatères entre `rhoFrom` (bord de la pupille) et le limbe. Les sommets sont perturbés (angle et rayon, graine de
 * l'œil) pour une cristallisation irrégulière ; chaque facette reçoit un ton de la palette (sombre -> clair) et un biseau clair sur son arête haute-gauche
 * (la lumière vient du haut-gauche, comme les reflets par défaut). `contrast` pilote l'écart de ton et l'opacité du biseau.
 */
export function facets(f: IrisFrame, pal: IrisPalette, rnd: Rnd, o: Facets, rhoFrom: number): string {
  const out: string[] = [];
  const band = (0.96 - rhoFrom) / o.rings;
  for (let k = 0; k < o.rings; k++) {
    const n = o.count + 2 * k;
    const r0 = rhoFrom + band * k; const r1 = r0 + band;
    const off = rnd() * TAU; const jitterA = (TAU / n) * 0.28; const jitterR = band * 0.22;
    const ring = Array.from({ length: n }, () => ({ a: (rnd() - 0.5) * jitterA * 2, rIn: (rnd() - 0.5) * jitterR * 2, rOut: (rnd() - 0.5) * jitterR * 2 }));
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n; const a0 = off + (TAU * i) / n + ring[i]!.a; const a1 = off + (TAU * (i + 1)) / n + ring[j]!.a + (j === 0 ? TAU : 0);
      const pts = [f.at(Math.max(r0 + ring[i]!.rIn, rhoFrom), a0), f.at(Math.min(r1 + ring[i]!.rOut, 0.985), a0), f.at(Math.min(r1 + ring[j]!.rOut, 0.985), a1), f.at(Math.max(r0 + ring[j]!.rIn, rhoFrom), a1)];
      const t = rnd(); const mid = (a0 + a1) / 2;
      // Les facettes tournées vers le haut-gauche (angle ~ 225°) sont plus claires : le modelé suit la lumière, le hasard fait le reste.
      const toward = 0.5 + 0.5 * Math.cos(mid - (Math.PI * 5) / 4);
      const tone = Math.min(1, Math.max(0, 0.5 * toward + 0.5 * t));
      const col = tone < 0.5 ? mix(darken(pal.dark, 0.35), pal.mid, tone * 2) : mix(pal.mid, lighten(pal.light, 0.35), (tone - 0.5) * 2);
      out.push(el('path', { d: `M${pts.map(P).join('L')}Z`, fill: col, 'fill-opacity': 0.2 + 0.62 * o.contrast * Math.abs(tone - 0.5) * 2, stroke: darken(pal.edge, 0.55), 'stroke-width': f.rx * 0.006, 'stroke-opacity': 0.3 + 0.4 * o.contrast }));
      out.push(el('path', { d: `M${P(pts[3]!)}L${P(pts[0]!)}L${P(pts[1]!)}`, fill: 'none', stroke: lighten(pal.light, 0.6), 'stroke-width': f.rx * 0.009, 'stroke-opacity': Math.min(0.95, 0.2 + 0.7 * o.contrast * toward) }));
    }
  }
  return el('g', {}, out);
}

/**
 * BULLES : sphères translucides (remplissage très léger, liseré clair, reflet interne en haut-gauche, croissant d'ombre en bas-droite), tirées par la graine
 * de l'œil dans la moitié basse de l'iris (`zone: 'lower'`) ou partout ; elles ne se chevauchent pas (rejet simple) et restent à l'intérieur du limbe.
 */
export function bubbles(f: IrisFrame, pal: IrisPalette, rnd: Rnd, o: Bubbles, rhoPupil: number): string {
  const out: string[] = []; const placed: { x: number; y: number; r: number }[] = [];
  for (let n = 0; n < o.count * 12 && placed.length < o.count; n++) {
    const a = o.zone === 'lower' ? Math.PI * (0.1 + 0.8 * rnd()) : TAU * rnd();
    const rho = Math.max(rhoPupil + 0.14, 0.3) + (0.8 - Math.max(rhoPupil + 0.14, 0.3)) * rnd();
    const r = f.rx * o.size * (0.55 + 0.7 * rnd()); const c = f.at(rho, a);
    if (placed.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < (p.r + r) * 1.05)) continue;
    placed.push({ x: c.x, y: c.y, r });
    const g = o.opacity;
    out.push(el('circle', { cx: c.x, cy: c.y, r, fill: lighten(pal.light, 0.5), 'fill-opacity': 0.14 * g, stroke: '#ffffff', 'stroke-width': r * 0.16, 'stroke-opacity': 0.5 * g }));
    out.push(el('path', { d: `M${P({ x: c.x + r * 0.62, y: c.y - r * 0.5 })}A${r * 0.8} ${r * 0.8} 0 0 1 ${P({ x: c.x - r * 0.4, y: c.y + r * 0.7 })}`, fill: 'none', stroke: darken(pal.edge, 0.4), 'stroke-width': r * 0.2, 'stroke-opacity': 0.35 * g }));
    out.push(el('circle', { cx: c.x - r * 0.36, cy: c.y - r * 0.4, r: r * 0.2, fill: '#ffffff', 'fill-opacity': 0.9 * g }));
  }
  return el('g', {}, out);
}

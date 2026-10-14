import { darken, lighten } from '../../core/color';
import { el } from '../../core/svg';
import type { Vec } from '../../geometry/eye';
import type { ColorSource } from '../../schema';
import { dominantColor, edgeColor } from '../../materials';
import { P, smoothClosed } from './helpers';

/** Repère polaire de l'iris : `at(ρ, a)` = point à la fraction ρ du rayon (ellipse rx×ry), angle `a`. */
export interface IrisFrame {
  readonly c: Vec;
  readonly rx: number;
  readonly ry: number;
  readonly at: (rho: number, a: number) => Vec;
}

export function irisFrame(c: Vec, rx: number, ry: number): IrisFrame {
  return { c, rx, ry, at: (rho, a) => ({ x: c.x + Math.cos(a) * rx * rho, y: c.y + Math.sin(a) * ry * rho }) };
}

export interface IrisPalette {
  readonly center: string;
  readonly mid: string;
  readonly edge: string;
  readonly light: string;
  readonly dark: string;
}

/** Palette dérivée du matériau de l'iris (centre / milieu / bord, puis tons clair et sombre). */
export function irisPalette(base: ColorSource): IrisPalette {
  const center = base.type === 'solid' ? base.color : (base.stops[0]?.color ?? '#808080');
  const mid = dominantColor(base);
  const edge = edgeColor(base);
  return { center, mid, edge, light: lighten(mid, 0.45), dark: darken(edge, 0.3) };
}

const TAU = Math.PI * 2;
type Rnd = () => number;

/** Forme en fuseau (deux quadratiques) de demi-largeur `w` au milieu, entre deux points. */
function lens(p0: Vec, p1: Vec, w: number): string {
  const len = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
  const nx = -(p1.y - p0.y) / len;
  const ny = (p1.x - p0.x) / len;
  const m: Vec = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const a: Vec = { x: m.x + nx * w * 2, y: m.y + ny * w * 2 };
  const b: Vec = { x: m.x - nx * w * 2, y: m.y - ny * w * 2 };
  return `M${P(p0)}Q${P(a)} ${P(p1)}Q${P(b)} ${P(p0)}Z`;
}

/**
 * Fibres du stroma : fuseaux effilés rayonnant entre `rhoFrom` et le bord, alternativement clairs et
 * sombres, avec une légère spirale. Nombre fixe de tirages par fibre (7) : réglages ultérieurs sans
 * décalage des tirages suivants.
 */
export function stromaFibers(
  f: IrisFrame,
  pal: IrisPalette,
  rnd: Rnd,
  n: number,
  range: { from: [number, number]; to: [number, number] },
  width: [number, number],
  opacity: [number, number],
  contrast: number,
): string {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const j = rnd();
    const r0 = rnd();
    const r1 = rnd();
    const bend = rnd();
    const pick = rnd();
    const op = rnd();
    const wd = rnd();
    const a = ((i + (j - 0.5) * 0.9) / n) * TAU;
    const ra = range.from[0] + (range.from[1] - range.from[0]) * r0;
    const rb = range.to[0] + (range.to[1] - range.to[0]) * r1;
    if (rb <= ra + 0.06) continue;
    const color = pick < 0.08 ? lighten(pal.mid, 0.75) : pick < 0.55 ? pal.light : pal.dark;
    out.push(
      el('path', {
        d: lens(f.at(ra, a), f.at(rb, a + (bend - 0.5) * 0.07), f.rx * (width[0] + (width[1] - width[0]) * wd)),
        fill: color,
        'fill-opacity': Math.min(1, (opacity[0] + (opacity[1] - opacity[0]) * op) * (0.4 + contrast * 1.2)),
      }),
    );
  }
  return el('g', {}, out);
}

/** Cryptes : petites lacunes sombres en fuseau, juste au-delà de la collerette. */
export function crypts(f: IrisFrame, pal: IrisPalette, rnd: Rnd, n: number, rhoC: number): string {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU;
    const r = rhoC + 0.04 + 0.16 * rnd();
    const len = 0.07 + 0.08 * rnd();
    const w = f.rx * (0.014 + 0.016 * rnd());
    const op = 0.28 + 0.3 * rnd();
    out.push(el('path', { d: lens(f.at(r - len / 2, a), f.at(r + len / 2, a + (rnd() - 0.5) * 0.05), w), fill: darken(pal.mid, 0.7), 'fill-opacity': op }));
  }
  return el('g', {}, out);
}

/**
 * Collerette : anneau ondulé et irrégulier (somme de trois harmoniques à phases tirées + bruit
 * léger), lissé, tracé en liseré clair sur un fin ombrage sombre — l'aspect d'un vrai bourrelet,
 * pas d'un engrenage.
 */
export function collarette(f: IrisFrame, pal: IrisPalette, rnd: Rnd, rho: number, irregularity: number, opacity: number): string {
  const N = 48;
  const ph = [rnd() * TAU, rnd() * TAU, rnd() * TAU];
  const pts: Vec[] = [];
  for (let k = 0; k < N; k++) {
    const a = (k / N) * TAU;
    const wave = 0.5 * Math.sin(3 * a + (ph[0] as number)) + 0.32 * Math.sin(7 * a + (ph[1] as number)) + 0.22 * Math.sin(13 * a + (ph[2] as number));
    pts.push(f.at(rho * (1 + irregularity * (0.075 * wave + 0.02 * (rnd() - 0.5))), a));
  }
  const d = smoothClosed(pts);
  const common = { d, fill: 'none', 'stroke-linejoin': 'round' } as const;
  return el('g', {}, [
    el('path', { ...common, stroke: darken(pal.mid, 0.55), 'stroke-width': f.rx * 0.04, 'stroke-opacity': 0.14 * opacity }),
    el('path', { ...common, stroke: lighten(pal.mid, 0.5), 'stroke-width': f.rx * 0.02, 'stroke-opacity': 0.34 * opacity }),
    el('path', { ...common, stroke: lighten(pal.mid, 0.7), 'stroke-width': f.rx * 0.007, 'stroke-opacity': 0.7 * opacity }),
  ]);
}

/**
 * Flammes : langues individuelles autour de la pupille — base large qui se chevauche avec ses
 * voisines (pas de trou près de la pupille), flancs courbes, pointe fine, légère spirale commune et
 * longueurs variées. `phase` décale la couronne d'un demi-pas (deux couronnes en quinconce).
 */
export function flames(f: IrisFrame, rnd: Rnd, spikes: number, rhoFrom: number, rhoTo: number, phase: number, fill: string): string {
  const K = spikes;
  const pitch = TAU / K;
  const swirl = 0.4 * pitch;
  const out: string[] = [];
  for (let k = 0; k < K; k++) {
    const jl = rnd();
    const ja = rnd();
    const a = (k + phase) * pitch + (ja - 0.5) * 0.25 * pitch;
    const tipRho = rhoFrom + (rhoTo - rhoFrom) * (0.55 + 0.45 * jl);
    const midRho = rhoFrom + (tipRho - rhoFrom) * 0.5;
    const half = 0.58 * pitch;
    const b1 = f.at(rhoFrom, a - half);
    const b2 = f.at(rhoFrom, a + half);
    const tip = f.at(tipRho, a + swirl);
    const c1 = f.at(midRho, a - half * 0.3 + swirl * 0.6);
    const c2 = f.at(midRho, a + half * 0.42 + swirl * 0.6);
    out.push(el('path', { d: `M${P(b1)}Q${P(c1)} ${P(tip)}Q${P(c2)} ${P(b2)}Z`, fill }));
  }
  return el('g', {}, out);
}

/** Scintillements : petits points lumineux dispersés dans la moitié BASSE de l'iris. */
export function sparkles(f: IrisFrame, rnd: Rnd, n: number): string {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (0.12 + 0.76 * rnd());
    const r = 0.42 + 0.42 * rnd();
    const size = f.rx * (0.02 + 0.03 * rnd());
    const p = f.at(r, a);
    out.push(el('circle', { cx: p.x, cy: p.y, r: size, fill: '#ffffff', 'fill-opacity': 0.4 + 0.45 * rnd() }));
  }
  return el('g', {}, out);
}

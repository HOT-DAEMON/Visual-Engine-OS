import { darken, lighten } from '../../core/color';
import { mulberry32 } from '../../core/prng';
import { el, num, urlRef } from '../../core/svg';
import type { FaceLandmarks } from '../../face';
import type { HairGeometry } from '../../face/hair';
import { polyBox, type Poly } from '../../face/poly';
import { toLocal, type LightVector } from '../../lighting/light';
import { spotGradient } from '../../materials';
import type { FaceParams } from '../../schema';
import { polyPath } from './path';

/** Polygone → chemin lissé (quadratiques entre milieux d'arêtes : reste dans l'enveloppe convexe des sommets). */
export function smoothPath(poly: Poly): string {
  const n = poly.length;
  const f = (x: number, y: number): string => `${num(x)} ${num(y)}`;
  const mid = (i: number): [number, number] => {
    const a = poly[i % n] as { x: number; y: number };
    const b = poly[(i + 1) % n] as { x: number; y: number };
    return [(a.x + b.x) / 2, (a.y + b.y) / 2];
  };
  let d = `M${f(...mid(0))}`;
  for (let i = 1; i <= n; i++) {
    const a = poly[i % n] as { x: number; y: number };
    d += `Q${f(a.x, a.y)} ${f(...mid(i))}`;
  }
  return `${d}Z`;
}

/**
 * Transition peau / cheveux : ombre portée douce sous l'implantation (deux traits larges très transparents)
 * et fins « baby hairs » qui franchissent la ligne. Reste au-dessus de la limite des sourcils (déjà garantie
 * par la ligne d'implantation) : 0,02 H d'amplitude au plus.
 */
export function hairlineTransition(geo: HairGeometry, p: FaceParams, lm: FaceLandmarks, skin: string): string[] {
  const h = p.hair;
  const rnd = mulberry32(h.seed ^ 0xbabe);
  const line = (dy: number): string => `M${geo.hairline.map((q) => `${num(q.x)} ${num(q.y + dy * lm.H)}`).join('L')}`;
  const out = [
    el('path', { d: line(0.011), fill: 'none', stroke: darken(skin, 0.35), 'stroke-width': lm.W * 0.024, 'stroke-linecap': 'round', opacity: 0.05 }),
    el('path', { d: line(0.005), fill: 'none', stroke: darken(skin, 0.35), 'stroke-width': lm.W * 0.014, 'stroke-linecap': 'round', opacity: 0.1 }),
  ];
  const n = geo.hairline.length;
  for (let i = 2; i < n - 2; i++) {
    if (rnd() < 0.25 + 0.3 * h.irregularity) continue;
    const q = geo.hairline[i] as { x: number; y: number };
    const ang = Math.PI / 2 + (rnd() - 0.5) * 1.6;
    const len = (0.006 + 0.01 * rnd()) * lm.H;
    out.push(el('path', { d: `M${num(q.x)} ${num(q.y - 0.002 * lm.H)}l${num(Math.cos(ang) * len)} ${num(Math.sin(ang) * len)}`, fill: 'none', stroke: darken(h.color, 0.1), 'stroke-width': lm.W * 0.0011, 'stroke-linecap': 'round', opacity: 0.22 + 0.3 * rnd() }));
  }
  return out;
}

const GLOSS = { straight: 0.9, wavy: 0.7, curly: 0.35, coily: 0.12, braided: 0.5 } as const;

/** Reflet côté lumière, limité à la chevelure avant (clip = union des polygones) : faible sur les textures crépues. */
export function hairGloss(id: string, geo: HairGeometry, p: FaceParams, lm: FaceLandmarks, L: LightVector, rot: number): { defs: string[]; markup: string[] } {
  const k = GLOSS[geo.texture];
  const loc = toLocal(L, rot);
  const box = polyBox(geo.front.flat());
  const gid = `${id}-hair-gloss`;
  const cid = `${id}-hair-gloss-clip`;
  const cx = box.x + box.w / 2 + loc.x * 0.2 * lm.W;
  const cy = box.y + box.h * 0.3 + loc.y * 0.06 * lm.H;
  return {
    defs: [spotGradient(gid, lighten(p.hair.color, 0.75), 0.4 * k, 0.7), el('clipPath', { id: cid }, [el('path', { d: polyPath(...geo.front) })])],
    markup: [el('g', { 'clip-path': urlRef(cid) }, [el('ellipse', { cx, cy, rx: box.w * 0.34, ry: box.h * 0.2, fill: urlRef(gid) })])],
  };
}

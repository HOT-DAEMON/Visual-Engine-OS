import { darken } from '../../core/color';
import type { ResolvedAppearance } from '../../appearance';
import { mulberry32 } from '../../core/prng';
import { el, num, urlRef } from '../../core/svg';
import type { FaceLandmarks } from '../../face';
import type { HairGeometry } from '../../face/hair';
import { polyBox, type Poly } from '../../face/poly';
import { toLocal, type LightVector } from '../../lighting/light';
import { spotGradient } from '../../materials';
import type { FaceParams } from '../../schema';
import { polyPath } from './path';
import { edgeStyle } from '../../face/hair/boundary/edge-style';
import { resolveTexture } from '../../face/hair/texture';

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
 * Transition peau / cheveux le long de TOUTE la lisière visible de face (implantation du front + bord avant des pattes) : ombre portée
 * douce posée sur la peau, côté du visage, et petits poils qui franchissent le bord. Netteté, opacité et densité viennent de
 * `edgeStyle` (coiffure, texture, contraste cheveux / peau). Reste dans la bande de 0,02 H autour de la lisière.
 */
export function hairlineTransition(geo: HairGeometry, p: FaceParams, lm: FaceLandmarks, skinShadow: string, skin: string = skinShadow): string[] {
  const h = p.hair;
  const es = edgeStyle(h.style as Exclude<typeof h.style, 'bald'>, resolveTexture(h.style, h.texture), h.color, skin, h.irregularity);
  const rnd = mulberry32(h.seed ^ 0xbabe);
  const b = geo.boundary;
  // Polyligne continue : bord avant de la patte gauche (de la pointe vers la tempe), implantation, patte droite (de la tempe vers la pointe).
  const chain = [...b.segment('sideburn', -1), ...b.loop.filter((q) => q.kind === 'front'), ...b.segment('sideburn', 1)];
  // Décalage vers la peau : vers le bas sur l'implantation, vers le centre du visage sur les pattes.
  const toSkin = (q: (typeof chain)[number], d: number): string => {
    const dx = q.kind === 'sideburn' ? -Math.sign(q.p.x || 1) * d * lm.H * 0.9 : 0;
    const dy = q.kind === 'sideburn' ? 0 : d * lm.H;
    return `${num(q.p.x + dx)} ${num(q.p.y + dy)}`;
  };
  const line = (d: number): string => `M${chain.map((q) => toSkin(q, d)).join('L')}`;
  const out = [
    el('path', { d: line(0.011), fill: 'none', stroke: skinShadow, 'stroke-width': lm.W * 0.024 * es.shadowWidth, 'stroke-linecap': 'round', opacity: es.shadowAlpha * 0.5 }),
    el('path', { d: line(0.005), fill: 'none', stroke: skinShadow, 'stroke-width': lm.W * 0.014 * es.shadowWidth, 'stroke-linecap': 'round', opacity: es.shadowAlpha }),
  ];
  // Petits poils : sur l'implantation (vers le haut/bas, éventail de ±0,8 rad) ; sur les pattes (vers l'intérieur).
  const keep = es.strayShare;
  for (let i = 2; i < chain.length - 2; i++) {
    if (rnd() >= keep) continue;
    const q = chain[i] as (typeof chain)[number];
    const side = q.kind === 'sideburn';
    const ang = (side ? (q.p.x < 0 ? 0 : Math.PI) : Math.PI / 2) + (rnd() - 0.5) * 1.6;
    const len = (0.006 + 0.01 * rnd()) * lm.H;
    out.push(el('path', { d: `M${num(q.p.x)} ${num(q.p.y - (side ? 0 : 0.002 * lm.H))}l${num(Math.cos(ang) * len)} ${num(Math.sin(ang) * len)}`, fill: 'none', stroke: darken(h.color, 0.1), 'stroke-width': lm.W * 0.0011, 'stroke-linecap': 'round', opacity: (0.22 + 0.3 * rnd()) * (es.strayAlpha / 0.4) }));
  }
  return out;
}

const GLOSS = { straight: 0.9, wavy: 0.7, curly: 0.35, coily: 0.12, braided: 0.5 } as const;

/** Reflet côté lumière, limité à la chevelure avant (clip = union des polygones) : faible sur les textures crépues. */
export function hairGloss(id: string, geo: HairGeometry, _p: FaceParams, lm: FaceLandmarks, L: LightVector, rot: number, ra: ResolvedAppearance): { defs: string[]; markup: string[] } {
  // En ombrage cel, le reflet est porté par les bandes de chaque mèche : pas de tache douce par-dessus.
  const k = ra.spec.shading.mode === 'cel' ? 0 : GLOSS[geo.texture] * (0.4 + 1.2 * ra.spec.reflection.intensity);
  if (k === 0) return { defs: [], markup: [] };
  const loc = toLocal(L, rot);
  const box = polyBox(geo.front.flat());
  const gid = `${id}-hair-gloss`;
  const cid = `${id}-hair-gloss-clip`;
  const cx = box.x + box.w / 2 + loc.x * 0.2 * lm.W;
  const cy = box.y + box.h * 0.3 + loc.y * 0.06 * lm.H;
  return {
    defs: [spotGradient(gid, ra.highlight, 0.4 * k, 0.7), el('clipPath', { id: cid }, [el('path', { d: polyPath(...geo.front) })])],
    markup: [el('g', { 'clip-path': urlRef(cid) }, [el('ellipse', { cx, cy, rx: box.w * 0.34, ry: box.h * 0.2, fill: urlRef(gid) })])],
  };
}

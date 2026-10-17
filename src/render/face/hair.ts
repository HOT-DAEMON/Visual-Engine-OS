import { darken, lighten } from '../../core/color';
import { el, urlRef } from '../../core/svg';
import type { FaceLandmarks } from '../../face';
import { hairGeometry, type HairLock } from '../../face/hair';
import { polyBox, type Poly } from '../../face/poly';
import type { LightVector } from '../../lighting/light';
import { compileSurface, resolvePreset, spotGradient, type Surface } from '../../materials';
import type { FaceParams } from '../../schema';
import { hairGloss, hairlineTransition, smoothPath } from './hair-detail';
import { polyPath } from './path';

export interface HairParts {
  readonly defs: string[];
  /** Queue, chignon, tresses, mèches arrière, masse arrière : dessinés AVANT le cou et la tête. */
  readonly back: string[];
  /** Cuir chevelu, sous-couche, mèches, transition : dessinés APRÈS la tête. */
  readonly front: string[];
}

/** Sous-couche : matériau « satin » du système partagé (même lumière que la peau). */
function underlayer(id: string, poly: Poly, color: string, L: LightVector, rot: number): { defs: string[]; markup: string; d: string } {
  const d = polyPath(poly);
  const surface: Surface = { bbox: polyBox(poly), curvature: 'sphere', draw: (a) => el('path', { d, ...a }) };
  const out = compileSurface(id, surface, resolvePreset({ preset: 'satin', color }), L, rot);
  return { defs: out.defs, markup: out.markup, d };
}

/**
 * Chevelure : cuir chevelu visible (raie, éclaircissement) sous des mèches principales et secondaires dessinées
 * une à une (ruban lissé, teinte propre à chaque mèche), reflet, ombre et transition à la ligne d'implantation.
 */
export function renderHair(id: string, p: FaceParams, lm: FaceLandmarks, L: LightVector, rot: number, skin: string): HairParts {
  const geo = hairGeometry(p, lm);
  if (!geo) return { defs: [], back: [], front: [] };
  const h = p.hair;
  const color = h.color;
  const rootColor = h.rootColor ?? darken(color, 0.32);
  const tone = (t: number): string => (t >= 0 ? lighten(color, t * 0.4) : darken(color, -t * 0.45));
  const lockEl = (l: HairLock, depth: number): string =>
    el('path', { d: smoothPath(l.poly), fill: darken(tone(l.tone), depth), stroke: l.edge ? darken(color, 0.5) : undefined, 'stroke-width': l.edge ? lm.W * 0.0014 : undefined, 'stroke-opacity': l.edge ? 0.35 : undefined, opacity: l.rank === 'fine' ? 0.88 : 1 });
  const defs: string[] = [];
  const back: string[] = [];
  if (geo.backBase) back.push(el('path', { d: smoothPath(geo.backBase), fill: darken(color, 0.45) }));
  for (const l of geo.locks.filter((q) => q.layer === 'back')) back.push(lockEl(l, 0.12));
  for (const t of geo.ties) {
    const ring = el('ellipse', { cx: t.at.x, cy: t.at.y, rx: t.rx, ry: t.rx * 0.55, fill: darken(color, 0.55), stroke: lighten(color, 0.4), 'stroke-width': lm.W * 0.003 });
    back.push(ring);
  }

  const base = underlayer(`${id}-hair-base`, geo.base[0] as Poly, rootColor, L, rot);
  const clipId = `${id}-hair-base-clip`;
  defs.push(...base.defs, el('clipPath', { id: clipId }, [el('path', { d: base.d })]));
  const scalpColor = darken(skin, 0.12);
  const bare: string[] = [];
  if (geo.bare.part) bare.push(el('path', { d: smoothPath(geo.bare.part), fill: scalpColor, opacity: 0.85 }));
  geo.bare.thin.forEach((q, i) => {
    const b = polyBox(q);
    const gid = `${id}-hair-thin${i}`;
    defs.push(spotGradient(gid, scalpColor, 0.35 + 0.5 * h.thinning, 0.55));
    bare.push(el('ellipse', { cx: b.x + b.w / 2, cy: b.y + b.h / 2, rx: b.w / 2, ry: b.h / 2, fill: urlRef(gid) }));
  });
  const front: string[] = [...hairlineTransition(geo, p, lm, skin), base.markup, el('g', { 'clip-path': urlRef(clipId) }, bare)];
  const fringeBase = geo.front.slice(1, geo.front.length - geo.locks.filter((q) => q.layer === 'front').length);
  if (fringeBase.length) front.push(el('path', { d: polyPath(...fringeBase), fill: rootColor }));
  for (const l of geo.locks.filter((q) => q.layer === 'front')) front.push(lockEl(l, 0));
  const gloss = hairGloss(id, geo, p, lm, L, rot);
  defs.push(...gloss.defs);
  front.push(...gloss.markup);
  return { defs, back, front };
}

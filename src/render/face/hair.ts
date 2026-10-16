import { darken } from '../../core/color';
import { el, urlRef } from '../../core/svg';
import type { FaceLandmarks } from '../../face';
import { hairGeometry } from '../../face/hair-geometry';
import { polyBox, type Poly } from '../../face/poly';
import type { LightVector } from '../../lighting/light';
import { compileSurface, resolvePreset, type Surface } from '../../materials';
import type { FaceParams } from '../../schema';
import { hairStrands } from './hair-strands';
import { polyPath } from './path';

export interface HairParts {
  readonly defs: string[];
  /** Masse arrière (bob/long) : dessinée AVANT le cou et la tête. */
  readonly back: string[];
  /** Cap, frange, pattes/rideaux + brins : dessinés APRÈS la tête. */
  readonly front: string[];
}

const layer = (id: string, polys: Poly[], color: string, L: LightVector, rot: number): { defs: string[]; markup: string; d: string } => {
  const d = polyPath(...polys);
  const box = polyBox(polys.flat());
  const surface: Surface = { bbox: box, curvature: 'sphere', draw: (a) => el('path', { d, ...a }) };
  const out = compileSurface(id, surface, resolvePreset({ preset: 'satin', color }), L, rot);
  return { defs: out.defs, markup: out.markup, d };
};

/** Chevelure : matériau « satin » du système partagé (même lumière que la peau), brins et reflet par-dessus. */
export function renderHair(id: string, p: FaceParams, lm: FaceLandmarks, L: LightVector, rot: number): HairParts {
  const geo = hairGeometry(p, lm);
  if (!geo) return { defs: [], back: [], front: [] };
  const color = p.hair.color;
  const defs: string[] = [];
  const back: string[] = [];
  if (geo.back) {
    const b = layer(`${id}-hair-back`, [geo.back], darken(color, 0.3), L, rot);
    defs.push(...b.defs);
    back.push(b.markup);
  }
  const fr = layer(`${id}-hair-front`, geo.front, color, L, rot);
  const clipId = `${id}-hair-clip`;
  defs.push(...fr.defs, el('clipPath', { id: clipId }, [el('path', { d: fr.d })]));
  const front = [fr.markup, el('g', { 'clip-path': urlRef(clipId) }, hairStrands(p, lm, geo))];
  return { defs, back, front };
}

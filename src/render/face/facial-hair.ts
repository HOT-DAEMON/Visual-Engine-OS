import { darken, lighten } from '../../core/color';
import { mulberry32 } from '../../core/prng';
import { el, num, urlRef } from '../../core/svg';
import type { FaceLandmarks } from '../../face';
import { facialHairGeometry, scatterIn } from '../../face/beard-geometry';
import { inPoly, polyBox, type Poly } from '../../face/poly';
import type { LightVector } from '../../lighting/light';
import { compileSurface, resolvePreset, type Surface } from '../../materials';
import type { FaceParams } from '../../schema';
import { polyPath } from './path';

export interface FacialHairParts {
  readonly defs: string[];
  /** Au-dessus de la lèvre : suit l'inclinaison de la bouche (même groupe). */
  readonly mustache: string[];
  /** Sur le contour du visage et sous le menton. */
  readonly beard: string[];
}

/** Masse de poils : matériau mat du système partagé, brins courts orientés par `flow`, le tout clippé à la forme. */
function mass(id: string, poly: Poly, color: string, opacity: number, L: LightVector, rot: number, seed: number, flow: (x: number, y: number) => { dx: number; dy: number }, count: number, W: number): { defs: string[]; markup: string[] } {
  const d = polyPath(poly);
  const box = polyBox(poly);
  const surface: Surface = { bbox: box, curvature: 'sphere', draw: (a) => el('path', { d, ...a }) };
  const out = compileSurface(id, surface, resolvePreset({ preset: 'matte', color }), L, rot);
  const rnd = mulberry32(seed);
  const strands = scatterIn(poly, box, count, seed, inPoly).map((q, i) => {
    const { dx, dy } = flow(q.x, q.y);
    const len = W * (0.014 + 0.014 * rnd());
    return el('path', { d: `M${num(q.x)} ${num(q.y)}l${num(dx * len)} ${num(dy * len)}`, fill: 'none', stroke: i % 3 === 0 ? lighten(color, 0.35) : darken(color, 0.4), 'stroke-width': W * 0.0036, 'stroke-linecap': 'round', opacity: i % 3 === 0 ? 0.25 : 0.4 });
  });
  const clipId = `${id}-clip`;
  const g = el('g', { 'clip-path': urlRef(clipId), opacity }, [out.markup, ...strands]);
  return { defs: [...out.defs, el('clipPath', { id: clipId }, [el('path', { d })])], markup: [g] };
}

export function renderFacialHair(id: string, p: FaceParams, lm: FaceLandmarks, L: LightVector, rot: number): FacialHairParts {
  const fh = p.facialHair;
  const none: FacialHairParts = { defs: [], mustache: [], beard: [] };
  if (fh.mustache === 'none' && fh.beard === 'none') return none;
  const geo = facialHairGeometry(p, lm);
  const color = fh.color ?? darken(p.hair.color, 0.08);
  const defs: string[] = [];
  const mustache: string[] = [];
  const beard: string[] = [];
  const dens = 0.55 + 0.45 * fh.density;
  const W = lm.W;
  // Moustache : les poils partent du philtrum vers l'extérieur et vers le bas.
  if (geo.mustache) {
    const m = mass(`${id}-mustache`, geo.mustache, color, 0.95, L, rot, fh.seed + 11, (x) => ({ dx: Math.sign(x || 1) * 0.9, dy: 0.45 }), 90, W);
    defs.push(...m.defs);
    mustache.push(...m.markup);
  }
  if (geo.beard) {
    const stubble = fh.beard === 'stubble';
    const polys = [geo.beard, ...(geo.mustacheBand ? [geo.mustacheBand] : [])];
    if (stubble) {
      // Barbe de quelques jours : voile léger + semis de points, jamais une masse pleine.
      const rnd = mulberry32(fh.seed + 5);
      const veil = polys.map((q, i) => mass(`${id}-stubble${i}`, q, color, 0.2 * dens, L, rot, fh.seed + i, () => ({ dx: 0, dy: 1 }), 0, W));
      veil.forEach((v) => {
        defs.push(...v.defs);
        beard.push(...v.markup);
      });
      for (const q of polys) {
        for (const pt of scatterIn(q, polyBox(q), Math.round(220 * dens), fh.seed + 17, inPoly)) {
          beard.push(el('circle', { cx: pt.x, cy: pt.y, r: W * (0.0016 + 0.0014 * rnd()), fill: darken(color, 0.3), opacity: 0.55 * dens }));
        }
      }
    } else {
      const b = mass(`${id}-beard`, geo.beard, color, 0.97, L, rot, fh.seed + 3, (x, y) => ({ dx: Math.sign(x || 1) * 0.35, dy: y > lm.H / 2 ? 1 : 0.9 }), Math.round(260 * dens), W);
      defs.push(...b.defs);
      beard.push(...b.markup);
    }
  }
  return { defs, mustache, beard };
}

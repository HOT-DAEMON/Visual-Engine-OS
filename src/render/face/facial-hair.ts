import { darken, lighten } from '../../core/color';
import { mulberry32 } from '../../core/prng';
import { el, num, urlRef } from '../../core/svg';
import type { FaceLandmarks } from '../../face';
import { facialHairGeometry, scatterIn } from '../../face/beard-geometry';
import { noise1 } from '../../face/hair/noise';
import { inPoly, polyBox, type Poly } from '../../face/poly';
import type { LightVector } from '../../lighting/light';
import { compileSurface, resolvePreset, type Surface } from '../../materials';
import type { FaceParams } from '../../schema';
import { polyPath } from './path';

export interface FacialHairParts {
  readonly defs: string[];
  /** Au-dessus de la lèvre : suit l'inclinaison de la bouche (même groupe). */
  readonly mustache: string[];
  /** Sur le contour du visage et sous le menton (barbe + favoris). */
  readonly beard: string[];
}

interface Look {
  readonly color: string;
  readonly opacity: number;
  /** Transition peau/poils (0 = bord net) et zones clairsemées (0 = uniforme). */
  readonly soft: number;
  readonly patch: number;
  readonly seed: number;
}

/** Polygone grossi autour de son centre : la lisière diffuse de la transition peau/poils. */
const inflate = (poly: Poly, k: number): Poly => {
  const b = polyBox(poly);
  const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  return poly.map((q) => ({ x: c.x + (q.x - c.x) * k, y: c.y + (q.y - c.y) * k }));
};

/**
 * Masse de poils : matériau mat du système partagé, brins courts orientés par `flow`, le tout clippé à la forme.
 * Transition : halo plus large et très transparent + poils épars AU-DELÀ du bord (densité décroissante) ;
 * zones clairsemées : brins et opacité retirés là où un bruit lisse tombe sous le seuil.
 */
function mass(id: string, poly: Poly, look: Look, L: LightVector, rot: number, flow: (x: number, y: number) => { dx: number; dy: number }, count: number, W: number): { defs: string[]; markup: string[] } {
  const { color, soft, patch, seed } = look;
  const d = polyPath(poly);
  const box = polyBox(poly);
  const surface: Surface = { bbox: box, curvature: 'sphere', draw: (a) => el('path', { d, ...a }) };
  const out = compileSurface(id, surface, resolvePreset({ preset: 'matte', color }), L, rot);
  const rnd = mulberry32(seed);
  const nz = noise1(seed ^ 0x3c3c);
  const holes = (x: number, y: number): boolean => (nz(x * 0.04) + nz(y * 0.04 + 9)) / 4 + 0.5 < patch * 0.5;
  const strand = (q: { x: number; y: number }, i: number, o: number): string => {
    const { dx, dy } = flow(q.x, q.y);
    const len = W * (0.014 + 0.014 * rnd());
    return el('path', { d: `M${num(q.x)} ${num(q.y)}l${num(dx * len)} ${num(dy * len)}`, fill: 'none', stroke: i % 3 === 0 ? lighten(color, 0.35) : darken(color, 0.4), 'stroke-width': W * 0.0036, 'stroke-linecap': 'round', opacity: (i % 3 === 0 ? 0.25 : 0.4) * o });
  };
  const strands = scatterIn(poly, box, count, seed, inPoly).filter((q) => !holes(q.x, q.y)).map((q, i) => strand(q, i, 1));
  const wide = inflate(poly, 1 + 0.06 * soft);
  const halo = soft > 0.02 ? scatterIn(wide, polyBox(wide), Math.round(count * 0.5 * soft), seed + 99, inPoly).filter((q) => !inPoly(poly, q.x, q.y) && !holes(q.x, q.y)).map((q, i) => strand(q, i, 0.7)) : [];
  const clipId = `${id}-clip`;
  const g = el('g', { 'clip-path': urlRef(clipId), opacity: look.opacity * (1 - 0.35 * patch) }, [out.markup, ...strands]);
  const veil = soft > 0.02 ? [el('path', { d: polyPath(wide), fill: color, opacity: 0.16 * soft * look.opacity })] : [];
  return { defs: [...out.defs, el('clipPath', { id: clipId }, [el('path', { d })])], markup: [...veil, g, ...halo] };
}

export function renderFacialHair(id: string, p: FaceParams, lm: FaceLandmarks, L: LightVector, rot: number): FacialHairParts {
  const fh = p.facialHair;
  const none: FacialHairParts = { defs: [], mustache: [], beard: [] };
  if (fh.mustache === 'none' && fh.beard === 'none' && fh.sideburns === 'none') return none;
  const geo = facialHairGeometry(p, lm);
  const color = fh.color ?? darken(p.hair.color, 0.08);
  const defs: string[] = [];
  const mustache: string[] = [];
  const beard: string[] = [];
  const dens = 0.55 + 0.45 * fh.density;
  const W = lm.W;
  const look = (o: number, s: number): Look => ({ color, opacity: o, soft: fh.transition, patch: fh.patchiness, seed: fh.seed + s });
  if (geo.mustache) {
    const m = mass(`${id}-mustache`, geo.mustache, look(0.95, 11), L, rot, (x) => ({ dx: Math.sign(x || 1) * 0.9, dy: 0.45 }), 90, W);
    defs.push(...m.defs);
    mustache.push(...m.markup);
  }
  geo.sideburns.forEach((q, i) => {
    const m = mass(`${id}-sideburn${i}`, q, look(0.95, 31 + i), L, rot, (x) => ({ dx: -Math.sign(x || 1) * 0.15, dy: 1 }), Math.round(70 * dens), W);
    defs.push(...m.defs);
    beard.push(...m.markup);
  });
  if (geo.beard) {
    const stubble = fh.beard === 'stubble';
    const polys = [geo.beard, ...(geo.mustacheBand ? [geo.mustacheBand] : [])];
    if (stubble) {
      // Barbe de quelques jours : voile léger + semis de points, jamais une masse pleine.
      const rnd = mulberry32(fh.seed + 5);
      const veil = polys.map((q, i) => mass(`${id}-stubble${i}`, q, look(0.2 * dens, i), L, rot, () => ({ dx: 0, dy: 1 }), 0, W));
      veil.forEach((v) => {
        defs.push(...v.defs);
        beard.push(...v.markup);
      });
      for (const q of polys) {
        for (const pt of scatterIn(q, polyBox(q), Math.round(220 * dens * (1 - 0.5 * fh.patchiness)), fh.seed + 17, inPoly)) {
          beard.push(el('circle', { cx: pt.x, cy: pt.y, r: W * (0.0016 + 0.0014 * rnd()), fill: darken(color, 0.3), opacity: 0.55 * dens }));
        }
      }
    } else {
      const b = mass(`${id}-beard`, geo.beard, look(0.97, 3), L, rot, (x, y) => ({ dx: Math.sign(x || 1) * 0.35, dy: y > lm.H / 2 ? 1 : 0.9 }), Math.round(260 * dens), W);
      defs.push(...b.defs);
      beard.push(...b.markup);
    }
  }
  return { defs, mustache, beard };
}

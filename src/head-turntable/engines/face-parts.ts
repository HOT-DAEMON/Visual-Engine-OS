import { EyeSpec } from '../../schema';
import { openingGeometry, openingPolygon } from '../../geometry/eye';
import type { Vec } from '../../geometry/eye/primitives';
import { inPoly, type Poly } from '../../face/poly';
import { clamp } from '../math';
import type { HeadTurnSpec } from '../types';
import type { EngineHead } from './face-model';
import { PX, fx, fy } from './units';

/** Géométrie de l'œil du moteur `geometry/eye`, en U, centrée sur le centre de l'iris : x vers l'EXTÉRIEUR, y vers le bas. */
export interface EyeGeo { readonly poly: Poly; readonly upper: readonly Vec[]; readonly lower: readonly Vec[]; readonly outer: Vec; readonly inner: Vec }

const eyeCache = new WeakMap<object, EyeGeo>();
/** Ouverture de l'œil : forme 'round' du moteur, hauteur ajustée pour que le haut / bas de l'ouverture tombent sur `hUp` / `hLo` MESURÉS de la planche (deux corrections successives). */
export function eyeGeo(spec: HeadTurnSpec): EyeGeo {
  const e = spec.eye; let g = eyeCache.get(e); if (g) return g;
  let height = (e.hUp + e.hLo) / PX, poly: Vec[] = [], top = 0, bot = 0, core: ReturnType<typeof openingGeometry> | undefined;
  for (let it = 0; it < 3; it++) {
    const s = EyeSpec.parse({ kind: 'eye', id: 'eye', shape: { width: e.w / PX, height, tiltDeg: 4, upperFraction: clamp(e.hUp / (e.hUp + e.hLo), 0.4, 0.8), outerSide: 'right', style: 'round' } });
    core = openingGeometry(s.shape, s.canthi); poly = openingPolygon(core, 20);
    const ys = poly.map((q) => q.y); top = Math.min(...ys); bot = Math.max(...ys); height *= (e.hUp + e.hLo) / PX / Math.max(1, bot - top);
  }
  const k = PX, dy = -(((top + bot) / 2) - ((bot - top) / 2) * ((e.hLo - e.hUp) / (e.hUp + e.hLo)) * 0), n = poly.length >> 1;
  const at = (q: Vec): Vec => ({ x: q.x * k, y: (q.y - (top + (e.hUp / PX))) * k });   // y = 0 sur la ligne des coins (haut de l'ouverture à −hUp)
  void dy;
  const P = poly.map(at);
  g = { poly: P, upper: P.slice(0, n + 1), lower: P.slice(n), outer: at(core!.po), inner: at(core!.pi) };
  eyeCache.set(e, g); return g;
}

/** Distance d'un point à une polyligne. */
export function distPolyline(pl: readonly Vec[], x: number, y: number): number {
  let m = Infinity;
  for (let i = 0; i + 1 < pl.length; i++) { const a = pl[i]!, b = pl[i + 1]!, vx = b.x - a.x, vy = b.y - a.y, t = clamp(((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy || 1), 0, 1); m = Math.min(m, Math.hypot(x - a.x - t * vx, y - a.y - t * vy)); }
  return m;
}
export { inPoly };

/** Polygones de la bouche et des narines du moteur, convertis en U (têtes de face : x et y absolus). */
export interface FacePartsU { readonly cavity: Poly; readonly teethU: Poly; readonly teethL: Poly; readonly tongue: Poly; readonly upperLip: Poly; readonly lowerLip: Poly; readonly closure: readonly Vec[]; readonly nostril: Poly }
const toU = (p: readonly Vec[]): Vec[] => p.map((q) => ({ x: fx(q.x), y: fy(q.y) }));
const partsCache = new WeakMap<EngineHead, FacePartsU>();
export function facePartsU(e: EngineHead): FacePartsU {
  let f = partsCache.get(e); if (f) return f;
  const m = e.mouth;
  f = { cavity: toU(m.cavity), teethU: toU(m.upperTeeth), teethL: toU(m.lowerTeeth), tongue: toU(m.tongue), upperLip: toU(m.upperLip), lowerLip: toU(m.lowerLip), closure: toU(m.closure), nostril: toU(e.nose.nostrils.right.poly) };
  partsCache.set(e, f); return f;
}

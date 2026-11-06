import { clamp, smooth } from './math';
import { hex, mix, type RGB } from './color';
import { REGION, type HeadTurnSpec, type V3 } from './types';
import { distPolyline, eyeGeo, facePartsU, inPoly } from './engines/face-parts';

/** Texel peint : couleur, région et indicateur d'encre. */
export interface Tex { readonly c: RGB; readonly region: number; readonly ink?: boolean }
export interface Pal { readonly ink: RGB; readonly skin: RGB; readonly shade: RGB; readonly hair: RGB; readonly iris: RGB; readonly deep: RGB; readonly lip: RGB; readonly mouthIn: RGB; readonly blush: RGB }
export const paletteOf = (s: HeadTurnSpec): Pal => { const p = s.palette; return { ink: hex(p.ink), skin: hex(p.skin), shade: hex(p.skinShade), hair: hex(p.hair), iris: hex(p.iris), deep: hex(p.irisDeep), lip: hex(p.lip), mouthIn: hex(p.mouthIn), blush: hex(p.blush) }; };

const WHITE: RGB = [255, 255, 255], LIGHT_IRIS: RGB = [139, 171, 240], PUPIL: RGB = [22, 27, 58], LID_SHADOW: RGB = [222, 229, 243];
const dseg = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
  const vx = bx - ax, vy = by - ay, t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1);
  return Math.hypot(px - ax - t * vx, py - ay - t * vy);
};

/** Œil (texture sur la surface du visage, en coordonnées tête : x vers l'extérieur, y vers le bas). k = compensation de largeur de trait. */
export function eyeTex(spec: HeadTurnSpec, p: V3, k: number, pal: Pal): Tex | null {
  if (spec.engine) return eyeTexEngine(spec, p, k, pal);
  const e = spec.eye, hw = e.w / 2, u = Math.abs(p.x) - e.x, v = p.y - e.y, au = u / hw;
  if (Math.abs(au) > 1.45 || Math.abs(v) > 0.2) return null;
  const curve = (a: number): { up: number; lo: number } => { const q = Math.max(0, 1 - a * a); return { up: -e.hUp * Math.pow(q, 0.75) - 0.012 * a, lo: e.hLo * Math.pow(q, 0.9) - 0.012 * a }; };
  const lash = dseg(u, v, hw * 0.9, curve(0.9).up, hw * 1.3, curve(0.9).up - 0.024);
  if (lash < 0.0045 * k) return { c: pal.ink, region: REGION.eye, ink: true };
  if (Math.abs(au) > 1) return null;
  const { up, lo } = curve(au), th = 0.0115 * k * (0.7 + 0.5 * Math.pow(Math.max(0, 1 - au * au), 0.5));
  if (v >= up - th && v <= up + 0.3 * th) return { c: pal.ink, region: REGION.eye, ink: true };
  if (Math.abs(v - lo) < 0.0035 * k && Math.abs(au) < 0.95) return { c: pal.ink, region: REGION.eye, ink: true };
  if (v < up || v > lo) return null;
  const r = Math.hypot(u, v + 0.004), rr = r / e.irisR;
  if (rr < 1) {
    if (Math.hypot(u + 0.018, v + 0.026) < 0.016) return { c: WHITE, region: REGION.eye };
    if (Math.hypot(u - 0.021, v - 0.022) < 0.007) return { c: mix(LIGHT_IRIS, WHITE, 0.7), region: REGION.eye };
    if (rr < 0.36) return { c: PUPIL, region: REGION.eye };
    if (rr > 0.8) return { c: pal.deep, region: REGION.eye };
    return { c: mix(pal.iris, LIGHT_IRIS, smooth((v + 0.004) / e.irisR * 1.2) * 0.8), region: REGION.eye };
  }
  return { c: v < up + 0.022 ? LID_SHADOW : WHITE, region: REGION.eye };
};

/** Sourcil : arc quadratique de xIn à xOut, trait effilé aux extrémités. */
export function browTex(spec: HeadTurnSpec, p: V3, k: number, pal: Pal): Tex | null {
  const b = spec.brow, xa = Math.abs(p.x);
  if (xa < b.xIn || xa > b.xOut) return null;
  const s = (xa - b.xIn) / (b.xOut - b.xIn), yc = 2 * b.yMid - 0.5 * (b.yIn + b.yOut);
  const yb = b.yIn * (1 - s) ** 2 + 2 * yc * s * (1 - s) + b.yOut * s * s, th = b.thick * k * (0.35 + 0.65 * Math.pow(Math.sin(Math.PI * s), 0.7));
  return Math.abs(p.y - yb) < th ? { c: mix(pal.ink, [150, 118, 84], 0.4), region: REGION.skin, ink: true } : null;
}

/** Bouche : ligne de sourire, intérieur (dents + langue) selon `open`, lèvres teintées. */
export function mouthTex(spec: HeadTurnSpec, p: V3, k: number, pal: Pal): Tex | null {
  if (spec.engine) return mouthTexEngine(spec, p, k, pal);
  const m = spec.mouth, hw = m.halfW, x = p.x;
  if (Math.abs(x) > hw * 1.04 || Math.abs(p.y - m.y) > 0.1) return null;
  const q = Math.min(1, (x / hw) ** 2), yU = m.y - 0.012 * q, e = Math.sqrt(1 - q), yD = yU + m.open * 0.07 * Math.pow(1 - q, 0.8), th = 0.0055 * k;
  if (Math.abs(p.y - yU) < th * (1 + 0.8 * q)) return { c: pal.ink, region: REGION.mouth, ink: true };
  if (m.open > 0.05) {
    if (Math.abs(p.y - yD) < th * 0.9) return { c: pal.ink, region: REGION.mouth, ink: true };
    if (p.y > yU && p.y < yD) return { c: p.y < yU + 0.02 * e * m.open ? WHITE : mix(pal.mouthIn, [226, 120, 128], smooth((p.y - yU) / (yD - yU) - 0.4)), region: REGION.mouth };
  }
  const lo = p.y > yD && p.y < yD + 0.03 * e, up = p.y < yU && p.y > yU - 0.022 * e;
  return lo || up ? { c: up ? mix(pal.lip, pal.ink, 0.08) : pal.lip, region: REGION.mouth } : null;
}

/** Narines : deux petites marques sombres sous le bout du nez. */
export function nostrilTex(spec: HeadTurnSpec, p: V3, pal: Pal): Tex | null {
  if (spec.engine) { const q = { x: Math.abs(p.x), y: p.y }; return inPoly(facePartsU(spec.engine).nostril, q.x, q.y) ? { c: mix(pal.shade, pal.ink, 0.45), region: REGION.skin } : null; }
  const dx = (Math.abs(p.x) - 0.03) / 0.011, dy = (p.y - (spec.nose.baseY - 0.008)) / 0.007;
  return dx * dx + dy * dy < 1 ? { c: mix(pal.shade, pal.ink, 0.45), region: REGION.skin } : null;
}

/** Rougeur des joues : opacité douce (0–0,3). */
export const blushAlpha = (p: V3): number => 0.3 * smooth(1 - Math.hypot((Math.abs(p.x) - 0.26) / 0.1, (p.y - 0.74) / 0.07));

/** Œil dont l'OUVERTURE vient du moteur `geometry/eye` (polygone des paupières) ; iris, pupille et reflets restent ceux de la planche. */
function eyeTexEngine(spec: HeadTurnSpec, p: V3, k: number, pal: Pal): Tex | null {
  const e = spec.eye, g = eyeGeo(spec), hw = e.w / 2, u = Math.abs(p.x) - e.x, v = p.y - e.y;
  if (Math.abs(u) > hw * 1.45 || Math.abs(v) > 0.2) return null;
  const oy = g.outer.y, lash = dseg(u, v, g.outer.x * 0.9, oy - 0.01, g.outer.x * 1.3, oy - 0.034);
  if (lash < 0.0045 * k) return { c: pal.ink, region: REGION.eye, ink: true };
  const au = u / hw, inside = inPoly(g.poly, u, v);
  const th = 0.0115 * k * (0.7 + 0.5 * Math.pow(Math.max(0, 1 - au * au), 0.5)), dU = distPolyline(g.upper, u, v);
  if (Math.abs(au) <= 1.02 && (dU < th * 0.6 || (dU < th && !inside && v < 0))) return { c: pal.ink, region: REGION.eye, ink: true };
  if (Math.abs(au) < 0.95 && distPolyline(g.lower, u, v) < 0.0035 * k) return { c: pal.ink, region: REGION.eye, ink: true };
  if (!inside) return null;
  const r = Math.hypot(u, v + 0.004), rr = r / e.irisR, up = g.upper.reduce((m, q) => (Math.abs(q.x - u) < Math.abs(m.x - u) ? q : m)).y;
  if (rr < 1) {
    if (Math.hypot(u + 0.018, v + 0.026) < 0.016) return { c: WHITE, region: REGION.eye };
    if (Math.hypot(u - 0.021, v - 0.022) < 0.007) return { c: mix(LIGHT_IRIS, WHITE, 0.7), region: REGION.eye };
    if (rr < 0.36) return { c: PUPIL, region: REGION.eye };
    if (rr > 0.8) return { c: pal.deep, region: REGION.eye };
    return { c: mix(pal.iris, LIGHT_IRIS, smooth((v + 0.004) / e.irisR * 1.2) * 0.8), region: REGION.eye };
  }
  return { c: v < up + 0.022 ? LID_SHADOW : WHITE, region: REGION.eye };
}

/** Bouche dont la cavité, les dents, la langue, les lèvres et la ligne de fermeture viennent du moteur de bouche. */
function mouthTexEngine(spec: HeadTurnSpec, p: V3, k: number, pal: Pal): Tex | null {
  const f = facePartsU(spec.engine!), x = p.x, y = p.y;
  if (Math.abs(x) > spec.mouth.halfW * 1.05 || Math.abs(y - spec.mouth.y) > 0.12) return null;
  const th = 0.0055 * k, open = f.cavity.length > 0;
  if (open && inPoly(f.cavity, x, y)) {
    if (inPoly(f.teethU, x, y) || inPoly(f.teethL, x, y)) { const edge = distPolyline([...f.teethU, f.teethU[0]!], x, y); return edge < th * 0.6 ? { c: pal.ink, region: REGION.mouth, ink: true } : { c: WHITE, region: REGION.mouth }; }
    const edge = Math.min(distPolyline([...f.cavity, f.cavity[0]!], x, y));
    if (edge < th) return { c: pal.ink, region: REGION.mouth, ink: true };
    return { c: inPoly(f.tongue, x, y) ? [226, 120, 128] : mix(pal.mouthIn, [226, 120, 128], smooth((y - spec.mouth.y) / 0.06 - 0.3)), region: REGION.mouth };
  }
  if (open ? distPolyline([...f.cavity, f.cavity[0]!], x, y) < th : distPolyline(f.closure, x, y) < th) return { c: pal.ink, region: REGION.mouth, ink: true };
  if (inPoly(f.lowerLip, x, y) && y < spec.mouth.y + (open ? 0.085 : 0.04)) return { c: pal.lip, region: REGION.mouth };
  if (inPoly(f.upperLip, x, y)) return { c: mix(pal.lip, pal.ink, 0.08), region: REGION.mouth };
  return null;
}

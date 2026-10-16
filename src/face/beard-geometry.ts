import { clamp } from '../core/math';
import { mulberry32 } from '../core/prng';
import type { Vec } from '../geometry/eye/primitives';
import type { FaceParams } from '../schema';
import type { FaceLandmarks } from './landmarks';
import { halfWidthAt, rightSamples } from './outline';
import { mirrorX, orient, type Poly } from './poly';

export interface FacialHairGeometry {
  /** Moustache : bande entre la base du nez et le haut de la lèvre (jamais sur les lèvres, jamais sous le nez). */
  readonly mustache: Poly | null;
  /** Barbe : le long du contour du visage, autour de la bouche (jamais dessus), débordant sous le menton. */
  readonly beard: Poly | null;
  /** Zone de moustache au sens large (pour la barbe de quelques jours). */
  readonly mustacheBand: Poly | null;
}

const span = (a: number, b: number, n: number): number[] => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Bande disponible entre le nez et la lèvre, en ordonnées : [haut, bas]. Le haut est sous les narines. */
export function mustacheBand(lm: FaceLandmarks): [number, number] {
  const gap = lm.lips.topY - lm.noseBaseY;
  return [lm.noseBaseY + 0.3 * gap, lm.lips.topY];
}

/** Haut de la lèvre à l'abscisse x (approximation lisse : creux au centre, arc, puis commissure). */
const lipTop = (lm: FaceLandmarks, x: number): number => {
  const a = Math.abs(x) / lm.lips.half;
  const bow = lm.mouthY - lm.lips.upperH;
  return a < 0.26 ? lm.lips.topY + (bow - lm.lips.topY) * smooth(a / 0.26) : bow + (lm.lips.cornerY - bow) * smooth(clamp((a - 0.26) / 0.74, 0, 1));
};

function mustachePoly(lm: FaceLandmarks, kind: string): Poly | null {
  if (kind === 'none') return null;
  const [yT, yB] = mustacheBand(lm);
  const band = yB - yT;
  const hwM = lm.lips.half * (kind === 'handlebar' ? 1.12 : kind === 'full' ? 1.02 : 0.9);
  const th0 = band * (kind === 'thin' ? 0.3 : kind === 'full' ? 0.8 : 0.65);
  const mid0 = kind === 'thin' ? yB - th0 / 2 - 0.05 * band : yT + th0 / 2;
  const pts = span(-1, 1, 40).map((a) => {
    const x = a * hwM;
    const ax = Math.abs(a);
    const th = th0 * (1 - 0.65 * ax ** 2.2);
    const droop = kind === 'full' ? 0.9 * band * ax ** 3 : 0.25 * band * ax ** 3;
    const curl = kind === 'handlebar' ? -1.6 * band * clamp((ax - 0.82) / 0.18, 0, 1) ** 2 : 0;
    const mid = mid0 + droop + curl;
    // Jamais au-dessus de la bande, jamais sur la lèvre.
    const top = Math.max(yT, mid - th / 2);
    const bot = Math.min(mid + th / 2, lipTop(lm, x) - 0.001 * lm.H);
    return { top, bot: Math.max(bot, top + 0.002 * lm.H), x };
  });
  const upper = pts.map((q) => ({ x: q.x, y: q.top }));
  const lower = pts.map((q) => ({ x: q.x, y: q.bot })).reverse();
  return orient([...upper, ...lower]);
}

function beardPoly(p: FaceParams, lm: FaceLandmarks): Poly | null {
  const kind = p.facialHair.beard;
  if (kind === 'none') return null;
  const { outline, H, W } = lm;
  const samples = rightSamples(outline);
  const hw = (y: number): number => halfWidthAt(outline, y, samples);
  const L = p.facialHair.length;
  const ext = (kind === 'goatee' ? 0.01 + 0.05 * L : kind === 'stubble' ? 0 : 0.02 + 0.12 * L) * H;
  const chin = H / 2;
  const ub = lm.lips.bottomY + 0.014 * H;
  const e = 0.003 * W;
  const full = kind !== 'goatee';
  const yStart = full ? lm.noseBaseY - 0.02 * H : ub;
  const tw = lm.lips.half * 0.8;
  // Bord extérieur droit (de haut en bas) : le contour du visage ; goatee : un trapèze bridé par le contour.
  const out = span(yStart, chin, 24).map((y): Vec => ({ x: full ? hw(y) + e : Math.min(tw * (1 - 0.15 * ((y - yStart) / (chin - yStart))), hw(y) + e), y }));
  const rxB = (out[out.length - 1] as Vec).x;
  const bottom = ext > 0 ? span(0, 1, 16).map((t): Vec => ({ x: rxB * Math.cos((t * Math.PI) / 2) * 0.98, y: chin + ext * Math.sin((t * Math.PI) / 2) })) : [];
  const right = [...out, ...bottom.slice(1)];
  if (!full) return orient([{ x: 0, y: ub + 0.012 * H }, ...right, ...[...right].reverse().map(mirrorX)]);
  // Bord intérieur : épouse la bouche à distance, sous la lèvre, puis rejoint la patte.
  const wTop = 0.06 * W;
  const inner: Vec[] = [
    { x: hw(yStart) - wTop, y: yStart },
    { x: lm.lips.half + 0.06 * W, y: lm.lips.cornerY - 0.03 * H },
    { x: lm.lips.half + 0.03 * W, y: lm.lips.cornerY + 0.012 * H },
    { x: lm.lips.half * 0.55, y: ub - 0.002 * H },
    { x: 0, y: ub },
  ];
  const innerR = [...inner].reverse();
  return orient([...right, ...[...right].reverse().map(mirrorX), ...inner.map(mirrorX), ...innerR.slice(1)]);
}

/** Pilosité faciale : GÉOMÉTRIE PURE, lue par le rendu et par les tests de cohérence. */
export function facialHairGeometry(p: FaceParams, lm: FaceLandmarks): FacialHairGeometry {
  const stubble = p.facialHair.beard === 'stubble';
  // Barbe de quelques jours : la zone au-dessus de la lèvre épouse la forme d'une moustache (pas un rectangle).
  const band = stubble ? mustachePoly(lm, 'full') : null;
  return { mustache: mustachePoly(lm, p.facialHair.mustache), beard: beardPoly(p, lm), mustacheBand: band };
}

/** Points de semis (barbe de quelques jours) : déterministes, uniquement à l'intérieur du polygone. */
export function scatterIn(poly: Poly, box: { x: number; y: number; w: number; h: number }, n: number, seed: number, inside: (p: Poly, x: number, y: number) => boolean): Vec[] {
  const rnd = mulberry32(seed);
  const out: Vec[] = [];
  for (let i = 0; i < n * 12 && out.length < n; i++) {
    const x = box.x + rnd() * box.w;
    const y = box.y + rnd() * box.h;
    if (inside(poly, x, y)) out.push({ x, y });
  }
  return out;
}

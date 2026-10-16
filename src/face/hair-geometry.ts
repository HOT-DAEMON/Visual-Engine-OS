import { clamp } from '../core/math';
import { mulberry32 } from '../core/prng';
import { cubicAt, type Vec } from '../geometry/eye/primitives';
import type { FaceParams } from '../schema';
import type { FaceLandmarks } from './landmarks';
import { halfWidthAt, rightSamples } from './outline';
import { mirrorX, orient, type Poly } from './poly';

type Wave = 'none' | 'scallop' | 'spike';
/** Par style : débord latéral (× W), hauteur du dôme (× H), ondulation du contour (amplitude relative, nombre de dents). */
interface StyleDef { off: [number, number]; lift: [number, number]; wave: Wave; amp: [number, number]; k: [number, number] }
const STYLES: Record<string, StyleDef> = {
  buzz: { off: [0.004, 0], lift: [0.004, 0], wave: 'none', amp: [0, 0], k: [1, 1] },
  short: { off: [0.012, 0.02], lift: [0.02, 0.06], wave: 'none', amp: [0, 0], k: [1, 1] },
  spiky: { off: [0.01, 0.02], lift: [0.03, 0.05], wave: 'spike', amp: [0.12, 0.1], k: [9, 13] },
  curly: { off: [0.03, 0.05], lift: [0.05, 0.09], wave: 'scallop', amp: [0.07, 0.04], k: [12, 16] },
  afro: { off: [0.07, 0.1], lift: [0.1, 0.14], wave: 'scallop', amp: [0.05, 0.03], k: [16, 22] },
  bob: { off: [0.018, 0.03], lift: [0.03, 0.07], wave: 'none', amp: [0, 0], k: [1, 1] },
  long: { off: [0.018, 0.03], lift: [0.03, 0.07], wave: 'none', amp: [0, 0], k: [1, 1] },
};

export interface HairGeometry {
  /** Cap + frange, orientés dans le même sens (union par fill nonzero). Tout est au-dessus de `browLimitY` sauf pattes/rideaux. */
  readonly front: Poly[];
  /** Masse arrière (bob/long), cachée par la tête et le cou sauf sur les côtés. */
  readonly back: Poly | null;
  /** Origine des brins (raie) et cibles sur le contour du dôme. */
  readonly origin: Vec;
  readonly ends: Vec[];
  /** Bord inférieur de la frange (de droite à gauche), ou null. */
  readonly fringeBottom: Vec[] | null;
  /** Bord intérieur / extérieur des pattes ou des rideaux latéraux, et leur plage verticale. */
  readonly side: { readonly xIn: (y: number) => number; readonly xOut: (y: number) => number; readonly y0: number; readonly y1: number };
}

const cubic = (a: Vec, b: Vec, n: number): Vec[] => {
  const c1 = { x: a.x + 0.55 * (b.x - a.x), y: a.y };
  const c2 = { x: b.x, y: a.y + 0.45 * (b.y - a.y) };
  return Array.from({ length: n + 1 }, (_, i) => cubicAt(a, c1, c2, b, i / n));
};
const span = (a: number, b: number, n: number): number[] => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
const tri = (u: number): number => 1 - Math.abs(2 * (u - Math.floor(u)) - 1);

/**
 * Cheveux d'un visage : GÉOMÉTRIE PURE (polygones), lue par le rendu ET par les tests. Tout dérive des
 * repères du visage (`lm.hair`, `lm.browLimitY`, contour du crâne, cou) : la naissance des cheveux et la
 * frange restent au-dessus des sourcils, les pattes à l'intérieur de la marge des tempes, les rideaux
 * (bob/long) longent le contour puis tombent de part et d'autre du cou. `null` si chauve.
 */
export function hairGeometry(p: FaceParams, lm: FaceLandmarks): HairGeometry | null {
  const h = p.hair;
  const st = STYLES[h.style];
  if (h.style === 'bald' || st === undefined) return null;
  const { W, H, outline } = lm;
  const samples = rightSamples(outline);
  const hw = (y: number): number => halfWidthAt(outline, y, samples);
  const rnd = mulberry32(h.seed);
  const v = h.volume;
  const off = (st.off[0] + st.off[1] * v) * W;
  const lift = (st.lift[0] + st.lift[1] * v) * H;
  const yTop = -H / 2;
  const { sideY: yS, templeY: yT, centerY: yC } = lm.hair;
  const curtain = h.style === 'bob' || h.style === 'long';
  const yL = h.style === 'long' ? H / 2 + (0.08 + 0.3 * h.length) * H : lm.jawY + (0.03 + 0.1 * h.length) * H;
  const yB = curtain ? yL : Math.max(yT + 0.02 * H, Math.min(yT + (0.1 + 0.9 * h.sideburns) * (lm.eyeY - yT) * 0.8, lm.eyeY - 0.03 * H));
  const wSB = (0.022 + 0.018 * h.sideburns) * W;
  const w0 = 0.03 * hw(yT);
  const u = (y: number): number => clamp((y - yT) / (yB - yT), 0, 1);
  const xIn = (y: number): number => {
    const base = hw(y) - (w0 + (wSB - w0) * u(y));
    return curtain ? Math.max(base, lm.neck.half * 1.03) : base;
  };
  const runMax = (y: number): number => Math.max(...span(yS, Math.min(y, H / 2), 24).map(hw));
  const xOut = (y: number): number => {
    if (!curtain) return hw(y) + off;
    const q = clamp((y - lm.jawY) / (yL - lm.jawY), 0, 1);
    const shape = h.style === 'long' ? 1 + 0.06 * clamp((y - yS) / (yL - yS), 0, 1) : 1 - 0.16 * q * q;
    return runMax(y) * shape + off;
  };

  // Dôme : ellipse ancrée à la hauteur `yS`, ondulée (boucles / pointes), jamais en deçà du crâne.
  const rx0 = xOut(yS);
  const ry = yS - yTop + lift;
  const amp = (st.amp[0] + st.amp[1] * v) * (0.85 + 0.3 * rnd());
  const k = Math.round(st.k[0] + (st.k[1] - st.k[0]) * rnd());
  const phase = rnd();
  const N = 140;
  const dome: Vec[] = span(0, 1, N).map((t) => {
    const th = Math.PI * t;
    const wave = st.wave === 'scallop' ? Math.abs(Math.sin(Math.PI * k * t)) : st.wave === 'spike' ? tri(k * t + phase) : 0;
    const f = 1 + amp * Math.sin(th) * wave;
    const y = yS + (-ry * Math.sin(th)) * f;
    const x = rx0 * Math.cos(th) * f;
    return { x: Math.sign(x || 1) * Math.max(Math.abs(x), hw(y) + 0.003 * W), y };
  });

  const apex: Vec = { x: h.part * 0.1 * W, y: yC };
  const tR: Vec = { x: hw(yT) * 0.97, y: yT };
  const line = cubic(apex, tR, 18);
  const lineL = cubic(apex, mirrorX(tR), 18).reverse();
  const ysIn = span(yT, yB, 14);
  // Bas en biseau : pattes effilées vers l'intérieur, rideaux coupés en diagonale (le coin extérieur remonte).
  const yBo = curtain ? yB - 0.05 * H : yB - 0.45 * (yB - yT);
  const ysOut = span(yBo, yS, 12);
  const right = [...ysIn.map((y) => ({ x: xIn(y), y })), ...ysOut.map((y) => ({ x: xOut(y), y }))];
  const left = [...[...ysOut].reverse().map((y) => ({ x: -xOut(y), y })), ...[...ysIn].reverse().map((y) => ({ x: -xIn(y), y }))];
  const cap = orient([...lineL, ...line.slice(1), ...right, ...dome, ...left]);

  // Frange : sous la naissance des cheveux, JAMAIS en dessous de `browLimitY` (marge 0,008 H, dents comprises).
  let fringe: Poly | null = null;
  let fringeBottom: Vec[] | null = null;
  if (h.fringe !== 'none' && h.style !== 'buzz') {
    const yF = lm.browLimitY - 0.008 * H;
    const d = 0.012 * H;
    const xF = hw(yF) * 0.985;
    const teeth = 9 + Math.floor(rnd() * 5);
    const depth = Array.from({ length: teeth }, () => (0.3 + 0.7 * rnd()) * d);
    const sp = h.part >= 0 ? 1 : -1;
    const base = (x: number): number => {
      const a = x / xF;
      const room = yF - d - yC - 0.015 * H;
      const corner = 0.7 * room * Math.abs(a) ** 4; // coins relevés : pas de bord carré contre les pattes
      if (h.fringe === 'straight') return yF - d - 0.004 * H - corner;
      if (h.fringe === 'sweep') return yF - d - (1 - clamp((-sp * a + 1) / 2, 0, 1)) * 0.045 * H - corner;
      return yF - d - (1 - Math.abs(a)) ** 1.3 * room;
    };
    fringeBottom = span(1, -1, 48).map((a) => {
      const x = a * xF;
      const pos = ((1 - a) / 2) * teeth;
      const tooth = (depth[Math.min(teeth - 1, Math.floor(pos))] as number) * tri(pos);
      return { x, y: base(x) + tooth };
    });
    const yA = yC - 0.02 * H;
    // Coins hauts calés sur le contour du crâne à CETTE hauteur (le crâne est plus étroit en haut : pas d'épaules carrées).
    const xA = hw(yA) * 0.97;
    fringe = orient([{ x: xA, y: yA }, ...fringeBottom, { x: -xA, y: yA }]);
  }

  let back: Poly | null = null;
  if (curtain) {
    const r = span(yS, yL, 16).map((y) => ({ x: xOut(y), y }));
    const sag = cubic({ x: xOut(yL), y: yL }, { x: 0, y: yL + 0.03 * H }, 12);
    back = orient([...r, ...sag.slice(1), ...sag.map(mirrorX).reverse(), ...[...r].reverse().map(mirrorX)]);
  }

  const origin: Vec = { x: h.part * 0.25 * rx0, y: yTop + (yC - yTop) * 0.4 };
  const ends = [...dome.filter((_, i) => i % 4 === 2), ...right.filter((_, i) => i % 5 === 0), ...left.filter((_, i) => i % 5 === 0)];
  return { front: fringe ? [cap, fringe] : [cap], back, origin, ends, fringeBottom, side: { xIn, xOut, y0: yT, y1: yB } };
}

import { clamp } from '../../../core/math';
import type { Vec } from '../../../geometry/eye/primitives';
import type { HairStyle } from '../../../schema';
import { rightSamples } from '../../outline';
import type { FaceLandmarks } from '../../landmarks';
import { smoothstep } from '../noise';
import type { HairBoundary } from './types';

/**
 * COQUE par coiffure : épaisseur des cheveux posée sur la surface du crâne.
 *  - `side`  : épaisseur au coin de la tempe relative à celle de la couronne (1 = aussi épaisse) ;
 *  - `reach` : jusqu'où la coque descend sur les côtés (`none` : s'arrête au coin de la tempe ; `ear` : jusqu'au-dessus de l'oreille,
 *    qui reste dégagée ; `cover` : au-delà de l'oreille, qu'elle recouvre).
 * Les valeurs suivent l'anatomie des coupes : tirées en arrière (queue, chignon, tresses) = côtés fins et plaqués ; volumineuses
 * (bouclé, afro) = autant d'épaisseur sur les côtés qu'au sommet.
 */
export interface ShellSpec {
  readonly side: number;
  readonly reach: 'none' | 'ear' | 'cover';
}

export const SHELL: Record<Exclude<HairStyle, 'bald'>, ShellSpec> = {
  buzz: { side: 0.9, reach: 'none' },
  short: { side: 0.75, reach: 'ear' },
  spiky: { side: 0.55, reach: 'ear' },
  curly: { side: 1, reach: 'ear' },
  afro: { side: 1, reach: 'cover' },
  bob: { side: 0.9, reach: 'cover' },
  long: { side: 0.9, reach: 'cover' },
  ponytail: { side: 0.45, reach: 'ear' },
  bun: { side: 0.45, reach: 'ear' },
  braids: { side: 0.55, reach: 'ear' },
};

export type Reach = ShellSpec['reach'];

export interface ShellInput {
  readonly lm: FaceLandmarks;
  readonly boundary: HairBoundary;
  /** Épaisseur de la couronne (px). */
  readonly crown: number;
  /** Épaisseur maximale de la coque (px), gain d'asymétrie compris : voir `thickness.ts`. */
  readonly maxT: number;
  readonly side: number;
  readonly reach: { readonly left: Reach; readonly right: Reach };
  /** Gain de silhouette à l'abscisse normalisée s ∈ [−1, 1] et relèvement des racines (bosse de la raie) à l'abscisse x. */
  readonly gain: (s: number) => number;
  readonly bump: (x: number) => number;
  /** Centre des directions radiales du dôme. */
  readonly C: Vec;
}

export interface Shell {
  /** Anneau fermé : implantation G→D, côté droit (bord intérieur = lisière, puis bas de l'aile), contour extérieur par le dessus, côté gauche. */
  readonly ring: Vec[];
  /** Ordonnée du bas de l'aile de chaque côté (= coin de tempe si pas d'aile). */
  readonly yEnd: { readonly left: number; readonly right: number };
}

const unit = (a: Vec): Vec => {
  const n = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / n, y: a.y / n };
};

/** Un côté (sg = +1 droite, −1 gauche) : bord intérieur le long de la lisière, bas de l'aile, bord extérieur remontant au sommet. */
function sidePath(inp: ShellInput, sg: -1 | 1): { inner: Vec[]; outer: Vec[]; yEnd: number } {
  const { lm, boundary: b, crown, side, C } = inp;
  const { H } = lm;
  const S = b.skull;
  const m = b.marks;
  const reach = sg === 1 ? inp.reach.right : inp.reach.left;
  const yCorner = sg === 1 ? m.cornerY.right : m.cornerY.left;
  const earTop = sg === 1 ? m.earTopY.right : m.earTopY.left;
  const earBottom = sg === 1 ? m.earBottomY.right : m.earBottomY.left;
  const yArch = earTop - 0.014 * H;
  const yEnd = reach === 'none' ? yCorner : reach === 'ear' ? Math.max(yArch, m.tipY + 0.015 * H) : Math.max(earBottom + 0.02 * H, yArch + 0.02 * H);
  // Bord intérieur : la lisière elle-même (bord avant de la patte, pointe, bord arrière, arche) puis, pour une aile qui couvre l'oreille, le contour.
  const inner: Vec[] = [];
  // Le parcours fermé remonte le côté gauche : on le relit de la tempe vers le bas, comme le côté droit.
  const ord = <T>(a: readonly T[]): T[] => (sg === 1 ? [...a] : [...a].reverse());
  if (reach !== 'none') {
    const sb = ord(b.segment('sideburn', sg));
    const ear = ord(b.segment('ear', sg)).slice(0, 8);
    for (const q of [...sb, ...ear]) if (q.y <= yEnd + 1e-6) inner.push(q.p);
    if (reach === 'cover') for (let i = 1; i <= 5; i++) { const y = yArch + ((yEnd - yArch) * i) / 5; inner.push({ x: sg * (S.a(y) - 0.012 * lm.W), y }); }
  }
  // Bord extérieur : le contour du crâne décalé de l'épaisseur T(y), du bas de l'aile au sommet.
  const top = -H / 2;
  const samples = rightSamples(lm.outline).filter((q) => q.y <= yEnd);
  const step = Math.max(1, Math.floor(samples.length / 46));
  const pick = samples.filter((_, i) => i % step === 0);
  if (pick.length === 0 || (pick[pick.length - 1] as Vec).y < yEnd - 1e-6) pick.push({ x: S.a(yEnd), y: yEnd });
  const span = Math.max(1e-6, yEnd - top);
  const outerUp = pick.map((q): Vec => {
    const f = clamp((q.y - top) / span, 0, 1);
    const s = sg * Math.min(1, f * (span / Math.max(1e-6, yCorner - top)));
    const toSide = smoothstep(clamp((q.y - (top + 0.1 * H)) / Math.max(1e-6, yCorner - top - 0.1 * H), 0, 1));
    const wing = q.y > yCorner ? 1 - 0.85 * smoothstep(clamp((q.y - yCorner) / Math.max(1e-6, yEnd - yCorner), 0, 1)) : 1;
    const closeNone = reach === 'none' ? 1 - smoothstep(clamp((q.y - (yCorner - 0.07 * H)) / (0.07 * H), 0, 1)) : 1;
    const T = Math.min(inp.maxT, crown * inp.gain(s) * (1 + (side - 1) * toSide) * wing * closeNone);
    const nrm = unit({ x: q.x - C.x, y: q.y - C.y });
    // Le soulèvement des racines (bosse de la raie) fait partie de l'épaisseur des cheveux : T + soulèvement ≤ épaisseur maximale de la coiffure.
    const lift = Math.min(inp.bump(sg * q.x), Math.max(0, inp.maxT - T));
    return { x: sg * (q.x + nrm.x * T), y: q.y + nrm.y * T - lift };
  });
  return { inner, outer: outerUp.reverse(), yEnd };
}

/** Anneau fermé de la coque : lisière (implantation + pattes + arche) à l'intérieur, contour du crâne épaissi à l'extérieur. */
export function capShell(inp: ShellInput): Shell {
  const R = sidePath(inp, 1);
  const L = sidePath(inp, -1);
  const front = inp.boundary.hairline.pts;
  // `outer` va du bas de l'aile au sommet. Droite : bord intérieur vers le bas, puis le contour remonte jusqu'au sommet ;
  // gauche : le contour redescend du sommet (doublon du sommet écarté), puis le bord intérieur remonte vers le coin de tempe gauche.
  const ring: Vec[] = [...front, ...R.inner, ...R.outer, ...[...L.outer].reverse().slice(1), ...[...L.inner].reverse()];
  return { ring, yEnd: { left: L.yEnd, right: R.yEnd } };
}

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

/**
 * ÉPAULE DU DÔME (`docs/HAIR-DOME-ROUND.md`), par coiffure : demi-largeur maximale de la coque (fraction de W) à hauteur du sommet du crâne, puis élargie en pente douce vers le bas
 * (`slope`, abscisse par ordonnée) jusqu'aux ailes. Mesuré : le dôme d'un afro faisait jusqu'à 0,62 W de demi-largeur au sommet du crâne (écart horizontal au contour mesuré par
 * `hair-reach-beyond-skull`, limite 0,6 ; les mèches rognées sur la coque y ajoutent leur marge) : un dôme CARRÉ aux épaules, aplati (« champignon »). Un plafond d'écart constant
 * au contour faisait une MARCHE à l'épaule (le contour du crâne s'élargit très vite sous le sommet) ; la droite `halfWidth + slope · (y − sommet)` donne une épaule en pente douce.
 * Le minimum est LISSE (pas de coin). Coiffures sans entrée : coque inchangée.
 */
export const SHOULDER: Partial<Record<Exclude<HairStyle, 'bald'>, { readonly halfWidth: number; readonly slope: number }>> = { afro: { halfWidth: 0.52, slope: 0.6 } };
/** Largeur du raccord lisse du minimum (fraction de W). */
const SHOULDER_BLEND = 0.05;

/**
 * COQUE ELLIPTIQUE (`docs/HAIR-NATURAL.md`) des masses rondes. Un afro / bouclé est une BOULE autour du crâne : le bord extérieur n'est plus le contour du crâne décalé de
 * l'épaisseur le long de la normale (qui évasait le bas en « gourde » ou en « champignon » et coupait l'aile en biais), mais une ellipse à deux demi-axes verticaux : celui du
 * HAUT part du sommet épaissi jusqu'à l'ÉQUATEUR (tangente verticale), celui du BAS est résolu pour que la courbe passe exactement par la fin de l'aile. Ni évasement ni marche.
 *  - `equator` : position de l'équateur entre le coin de tempe (0) et la fin de l'aile (1) ;
 *  - `endShare` : épaisseur gardée à la fin de l'aile, en part de l'épaisseur latérale (le bas se resserre sur le crâne) ;
 *  - `minShare` : épaisseur minimale partout, en part de l'épaisseur de couronne (jamais de bord collé au crâne) ;
 *  - `maxTop` / `maxSide` : épaisseur maximale au sommet et à l'équateur (fraction de W). Sans eux, l'épaisseur de couronne brute (jusqu'à 0,43 W) donnait une boule démesurée
 *    (portée 0,62 W au sommet) : l'ancienne épaule jouait ce rôle de plafond.
 */
export interface RoundShell { readonly equator: number; readonly endShare: number; readonly minShare: number; readonly maxTop: number; readonly maxSide: number }
export const ROUND_SHELL: Partial<Record<Exclude<HairStyle, 'bald'>, RoundShell>> = {
  afro: { equator: 0.5, endShare: 0.3, minShare: 0.25, maxTop: 0.2, maxSide: 0.15 },
  curly: { equator: 0.5, endShare: 0.3, minShare: 0.25, maxTop: 0.13, maxSide: 0.11 },
};

/** Maximum lisse de a et b (largeur de raccord `s`) : égal à max(a, b) loin du croisement, jamais en dessous. */
export function smoothMax(a: number, b: number, s: number): number {
  return -smoothMin(-a, -b, s);
}

/** Minimum lisse de a et b (largeur de raccord `s`) : égal à min(a, b) loin du croisement, jamais au-dessus, au plus `s·ln 2` en dessous. */
export function smoothMin(a: number, b: number, s: number): number {
  const m = Math.min(a, b);
  return m - s * Math.log(Math.exp(-(a - m) / s) + Math.exp(-(b - m) / s));
}

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
  /** Épaule du dôme (`SHOULDER`) : demi-largeur au sommet du crâne (px) et pente ; absent : aucun plafond. */
  readonly shoulder?: { readonly halfWidth: number; readonly slope: number };
  /** Coque elliptique (`ROUND_SHELL`) : remplace le décalage normal + épaule pour les côtés qui ont une aile. */
  readonly round?: RoundShell;
  /** Gonflement demandé (px, `puffW` × W) : élargit les plafonds de la coque elliptique, dans la limite de `maxT`. */
  readonly puff?: number;
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

/**
 * Bord extérieur ELLIPTIQUE d'un côté, du bas de l'aile au sommet (même ordre que le décalage normal). Équateur `yEq` entre le coin de tempe et la fin de l'aile ; demi-axe horizontal
 * = demi-largeur du crâne à l'équateur + épaisseur latérale ; demi-axe vertical du haut = de l'équateur au sommet épaissi ; demi-axe du bas résolu pour passer par (largeur de fin d'aile, `yEnd`).
 * Le résultat ne rentre jamais dans le crâne : maximum lisse avec le contour du crâne + épaisseur minimale.
 */
function ellipseOuter(inp: ShellInput, sg: -1 | 1, yEnd: number): Vec[] {
  const { lm, boundary: b, crown, side } = inp;
  const cfg = inp.round as NonNullable<ShellInput['round']>;
  const S = b.skull, W = lm.W, H = lm.H;
  // Équateur COMMUN aux deux côtés (moyenne des repères gauche / droite) : la boule reste centrée même si les deux oreilles ne sont pas à la même hauteur.
  const mk = b.marks;
  const yC = (mk.cornerY.left + mk.cornerY.right) / 2;
  const yEq = Math.min(yC + cfg.equator * (yEnd - yC), yEnd - 0.05 * H);
  const pf = inp.puff ?? 0;
  const tSide = Math.min(inp.maxT, cfg.maxSide * W + pf, crown * inp.gain(sg) * side);
  const tTop = Math.min(inp.maxT, cfg.maxTop * W + pf, crown * inp.gain(0));
  const A = S.a(yEq) + tSide;
  const top = S.topY - tTop;
  const Bt = Math.max(0.05 * H, yEq - top);
  const r = clamp((S.a(yEnd) + cfg.endShare * tSide) / A, 0.5, 0.96);
  const tEnd = Math.PI - Math.asin(r);
  const Bb = Math.max(0.02 * H, (yEnd - yEq) / Math.sqrt(1 - r * r));
  const minT = cfg.minShare * crown;
  const pts: Vec[] = [];
  const nUp = 24, nLow = 14;
  for (let i = 0; i <= nUp + nLow; i++) {
    const t = i <= nUp ? ((Math.PI / 2) * i) / nUp : Math.PI / 2 + ((tEnd - Math.PI / 2) * (i - nUp)) / nLow;
    const lowerHalf = i > nUp;
    let x = A * Math.sin(t), y = yEq - (lowerHalf ? Bb : Bt) * Math.cos(t);
    x = smoothMax(x, S.a(y) + minT, 0.02 * W);
    // Soulèvement des racines à la raie : part de l'épaisseur disponible, sur la moitié haute seulement.
    if (!lowerHalf) y -= Math.min(inp.bump(sg * x), 0.008 * H);
    pts.push({ x: sg * x, y });
  }
  return pts.reverse();
}

/** Un côté (sg = +1 droite, −1 gauche) : bord intérieur le long de la lisière, bas de l'aile, bord extérieur remontant au sommet. */
function sidePath(inp: ShellInput, sg: -1 | 1): { inner: Vec[]; outer: Vec[]; yEnd: number; round?: boolean } {
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
  if (inp.round && reach !== 'none' && inner.length > 0) return { inner, outer: ellipseOuter(inp, sg, yEnd), yEnd, round: true };
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
    let x = q.x + nrm.x * T;
    const y = q.y + nrm.y * T - lift;
    // Épaule du dôme : demi-largeur plafonnée au sommet du crâne, élargie en pente douce vers le bas (minimum lisse).
    if (inp.shoulder) x = smoothMin(x, inp.shoulder.halfWidth + inp.shoulder.slope * Math.max(0, y - S.topY), SHOULDER_BLEND * lm.W);
    return { x: sg * x, y };
  });
  return { inner, outer: outerUp.reverse(), yEnd, round: false };
}

/** Bas d'aile ARRONDI (courbe quadratique intérieur → extérieur, extrémités exclues) : remplace la coupe en biais d'un bas d'aile elliptique. */
function wingCap(a: Vec, b: Vec, H: number): Vec[] {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const c: Vec = { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + 0.35 * d + 0.004 * H };
  return Array.from({ length: 3 }, (_, i) => { const t = (i + 1) / 4; return { x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y }; });
}

/** Anneau fermé de la coque : lisière (implantation + pattes + arche) à l'intérieur, contour du crâne épaissi (ou ellipse, `ROUND_SHELL`) à l'extérieur. */
export function capShell(inp: ShellInput): Shell {
  const R = sidePath(inp, 1);
  const L = sidePath(inp, -1);
  const front = inp.boundary.hairline.pts;
  const H = inp.lm.H;
  const capR = R.round ? wingCap(R.inner[R.inner.length - 1] as Vec, R.outer[0] as Vec, H) : [];
  const capL = L.round ? wingCap(L.inner[L.inner.length - 1] as Vec, L.outer[0] as Vec, H).reverse() : [];
  // `outer` va du bas de l'aile au sommet. Droite : bord intérieur vers le bas, puis le contour remonte jusqu'au sommet ;
  // gauche : le contour redescend du sommet (doublon du sommet écarté), puis le bord intérieur remonte vers le coin de tempe gauche.
  const ring: Vec[] = [...front, ...R.inner, ...capR, ...R.outer, ...[...L.outer].reverse().slice(1), ...capL, ...[...L.inner].reverse()];
  return { ring, yEnd: { left: L.yEnd, right: R.yEnd } };
}

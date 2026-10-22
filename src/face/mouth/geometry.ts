import { clamp } from '../../core/math';
import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import { catmullRom } from '../curve';
import { displaceAll, pullsOf, tissueField } from '../deform/field';
import { resolveExpression } from '../deform/expression';
import { lipWeight, mandibleDisplace, mandiblePose, WEIGHT } from '../deform/skin';
import type { FaceLandmarks } from '../landmarks';
import { halfWidthAt } from '../outline';
import { polyArea, type Poly } from '../poly';
import type { MouthGeo } from './types';

/** Nombre d'échantillons le long de la ligne de fermeture (impair : un échantillon exact au centre). */
const N = 41;
const gauss = (x: number, m: number, s: number): number => Math.exp(-(((x - m) / s) ** 2));
/** Profil de lèvre (0 aux commissures, 1 au centre) : arrondi, jamais de pointe. */
const bell = (u: number, k: number): number => Math.max(0, 1 - u * u) ** k;

/**
 * Bouche structurée. Ordre : (1) largeur effective (adaptation au visage + expression), (2) commissures asymétriques, (3) ligne de fermeture (courbure, ondulation),
 * (4) lèvres avec MAINTIEN DU VOLUME (largeur ↑ → épaisseur ↓ dans le même rapport), (5) arc de Cupidon et tubercule, (6) cavité, dents, gencive, langue
 * (dents et lèvre inférieure LIÉES À LA MANDIBULE par `skin.ts`), (7) plis déplacés par le champ de tissu. Aucune coordonnée n'est écrite à la main : tout
 * dérive des repères (`lm.lips`) et du contrat `mouth`.
 */
export function mouthGeometry(p: FaceParams, lm: FaceLandmarks): MouthGeo {
  const m = p.mouth;
  const { W, H } = lm;
  const e = resolveExpression(p, lm);
  const pose = mandiblePose(p, lm);
  const hwMouth = halfWidthAt(lm.outline, Math.min(lm.chinY - 1e-3, lm.mouthY));
  // (1) Largeur : `fit` mélange la largeur absolue et une largeur proportionnelle à la largeur du visage à la hauteur de la bouche (référence : 0,4 W) ; l'expression
  //     écarte les commissures ; le tout est borné à 80 % de la demi-largeur du contour (la bouche ne touche jamais le bord).
  const base0 = lm.lips.half;
  const fitted = base0 * (1 - m.fit + m.fit * (hwMouth / (0.4 * W)));
  const limit = 0.8 * Math.min(hwMouth, halfWidthAt(lm.outline, Math.min(lm.chinY - 1e-3, lm.lips.bottomY + 0.012 * H)));
  const hm = Math.min(fitted + e.cornerOut, limit);
  const widthScale = hm / base0;
  // (2) Commissures : hauteur de repos (courbe), asymétrie (±1,2 % de H), puis remontée de l'expression.
  const yL = lm.lips.cornerY + 0.012 * H * m.cornerAsym - e.cornerLift;
  const yR = lm.lips.cornerY - 0.012 * H * m.cornerAsym - e.cornerLift;
  const corners = { left: { x: -hm, y: yL }, right: { x: hm, y: yR } };
  // (3) Ligne de fermeture : interpolation entre les commissures + creux central (`curve`) + ondulation en S (`lineWave`) ; nulle aux commissures.
  const yCenter = lm.mouthY + m.curve * 0.006 * H;
  const closure: Vec[] = [];
  const u: number[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const ui = 2 * t - 1;
    u.push(ui);
    const yLine = yL + (yR - yL) * t;
    const sag = (yCenter - (yL + yR) / 2) * Math.sin(Math.PI * t);
    const wave = m.lineWave * 0.006 * H * Math.sin(2 * Math.PI * 1.5 * t + 0.6) * Math.sin(Math.PI * t);
    // Lèvres tendues (grimace) : la ligne se redresse vers la droite joignant les commissures.
    closure.push({ x: -hm + 2 * hm * t, y: yLine + (sag + wave) * (1 - 0.6 * e.lipTension) });
  }
  // (4) Épaisseur des lèvres à volume constant : l'épaisseur est divisée par l'élargissement (aire ∝ largeur × épaisseur = constante). La tension (grimace) ne
  //     change PAS l'épaisseur : elle redresse la ligne de fermeture ; amincir sans allonger violerait la conservation du volume.
  const ul0 = (0.012 + 0.03 * m.upperLip) * H;
  const ll0 = (0.02 + 0.05 * m.lowerLip) * H;
  const thin = 1 / widthScale;
  const ul = ul0 * thin;
  const ll = ll0 * thin;
  // Retroussement de la lèvre supérieure (muscle élévateur). Il ne SÉPARE les lèvres que si les dents sont découvertes (`sep` : 0 = lèvres jointes, 1 = séparées) ;
  // sinon la lèvre reste jointe à l'inférieure (un sourire fermé n'a pas de fente). Les deux bords de la lèvre se déplacent ENSEMBLE : son épaisseur ne change pas.
  const sep = clamp(1.3 * e.teethBare, 0, 1);
  const raise = (x: number): number => e.upperLipRaise * sep * bell(x / hm, 0.9);
  const upperBottom = closure.map((q) => ({ x: q.x, y: q.y - raise(q.x) }));
  // (5) Arc de Cupidon : deux pics à ±ub (largeur) et un creux central (profondeur) ; tubercule = bosse vers le bas du bord bas de la lèvre supérieure.
  const ub = 0.1 + 0.12 * m.cupid.width;
  const cup = (x: number): number => m.cupid.depth * 0.3 * (gauss(Math.abs(x / hm), ub, 0.16) - 0.9 * gauss(x / hm, 0, 0.14));
  const upperTop = closure.map((q, i) => ({ x: q.x, y: q.y - raise(q.x) - ul * (bell(u[i] as number, 0.7) + cup(q.x)) }));
  const tub = m.cupid.tubercle * 0.003 * H;
  const upperEdge = upperBottom.map((q) => ({ x: q.x, y: q.y + tub * gauss(q.x / hm, 0, 0.12) }));
  const upperLip: Poly = [...upperTop, ...[...upperEdge].reverse()];
  // (6) Lèvre inférieure et dents : LIÉES à la mandibule. Le haut de la lèvre = ligne de fermeture déplacée par le poids de la lèvre à chaque abscisse.
  const dep = (x: number): number => e.lowerLipDepress * sep * bell(x / hm, 0.9);
  const lowerTop = closure.map((q, i) => {
    const d = mandibleDisplace(pose, lipWeight(u[i] as number));
    return { x: q.x + d.x, y: q.y + d.y + dep(q.x) };
  });
  const lowerBottom = lowerTop.map((q, i) => ({ x: q.x, y: q.y + ll * bell(u[i] as number, 0.8) * (1 + 0.15 * (pose.protrusionPx > 0 ? 1 : 0)) }));
  const lowerLip: Poly = [...lowerTop, ...[...lowerBottom].reverse()];
  const gap = (i: number): number => Math.max(0, (lowerTop[i] as Vec).y - (upperBottom[i] as Vec).y);
  const gapMax = Math.max(0, ...closure.map((_, i) => gap(i)));
  const open = gapMax > 0.004 * H;
  const cavity: Poly = open ? [...upperBottom, ...[...lowerTop].reverse()] : [];
  // Dents : visibilité réglée par `teeth.*` et par l'expression (dents découvertes) ; bornées à 55 % / 45 % de la fente. Dents inférieures = skinning poids 0,94.
  const vis = clamp(0.35 + 0.65 * e.teethBare, 0, 1);
  const gum = (x: number): number => m.gums * e.upperLipRaise * 1.5 * bell(x / hm, 0.5);
  const inner = (i: number): boolean => Math.abs(u[i] as number) < 0.8;
  const upperTeethTop = upperBottom.map((q) => ({ x: q.x, y: q.y + gum(q.x) }));
  const upperTeethBot = upperBottom.map((q, i) => ({ x: q.x, y: (upperTeethTop[i] as Vec).y + Math.min(gap(i) * 0.55, 0.02 * H) * m.teeth.upper * vis * bell(u[i] as number, 0.5) }));
  const wT = WEIGHT.lowerTeeth;
  const dT = mandibleDisplace(pose, wT);
  // Le bas des dents inférieures reste à 0,3 px AU-DESSUS du bord de la lèvre (dents posées derrière la lèvre, jamais sur son bord : le polygone reste strictement dans la cavité).
  // Abscisse : celle du BORD DE LA LÈVRE (pas q.x + dT.x) — la lèvre pèse moins que les dents près des commissures, donc une translation latérale
  // de la mandibule faisait sortir les dents de la cavité (constaté par la campagne de tirage, graine 931 : 82 % des dents dans la cavité < 90 %).
  const lowerTeethBot = closure.map((q, i) => ({ x: (lowerTop[i] as Vec).x, y: Math.min((lowerTop[i] as Vec).y - 0.3, q.y + dT.y) }));
  const lowerTeethTop = lowerTeethBot.map((q, i) => ({ x: q.x, y: q.y - Math.min(gap(i) * 0.45, 0.016 * H) * m.teeth.lower * vis * bell(u[i] as number, 0.5) }));
  const idx = closure.map((_, i) => i).filter(inner);
  const poly = (top: Vec[], bot: Vec[]): Poly => (open && idx.length > 1 ? [...idx.map((i) => top[i] as Vec), ...[...idx].reverse().map((i) => bot[i] as Vec)] : []);
  const upperTeeth = poly(upperTeethBot.map((q, i) => ({ x: q.x, y: (upperTeethTop[i] as Vec).y })), upperTeethBot);
  const lowerTeeth = poly(lowerTeethTop, lowerTeethBot);
  // Gencive : bande entre le bord de la lèvre relevée et le haut des dents (visible seulement si la lèvre est retroussée et `gums` > 0).
  const gums: Poly = open && m.gums * e.upperLipRaise > 0.2 ? [...idx.map((i) => upperBottom[i] as Vec), ...[...idx].reverse().map((i) => upperTeethTop[i] as Vec)] : [];
  // Langue : ellipse posée sur le plancher de la cavité, visible à partir d'une ouverture franche ; liée à la mandibule (poids 0,6).
  const tv = m.tongue * clamp(gapMax / (0.05 * H) - 0.3, 0, 1);
  const tongue: Poly = tv > 0.05 ? ellipse(0 + mandibleDisplace(pose, 0.6).x, (lowerTop[(N - 1) / 2] as Vec).y - 0.3 * gapMax, hm * 0.32 * tv, gapMax * 0.26 * tv) : [];
  // (7) Plis péri-commissuraux : courbes de base (commissure → bas du menton, « marionnette ») déplacées par le champ de tissu ; profondeur = contrat × (1 + creusement).
  const cheekC: [Vec, Vec] = [{ x: -0.2 * W, y: lm.eyeY + 0.12 * H }, { x: 0.2 * W, y: lm.eyeY + 0.12 * H }];
  const field = tissueField(pullsOf(e, lm, cheekC));
  const fold = (s: -1 | 1): Vec[] => displaceAll(catmullRom([{ x: s * hm * 1.02, y: s < 0 ? yL : yR }, { x: s * hm * 1.1, y: (lm.lips.cornerY + lm.chin.sulcusY) / 2 }, { x: s * lm.chin.half * 1.15, y: lm.chin.sulcusY + 0.3 * lm.chin.heightPx }], false, 6), field);
  const mid = (N - 1) / 2;
  return {
    corners,
    halfWidth: hm,
    widthScale,
    closure,
    upperLip,
    lowerLip,
    cupid: { peakLeft: upperTop[idxOf(u, -ub)] as Vec, peakRight: upperTop[idxOf(u, ub)] as Vec, dip: upperTop[mid] as Vec, tubercle: upperEdge[mid] as Vec },
    cavity,
    upperTeeth,
    lowerTeeth,
    gums,
    tongue,
    folds: { left: fold(-1), right: fold(1), depth: clamp(m.cornerFolds * (1 + e.foldDeepen), 0, 1) },
    gapPx: gapMax,
    lowerTeethY: (lowerTeethBot[mid] as Vec).y,
    upperTeethTopY: (upperTeethTop[mid] as Vec).y,
    lowerLipBottomY: (lowerBottom[mid] as Vec).y,
    areas: { upper: Math.abs(polyArea(upperLip)), lower: Math.abs(polyArea(lowerLip)) },
  };
}

/** Index de l'échantillon le plus proche de l'abscisse relative `target`. */
function idxOf(u: readonly number[], target: number): number {
  let best = 0;
  for (let i = 1; i < u.length; i++) if (Math.abs((u[i] as number) - target) < Math.abs((u[best] as number) - target)) best = i;
  return best;
}

/** Polygone elliptique (24 sommets). */
function ellipse(cx: number, cy: number, rx: number, ry: number): Poly {
  return Array.from({ length: 24 }, (_, i) => ({ x: cx + rx * Math.cos((2 * Math.PI * i) / 24), y: cy + ry * Math.sin((2 * Math.PI * i) / 24) }));
}

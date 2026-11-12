import { browGeometry, openingGeometry } from '../geometry/eye';
import { rad } from '../core/math';
import { EyeSpec } from '../schema';
import type { EyeFit } from './fit-eye';
import type { FaceLandmarks } from './landmarks';
import { noseFrame } from './nose';
import { halfWidthAt } from './outline';
import type { FaceParams } from '../schema';

/** Identifiants des 9 périmètres d'occupation des composants enfants (de haut en bas). Voir `docs/FACE-PERIMETERS.md`. */
export type PerimeterId = 'forehead' | 'brows' | 'browGap' | 'eyes' | 'interocular' | 'nose' | 'philtrum' | 'mouth' | 'chin';

/**
 * Périmètre d'occupation d'un composant : boîte verticale [topY, bottomY] (px, repère de l'hôte, origine au centre) et largeur occupée `halfPx` (demi-largeur maximale, px, symétrique autour de x = 0).
 * `heightShare` = hauteur / H ; `widthShare` = largeur occupée / largeur du visage (2 × demi-largeur du contour) à la hauteur médiane du périmètre.
 */
export interface Perimeter {
  readonly id: PerimeterId;
  readonly label: string;
  readonly topY: number;
  readonly bottomY: number;
  readonly heightPx: number;
  readonly halfPx: number;
  readonly heightShare: number;
  readonly widthShare: number;
}

/** Bandes verticales MESURÉES des yeux posés (px, repère de l'hôte) : fente, pli, sourcil ; `null` quand l'œil n'a pas de sourcil. */
export interface EyeBands {
  readonly lidTopY: number;
  readonly lidBottomY: number;
  /** Haut du pli palpébral (le sourcil se mesure depuis lui, comme `browGeometry`). */
  readonly creaseTopY: number;
  readonly browTopY: number | null;
  readonly browBottomY: number | null;
  readonly browInnerX: number | null;
  readonly browOuterX: number | null;
  readonly outerX: number;
}

/** Bandes d'un œil posé : l'œil local est ramené dans le repère de l'hôte par le même transform que `fitEyeToFace` (ancre du canthus interne, échelle, roulis). */
export function eyeBands(side: 'left' | 'right', fit: EyeFit, lm: FaceLandmarks): EyeBands {
  const spec = EyeSpec.parse({ ...fit.eye, place: undefined, shape: { ...fit.eye.shape, outerSide: side } });
  const g = openingGeometry(spec.shape, spec.canthi), k = fit.scale, t = rad(lm.asymmetry.eyeRollDeg), c = Math.cos(t), sn = Math.sin(t);
  const toHost = (p: { x: number; y: number }): { x: number; y: number } => { const dx = p.x - g.pi.x, dy = p.y - g.pi.y; return { x: fit.anchor.x + k * (dx * c - dy * sn), y: fit.anchor.y + k * (dx * sn + dy * c) }; };
  const box = (b: { x: number; y: number; w: number; h: number }): { x: number[]; y: number[] } => { const q = [toHost({ x: b.x, y: b.y }), toHost({ x: b.x + b.w, y: b.y }), toHost({ x: b.x, y: b.y + b.h }), toHost({ x: b.x + b.w, y: b.y + b.h })]; return { x: q.map((p) => p.x), y: q.map((p) => p.y) }; };
  const op = box(g.bbox), crease = Math.max(0, spec.lids.crease.height) * g.h;
  const out: { -readonly [K in keyof EyeBands]: EyeBands[K] } = { lidTopY: Math.min(...op.y), lidBottomY: Math.max(...op.y), creaseTopY: Math.min(...op.y) - k * crease, browTopY: null, browBottomY: null, browInnerX: null, browOuterX: null, outerX: Math.max(...op.x.map((x) => Math.abs(x))) };
  if (spec.eyebrow) {
    const bb = box(browGeometry(g, spec.eyebrow, spec.lids.crease.height).bbox);
    out.browTopY = Math.min(...bb.y); out.browBottomY = Math.max(...bb.y);
    const ax = bb.x.map((x) => Math.abs(x)); out.browInnerX = Math.min(...ax); out.browOuterX = Math.max(...ax);
  }
  return out;
}

export interface FacePerimeters { readonly list: readonly Perimeter[]; readonly byId: Readonly<Record<PerimeterId, Perimeter>>; readonly eyes: readonly EyeBands[] }

/**
 * LES NEUF PÉRIMÈTRES des composants enfants, mesurés sur les repères RÉSOLUS (`landmarks.ts`, source unique) et, si les yeux posés sont fournis, sur leur géométrie exacte (fente, pli, sourcil).
 *  front → sourcils → distance sourcil/paupière (flexible) → enveloppe palpébrale → zone entre les yeux → nez (commence SOUS la zone entre les yeux) → philtrum → bouche → menton (bouche → base du menton).
 * Sans yeux : sourcils et fentes sont estimés depuis les repères (limite des sourcils, ligne des yeux, orbite). Pure ; les bornes sont dans `perimeters-limits.ts`.
 */
export function facePerimeters(p: FaceParams, lm: FaceLandmarks, eyes: readonly EyeBands[] = []): FacePerimeters {
  const { H, W } = lm, hw = (y: number): number => halfWidthAt(lm.outline, Math.min(lm.chinY - 1e-3, Math.max(-H / 2, y)));
  const inner = Math.abs(lm.innerCanthus.right.x), nf = noseFrame(p, lm);
  // Œil MOYEN : l'asymétrie naturelle gauche / droite (ligne des yeux, roulis) ne se compte pas comme un défaut de périmètre ; l'écart sourcil / paupière est contrôlé œil par œil (`browGapPerEye`).
  const has = eyes.length > 0, mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
  const lidBot = has ? mean(eyes.map((e) => e.lidBottomY)) : lm.eyeY + 0.02 * H, crease = has ? mean(eyes.map((e) => e.creaseTopY)) : lm.eyeY - 0.03 * H;
  const brows = eyes.filter((e) => e.browTopY !== null);
  const browTop = brows.length ? mean(brows.map((e) => e.browTopY!)) : lm.browLimitY, browBot = brows.length ? mean(brows.map((e) => e.browBottomY!)) : lm.browLimitY + 0.02 * H;
  const browOuter = brows.length ? Math.max(...brows.map((e) => e.browOuterX!)) : inner + 0.12 * W;
  const outerX = has ? Math.max(...eyes.map((e) => e.outerX)) : inner + 0.14 * W;
  // La zone entre les yeux : de la glabelle (bas des sourcils, ou haut du pli) au bas de la fente à l'aplomb des canthi internes. Le nez commence juste dessous.
  const glabella = Math.min(browBot, crease), interBottom = Math.max(lm.eyeY, lidBot);
  const mk = (id: PerimeterId, label: string, top: number, bottom: number, half: number): Perimeter => {
    const mid = (top + bottom) / 2;
    return { id, label, topY: top, bottomY: bottom, heightPx: bottom - top, halfPx: half, heightShare: (bottom - top) / H, widthShare: (2 * half) / (2 * hw(mid)) };
  };
  const list: Perimeter[] = [
    mk('forehead', 'front', lm.hair.centerY, browTop, Math.min(0.3 * W, 0.8 * hw((lm.hair.centerY + browTop) / 2))),
    mk('brows', 'sourcils', browTop, browBot, browOuter),
    mk('browGap', 'distance sourcil / enveloppe palpébrale', browBot, crease, browOuter),
    mk('eyes', 'enveloppe palpébrale (pli → paupière inférieure)', crease, lidBot, outerX),
    mk('interocular', 'zone entre les yeux', glabella, interBottom, inner),
    mk('nose', 'nez', interBottom, lm.noseBaseY, Math.max(nf.alarX, nf.tipHalf)),
    mk('philtrum', 'philtrum', lm.noseBaseY, lm.lips.topY, nf.colHalf + 0.02 * W),
    mk('mouth', 'bouche', lm.lips.topY, lm.lips.bottomY, lm.lips.half),
    mk('chin', 'menton (bouche → base du menton)', lm.lips.bottomY, lm.chinY, Math.min(lm.chin.half, hw((lm.lips.bottomY + lm.chinY) / 2))),
  ];
  return { list, byId: Object.fromEntries(list.map((q) => [q.id, q])) as Record<PerimeterId, Perimeter>, eyes };
}

/** Écart (px) entre le haut du pli palpébral et le point le plus bas du sourcil, ŒIL PAR ŒIL (les yeux sans sourcil sont ignorés) : la grandeur que `fitEyeToFace` borne avec `BROW_GAP`. */
export const browGapPerEye = (eyes: readonly EyeBands[]): number[] => eyes.filter((e) => e.browBottomY !== null).map((e) => e.creaseTopY - e.browBottomY!);

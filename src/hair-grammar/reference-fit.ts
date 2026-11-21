import { bladeOutline } from './blade';
import { composeHair } from './compose-plan';
import { fillPoly, makeGrid } from './compose-grid';
import { generate, type HairProfile } from './grammar';
import { project, type View } from './head';
import { applyIntent, type Intent } from './intent';
import { observe, observationsToSpec, type ArtObservations, type HeadEllipse, type Reference } from './observe';
import { observeStructure, type ArtStructure } from './observe-structure';
import { fillOf, INK, paintLock, type PaintedLock } from './paint';
import { repairCycle, type RepairResult } from './repair';
import { clamp, v3, type V2 } from './vec';
import type { LockSpec } from './lock';

/**
 * RÉFÉRENCE → COIFFURE, BOUCLE FERMÉE — branche l'observation (`observe.ts`, `observe-structure.ts`) sur la génération (`applyIntent`, `composeHair`) et sur la
 * réparation (`repairCycle`). Jusqu'ici `observe` convertissait une image en réglages UNE fois, sans jamais regarder ce que ces réglages produisaient.
 *   1. observer la référence (7 grandeurs + structure) → réglages initiaux (`observationsToSpec`) ;
 *   2. générer, RASTÉRISER le résultat avec la même convention que la référence, l'observer à son tour ;
 *   3. corriger l'intention par l'écart mesuré (gain 0,8 ; étalonnage de `observationsToSpec` : largeur 0,34 par unité de volume, poids 0,04) ;
 *   4. après `iters` tours, réparer (géométrie · anatomie · style) et rendre le journal des écarts.
 * Ce n'est PAS l'analyse par synthèse de `autofit.ts` (qui ajuste les mèches une à une sur des pixels d'encre) : ici, on ajuste les AXES d'intention sur des grandeurs
 * mesurables, ce qui est plus grossier mais ne dépend ni de la segmentation par mèche ni d'un rastériseur d'encre. Les deux sont complémentaires (voir docs).
 */
export interface FitStep { readonly iter: number; readonly intent: Intent; readonly obs: ArtObservations; readonly err: { readonly width: number; readonly negative: number; readonly moment: number; readonly axis: number } }
export interface ReferenceFit { readonly intent: Intent; readonly specs: LockSpec[]; readonly target: ArtObservations; readonly structure: ArtStructure; readonly steps: FitStep[]; readonly repair: RepairResult; readonly final: ArtObservations }

/** Rastérise des mèches peintes en `Reference` : masque = union des lames ; gris = ton de la mèche (ordre de peinture), contour d'encre d'un pixel. */
export function referenceFromPainted(painted: readonly PaintedLock[], w: number, h: number): Reference {
  const mask = new Uint8Array(w * h); const gray = new Float32Array(w * h).fill(1); const g = makeGrid(w, h, 1);
  const tone = (p: PaintedLock): number => { const c = fillOf(p.spec.tone, INK); return c === INK.dark ? 38 / 255 : c === INK.mid ? 207 / 255 : 243 / 255; };
  const order = (['back', 'front', 'over'] as const).flatMap((l) => painted.filter((p) => p.layer === l));
  for (const p of order) {
    g.data.fill(0); fillPoly(g, bladeOutline(p.blade), 1); const t = tone(p);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (!g.data[i]) continue;
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1 || !g.data[i - 1] || !g.data[i + 1] || !g.data[i - w] || !g.data[i + w];
      mask[i] = 1; gray[i] = edge ? 0.08 : t;
    }
  }
  return { w, h, mask, gray };
}

/** Ellipse de la tête sous une vue (repère image) : centre du crâne projeté, demi-axes de tête × échelle. */
export const headEllipse = (P: HairProfile, view: View): HeadEllipse => { const c = project(view, v3(0, 0, P.head.cz)); return { cx: c.x, cy: c.y, rx: P.head.rx * view.s, ry: P.head.ry * view.s }; };

const W_PER_VOLUME = 0.34; const NEG_PER_WEIGHT = 0.04;

export function fitFromReference(P: HairProfile, R: Reference, view: View, o: { readonly seed?: number; readonly iters?: number; readonly towards?: number } = {}): ReferenceFit {
  const seed = o.seed ?? 1; const iters = o.iters ?? 4; const H = headEllipse(P, view);
  const target = observe(R, H); const structure = observeStructure(R, H);
  const start = observationsToSpec(target, o.towards); let intent: Intent = { ...start.intent };
  const steps: FitStep[] = []; let specs: LockSpec[] = [];
  for (let it = 0; it <= iters; it++) {
    const { profile } = applyIntent(P, intent); specs = composeHair(profile, start.composition, seed, view, 3).specs;
    const cur = observe(referenceFromPainted(specs.map((L) => paintLock(P.head, L, view)), R.w, R.h), H);
    const err = { width: target.widthRatio - cur.widthRatio, negative: target.negative - cur.negative, moment: target.moment - cur.moment, axis: Math.atan2(Math.sin(target.axis - cur.axis), Math.cos(target.axis - cur.axis)) };
    steps.push({ iter: it, intent, obs: cur, err });
    if (it === iters) break;
    // Moins d'espaces négatifs (negative ↓) = plus lourd : weight = (1 − negative − 0,856)/0,04, donc l'erreur de poids est −(err.negative).
    intent = { ...intent, volume: clamp((intent.volume ?? 0) + (0.8 * err.width) / W_PER_VOLUME, -1, 1), weight: clamp((intent.weight ?? 0) - (0.8 * err.negative) / NEG_PER_WEIGHT, -1, 1) };
  }
  const { profile } = applyIntent(P, intent); const repair = repairCycle(profile, specs, view, seed, 12, { wind: intent.wind ?? 0 });
  const final = observe(referenceFromPainted(repair.specs.map((L) => paintLock(P.head, L, view)), R.w, R.h), H);
  return { intent, specs: repair.specs, target, structure, steps, repair, final };
}
export type { V2 };
// `generate` est ré-exporté pour que les tests fabriquent une référence synthétique avec la même convention.
export { generate };

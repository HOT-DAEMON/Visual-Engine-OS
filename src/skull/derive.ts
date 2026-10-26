import { Resolver, type Correction } from '../core/resolve';
import type { FaceParams } from '../schema';
import { SkullParams } from './types';

/**
 * DÉRIVATION DES AXES DU CRÂNE À PARTIR DES PARAMÈTRES DE LA FACE — le crâne n'est plus tiré à part : il est DÉDUIT de la tête de face, puis
 * reçoit une petite variation libre BORNÉE (jamais plus que `CI_FREE` sur l'indice céphalique, `AXIS_FREE` sur un axe 0–1).
 *
 * Chaîne principale (la seule qui touche la longueur de la tête) :
 *   largeur de face (W/H de l'hôte) → largeur de tête (`BREADTH_SCALE` × W/H, en H) → indice céphalique cible (monotone, borné) + variation libre
 *   → longueur de tête L = largeur / indice → axe `length` du crâne (L = (0,80 + 0,06·length)·H, voir `frame.ts`).
 * Les autres axes dérivés sont des relations MONOTONES et bornées (jamais des mesures anthropométriques exactes : ce sont des conventions de
 * proportion documentées ici, consignées dans `Derivation`) :
 *   front       ← `templeY` (plus la largeur maximale est haute, plus le front est plein) et `eyeLine` (yeux bas = voûte haute) ;
 *   pommettes   ← `cheek.boneProjection` et `cheek.lateralWidth` ;
 *   cou         ← `neck.width` (fraction de W) ramenée à la profondeur antéro-postérieure du cou.
 * Tout ce que la face ne détermine pas (occiput, inion, maxillaire, trapèze, C7, lordose…) reste tiré librement (`random-skull.ts`).
 */
export const BREADTH_SCALE = 0.8; // largeur de tête / H pour un hôte de rapport W/H = 1 ; 0,8 × 0,8 = 0,64 H (ordre de grandeur adulte : ≈ 0,65 H)
export const REF_ASPECT = 0.8; // rapport W/H de l'hôte de référence du cadre de profil (frame.ts)
export const CI_BOUNDS = [0.7, 0.9] as const; // plage de l'indice céphalique accepté (dolichocéphale extrême → hyperbrachycéphale)
export const CI_FREE = 0.025; // variation libre maximale de l'indice (≈ 2,5 points d'indice)
export const AXIS_FREE = 0.08; // variation libre maximale d'un axe unitaire dérivé
export const LENGTH_REF = 0.8; // L/H à `length` = 0 (frame.ts)
export const LENGTH_SPAN = 0.06; // variation de L/H pour `length` = ±1 (frame.ts)

/** Indice céphalique cible d'une face de rapport W/H = r : 0,74 à r = 0,71, 0,86 à r = 0,91 (pente 0,6). Monotone, borné à `CI_BOUNDS`. */
export const targetIndex = (r: number): number => Math.min(CI_BOUNDS[1], Math.max(CI_BOUNDS[0], 0.74 + 0.6 * (r - 0.71)));

/** Tirages libres, chacun dans [-1, 1] (0 = aucune variation). */
export interface FreeDraw {
  readonly ci?: number;
  readonly axes?: Partial<Record<DerivedAxis, number>>;
}
export const DERIVED_AXES = ['vaultHeight', 'frontalBulge', 'foreheadSlope', 'zygoma', 'neckDepth'] as const;
export type DerivedAxis = (typeof DERIVED_AXES)[number];

export interface Derivation {
  readonly skull: SkullParams;
  /** Rapport W/H de l'hôte et largeur de tête (fraction de H, dans le repère du profil). */
  readonly aspect: number;
  readonly breadthH: number;
  /** Indice céphalique : cible (sans variation), variation libre appliquée, valeur retenue (largeur / longueur). */
  readonly ci: { readonly target: number; readonly free: number; readonly applied: number };
  /** Longueur de tête visée (fraction de H) avant et après bornage de l'axe `length`. */
  readonly lengthH: number;
  /** Valeur dérivée (sans variation) et variation libre appliquée, par axe : trace complète de la dérivation. */
  readonly axes: Readonly<Record<DerivedAxis, { readonly derived: number; readonly free: number; readonly value: number }>>;
  readonly corrections: readonly Correction[];
}

const unit = (v: number): number => Math.min(1, Math.max(0, v));

export function deriveSkull(face: FaceParams, aspect: number, base: Partial<SkullParams> = {}, draw: FreeDraw = {}): Derivation {
  const R = new Resolver();
  const r = R.limit('host-aspect', 'host.aspect', aspect, 0.6, 1.05, 'rapport largeur/hauteur de l’hôte hors de la plage où la dérivation est définie');
  const breadthH = BREADTH_SCALE * r;
  const target = targetIndex(r);
  const free = CI_FREE * Math.min(1, Math.max(-1, draw.ci ?? 0));
  const applied = R.limit('ci-bounds', 'skull.cephalicIndex', target + free, CI_BOUNDS[0], CI_BOUNDS[1], 'indice céphalique hors plage humaine');
  const lengthH = breadthH / applied;
  const length = R.limit('length-range', 'skull.length', (lengthH - LENGTH_REF) / LENGTH_SPAN, -1, 1, 'longueur de tête hors de l’axe `length` du crâne');
  // Front : t = hauteur relative de la plus grande largeur (0 = haute), e = hauteur relative de la ligne des yeux (1 = yeux bas).
  const t = (face.templeY - 0.22) / 0.28;
  const e = (face.eyeLine - 0.4) / 0.18;
  const derived: Record<DerivedAxis, number> = {
    vaultHeight: unit(0.15 + 0.7 * e),
    frontalBulge: unit(0.2 + 0.6 * (1 - t)),
    foreheadSlope: Math.min(0.85, Math.max(0.05, 0.7 - 0.35 * e - 0.3 * (1 - t))),
    zygoma: unit(0.6 * face.cheek.boneProjection + 0.4 * face.cheek.lateralWidth),
    // Largeur du cou (fraction de W, 0,16–0,72 → 0–1) ramenée à l'aspect de l'hôte : un hôte plus large a un cou plus large à fraction égale.
    neckDepth: unit((face.neck.width * (r / REF_ASPECT) - 0.16) / 0.56),
  };
  const axes = {} as Record<DerivedAxis, { derived: number; free: number; value: number }>;
  for (const k of DERIVED_AXES) {
    const f = AXIS_FREE * Math.min(1, Math.max(-1, draw.axes?.[k] ?? 0));
    axes[k] = { derived: derived[k], free: f, value: k === 'foreheadSlope' ? Math.min(0.85, Math.max(0.05, derived[k] + f)) : unit(derived[k] + f) };
  }
  const skull = SkullParams.parse({ ...base, length, vaultHeight: axes.vaultHeight.value, frontalBulge: axes.frontalBulge.value, foreheadSlope: axes.foreheadSlope.value, zygoma: axes.zygoma.value, neckDepth: axes.neckDepth.value });
  return { skull, aspect: r, breadthH, ci: { target, free, applied }, lengthH, axes, corrections: R.applied };
}

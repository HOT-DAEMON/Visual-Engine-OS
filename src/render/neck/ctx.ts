import { mix } from '../../core/color';
import type { ResolvedAppearance } from '../../appearance';
import type { LightVector } from '../../lighting/light';
import { intensityFor } from '../../lighting/rig';
import { sectionPoint, stationAt, fieldAt, surfaceNormal } from '../../neck/geometry';
import { visibilityOf } from '../../neck/anatomy';
import type { NeckModel, P2, StructureId } from '../../neck/types';
import { detailGain, effectiveStyle } from '../../neck/style';
import type { NeckSystem } from '../../schema/neck-system';
import { softKit, type SoftKit } from '../face/soft';
import type { SkinShading } from '../../skin';
import { lightProjection, toneOfNormal } from './skin';

/** Contexte partagé par les sous-rendus du cou (muscles, reliefs, surface) : une seule lecture de la lumière, de l'apparence et du modèle. */
export interface NeckCtx {
  readonly id: string;
  readonly model: NeckModel;
  readonly sys: NeckSystem;
  readonly skin: string;
  readonly ra: ResolvedAppearance;
  readonly L: LightVector;
  /** Ombrage de peau PARTAGÉ (matériau × lumière × apparence) : la seule loi d'éclairage du cou. */
  readonly sh: SkinShading;
  /** Couleur d'une couleur de base éclairée selon une normale, par la loi partagée (écailles, plaques, plumes, accessoires). */
  readonly tone: (base: string, n: { x: number; y: number }) => string;
  /** Creux des reliefs du cou (plis, tendons, trachée) : l'ombre de l'apparence approfondie, pour qu'un creux se lise sur une peau déjà à peine plus claire que cette ombre. */
  readonly dark: string;
  /** Projection de la normale sur la lumière 2D (+1 = côté lumière). */
  readonly proj: (n: { x: number; y: number }) => number;
  readonly kit: SoftKit;
  /** Échelle px par unité de largeur de tête (W/300), comme le reste du moteur de visage. */
  readonly u: number;
  readonly I: number;
  /** Direction 2D de la lumière (x vers la droite) : côté éclairé = signe de `dir.x`. */
  readonly dir: { x: number; y: number };
  /** Gain de détail du style (silhouette prioritaire / simplification). */
  readonly detail: number;
  readonly vis: (id: StructureId) => number;
  /** Point de la surface (face) en (u le long du cou, ψ), `lift` px vers l'extérieur. */
  readonly at: (u: number, psi: number, lift?: number) => P2;
  readonly field: (key: Parameters<typeof fieldAt>[1], u: number) => number;
  /** Composante z de la normale (> 0 = tourné vers le spectateur) : une structure n'est dessinée que là où elle est VISIBLE. */
  readonly facing: (u: number, psi: number) => number;
  readonly chinU: number;
  readonly jawU: number;
}

/**
 * Gain d'écriture des reliefs, ÉTALONNÉ à l'œil sur les planches de preuve (artefacts/neck) : à l'échelle d'une tête entière, un trait de 2 px et 0,1 d'opacité
 * disparaît ; ×1,7 en largeur et ×1,5 en opacité (plafond 0,85) rend les reliefs lisibles sans les durcir. Appliqué en UN seul endroit.
 */
const GAIN = { width: 1.7, opacity: 1.5, cap: 0.85 } as const;
function gained(k: SoftKit): SoftKit {
  return { ...k, stroke: (d, color, w, o, s) => k.stroke(d, color, w * GAIN.width, Math.min(GAIN.cap, o * GAIN.opacity), s), fill: (d, f, o, s) => k.fill(d, f, Math.min(GAIN.cap, o * GAIN.opacity), s) };
}

export function makeCtx(id: string, model: NeckModel, sys: NeckSystem, skin: string, ra: ResolvedAppearance, L: LightVector, dir: { x: number; y: number }, sh: SkinShading): NeckCtx {
  const { W, H, chinY, jawY } = model.ctx;
  const S = model.stations;
  const uOf = (y: number): number => { for (let i = 1; i < S.length; i++) if (y <= S[i]!.y) return ((i - 1) + (y - S[i - 1]!.y) / (S[i]!.y - S[i - 1]!.y || 1)) / (S.length - 1); return 1; };
  return {
    id, model, sys, skin, ra, L, sh, dark: mix(ra.shadow, '#000000', 0.3), tone: (b, n) => toneOfNormal(sh, L, b, n), proj: (n) => lightProjection(n, L), kit: gained(softKit(`${id}-neckfx`, W, H)), u: W / 300, I: intensityFor(L, 'skin'), dir,
    // Gain de détail : style (priorité de silhouette, simplification) × champ `simplify` écrit par l'opérateur `silhouette_simplification`.
    detail: detailGain(effectiveStyle(sys.style)) * (1 - 0.8 * model.fields.simplify),
    vis: (s) => visibilityOf(model.composition.structures, s),
    at: (u, psi, lift = 0) => { const p = sectionPoint(stationAt(model, u), psi, lift); return { x: p.x, y: p.y }; },
    field: (k, u) => fieldAt(model, k, u),
    facing: (u, psi) => surfaceNormal(model, Math.round(u * (S.length - 1)), psi).z,
    chinU: uOf(chinY), jawU: uOf(jawY),
  };
}

import { clamp01 } from '../core/math';
import type { NeckSystem } from '../schema/neck-system';

/**
 * COUCHE DE STYLE (TODO §3) : le style ne touche JAMAIS la morphologie demandée, il règle QUATRE curseurs de lecture. Chaque mode est un
 * DÉCALAGE ajouté aux curseurs explicites (borné à [0, 1]) : un style « anime » avec `simplification: 0.2` donne 0,7, pas 0,5.
 * Réalisme = aucun décalage ; caricature = la silhouette prime ; anime = volumes simplifiés ; sculpture = facettes ; peinture = silhouette adoucie.
 */
export interface EffectiveStyle { readonly exaggeration: number; readonly simplification: number; readonly angularity: number; readonly silhouettePriority: number }

const BIAS: Readonly<Record<NeckSystem['style']['mode'], EffectiveStyle>> = {
  realistic: { exaggeration: 0, simplification: 0, angularity: 0, silhouettePriority: 0 },
  caricature: { exaggeration: 0.5, simplification: 0.1, angularity: 0, silhouettePriority: 0.4 },
  anime: { exaggeration: 0.1, simplification: 0.5, angularity: 0.15, silhouettePriority: 0.2 },
  sculpture: { exaggeration: 0, simplification: 0.2, angularity: 0.4, silhouettePriority: 0.1 },
  painting: { exaggeration: 0.05, simplification: 0, angularity: 0, silhouettePriority: -0.2 },
};

export function effectiveStyle(s: NeckSystem['style']): EffectiveStyle {
  const b = BIAS[s.mode];
  return {
    exaggeration: clamp01(s.exaggeration + b.exaggeration),
    simplification: clamp01(s.simplification + b.simplification),
    angularity: clamp01(s.angularity + b.angularity),
    silhouettePriority: clamp01(s.silhouettePriority + b.silhouettePriority),
  };
}

/** Gain appliqué aux DÉTAILS internes (reliefs, plis, tendons) : 1 au défaut (priorité 0,3), < 1 quand la silhouette prime ou que l'on simplifie. */
export const detailGain = (st: EffectiveStyle): number => Math.max(0.05, ((1 - 0.7 * st.silhouettePriority) / (1 - 0.7 * 0.3)) * (1 - 0.8 * st.simplification));

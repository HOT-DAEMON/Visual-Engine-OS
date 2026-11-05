import { clamp } from '../../../core/math';
import { luminance } from '../../../core/color';
import type { HairStyle, HairTexture } from '../../../schema';

/**
 * STYLE DE LA LISIÈRE : à quoi ressemble le passage peau → cheveux selon la coiffure, la texture et la COULEUR.
 *  - `crisp` (0–1) : netteté du bord. Une coiffure tirée en arrière (queue, chignon, tresses) a un bord franc ; un rasage (`buzz`) ou une
 *    chevelure crépue / bouclée a un bord flou, fait de petits poils épars.
 *  - `contrast` (0–1) : écart de luminance cheveux / peau (lumière linéaire, racine carrée pour une échelle perceptuelle). Cheveux noirs
 *    sur peau claire = fort contraste : le bord se voit de loin, les petits poils aussi. Blond sur peau claire = faible contraste : le bord se
 *    lit surtout par l'ombre de transition.
 * Les facteurs sont des choix de conception documentés (`docs/HAIR-BOUNDARY.md`), pas des mesures.
 */
export interface EdgeStyle {
  readonly crisp: number;
  readonly contrast: number;
  /** Opacité (0–1) de l'ombre portée du bord et largeur relative (1 = référence). */
  readonly shadowAlpha: number;
  readonly shadowWidth: number;
  /** Part des points de la lisière qui reçoivent un petit poil, et leur opacité maximale. */
  readonly strayShare: number;
  readonly strayAlpha: number;
}

const STYLE_CRISP: Record<Exclude<HairStyle, 'bald'>, number> = { buzz: 0.15, short: 0.5, spiky: 0.4, curly: 0.3, afro: 0.15, bob: 0.7, long: 0.7, ponytail: 0.85, bun: 0.85, braids: 0.9 };
const TEXTURE_CRISP: Record<HairTexture, number> = { straight: 1, wavy: 0.85, curly: 0.6, coily: 0.45, braided: 1 };

export function edgeStyle(style: Exclude<HairStyle, 'bald'>, texture: HairTexture, hairColor: string, skinColor: string, irregularity: number): EdgeStyle {
  const crisp = clamp(STYLE_CRISP[style] * TEXTURE_CRISP[texture], 0, 1);
  const contrast = clamp(Math.abs(Math.sqrt(luminance(hairColor)) - Math.sqrt(luminance(skinColor))), 0, 1);
  const soft = 1 - crisp;
  return {
    crisp,
    contrast,
    // Faible contraste : l'ombre porte la lecture du bord (plus marquée) ; fort contraste : le bord se lit seul (ombre discrète).
    shadowAlpha: clamp((0.1 + 0.1 * soft) * (1.25 - 0.8 * contrast), 0.03, 0.2),
    shadowWidth: 0.7 + 0.9 * soft,
    strayShare: clamp(0.3 + 0.5 * soft + 0.2 * irregularity, 0.15, 0.95),
    strayAlpha: clamp(0.15 + 0.5 * contrast, 0.12, 0.6),
  };
}

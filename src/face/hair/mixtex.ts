import type { HairTexture } from '../../schema';
import type { HairCtx } from './flow';

/**
 * Texture d'UNE mèche quand la tête mélange plusieurs textures (`hair.textureMix`). La texture dépend de la ZONE
 * de la racine (positions normalisées s horizontale, t radiale), pas d'un tirage par mèche : des régions cohérentes
 * (ex. dessus ondulé, nuque crépue) plutôt qu'un mélange aléatoire. Les poids donnent la part de chaque texture.
 * Sans mélange, la texture unique de la coiffure (`ctx.tex`) est renvoyée.
 */
export function textureAt(ctx: HairCtx, s: number, t: number): HairTexture {
  const mix = ctx.h.textureMix.filter((m) => m.weight > 0);
  if (mix.length === 0) return ctx.tex;
  // Valeur de zone dans [0, 1] : bruit lisse en s et t (deux fréquences) → régions de taille moyenne.
  const z = ((ctx.nz(s * 1.7 + t * 2.3 + 5) + 0.5 * ctx.nz(s * 4.1 - t * 3.7 + 17)) / 3 + 0.5) % 1;
  const zone = Math.min(0.999, Math.max(0, z));
  const total = mix.reduce((a, m) => a + m.weight, 0);
  let acc = 0;
  for (const m of mix) {
    acc += m.weight / total;
    if (zone <= acc) return m.texture;
  }
  return (mix[mix.length - 1] as { texture: HairTexture }).texture;
}

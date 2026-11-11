import { generateRandomFace, type RandomFace, type RandomFaceOptions } from '../../src';
import { mulberry32 } from '../../src/core/prng';
import { drawHairColor } from '../../src/generation/random-face-extras';
import { drawHairV2 } from '../../src/generation/random-hair-v2';
import type { HairStyle } from '../../src/schema';

/**
 * Visages à coiffure IMPOSÉE avec des axes v2 COHÉRENTS avec la coiffure.
 *
 * Pourquoi : `generateRandomFace(seed, { hair: { style } })` surcharge le style APRÈS que `drawHairV2` a tiré ses axes pour le style
 * tiré au hasard. Une coupe rasée recevait donc gonflement 0,7, soulèvement et cônes : combinaison que la génération naturelle écarte
 * (`random-hair-v2.ts` : `flat` / `tied`). Les planches de preuve doivent juger la coiffure, pas ce mélange : ici `drawHairV2` est appelé
 * avec le style imposé, puis son résultat est passé en surcharge.
 */
export type HairEngine = 'classic' | 'v2';
export type CleanStyle = Exclude<HairStyle, 'bald'>;
/** Aucune pilosité faciale, pattes comprises : les planches jugent les CHEVEUX. Oublier `sideburns` laissait des pattes « mutton » tirées au hasard, lues à tort comme des plaques anguleuses de cheveux aux joues. */
export const NO_FACIAL_HAIR = { mustache: 'none', beard: 'none', sideburns: 'none' } as const;

export interface HairFaceOptions {
  readonly engine?: HairEngine;
  /** Graine du visage (défaut : 4000 + 19 k). */
  readonly seed?: number;
  readonly identity?: number;
  readonly fringe?: 'none' | 'straight' | 'sweep' | 'curtain';
  /** Surcharges libres des paramètres de cheveux (vent, longueur, simulation…). */
  readonly hair?: Record<string, unknown>;
  readonly transform?: { readonly x?: number; readonly y?: number; readonly scale?: number };
  readonly id?: string;
}

const textureOf = (style: HairStyle): 'straight' | 'curly' | 'coily' => (style === 'curly' ? 'curly' : style === 'afro' ? 'coily' : 'straight');

/** `(seed, options)` à passer à `generateRandomFace` ou à `layout()` des planches. */
export function hairFaceSpec(style: CleanStyle, k: number, o: HairFaceOptions = {}): { seed: number; opts: RandomFaceOptions } {
  const engine = o.engine ?? 'v2';
  const seed = o.seed ?? 4000 + k * 19;
  let v2: Record<string, unknown> = {};
  if (engine === 'v2') {
    const rnd = mulberry32((seed ^ 0x2545f491) >>> 0);
    v2 = drawHairV2(rnd, { style, color: drawHairColor(rnd), texture: textureOf(style) }) as unknown as Record<string, unknown>;
  }
  const opts = {
    identity: o.identity ?? k % 8,
    hairEngine: 'classic' as const,
    ...(o.id ? { id: o.id } : {}),
    ...(o.transform ? { transform: o.transform } : {}),
    hair: { ...v2, style, texture: 'auto', fringe: o.fringe ?? (k % 2 ? 'sweep' : 'none'), seed: k, ...(o.hair ?? {}) },
    facialHair: NO_FACIAL_HAIR,
  } as unknown as RandomFaceOptions;
  return { seed, opts };
}

export function hairFace(style: CleanStyle, k: number, o: HairFaceOptions = {}): RandomFace {
  const s = hairFaceSpec(style, k, o);
  return generateRandomFace(s.seed, s.opts);
}

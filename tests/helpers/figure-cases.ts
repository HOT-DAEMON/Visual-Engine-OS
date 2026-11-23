import { createHash } from 'node:crypto';
import { ARCHETYPES, type BodyInput } from '../../src/body';
import { bodyVolumes } from '../../src/body/volume';
import { renderVolumesPixel } from '../../src/body/volume/pixel';
import { lightModelOf, litFigure, type LitStyle } from '../../src/relief';
import { bodyHost } from '../../scripts/lib/body-host';

/**
 * CAS DE RÉFÉRENCE de la figure complète (tête + cou + corps éclairés). Servent à PROUVER qu'un découpage en couches, un cache ou une optimisation exacte rend
 * la MÊME image : le test compare des empreintes SHA-1 du SVG, des pixels du corps et des champs de lumière de la tête (`tests/fixtures/figure-golden.json`,
 * produit une fois par `scripts/figure-golden.ts` sur le code d'avant). Une empreinte égale = résultat identique octet pour octet, donc pixel pour pixel.
 */
export interface FigureCase { readonly id: string; readonly arch: keyof typeof ARCHETYPES; readonly light: Record<string, number>; readonly style: LitStyle; readonly o: Record<string, unknown>; readonly bodyOnly?: boolean }
export const FIGURE_CASES: readonly FigureCase[] = [
  { id: 'c1-tres-muscle-soft', arch: 'veryMuscular', light: { azimuthDeg: 305, elevationDeg: 38, shadowHardness: 0.5, sourceSize: 0.4 }, style: 'soft', o: { heightPx: 420 } },
  { id: 'c2-femme-cel2-haute', arch: 'adultFemale', light: { azimuthDeg: 120, elevationDeg: 60 }, style: 'cel2', o: { heightPx: 420, ss: 2 } },
  { id: 'c3-corpulent-dure-rasante', arch: 'obese', light: { azimuthDeg: 20, elevationDeg: 20, shadowHardness: 0.9, sourceSize: 0.1 }, style: 'soft', o: { heightPx: 420 } },
  { id: 'c4-enfant-cel3-ss1', arch: 'child', light: {}, style: 'cel3', o: { heightPx: 420, ss: 1 } },
  { id: 'c5-mince-camera-35deg', arch: 'thin', light: { azimuthDeg: 200, elevationDeg: 45 }, style: 'soft', o: { heightPx: 420, camera: { yaw: 35, pitch: 0, pivot: { x: 0, y: 0, z: 0 } } } },
  { id: 'c6-muscle-rapide-ppu16', arch: 'muscular', light: { azimuthDeg: 330, elevationDeg: 55 }, style: 'soft', o: { heightPx: 420, quality: 'fast', ss: 1, headPpu: 1.6 } },
  { id: 'c7-corps-seul-ancien-eclairage', arch: 'adultMale', light: {}, style: 'soft', o: { heightPx: 420, lightModel: null }, bodyOnly: true },
];

const sha = (b: Uint8Array | string): string => createHash('sha1').update(b).digest('hex');
const f32 = (a: Float32Array): string => sha(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
export interface Digest { readonly svg: string; readonly body: string; readonly lit?: string; readonly cast?: string }

let host: ReturnType<typeof bodyHost> | null = null;
export function digestOf(c: FigureCase): Digest {
  host ??= bodyHost();
  const BH = host, set = bodyVolumes(ARCHETYPES[c.arch] as BodyInput, BH.a, {});
  if (c.bodyOnly) { const r = renderVolumesPixel(set, { skin: BH.skin, ...c.o } as never); return { svg: sha(r.svg), body: sha(new Uint8Array(r.pixels.rgba.buffer)) }; }
  const m = lightModelOf(c.light, { style: c.style }), f = litFigure(BH.svg, BH.o, BH.skin, set, m, c.o as never);
  return { svg: sha(f.svg), body: sha(new Uint8Array(f.body.pixels.rgba.buffer)), lit: f32(f.head.lit), cast: f32(f.head.cast) };
}

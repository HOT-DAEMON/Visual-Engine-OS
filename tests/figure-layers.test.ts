import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { clearLayerCaches, layerStats, resetLayerStats } from '../src/perf';
import { ARCHETYPES, type BodyInput } from '../src/body';
import { bodyVolumes } from '../src/body/volume';
import { renderVolumesPixel } from '../src/body/volume/pixel';
import { bodyHost } from '../scripts/lib/body-host';
import { FIGURE_CASES, digestOf } from './helpers/figure-cases';

/**
 * PREUVE d'identité du découpage en couches : pour 7 configurations (morphologies, lumière dure/douce, styles cel, caméra de côté, qualité rapide, ancien éclairage),
 * les empreintes SHA-1 du SVG, des pixels du corps et des champs de lumière de la tête sont ÉGALES à celles de l'ancien rendu monolithique, figées dans
 * `tests/fixtures/figure-golden.json` (scripts/figure-golden.ts, produit sur le code d'avant). Empreinte égale = résultat identique octet pour octet = pixel pour pixel.
 */
const GOLD = JSON.parse(readFileSync(new URL('./fixtures/figure-golden.json', import.meta.url), 'utf8')) as Record<string, Record<string, string>>;
describe('figure en couches ≡ rendu monolithique', () => {
  beforeAll(() => { clearLayerCaches(); resetLayerStats(); });
  for (const c of FIGURE_CASES) it(`${c.id} : empreintes identiques (à froid, puis couches chaudes)`, () => {
    clearLayerCaches();
    expect(digestOf(c), 'à froid').toEqual(GOLD[c.id]);
    expect(digestOf(c), 'couches chaudes (deuxième rendu, caches remplis)').toEqual(GOLD[c.id]);
  }, 120000);
  it('les couches chaudes sont réellement réutilisées', () => {
    const s = layerStats();
    expect(s['body.gbuffer']!.hits).toBeGreaterThan(0); expect(s['body.occlusion']!.hits).toBeGreaterThan(0);
  });
  it('seamBlend (fondu des jonctions peau/peau) est consommé et distingué par le cache du G-buffer', () => {
    const BH = bodyHost(), set = bodyVolumes(ARCHETYPES.veryMuscular as BodyInput, BH.a, {}); clearLayerCaches();
    const on = renderVolumesPixel(set, { skin: BH.skin, heightPx: 360 }), off = renderVolumesPixel(set, { skin: BH.skin, heightPx: 360, seamBlend: false }), on2 = renderVolumesPixel(set, { skin: BH.skin, heightPx: 360 });
    expect(on.seam.blended).toBeGreaterThan(0); expect(off.seam.blended).toBe(0);
    expect(Buffer.from(on.pixels.rgba).equals(Buffer.from(off.pixels.rgba))).toBe(false); // le paramètre agit
    expect(Buffer.from(on.pixels.rgba).equals(Buffer.from(on2.pixels.rgba))).toBe(true); // et le cache ne mélange pas les deux
  });
});

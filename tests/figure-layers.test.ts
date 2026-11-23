import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { clearLayerCaches, layerStats, resetLayerStats } from '../src/perf';
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
});

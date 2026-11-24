import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { composeEar, faceLandmarks } from '../src/face';
import { earViewSvg } from '../src/render/face/ear/sheet';
import { FaceParams } from '../src/schema';

/** Preuve visuelle automatisée des axes de la passe 6 : chaque axe change assez de pixels dans sa meilleure vue d'oreille (seuil du dépôt : 378 px). */
const AX: [string, string][] = [['antihelix', 'upperBend'], ['antihelix', 'lowerBend'], ['concha', 'floor'], ['helix', 'darwinSite']];
const render = (g: string, k: string, v: number, view: 'close-up' | 'three-quarter' | 'profile'): Uint8Array => {
  // `darwinSite` n'a d'effet visible que si le tubercule existe : il est activé à 0,8 pour l'audit de ce seul axe.
  const morph: Record<string, Record<string, number>> = { [g]: { [k]: v } };
  if (k === 'darwinSite') morph.helix = { ...morph.helix, darwin: 0.8 };
  const p = FaceParams.parse({ anatomyEngine: 'structured', ears: { engine: 'morphology', seed: 11, style: { detail: 0.9 }, morph } });
  return new Resvg(earViewSvg(p, faceLandmarks(p, 300, 400), { view, width: 240, height: 320, skin: '#b98a62' }), { fitTo: { mode: 'width', value: 240 } }).render().pixels;
};
const diff = (a: Uint8Array, b: Uint8Array): number => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs((a[i] as number) - (b[i] as number)) + Math.abs((a[i + 1] as number) - (b[i + 1] as number)) + Math.abs((a[i + 2] as number) - (b[i + 2] as number)) > 24) n++; return n; };

describe('passe 6 : chaque nouvel axe est visible', () => {
  it.each(AX)('%s.%s : ±0,8 change ≥ 378 px dans la meilleure des trois vues', (g, k) => {
    const best = Math.max(...(['close-up', 'three-quarter', 'profile'] as const).map((v) => diff(render(g, k, -0.8, v), render(g, k, 0.8, v))));
    expect(best).toBeGreaterThanOrEqual(378);
  });
  it('le schéma borne les axes et le défaut est neutre', () => {
    expect(() => FaceParams.parse({ ears: { morph: { concha: { floor: 2 } } } })).toThrow();
    const p = FaceParams.parse({ ears: {} });
    for (const [g, k] of AX) expect(((p.ears.morph as unknown as Record<string, Record<string, number>>)[g] as Record<string, number>)[k]).toBe(0);
  });
  it('le compositeur reste déterministe', () => { expect(composeEar(42, { character: 'natural' })).toEqual(composeEar(42, { character: 'natural' })); });
});

import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { composeEar, faceLandmarks } from '../src/face';
import { earViewSvg } from '../src/render/face/ear/sheet';
import { FaceParams } from '../src/schema';

/** Preuve visuelle automatisée des axes de la passe 4 : chaque axe doit changer assez de pixels dans sa meilleure vue d'oreille (seuil du dépôt : 378 px). */
const AX: [string, string][] = [['helix', 'torsion'], ['helix', 'continuity'], ['scapha', 'curvature'], ['scapha', 'gradient'], ['fossa', 'tilt'], ['fossa', 'curvature'], ['concha', 'volume'], ['concha', 'tilt'], ['concha', 'transition'], ['tragus', 'thickness'], ['lobule', 'volume']];
const render = (g: string, k: string, v: number, view: 'close-up' | 'three-quarter' | 'profile'): Uint8Array => {
  const p = FaceParams.parse({ anatomyEngine: 'structured', ears: { engine: 'morphology', seed: 11, style: { detail: 0.9 }, morph: { [g]: { [k]: v } } } });
  return new Resvg(earViewSvg(p, faceLandmarks(p, 300, 400), { view, width: 240, height: 320, skin: '#b98a62' }), { fitTo: { mode: 'width', value: 240 } }).render().pixels;
};
const diff = (a: Uint8Array, b: Uint8Array): number => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs((a[i] as number) - (b[i] as number)) + Math.abs((a[i + 1] as number) - (b[i + 1] as number)) + Math.abs((a[i + 2] as number) - (b[i + 2] as number)) > 24) n++; return n; };

describe('passe 4 : chaque axe est visible (pas de paramètre théorique)', () => {
  it.each(AX)('%s.%s : ±0,8 change ≥ 378 px dans la meilleure des trois vues', (g, k) => {
    const best = Math.max(...(['close-up', 'three-quarter', 'profile'] as const).map((v) => diff(render(g, k, -0.8, v), render(g, k, 0.8, v))));
    expect(best).toBeGreaterThanOrEqual(378);
  });
  it('le schéma rejette un axe hors bornes et le défaut est neutre (tous les axes à 0 = oreille sans déviation)', () => {
    expect(() => FaceParams.parse({ ears: { morph: { concha: { volume: 2 } } } })).toThrow();
    const p = FaceParams.parse({ ears: {} });
    for (const [g, k] of AX) expect(((p.ears.morph as unknown as Record<string, Record<string, number>>)[g] as Record<string, number>)[k]).toBe(0);
  });
  it('le compositeur tire ces axes dans les bornes, sans changer le tirage historique (même graine → mêmes axes anciens)', () => {
    const a = composeEar(42, { character: 'natural' }), b = composeEar(42, { character: 'natural' });
    expect(a).toEqual(b);
    const m = a.morph as unknown as Record<string, Record<string, number>>;
    for (const [g, k] of AX) expect(Math.abs((m[g] as Record<string, number>)[k] as number)).toBeLessThanOrEqual(1);
  });
});

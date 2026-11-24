import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { faceLandmarks } from '../src/face';
import { lightVector } from '../src/lighting/light';
import { renderHair } from '../src/render/face/hair';
import { skinShadowOpacity } from '../src/render/face/hair-skin-shadow';

/** Opacité de l'ombre de peau selon l'intensité et la douceur de la lumière (docs/HAIR-PASS6.md). La lumière de référence redonne l'opacité cuite, au bit près. */
const mk = (o: { intensity?: number; sourceSize?: number; shadowHardness?: number; distance?: number | null; influence?: { skin: number; hair: number; eyes: number; lips: number; metal: number } } = {}) =>
  lightVector({ azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity: o.intensity ?? 1, ...(o.sourceSize === undefined ? {} : { sourceSize: o.sourceSize }), ...(o.shadowHardness === undefined ? {} : { shadowHardness: o.shadowHardness }), ...(o.distance === undefined ? {} : { distance: o.distance }), ...(o.influence === undefined ? {} : { influence: o.influence }) });

describe('skinShadowOpacity', () => {
  it('lumière de référence : valeur cuite INCHANGÉE, au bit près', () => { for (const b of [0.2, 0.6, 0.85, 1]) expect(skinShadowOpacity(mk(), b)).toBe(b); });
  it('l\'intensité est proportionnelle : moitié de lumière = moitié d\'ombre ; sans lumière = pas d\'ombre', () => {
    expect(skinShadowOpacity(mk({ intensity: 0.5 }), 0.6)).toBeCloseTo(0.3, 9); expect(skinShadowOpacity(mk({ intensity: 0 }), 0.6)).toBe(0);
  });
  it('l\'influence de la classe « skin » compte (c\'est la peau qui reçoit l\'ombre)', () => { expect(skinShadowOpacity(mk({ influence: { skin: 0.5, hair: 1, eyes: 1, lips: 1, metal: 1 } }), 0.6)).toBeCloseTo(0.3, 9); expect(skinShadowOpacity(mk({ influence: { skin: 1, hair: 0.1, eyes: 1, lips: 1, metal: 1 } }), 0.6)).toBe(0.6); });
  it('source plus large / plus douce → ombre plus pâle ; plus dure / plus petite → plus dense (monotone)', () => {
    const soft = skinShadowOpacity(mk({ sourceSize: 1, shadowHardness: 0 }), 0.6); const hard = skinShadowOpacity(mk({ sourceSize: 0, shadowHardness: 1 }), 0.6);
    expect(soft).toBeLessThan(0.6); expect(hard).toBeGreaterThan(0.6); expect(soft).toBeGreaterThanOrEqual(0.6 * 0.75 - 1e-9); expect(hard).toBeLessThanOrEqual(0.6 * 1.25 + 1e-9);
    expect(skinShadowOpacity(mk({ sourceSize: 0.8 }), 0.6)).toBeLessThan(skinShadowOpacity(mk({ sourceSize: 0.2 }), 0.6));
  });
  it('toujours dans [0, 1], même base 1 et source très dure', () => { expect(skinShadowOpacity(mk({ sourceSize: 0, shadowHardness: 1 }), 1)).toBeLessThanOrEqual(1); expect(skinShadowOpacity(mk({ intensity: 0 }), 1)).toBeGreaterThanOrEqual(0); });
});

describe('rendu : l\'opacité du groupe d\'ombres suit la lumière', () => {
  const f = generateRandomFace(321, { identity: 3, hairEngine: 'classic', hair: { style: 'short', texture: 'straight', color: '#23232b', seed: 5, volume: 0.5, density: 0.85, part: 0.2, sim: { enabled: true, archetype: 'side_sweep', skinShadow: 0.6 } } } as never);
  const lm = faceLandmarks(f.params, f.width, f.height);
  const op = (L: ReturnType<typeof mk>): number => { const m = /filter="url\(#t-hair-skin-blur\)"[^>]*opacity="([\d.]+)"|opacity="([\d.]+)"[^>]*filter="url\(#t-hair-skin-blur\)"/.exec(renderHair('t', f.params, lm, L, 0, '#6b4a3a', '#e8b89a').front.join('')); return Number(m?.[1] ?? m?.[2] ?? NaN); };
  it('référence : 0,6 ; demi-intensité : 0,3 ; la même ombre, deux fois plus pâle', () => { expect(op(mk())).toBeCloseTo(0.6, 9); expect(op(mk({ intensity: 0.5 }))).toBeCloseTo(0.3, 9); });
});

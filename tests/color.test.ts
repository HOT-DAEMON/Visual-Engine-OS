import { describe, expect, it } from 'vitest';
import { darken, lighten, luminance, mix, parseHex } from '../src/core/color';

describe('color', () => {
  it('parse et valide', () => {
    expect(parseHex('#ff8000')).toEqual([255, 128, 0]);
    expect(() => parseHex('#12345')).toThrow(RangeError);
    expect(() => parseHex('red')).toThrow(RangeError);
  });
  it('mix : bornes exactes', () => {
    expect(mix('#102030', '#ffffff', 0)).toBe('#102030');
    expect(mix('#102030', '#ffffff', 1)).toBe('#ffffff');
    expect(mix('#102030', '#ffffff', -5)).toBe('#102030');
    expect(mix('#102030', '#ffffff', 9)).toBe('#ffffff');
  });
  it('mix en lumière linéaire : le milieu noir/blanc est plus clair que #808080', () => {
    expect(parseHex(mix('#000000', '#ffffff', 0.5))[0]).toBeGreaterThan(0xb0);
  });
  it('lighten / darken sont monotones', () => {
    const c = '#3060a0';
    expect(luminance(lighten(c, 0.3))).toBeGreaterThan(luminance(c));
    expect(luminance(darken(c, 0.3))).toBeLessThan(luminance(c));
  });
});

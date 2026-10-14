import { describe, expect, it } from 'vitest';
import { halfVectorXY, lightVector, toLocal } from '../src/lighting/light';
import { LightSpec } from '../src/schema';

const light = (over: Partial<LightSpec>) => lightVector(LightSpec.parse(over));

describe('lightVector', () => {
  it('azimut 0° = lumière venant du haut de l\'écran (y négatif en repère SVG)', () => {
    const v = light({ azimuthDeg: 0, elevationDeg: 45 });
    expect(v.x).toBeCloseTo(0, 9);
    expect(v.y).toBeLessThan(0);
    expect(v.z).toBeCloseTo(Math.SQRT1_2, 9);
  });
  it('azimut 90° = droite, 180° = bas, 270° = gauche', () => {
    expect(light({ azimuthDeg: 90 }).x).toBeGreaterThan(0);
    expect(light({ azimuthDeg: 180 }).y).toBeGreaterThan(0);
    expect(light({ azimuthDeg: 270 }).x).toBeLessThan(0);
  });
  it('est unitaire', () => {
    const v = light({ azimuthDeg: 123, elevationDeg: 37 });
    expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(1, 12);
  });
});

describe('toLocal', () => {
  it('objet tourné de 90° (horaire) : la lumière du haut devient -x local', () => {
    const v = toLocal(light({ azimuthDeg: 0, elevationDeg: 10 }), 90);
    expect(v.x).toBeLessThan(-0.9);
    expect(Math.abs(v.y)).toBeLessThan(1e-9);
  });
  it('préserve la norme et z', () => {
    const w = light({ azimuthDeg: 200, elevationDeg: 33 });
    const l = toLocal(w, 47);
    expect(Math.hypot(l.x, l.y, l.z)).toBeCloseTo(1, 12);
    expect(l.z).toBe(w.z);
  });
  it('rotation 0 = identité', () => {
    const w = light({ azimuthDeg: 200 });
    const l = toLocal(w, 0);
    expect(l.x).toBeCloseTo(w.x, 12);
    expect(l.y).toBeCloseTo(w.y, 12);
  });
});

describe('halfVectorXY', () => {
  it('lumière de face => reflet au centre', () => {
    const h = halfVectorXY(light({ elevationDeg: 90 }));
    expect(h.x).toBeCloseTo(0, 12);
    expect(h.y).toBeCloseTo(0, 12);
  });
  it('reste strictement dans le disque unité', () => {
    for (let az = 0; az < 360; az += 15) {
      for (const el of [10, 30, 60, 90]) {
        const h = halfVectorXY(light({ azimuthDeg: az, elevationDeg: el }));
        expect(Math.hypot(h.x, h.y)).toBeLessThan(0.7);
      }
    }
  });
});

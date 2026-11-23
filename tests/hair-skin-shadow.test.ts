import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { faceLandmarks } from '../src/face';
import { lightVector } from '../src/lighting/light';
import { renderHair } from '../src/render/face/hair';
import { skinShadowShift } from '../src/render/face/hair-skin-shadow';

/** Ombre des mèches sur la peau : elle suit la lumière (`hair-skin-shadow.ts`). La lumière de référence du schéma (azimut 330°, élévation 55°) redonne le décalage cuit : rendu historique inchangé. */
const REF = lightVector({ azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity: 1 });
const at = (azimuthDeg: number, elevationDeg: number) => lightVector({ azimuthDeg, elevationDeg, color: '#ffffff', intensity: 1 });

describe('skinShadowShift', () => {
  it('lumière de référence : translation nulle (le décalage cuit est déjà le bon)', () => {
    for (const [W, H] of [[300, 300], [300, 400], [120, 90]] as const) { const s = skinShadowShift(REF, W, H); expect(Math.abs(s.x)).toBeLessThan(1e-9); expect(Math.abs(s.y)).toBeLessThan(1e-9); }
  });
  it('l\'ombre tombe à l\'opposé de la lumière : lumière à droite → ombre à gauche, lumière en bas → ombre en haut', () => {
    const right = skinShadowShift(at(90, 55), 300, 400); const left = skinShadowShift(at(270, 55), 300, 400); const below = skinShadowShift(at(180, 55), 300, 400);
    const baked = { x: 0.006 * 300, y: 0.011 * 400 };
    expect(right.x + baked.x).toBeLessThan(0); expect(left.x + baked.x).toBeGreaterThan(0); expect(below.y + baked.y).toBeLessThan(0);
  });
  it('lumière rasante : ombre plus longue qu\'à 70° ; lumière de face : ombre plus courte, jamais NaN', () => {
    const len = (e: number): number => { const s = skinShadowShift(at(90, e), 300, 400); return Math.hypot(s.x + 0.006 * 300, s.y + 0.011 * 400); };
    expect(len(15)).toBeGreaterThan(len(55)); expect(len(55)).toBeGreaterThan(len(75)); expect(Number.isFinite(len(90))).toBe(true); expect(len(90)).toBeLessThan(len(55));
    const n = skinShadowShift({ x: 0, y: 0, z: 1 }, 300, 400); expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true);
  });
});

describe('rendu : le groupe d\'ombres de peau est déplacé selon la lumière', () => {
  const f = generateRandomFace(321, { identity: 3, hairEngine: 'classic', hair: { style: 'short', texture: 'straight', color: '#23232b', seed: 5, volume: 0.5, density: 0.85, part: 0.2, sim: { enabled: true, archetype: 'side_sweep', skinShadow: 0.6 } } } as never);
  const lm = faceLandmarks(f.params, f.width, f.height);
  const front = (L: ReturnType<typeof lightVector>): string => renderHair('t', f.params, lm, L, 0, '#6b4a3a', '#e8b89a').front.join('');
  it('lumière de référence : aucun transform sur le groupe ; lumière à droite : un transform vers la gauche', () => {
    const a = front(REF); const b = front(at(90, 55));
    expect(a).toContain('t-hair-skin-blur'); expect(a).not.toMatch(/filter="url\(#t-hair-skin-blur\)"[^>]*transform=/);
    const m = /filter="url\(#t-hair-skin-blur\)"[^>]*transform="translate\((-?[\d.]+) (-?[\d.]+)\)"/.exec(b); expect(m).not.toBeNull(); expect(Number(m![1])).toBeLessThan(0);
  });
});

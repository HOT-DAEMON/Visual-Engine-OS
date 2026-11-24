import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { faceLandmarks } from '../src/face';
import { lightVector } from '../src/lighting/light';
import { renderHair } from '../src/render/face/hair';

/** Le reflet global des cheveux (moteur principal) est proportionnel à la lumière directrice : `intensityFor(L, 'hair')` (docs/HAIR-PASS6.md). Lumière de référence = rendu historique, au bit près. */
const mk = (intensity: number, hair = 1) => lightVector({ azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity, influence: { skin: 1, hair, eyes: 1, lips: 1, metal: 1 } });
const f = generateRandomFace(321, { identity: 3, hairEngine: 'classic', hair: { style: 'long', texture: 'straight', color: '#23232b', seed: 5, volume: 0.5, density: 0.85, part: 0.2 } } as never);
const lm = faceLandmarks(f.params, f.width, f.height);
const out = (L: ReturnType<typeof mk>) => { const r = renderHair('t', f.params, lm, L, 0, '#6b4a3a', '#e8b89a'); return { defs: r.defs.join(''), front: r.front.join('') }; };
const alpha = (s: string): number | undefined => { const m = /id="t-hair-gloss"[^>]*>(?:<stop[^>]*>)*?<stop[^>]*stop-opacity="([\d.]+)"/.exec(s); return m ? Number(m[1]) : undefined; };

describe('reflet global des cheveux et lumière', () => {
  const ref = out(mk(1)); const a1 = alpha(ref.defs);
  it('le reflet existe à la lumière de référence (sinon le test ne prouve rien)', () => { expect(a1).toBeDefined(); expect(a1 as number).toBeGreaterThan(0); });
  it('demi-intensité : opacité du reflet divisée par deux', () => { expect(alpha(out(mk(0.5)).defs) as number).toBeCloseTo((a1 as number) / 2, 2); });
  it('influence de la classe « hair » à 0,25 : quart d\'opacité ; l\'influence des autres classes ne compte pas', () => {
    expect(alpha(out(mk(1, 0.25)).defs) as number).toBeCloseTo((a1 as number) / 4, 2);
    expect(alpha(out(lightVector({ azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity: 1, influence: { skin: 0, hair: 1, eyes: 0, lips: 0, metal: 0 } })).defs)).toBe(a1);
  });
  it('lumière éteinte : aucun reflet global', () => { expect(out(mk(0)).defs).not.toContain('t-hair-gloss"'); });
  it('plus intense que la référence : pas d\'amplification (borne à 1, comme les autres composants)', () => { expect(alpha(out(mk(2)).defs)).toBe(a1); });
});

import { describe, expect, it } from 'vitest';
import { Resvg } from '@resvg/resvg-js';
import { compileScene } from '../src';
import { EyeSpec } from '../src/schema';
import { generateExtraEye } from '../src/generation/eye-gallery-ext';
import { eyeLevers, effectiveFinish, NEUTRAL_LEVERS } from '../src/render/eye/appearance-levers';

/** PASSE 20 — les six leviers d'apparence de l'œil sont lus et se VOIENT (rastérisation resvg), et l'œil sans levier est identique à l'octet. */
const W = 400, H = 280;
const eye = (extra: Record<string, unknown> = {}, ap?: Record<string, unknown>): Record<string, unknown> => ({ kind: 'eye', id: 'e', shape: { width: 240, height: 130 }, ...extra, ...(ap ? { appearance: ap } : {}) });
const svgOf = (e: Record<string, unknown>, light?: Record<string, number>, scale = 1): string => { const r = compileScene({ width: W, height: H, background: '#d9b8a0', ...(light ? { light } : {}), objects: [{ kind: 'eye', id: 'z', transform: { x: 200, y: 140, scale }, ...e }] } as never) as { ok: boolean; svg: string; issues?: string[] }; if (!r.ok) throw new Error((r.issues ?? []).join('\n')); return r.svg; };
const px = (svg: string): Uint8Array => new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().pixels as unknown as Uint8Array;
const changed = (a: Uint8Array, b: Uint8Array): number => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!) > 24) n++; return n; };
const luma = (a: Uint8Array): number => { let s = 0, n = 0; for (let i = 0; i < a.length; i += 4) { s += 0.2126 * a[i]! + 0.7152 * a[i + 1]! + 0.0722 * a[i + 2]!; n++; } return s / n; };

describe('leviers d’apparence de l’œil (passe 20)', () => {
  it('neutres : apparence absente, `{}` ou valeurs par défaut → mêmes leviers, SVG identique à l’octet', () => {
    expect(eyeLevers(EyeSpec.parse(eye()))).toEqual(NEUTRAL_LEVERS);
    expect(eyeLevers(EyeSpec.parse(eye({}, {})))).toEqual(NEUTRAL_LEVERS);
    expect(svgOf(eye({}, { reflection: { intensity: 0.5, size: 0.5 }, opacity: 1, shading: { mode: 'smooth', castShadow: 0, highlightBand: 0 } }))).toBe(svgOf(eye({}, {})));
  });
  it('opacity : l’œil devient translucide (le fond reparaît), 1 = inchangé', () => {
    const full = px(svgOf(eye({}, { opacity: 1 }))), half = px(svgOf(eye({}, { opacity: 0.4 })));
    expect(changed(full, half)).toBeGreaterThan(3000);
  });
  it('reflection.intensity / size : le reflet s’éteint ou grandit (mêmes conventions que la peau, 0,5 = neutre)', () => {
    const base = px(svgOf(eye({}, { reflection: { intensity: 0.5, size: 0.5 } })));
    expect(changed(base, px(svgOf(eye({}, { reflection: { intensity: 0.05, size: 0.5 } }))))).toBeGreaterThan(150);
    expect(changed(base, px(svgOf(eye({}, { reflection: { intensity: 0.5, size: 1 } }))))).toBeGreaterThan(150);
    expect(changed(base, px(svgOf(eye({}, { reflection: { intensity: 0.5, size: 0.05 } }))))).toBeGreaterThan(150);
  });
  it('reflection suit aussi la liste de reflets détaillés (highlights.list)', () => {
    const list = { highlights: { list: [{ kind: 'reflection', role: 'primary', shape: 'circle', size: 0.3, opacity: 1 }] } };
    expect(changed(px(svgOf(eye(list, { reflection: { intensity: 0.5, size: 0.5 } }))), px(svgOf(eye(list, { reflection: { intensity: 0.5, size: 1 } }))))).toBeGreaterThan(150);
  });
  it('shading.castShadow : l’ombre des paupières s’approfondit (plus sombre), en `shaded` comme en `cel`', () => {
    for (const finish of ['shaded', 'cel']) {
      const a = px(svgOf(eye({ finish }, { shading: { castShadow: 0 } }))), b = px(svgOf(eye({ finish }, { shading: { castShadow: 1 } })));
      expect(luma(b)).toBeLessThan(luma(a) - 0.05); expect(changed(a, b)).toBeGreaterThan(100);
    }
  });
  it('shading.highlightBand : un croissant de lumière paraît sur l’iris, du côté de la lumière ; sa largeur croît avec la valeur', () => {
    const none = px(svgOf(eye({ finish: 'flat' }, { shading: { highlightBand: 0 } })));
    const thin = changed(none, px(svgOf(eye({ finish: 'flat' }, { shading: { highlightBand: 0.3 } }))));
    const wide = changed(none, px(svgOf(eye({ finish: 'flat' }, { shading: { highlightBand: 1 } }))));
    expect(thin).toBeGreaterThan(40); expect(wide).toBeGreaterThan(thin * 1.5);   // croissant fin (0,3) puis large (1) : l'aire croît
    // le côté suit la lumière : azimuts opposés → croissants différents
    const l1 = px(svgOf(eye({ finish: 'flat' }, { shading: { highlightBand: 1 } }), { azimuthDeg: 40 })), l2 = px(svgOf(eye({ finish: 'flat' }, { shading: { highlightBand: 1 } }), { azimuthDeg: 220 }));
    expect(changed(l1, l2)).toBeGreaterThan(300);   // (la zone lavée change de côté avec la lumière ; voir le test suivant pour la disjonction)
  });
  it('la bande est un CROISSANT : deux lumières opposées lavent des zones disjointes', () => {
    const mk = (az: number, band: number): Uint8Array => px(svgOf(eye({ finish: 'flat' }, { shading: { highlightBand: band } }), { azimuthDeg: az }));
    const a = mk(40, 0.5), b = mk(220, 0.5), na = mk(40, 0), nb = mk(220, 0); let both = 0, either = 0;
    for (let i = 0; i < a.length; i += 4) { const ca = Math.abs(a[i]! - na[i]!) > 12, cb = Math.abs(b[i]! - nb[i]!) > 12; if (ca && cb) both++; if (ca || cb) either++; }
    expect(either).toBeGreaterThan(300); expect(both / either).toBeLessThan(0.05);   // mesuré : 0,00
  });
  it('non-régression œil de galerie 9 (grosse iris, groupe filtré) : pas de lavis, et pas de zone morte en bas de plage', () => {
    const { transform: _t, place: _p, appearance: _a, ...rest } = generateExtraEye(9) as Record<string, unknown>;
    const g9 = (b: number): Uint8Array => px(svgOf({ ...rest, eyebrow: null, appearance: { shading: { highlightBand: b } } }, undefined, 1.9));
    const none = g9(0), c = (b: number): number => changed(none, g9(b));
    const irisPx = Math.PI * 83.99 * 88.78 * 1.9 * 1.9;   // aire de l'iris en pixels
    // mesuré : 501 / 1 090 / 4 173 px. Avant correction : 0 px à 0,2 (croissant vide) ; un rectangle trop grand dans le groupe filtré lavait ~17 000 px à 1.
    expect(c(0.2)).toBeGreaterThan(200); expect(c(0.4)).toBeGreaterThan(c(0.2)); expect(c(1)).toBeGreaterThan(c(0.4));
    expect(c(1)).toBeLessThan(0.12 * irisPx);
  });
  it('shading.mode cel : un œil `shaded` devient `cel` (aplats, 0 dégradé) ; un fini explicite n’est jamais écrasé', () => {
    expect(effectiveFinish(EyeSpec.parse(eye({}, { shading: { mode: 'cel' } })))).toBe('cel');
    expect(effectiveFinish(EyeSpec.parse(eye({ finish: 'flat' }, { shading: { mode: 'cel' } })))).toBe('flat');
    expect(effectiveFinish(EyeSpec.parse(eye({}, { shading: { mode: 'smooth' } })))).toBe('shaded');
    const grads = (s: string): number => (s.match(/<(radialGradient|linearGradient|filter)\b/g) ?? []).length;
    expect(grads(svgOf(eye({}, { shading: { mode: 'cel' } })))).toBeLessThan(grads(svgOf(eye({}, { shading: { mode: 'smooth' } }))));
    expect(svgOf(eye({}, { shading: { mode: 'cel' } }))).toBe(svgOf(eye({ finish: 'cel' })));
  });
});

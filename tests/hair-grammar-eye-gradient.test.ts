import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { eyeInk, grayscaleSvg, type EyeSlot } from '../src/hair-grammar/eye-slot';
import type { RibbonProfile } from '../src/hair-grammar/ribbon';
import { GRADIENT_MIN_GRAY, ribbonScene } from '../src/hair-grammar/ribbon-scene';

const P = JSON.parse(readFileSync('src/hair-grammar/profiles/side_sweep.ribbons.json', 'utf8')) as RibbonProfile;
const VIEW = { w: 142, h: 150, px: 2 };

describe('grayscaleSvg', () => {
  it('convertit hex6, hex3 et rgb() en gris de même luminance, sans toucher au reste', () => {
    expect(grayscaleSvg('<a fill="#ff0000"/>')).toBe('<a fill="#4c4c4c"/>');
    expect(grayscaleSvg('<a fill="#fff" stroke="#000"/>')).toBe('<a fill="#ffffff" stroke="#000000"/>');
    expect(grayscaleSvg('<a fill="rgb(0,255,0)"/>')).toBe('<a fill="rgb(150,150,150)"/>');
    expect(grayscaleSvg('<a opacity="0.5" fill="none"/>')).toBe('<a opacity="0.5" fill="none"/>');
  });
});

describe('place d\'œil (moteur d\'yeux réel)', () => {
  const slot = P.eyeSlot as EyeSlot;
  it('le profil 02 porte une place d\'œil et des rubans de rôle eye', () => {
    expect(slot).toBeDefined();
    expect(P.ribbons.some((r) => r.role === 'eye')).toBe(true);
  });
  it('est déterministe, entièrement en gris, et borné par le cadre de découpe', () => {
    const a = eyeInk(slot); const b = eyeInk(slot);
    expect(a).toEqual(b);
    const colors = [...(a.defs + a.markup).matchAll(/#([0-9a-f]{6})\b/g)].map((m) => m[1] as string);
    expect(colors.length).toBeGreaterThan(5);
    for (const c of colors) expect(c.slice(0, 2) === c.slice(2, 4) && c.slice(2, 4) === c.slice(4, 6), c).toBe(true);
    expect(a.markup).toContain('clip-path="url(#eyeslot-clip)"');
  });
  it('remplace l\'encre tracée de l\'œil : sans place d\'œil, la trace est conservée', () => {
    const withEye = ribbonScene(P, VIEW);
    const { eyeSlot: _drop, ...bare } = P;
    const traced = ribbonScene(bare as RibbonProfile, VIEW);
    expect(withEye).toContain('eyeslot-clip');
    expect(traced).not.toContain('eyeslot-clip');
    expect(traced.length).not.toBe(withEye.length);
  });
});

describe('dégradé le long des rubans', () => {
  it('seuls les rubans au gris mesuré clair reçoivent un dégradé ; chaque dégradé est défini et référencé', () => {
    const svg = ribbonScene(P, VIEW);
    const defined = [...svg.matchAll(/<linearGradient id="(rg\d+)"/g)].map((m) => m[1] as string);
    const used = [...svg.matchAll(/fill="url\(#(rg\d+)\)"/g)].map((m) => m[1] as string);
    expect(defined.length).toBeGreaterThan(5);
    expect(new Set(used)).toEqual(new Set(defined));
    const expected = P.ribbons.filter((r) => r.role !== 'eye' && r.g && Math.max(...r.g) > GRADIENT_MIN_GRAY).length;
    expect(defined.length).toBeLessThanOrEqual(expected);
  });
  it('un profil sans gris mesuré (cellule 01) se rend sans aucun dégradé', () => {
    const P1 = JSON.parse(readFileSync('src/hair-grammar/profiles/tousled.ribbons.json', 'utf8')) as RibbonProfile;
    expect(ribbonScene(P1, { w: 156, h: 150, px: 2 })).not.toContain('linearGradient');
  });
  it('tous les gris mesurés sont dans [0, 255] et alignés sur les points', () => {
    for (const r of P.ribbons) { if (!r.g) continue; expect(r.g.length).toBe(r.p.length); for (const v of r.g) expect(v >= 0 && v <= 255).toBe(true); }
  });
});

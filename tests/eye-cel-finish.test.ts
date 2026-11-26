import { describe, expect, it } from 'vitest';
import { Resvg } from '@resvg/resvg-js';
import { compileScene } from '../src';
import { extraEyeRecipes, generateExtraEye } from '../src/generation/eye-gallery-ext';
import { EyeSpec } from '../src/schema';
import { hasCastShadow, isFlat } from '../src/render/eye/flat-finish';
import { eyeToneShare } from '../scripts/lib/verify-eye-render';

/** PASSE 19 — fini `cel` : `flat` + ombre portée des paupières en aplat à bord dur (réf. 01). */
const PLAIN = { kind: 'eye', id: 'e', shape: { width: 240, height: 130 } } as Record<string, unknown>;
const build = (finish: string, light?: Record<string, number>) => { const r = compileScene({ width: 400, height: 280, background: '#ffffff', ...(light ? { light } : {}), objects: [{ transform: { x: 200, y: 140 }, ...PLAIN, finish }] } as never) as { ok: boolean; svg: string; issues?: string[] }; if (!r.ok) throw new Error((r.issues ?? []).join('\n')); return r.svg; };
const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;
const meanLuma = (svg: string): number => { const px = new Resvg(svg, { fitTo: { mode: 'width', value: 400 } }).render().pixels as unknown as Uint8Array; let sum = 0, n = 0; for (let y = 90; y < 190; y++) for (let x = 120; x < 280; x++) { const i = (y * 400 + x) * 4; sum += 0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!; n++; } return sum / n; };

describe('fini cel', () => {
  it('le schéma accepte shaded / flat / cel et refuse le reste ; isFlat vaut pour flat ET cel, l’ombre portée pour cel seul', () => {
    for (const f of ['shaded', 'flat', 'cel']) expect(EyeSpec.parse({ ...PLAIN, finish: f }).finish).toBe(f);
    expect(() => EyeSpec.parse({ ...PLAIN, finish: 'painted' })).toThrow();
    expect([isFlat({ finish: 'shaded' }), isFlat({ finish: 'flat' }), isFlat({ finish: 'cel' })]).toEqual([false, true, true]);
    expect([hasCastShadow({ finish: 'shaded' }), hasCastShadow({ finish: 'flat' }), hasCastShadow({ finish: 'cel' })]).toEqual([false, false, true]);
  });

  it('cel = flat + UN tracé d’ombre à bord dur : aucun dégradé ni filtre en plus, exactement un évenodd en plus', () => {
    const flat = build('flat'), cel = build('cel'), shaded = build('shaded');
    const grad = (s: string): number => count(s, /<(radialGradient|linearGradient|filter)\b/g);
    expect(grad(flat)).toBe(0); expect(grad(cel)).toBe(0); expect(grad(shaded)).toBeGreaterThan(5);
    expect(count(cel, /fill-rule="evenodd"/g)).toBe(count(flat, /fill-rule="evenodd"/g) + 1);
  });

  it('l’ombre est CONSOMMÉE à l’image : l’œil cel est plus sombre que le même œil flat (luminance moyenne de l’ouverture)', () => {
    expect(meanLuma(build('cel'))).toBeLessThan(meanLuma(build('flat')) - 3);   // mesuré : 161,8 → 153,5 ; une ombre assombrit TOUJOURS (peinte de la couleur de la peau, elle éclaircissait les surfaces sombres)
  });

  it('la direction de la lumière déplace le tracé de l’ombre (le croissant suit la lumière de la scène) ; sans fini cel il n’y a pas de tracé à déplacer', () => {
    const shadowD = (svg: string): string => (svg.match(/<path d="([^"]+)"[^>]*fill-rule="evenodd"[^>]*fill-opacity="0\.4"/) ?? [])[1] ?? '';
    const a = shadowD(build('cel')), b = shadowD(build('cel', { azimuthDeg: 60 })), c = shadowD(build('cel', { azimuthDeg: 200 }));
    expect(a).not.toBe(''); expect(new Set([a, b, c]).size).toBe(3);
    expect(shadowD(build('flat'))).toBe('');
  });

  it('reste un style d’aplats : sans dégradé, et bien moins de tons intermédiaires que shaded (mesuré : cel 0,11 · shaded 0,39 · flat 0) ; 0 sur l’œil d’encre de la galerie', () => {
    // `toneShare` tolère 3 tons dominants : l’ombre dure en ajoute légitimement (sclère et iris ombrés) — d’où cel > 0, mais cel < la moitié de shaded.
    const cel = eyeToneShare({ ...PLAIN, finish: 'cel' }), shaded = eyeToneShare({ ...PLAIN, finish: 'shaded' });
    expect(cel).toBeLessThanOrEqual(0.15); expect(cel).toBeLessThan(shaded / 2);
    const ink = extraEyeRecipes().filter((r) => r.ref && !r.ref.startsWith('15-')).map((r) => r.index)[0]!;
    expect(eyeToneShare({ ...(generateExtraEye(ink) as Record<string, unknown>), finish: 'cel' })).toBeLessThanOrEqual(0.02);
  });
});

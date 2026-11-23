import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { compileScene } from '../src';
import { mulberry32 } from '../src/core/prng';
import { EXTRA4_COUNT, generateExtra4Eye } from '../src/generation/eye-gallery-ext4';
import { applyIrisPreset, extra2Recipes, generateExtra2Eye } from '../src/generation/eye-gallery-ext2';
import { PHOTO2_IRIS_FAMILIES, PHOTO2_IRIS_MEASURES, photoIrisFamily2 } from '../src/generation/eye-iris-families-photo2';
import { pupilOccludedByStar } from '../src/geometry/eye';
import { quantizeBlur } from '../src/render/eye/highlights-render';
import { verifyEye } from '../src/verify/eye';
import { atomMetrics } from '../scripts/lib/eye-iris-atoms';
import { irisTone } from '../scripts/lib/eye-iris-tone';

/**
 * Passe 14 : (1) filtres de reflets partagés (budget SVG), (2) règle `pupil-darker-than-iris` alignée sur la règle de pixels (pupille noyée dans une étoile centrée),
 * (3) famille emerald recalibrée sur la réf. 07 (vide interne resserré, 36 facettes). Chaque changement est prouvé sur le SVG, les pixels ou les mesures.
 */
const T = JSON.parse(readFileSync('references/eyes/measures-iris-photos.json', 'utf8')).eyes as { id: string; tone: { darkShare: number; lumMean: number } }[];
const A = JSON.parse(readFileSync('references/eyes/measures-iris-atoms.json', 'utf8')).eyes as Record<string, any>;
const baseIdx = extra2Recipes().findIndex((r) => r.style === 'almond' && r.irisFamily === null);
const eyeOf = (f: (typeof PHOTO2_IRIS_FAMILIES)[number], patch?: (e: any) => void): any => { const i = PHOTO2_IRIS_FAMILIES.indexOf(f); const e: any = applyIrisPreset(generateExtra2Eye(baseIdx) as never, photoIrisFamily2(f, mulberry32(7 + i)), 'almond', false); patch?.(e); return e; };
const scene = (e: any): string => { const r: any = compileScene({ width: 700, height: 460, background: '#ff00ff', objects: [{ kind: 'eye', id: 'e', transform: { x: 350, y: 230 }, ...e, eyebrow: null }] } as never); if (!r.ok) throw new Error(r.issues.join('\n')); return r.svg as string; };
const filterCount = (svg: string): number => (svg.match(/<filter /g) ?? []).length;

describe('flous de reflets partagés (budget de filtres)', () => {
  it('quantizeBlur : erreur relative ≤ 2,5 %, idempotente, 0 reste 0', () => {
    for (const s of [0.4, 1.262, 2.082, 2.397, 10.815, 22.711]) { const q = quantizeBlur(s); expect(Math.abs(q - s) / s).toBeLessThanOrEqual(0.0251); expect(quantizeBlur(q)).toBeCloseTo(q, 9); }
    expect(quantizeBlur(0)).toBe(0);
  });
  it('les 5 familles photo 2 tiennent dans le budget de 14 filtres (ice 18 et emerald 15 avant la passe)', () => {
    for (const f of PHOTO2_IRIS_FAMILIES) expect(filterCount(scene(eyeOf(f))), f).toBeLessThanOrEqual(14);
    expect(filterCount(scene(eyeOf('ice-star')))).toBeLessThan(18);
  });
  it('deux éclats de même taille et même douceur partagent UN filtre ; chaque filtre de reflet est utilisé', () => {
    const e = eyeOf('ice-star', (x) => { x.highlights = { ...x.highlights, list: [0.1, -0.1].map((dy) => ({ shape: 'sparkle', anchor: 'iris', x: 0.3, y: dy, size: 0.2, softness: 0.4, intensity: 0, confine: 'iris' })) }; });
    const svg = scene(e);
    const ids = [...svg.matchAll(/<filter id="([^"]*-hl-(?:glow|soft)\d+)"/g)].map((m) => m[1] as string);
    expect(ids.length).toBe(1);
    expect((svg.match(new RegExp(`filter="url\\(#${ids[0]}\\)"`, 'g')) ?? []).length).toBe(2);
    for (const f of PHOTO2_IRIS_FAMILIES) { const s = scene(eyeOf(f)); for (const m of s.matchAll(/<filter id="([^"]*-hl-(?:glow|soft)\d+)"/g)) expect(s.includes(`url(#${m[1]})`), `${f} ${m[1]}`).toBe(true); }
  });
});

describe('pupil-darker-than-iris : même exemption que la règle de pixels', () => {
  const star = (e: any): void => { e.pupil.size = 0.3; e.highlights = { ...e.highlights, list: [{ shape: 'sparkle', anchor: 'iris', x: 0, y: 0, size: 0.4, intensity: 0, softness: 0, confine: 'iris' }] }; };
  const lightPupil = (e: any): void => { e.pupil.fill = { type: 'solid', color: '#e8e8e8' }; e.highlights = { ...e.highlights, list: [] }; };
  const rule = (e: any): any => (verifyEye(e).checks as any[]).find((c) => c.id === 'pupil-darker-than-iris');
  it('pupilOccludedByStar : étoile ancrée à l’iris, centrée dans la pupille, au moins aussi grande', () => {
    const base = { pupil: { size: 0.3 } };
    expect(pupilOccludedByStar({ ...base, highlights: { list: [{ shape: 'sparkle', anchor: 'iris', x: 0, y: 0.1, size: 0.3 }] } })).toBe(true);
    expect(pupilOccludedByStar({ ...base, highlights: { list: [{ shape: 'sparkle', anchor: 'iris', x: 0, y: 0.1, size: 0.2 }] } })).toBe(false);   // trop petite
    expect(pupilOccludedByStar({ ...base, highlights: { list: [{ shape: 'sparkle', anchor: 'iris', x: 0.5, y: 0, size: 0.5 }] } })).toBe(false);   // décentrée
    expect(pupilOccludedByStar({ ...base, highlights: { list: [{ shape: 'circle', anchor: 'iris', x: 0, y: 0, size: 0.5 }] } })).toBe(false);      // pas une étoile
  });
  it('pupille noyée dans une étoile : règle non évaluée ; sans étoile, une pupille plus claire que l’iris échoue toujours (contre-exemple)', () => {
    expect(rule(eyeOf('emerald-facets', star))).toBeUndefined();
    const c = rule(eyeOf('emerald-facets', lightPupil)); expect(c).toBeDefined(); expect(c.ok).toBe(false);
  });
  it('galerie 4 : plus aucun avertissement `pupil-darker-than-iris` (30 sur 100 avant la passe, tous des étoiles centrées)', () => {
    let warned = 0; for (let i = 0; i < EXTRA4_COUNT; i += 2) { const e = generateExtra4Eye(i) as any; const c = rule(e); if (c && !c.ok) warned++; if (c && !c.ok) expect(pupilOccludedByStar(e), `œil ${i}`).toBe(false); }
    expect(warned).toBe(0);
  }, 180_000);
});

describe('emerald-facets (réf. 07) recalibrée', () => {
  const ref = T.find((e) => e.id === PHOTO2_IRIS_MEASURES['emerald-facets'].ref)!.tone; const cellsRef = A[PHOTO2_IRIS_MEASURES['emerald-facets'].ref].cells;
  const dark = (e: any): number => { const px = new Resvg(scene(e), { fitTo: { mode: 'width', value: 700 } }).render().pixels as unknown as Uint8Array; let n = 0; for (let i = 0; i < px.length; i += 4) if (0.2126 * (px[i] as number) + 0.7152 * (px[i + 1] as number) + 0.0722 * (px[i + 2] as number) < 40) n++; return n; };
  it('part sombre à ± 0,03 de la référence (avant : 0,167 pour 0,101), luminance à ± 10, cellules entre 80 et 2 × la référence (avant : 50)', () => {
    const e = eyeOf('emerald-facets'); const t = irisTone(e as never); const m = atomMetrics(e).cells;
    expect(Math.abs(t.darkShare - ref.darkShare)).toBeLessThanOrEqual(0.03); expect(Math.abs(t.lumMean - ref.lumMean)).toBeLessThanOrEqual(10);
    expect(m.count).toBeGreaterThanOrEqual(80); expect(m.count).toBeLessThanOrEqual(cellsRef.count * 2);
  }, 60_000);
  it('voids[0].outer est LU : un vide interne large (0,34) noircit plus de pixels que le vide resserré (0,22)', () => {
    const wide = eyeOf('emerald-facets', (e) => { e.iris.detail.voids[0].outer = 0.34; });
    expect(dark(wide)).toBeGreaterThan(dark(eyeOf('emerald-facets')));
  }, 60_000);
  it('facets.count est LU : 36 facettes donnent plus de cellules que 20', () => {
    const few = eyeOf('emerald-facets', (e) => { e.iris.detail.facets.count = 20; });
    expect(atomMetrics(eyeOf('emerald-facets')).cells.count).toBeGreaterThan(atomMetrics(few).cells.count);
  }, 60_000);
});

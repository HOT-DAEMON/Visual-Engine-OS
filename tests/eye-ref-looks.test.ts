import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LID_LINE_OVER_WIDTH, REF_NATURAL, SPRITE_HIGHLIGHTS, SPRITE_IRIS_OVER_HEIGHT, SPRITE_TALL, applyLook, normaliseSclera } from '../src/generation/eye-ref-looks';
import { EXTRA_EYE_COUNT, extraEyeRecipes, generateExtraEye } from '../src/generation/eye-gallery-ext';
import { openingGeometry, openingProfile } from '../src/geometry/eye';
import { irisRadii } from '../src/render/eye/helpers';
import { resolveEye } from '../src/render/eye/eye';
import { EyeSpec } from '../src/schema';

const M = JSON.parse(readFileSync('references/eyes/measures.json', 'utf8')).eyes as Record<string, { sclera: { top: string; mid: string; bottom: string }; skin: { mean: string }; upperLidLineThicknessOverWidth: number }>;
const S = JSON.parse(readFileSync('references/eyes/measures-sprites.json', 'utf8')).sprites15 as Record<string, { irisAspect: number; irisHOverOpeningH: number; pupilWOverIrisW: number; irisTop: string; irisBottom: string }>;
const lum = (h: string): number => 0.2126 * parseInt(h.slice(1, 3), 16) + 0.7152 * parseInt(h.slice(3, 5), 16) + 0.0722 * parseInt(h.slice(5, 7), 16);

describe('looks issus des références mesurées', () => {
  it('REF_NATURAL reprend EXACTEMENT les palettes de sclère et de peau de measures.json', () => {
    for (const p of REF_NATURAL) { expect(p.top).toBe(M[p.id]!.sclera.top); expect(p.mid).toBe(M[p.id]!.sclera.mid); expect(p.bottom).toBe(M[p.id]!.sclera.bottom); expect(p.skin).toBe(M[p.id]!.skin.mean); }
  });
  it('plage d’épaisseur du trait de paupière = les deux photos où elle est mesurable', () => {
    expect([M['04']!.upperLidLineThicknessOverWidth, M['10a']!.upperLidLineThicknessOverWidth]).toEqual([...LID_LINE_OVER_WIDTH]);
  });
  it('SPRITE_TALL et SPRITE_IRIS_OVER_HEIGHT reprennent measures-sprites.json (rangées 1–2, paires cohérentes)', () => {
    expect(S['15-00']!.irisAspect).toBeCloseTo(S['15-01']!.irisAspect, 1); expect(S['15-02']!.irisAspect).toBeCloseTo(S['15-03']!.irisAspect, 1);
    expect(SPRITE_TALL[0].irisAspect).toBeCloseTo((S['15-00']!.irisAspect + S['15-01']!.irisAspect) / 2, 1);
    expect(SPRITE_TALL[0].top).toBe(S['15-00']!.irisTop); expect(SPRITE_TALL[1].bottom).toBe(S['15-02']!.irisBottom);
    const hs = [0, 1, 2, 3].map((i) => S[`15-0${i}`]!.irisHOverOpeningH); expect(SPRITE_IRIS_OVER_HEIGHT).toBeGreaterThanOrEqual(Math.min(...hs)); expect(SPRITE_IRIS_OVER_HEIGHT).toBeLessThanOrEqual(Math.max(...hs));
    expect(SPRITE_HIGHLIGHTS.primary.size).toBeGreaterThan(SPRITE_HIGHLIGHTS.secondary.size);
  });
  it('normaliseSclera : teinte conservée, milieu à 0,93, aucune bande sous le plancher d’ombre', () => {
    for (const p of REF_NATURAL) { const [t, m, b] = normaliseSclera(p); expect(lum(m)).toBeGreaterThan(0.9 * 255); for (const c of [t, m, b]) expect(lum(c)).toBeGreaterThanOrEqual(0.72 * 255 - 3); expect(lum(t)).toBeLessThanOrEqual(lum(m) + 1); }
  });
  it('applyLook natural : dégradé de sclère à 3 bandes, peau mesurée, trait fin ; graphic : œil inchangé', () => {
    const base = generateExtraEye(40) as any; const rnd = (): number => 0.5;
    const n = applyLook(base, 'natural', rnd, 0.55) as any;
    expect(n.sclera.base.type).toBe('linear'); expect(n.sclera.base.stops).toHaveLength(3); expect(REF_NATURAL.map((p) => p.skin)).toContain(n.skin.base.color);
    expect(n.lids.thickness).toBeGreaterThanOrEqual(0.01); expect(n.lids.thickness).toBeLessThan(0.06);
    expect(applyLook(base, 'graphic', rnd, 0.55)).toBe(base);
  });
  it('les silhouettes mesurées (réf. 15-A / 15-B) donnent des yeux sprite : iris ovale 1,49, ≈ 0,88 de la hauteur d’ouverture, pupille ronde large', () => {
    const rc = extraEyeRecipes(); const idx = rc.filter((r) => r.ref === '15-A' || r.ref === '15-B').map((r) => r.index); expect(idx.length).toBeGreaterThanOrEqual(1);
    for (const i of idx) {
      const e = generateExtraEye(i) as any; expect(e.iris.aspect).toBeCloseTo(1.49, 1); expect(e.pupil.shape).toBe('round'); expect(e.pupil.size).toBeGreaterThanOrEqual(0.45);
      const spec = resolveEye(EyeSpec.parse(e)); const g = openingGeometry(spec.shape, spec.canthi); const openH = openingProfile(g).aspect * g.w; const ratio = (2 * irisRadii(spec).ry) / openH;
      expect(ratio).toBeGreaterThan(0.78); expect(ratio).toBeLessThan(0.95);
    }
  });
  it('les yeux d’encre (réfs 13 / 17) ont la sclère blanche, un gros trait de paupière et des reflets en lentille', () => {
    const rc = extraEyeRecipes().filter((r) => r.ref && !r.ref.startsWith('15-')); expect(rc.length).toBeGreaterThanOrEqual(1);
    for (const r of rc) { const e = generateExtraEye(r.index) as any; expect(e.sclera.base.color).toBe('#ffffff'); expect(e.lids.thickness).toBeGreaterThan(0.1); expect(e.highlights.list.some((h: any) => h.shape === 'ellipse')).toBe(true); }
  });
  it('~40 % des yeux tirés (hors références) reçoivent le look naturel', () => {
    let n = 0, m = 0; for (let i = 0; i < EXTRA_EYE_COUNT; i++) { const r = extraEyeRecipes()[i]!; if (r.ref) continue; m++; if ((generateExtraEye(i) as any).sclera?.base?.type === 'linear') n++; }
    expect(n / m).toBeGreaterThan(0.25); expect(n / m).toBeLessThan(0.55);
  });
});

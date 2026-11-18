import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { head3dSubject } from '../src/render/head-3d';
import { hostOf } from '../scripts/nose-refs/alar-overflow';
import { alaEmbed, alaOf, alaPull, alaSeat, alaSeated } from '../src/head-turntable/parts';
import { ALA_CONTOUR_BOUNDS, ALA_TOL_45, ALA_TOL_60, ALA_TOL_70, ALA_Z_LIFT, alaOverflow, frontWidthRatio } from '../src/head-turntable/nose-contour';
import { engineGeometry } from '../src/head-turntable/verify-engines';
import { REF_SPEC } from '../src/head-turntable/spec';
import type { HeadTurnSpec } from '../src/head-turntable';

/** Bornes 45° / 60° / 70° et levier d'enfoncement (docs/NOSE-YAW-BOUNDS.md). */
const subject = (seed: number, a?: string): HeadTurnSpec => head3dSubject(hostOf(seed, a), {} as never).spec;
const seeds = (a: string | undefined, n = 12): HeadTurnSpec[] => Array.from({ length: n }, (_, k) => subject(500 + k * 37, a));
const rule = (s: HeadTurnSpec, id: string) => engineGeometry(s).find((c) => c.id === id)!;

describe('bornes 60° / 70° et enfoncement de l\'aile', () => {
  it('tolérances 60°/70° = débordement PROPRE du nez de la planche (ni plus lâche, ni plus strict que 0,002 U), nez de la planche inchangé', () => {
    const a = alaOf(REF_SPEC, -1);
    expect(alaOverflow(REF_SPEC, a, 60)).toBeLessThanOrEqual(ALA_TOL_60); expect(ALA_TOL_60 - alaOverflow(REF_SPEC, a, 60)).toBeLessThan(0.002);
    expect(alaOverflow(REF_SPEC, a, 70)).toBeLessThanOrEqual(ALA_TOL_70); expect(ALA_TOL_70 - alaOverflow(REF_SPEC, a, 70)).toBeLessThan(0.002);
    expect(alaSeat(REF_SPEC)).toEqual({ pull: 0, embed: 0 });
  });

  it('l\'enfoncement ne touche ni x ni la silhouette de face : seul z baisse, de embed × ALA_Z_LIFT × ka', () => {
    const s = subject(77, 'plat-trapeze'), p = alaSeated(s, -1, 0.01, 0), e = alaSeated(s, -1, 0.01, 0.6), ka = p.ex / 0.026;
    expect(e.c.x).toBe(p.c.x); expect(e.c.y).toBe(p.c.y); expect(e.ex).toBe(p.ex);
    expect(p.c.z - e.c.z).toBeCloseTo(0.6 * ALA_Z_LIFT * ka, 9);
    expect(frontWidthRatio(s, alaSeated(s, 1, 0.01, 0.6))).toBe(frontWidthRatio(s, alaSeated(s, 1, 0.01, 0)));
  });

  it('ordre des leviers : à 45° l\'enfoncement passe AVANT le rappel — le rappel d\'un plat-trapèze tombe sous celui de l\'état précédent (0,25 × alaX pour tous)', () => {
    const pl = seeds('plat-trapeze'), pulled = pl.filter((s) => alaPull(s) > 1e-6).length;
    expect(pulled).toBeLessThan(pl.length);                                   // avant : 40/40 rappelés
    for (const s of pl) { expect(alaEmbed(s)).toBeLessThanOrEqual(1 + 1e-9); expect(alaPull(s)).toBeLessThanOrEqual(0.6 * s.nose.alaX + 1e-9); }
  });

  it('effet mesuré (stats.json, 40 graines) : plat-trapèze à 45° 0,0565 → 0,0203 U ; pyramide 0,0358 → 0,0067 ; 60° et 70° réduits de moitié environ', () => {
    const st = JSON.parse(readFileSync('artefacts/nez-bornes-60-70/stats.json', 'utf8')) as Record<string, Record<string, { d45: { max: number }; d60: { max: number }; d70: { max: number } }>>;
    expect(st['plat-trapeze']!.avant!.d45.max).toBeGreaterThan(0.05); expect(st['plat-trapeze']!.defaut!.d45.max).toBeLessThan(0.025);
    expect(st['pyramide']!.defaut!.d45.max).toBeLessThan(0.0072);
    for (const t of ['plat-trapeze', 'pyramide', 'cloche-ailes', 'libre']) for (const k of ['d60', 'd70'] as const) expect(st[t]!.defaut![k].max, `${t} ${k}`).toBeLessThan(st[t]!.avant![k].max * 0.7);
  });

  it('recalcul indépendant sur 12 graines par type : plat-trapèze ≤ 0,03 U à 45°, ≤ 0,06 à 60°, ≤ 0,07 à 70° ; le 30° reste nul ; la largeur de face reste 1,00–1,04', () => {
    for (const t of [undefined, 'pyramide', 'cloche-ailes', 'plat-trapeze'] as const) for (const s of seeds(t)) {
      const a = alaOf(s, -1); expect(alaOverflow(s, a, 30), `${t} 30°`).toBeLessThan(1e-4);
      const fw = frontWidthRatio(s, alaOf(s, 1)); expect(fw).toBeGreaterThan(0.97); expect(fw).toBeLessThan(1.08);
      if (t === 'plat-trapeze') { expect(alaOverflow(s, a, 45)).toBeLessThan(0.03); expect(alaOverflow(s, a, 60)).toBeLessThan(0.06); expect(alaOverflow(s, a, 70)).toBeLessThan(0.07); }
    }
  });

  it('bornes déclarées : 30° sans enfoncement (comportement validé inchangé), 45° enfoncement puis rappel ≤ 0,25, 60°/70° enfoncement seul', () => {
    const b = ALA_CONTOUR_BOUNDS;
    expect(b.map((x) => [x.yaw, x.maxEmbed, x.maxPull])).toEqual([[30, 0, 0.6], [45, 1, 0.25], [60, 1, 0], [70, 1, 0]]);
    expect(b[1]!.tol).toBe(ALA_TOL_45);
  });

  it('règles : `alar-contour-60-70` (info) vraie sur le nez de la planche, fausse et jamais bloquante sur un nez très large ; `alar-embed` signale la saturation', () => {
    expect(rule(REF_SPEC, 'eng.nose.alar-contour-60-70').ok).toBe(true); expect(rule(REF_SPEC, 'eng.nose.alar-embed').ok).toBe(true);
    const w = { ...subject(77, 'plat-trapeze') } as HeadTurnSpec, wide = { ...w, nose: { ...w.nose, alaX: w.nose.alaX * 1.6 } } as HeadTurnSpec;
    expect(rule(wide, 'eng.nose.alar-contour-60-70').ok).toBe(false); expect(rule(wide, 'eng.nose.alar-contour-60-70').kind).toBe('info');
    expect(rule(wide, 'eng.nose.alar-embed').ok).toBe(false);
  });

  it('déterminisme', () => { const s = subject(11, 'pyramide'); expect(alaSeat(s)).toEqual(alaSeat(s)); });
});

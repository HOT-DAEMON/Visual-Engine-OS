import { describe, expect, it } from 'vitest';
import { head3dSubject } from '../src/render/head-3d';
import { hostOf, noseOverflow } from '../scripts/nose-refs/alar-overflow';
import { alaOf, alaPull, alaSeated } from '../src/head-turntable/parts';
import { alaOverflow } from '../src/head-turntable/nose-contour';
import { engineGeometry } from '../src/head-turntable/verify-engines';
import { REF_SPEC } from '../src/head-turntable/spec';
import type { HeadTurnSpec } from '../src/head-turntable';

/**
 * Ailes du nez 3D dans le contour de la joue (docs/NOSE-ALAR-SEAT.md). Têtes : graines fixes, archétype imposé.
 * Depuis l'ancrage du bord externe sur la crête (docs/NOSE-WIDTH-3D.md), les nez de ces graines ne débordent presque plus : les tests de la CONTRAINTE utilisent un nez élargi (`wide`, alaX × 1,3) et l'ancien défaut est reconstruit en décalant l'aile de `ex` (`oldAnchor`).
 */
const subject = (seed: number, a?: string): HeadTurnSpec => head3dSubject(hostOf(seed, a), {} as never).spec;
const rule = (s: HeadTurnSpec, id: string) => engineGeometry(s).find((c) => c.id === id)!;
const wide = (s: HeadTurnSpec, k: number): HeadTurnSpec => ({ ...s, nose: { ...s.nose, alaX: s.nose.alaX * k } }) as HeadTurnSpec;
const oldAnchor = (s: HeadTurnSpec) => { const a = alaSeated(s, -1, 0); return { ...a, c: { ...a.c, x: a.c.x - a.ex } }; };

describe('ailes du nez 3D : pose sur la joue et contrainte de contour', () => {
  it('le nez de la planche de référence n\'est pas modifié (aucun rappel)', () => {
    expect(alaPull(REF_SPEC)).toBe(0);
    const a = alaOf(REF_SPEC, 1), b = alaSeated(REF_SPEC, 1, 0);
    expect(a).toEqual(b);
  });

  it('la mesure analytique concorde avec la mesure par différence de rendus (±0,012 U)', () => {
    // à 45° et nez élargi (le rappel plafonné du 45°, docs/NOSE-YAW45.md, laisse un débordement résiduel > 0,01) : valeurs non nulles des deux côtés, donc comparaison non triviale
    for (const [seed, a] of [[77, 'plat-trapeze'], [11, 'pyramide']] as const) {
      const s = wide(subject(seed, a), 1.3), analytic = alaOverflow(s, alaOf(s, -1), 45), render = noseOverflow(s, 45, 300).far;
      expect(analytic).toBeGreaterThan(0.01);
      expect(Math.abs(analytic - render)).toBeLessThan(0.012);
    }
  });

  it('défaut ancien DÉTECTÉ : une aile ancrée par son centre sur la crête déborde à 30° (plat-trapèze graine 77 : ≈ 0,060 U)', () => {
    const s = subject(77, 'plat-trapeze');
    expect(alaOverflow(s, oldAnchor(s), 30)).toBeGreaterThan(0.03);
  });

  it('contrainte : débordement à 30° nul après rappel, confirmé sur le RENDU (≤ une résolution de pixel)', () => {
    const s = wide(subject(77, 'plat-trapeze'), 1.3);   // sans l'élargissement, ce nez ne déborde plus (≈ 0,0007 U) : la contrainte n'aurait rien à faire
    expect(alaOverflow(s, alaSeated(s, -1, 0), 30)).toBeGreaterThan(0.03);
    expect(alaPull(s)).toBeGreaterThan(0.02);
    expect(alaOverflow(s, alaOf(s, -1), 30)).toBeLessThan(1e-4);
    expect(noseOverflow(s, 30, 300).far).toBeLessThan(0.008);
    expect(rule(s, 'eng.nose.alar-contour').ok).toBe(true);
  });

  it('un nez libre (graines 11, 77, 1203) n\'est pas rappelé de façon visible', () => {
    for (const seed of [11, 77, 1203]) expect(alaPull(subject(seed))).toBeLessThan(0.006);
  });

  it('la règle voit la saturation : un nez bien plus large que le modèle ne peut pas tenir, la règle de rappel (info) le dit', () => {
    const w = wide(subject(77, 'plat-trapeze'), 2.6);   // alaX × 1,8 suffisait avant l'ancrage du bord externe
    expect(alaPull(w)).toBeCloseTo(0.6 * w.nose.alaX, 5);   // borne ALA_PULL_MAX
    expect(rule(w, 'eng.nose.alar-pull').ok).toBe(false);
    expect(rule(w, 'eng.nose.alar-contour').ok).toBe(false);
  });

  it('déterminisme : deux appels donnent la même aile', () => {
    const s = subject(11, 'plat-trapeze');
    expect(alaOf(s, 1)).toEqual(alaOf(s, 1));
    expect(alaOf(s, 1).c.x).toBeCloseTo(-alaOf(s, -1).c.x, 12);
  });
});

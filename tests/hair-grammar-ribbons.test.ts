import { describe, expect, it } from 'vitest';
import data from '../src/hair-grammar/profiles/tousled.ribbons.json';
import { ribbonOutline, ribbonPath, type RibbonProfile } from '../src/hair-grammar/ribbon';
import { ribbonScene } from '../src/hair-grammar/ribbon-scene';
import { verifyRibbonAnatomy, verifyRibbonGeometry, verifyRibbonStyle } from '../src/hair-grammar/ribbon-verify';

const P = data as unknown as RibbonProfile;
const shifted = (dv: number): RibbonProfile => ({ ...P, ribbons: P.ribbons.map((r) => ({ ...r, p: r.p.map((q) => [q[0], q[1] + dv, q[2]] as const) })) });
const scaled = (k: number): RibbonProfile => ({ ...P, ribbons: P.ribbons.map((r) => ({ ...r, p: r.p.map((q) => [q[0] * k, q[1] * k, q[2]] as const) })) });

describe('ruban de trait (cellule 01)', () => {
  it('le profil est dans le repère de tête (unité H, origine iris proche)', () => {
    expect(P.frame.unit).toBeCloseTo(109.5, 1);
    expect(P.ribbons.length).toBeGreaterThan(100);
  });
  it('contour fini et fermé, chemin non vide', () => {
    for (const r of P.ribbons.slice(0, 40)) {
      expect(ribbonOutline(r, P.frame).every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
      expect(ribbonPath(r, P.frame).endsWith('Z')).toBe(true);
    }
  });
  it('les trois couches de vérification sont vertes sur le profil', () => {
    for (const r of [verifyRibbonGeometry(P), verifyRibbonAnatomy(P), verifyRibbonStyle(P)]) expect(r.checks.filter((c) => !c.ok), r.layer).toEqual([]);
  });
  it('la couche anatomique ÉCHOUE si les cheveux glissent vers le bas ou si la tête est agrandie', () => {
    expect(verifyRibbonAnatomy(shifted(0.35)).ok).toBe(false);
    expect(verifyRibbonAnatomy(scaled(1.35)).ok).toBe(false);
  });
  it('la couche géométrique ÉCHOUE sur une largeur non finie', () => {
    const bad: RibbonProfile = { ...P, ribbons: [{ ...(P.ribbons[0] as RibbonProfile['ribbons'][number]), p: [[0, 0, Number.NaN], [0.1, 0.1, 0.01]] }, ...P.ribbons] };
    expect(verifyRibbonGeometry(bad).ok).toBe(false);
  });
  it('rendu déterministe et sans filtre', () => {
    const a = ribbonScene(P, { w: 156, h: 150, px: 2 }); const b = ribbonScene(P, { w: 156, h: 150, px: 2 });
    expect(a).toBe(b); expect(a).not.toContain('<filter');
  });
});

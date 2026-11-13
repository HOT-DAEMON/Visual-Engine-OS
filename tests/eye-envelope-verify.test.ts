import { describe, expect, it } from 'vitest';
import { openingGeometry, openingProfile } from '../src/geometry/eye';
import { Canthi } from '../src/schema/eye-canthi-fold';
import { Shape } from '../src/schema/eye-shape';
import { NATURAL_STYLES, checkEyeEnvelope, peaks } from '../src/verify/eye-envelope';
import { verifyEye } from '../src/verify/eye';

const STYLES = ['almond', 'round', 'sharp', 'drooping', 'chibi', 'angular', 'compressed', 'rounded_rect', 'triangle', 'circle', 'diamond', 'diamond_v2'] as const;
describe('vérification de l’enveloppe (couches géométrie / anatomie / style)', () => {
  it('peaks() distingue une bosse, deux bosses et un plateau', () => {
    expect(peaks([0, 1, 2, 3, 2, 1, 0])).toBe(1);
    expect(peaks([0, 2, 1, 2, 0])).toBe(2);
    expect(peaks([0, 0, 0, 0])).toBe(0);
  });
  it('les 12 enveloppes par défaut passent les contrôles géométriques (error)', () => {
    for (const s of STYLES) { const g = openingGeometry(Shape.parse({ style: s }), Canthi.parse({})); const bad = checkEyeEnvelope(g, s, 40).filter((c) => !c.ok && c.severity === 'error'); expect(bad, s).toEqual([]); }
  });
  it('l’almond par défaut ne déclenche aucun avertissement anatomie/style sur l’enveloppe', () => {
    const g = openingGeometry(Shape.parse({ style: 'almond' }), Canthi.parse({}));
    const p = openingProfile(g);
    expect(checkEyeEnvelope(g, 'almond', (p.aspect * g.w) / 2).filter((c) => !c.ok)).toEqual([]);
  });
  it('les styles stylisés sont exclus des bornes humaines', () => { expect(NATURAL_STYLES).not.toContain('round'); expect(NATURAL_STYLES).not.toContain('chibi'); });
  it('un sommet décentré hors plage mesurée est signalé (warn) sur un style naturel', () => {
    const g = openingGeometry(Shape.parse({ style: 'drooping' }), Canthi.parse({}));
    const w = checkEyeEnvelope({ ...g, u1: { x: g.pi.x + g.w * 0.02, y: g.u1.y }, u2: { x: g.po.x - g.w * 0.6, y: g.u2.y } }, 'drooping', 50);
    expect(w.some((c) => !c.ok && c.severity === 'warn' && c.id.startsWith('upper-peak'))).toBe(true);
  });
  it('verifyEye accepte un œil amande par défaut (les contrôles d’enveloppe y sont branchés)', () => {
    expect(verifyEye({ kind: 'eye', id: 'e', shape: { style: 'almond' } } as never).ok).toBe(true);
  });
});

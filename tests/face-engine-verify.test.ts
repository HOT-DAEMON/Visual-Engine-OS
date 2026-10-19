import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { MAX_PEAK } from '../src/contact';
import { engineAnatomy, engineContext, engineGeometry, engineStyle } from '../src/verify/face-engine';
import { verifyFace } from '../src/verify';
import type { Check } from '../src/verify';

const errors = (c: Check[]): string[] => c.filter((x) => !x.ok && x.severity === 'error').map((x) => x.id);

describe('couche de vérification du moteur de visage', () => {
  it('120 visages aléatoires : aucun contrôle d\'erreur n\'échoue (géométrie, anatomie, style)', () => {
    for (let s = 1; s <= 120; s++) {
      const r = verifyFace(generateRandomFace(s * 977));
      const bad = r.failures.map((f) => f.id);
      expect(bad, `seed ${s * 977}`).toEqual([]);
    }
  }, 280000);

  it('les trois couches produisent des contrôles chiffrés (valeur et limite finies)', () => {
    const c = engineContext(generateRandomFace(5));
    for (const list of [engineGeometry(c), engineAnatomy(c), engineStyle(c)]) {
      expect(list.length).toBeGreaterThanOrEqual(5);
      for (const k of list) { expect(Number.isFinite(k.value)).toBe(true); expect(Number.isFinite(k.limit)).toBe(true); }
    }
    expect(new Set([...engineGeometry(c), ...engineAnatomy(c), ...engineStyle(c)].map((k) => k.layer))).toEqual(new Set(['geometry', 'anatomy', 'style']));
  });

  it('DÉTECTE une ombre trop forte (pièce collée) et une ombre sans contact (objet flottant)', () => {
    const c = engineContext(generateRandomFace(5));
    const m = c.contacts[0]!;
    expect(errors(engineGeometry({ ...c, contacts: [{ ...m, peak: MAX_PEAK + 0.2 }] }))).toContain(`contact-not-sticker:${m.id}`);
    expect(errors(engineGeometry({ ...c, contacts: [{ ...m, contactShare: 0 }] }))).toContain(`contact-not-floating:${m.id}`);
  });

  it('DÉTECTE une narine posée hors de son aile et un nez qui descend sur la bouche', () => {
    const c = engineContext(generateRandomFace(5));
    const shift = (n: typeof c.nose.nostrils.right) => ({ ...n, poly: n.poly.map((q) => ({ x: q.x + 60, y: q.y })), c: { x: n.c.x + 60, y: n.c.y } });
    expect(errors(engineAnatomy({ ...c, nose: { ...c.nose, nostrils: { left: c.nose.nostrils.left, right: shift(c.nose.nostrils.right) } } }))).toContain('nostrils-inside-alae');
    expect(errors(engineAnatomy({ ...c, nose: { ...c.nose, baseY: c.lm.lips.topY + 10 } }))).toContain('nose-above-mouth');
  });

  it('DÉTECTE un reflet de peau teinté (métallique) et une transition lumière/ombre brutale', () => {
    const c = engineContext(generateRandomFace(5));
    expect(errors(engineStyle({ ...c, shading: { ...c.shading, specColor: '#ffb300' } }))).toContain('skin-specular-nonmetal');
    expect(errors(engineStyle({ ...c, shading: { ...c.shading, terminatorWidth: 0.01 } }))).toContain('skin-terminator-soft');
  });

  it('DÉTECTE un contour dont la tangente casse', () => {
    const c = engineContext(generateRandomFace(5));
    const segs = c.lm.outline.right.map((s, i) => (i === 2 ? { ...s, p1: { x: s.p1.x + 40, y: s.p0.y - 5 } } : s));
    const broken = { ...c, lm: { ...c.lm, outline: { ...c.lm.outline, right: segs } } };
    expect(errors(engineGeometry(broken))).toContain('outline-c1');
  });

  it('DÉTECTE une hauteur de menton qui rallongerait le visage', () => {
    const c = engineContext(generateRandomFace(5));
    expect(errors(engineGeometry({ ...c, lm: { ...c.lm, outline: { ...c.lm.outline, bottomY: c.lm.outline.bottomY + 12 } } }))).toContain('face-length-fixed');
  });
});

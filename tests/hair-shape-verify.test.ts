import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { faceLandmarks, hairGeometry, type HairGeometry } from '../src/face';
import { HAIR_STYLES } from '../src/schema';
import { checkHairShape, sharpTeeth } from '../src/verify/hair-shape';

const STYLES = HAIR_STYLES.filter((s) => s !== 'bald');
const mk = (seed: number, hair: Record<string, unknown> = {}) => generateRandomFace(seed, { hairEngine: 'classic', hair: hair as never } as never);
const geoOf = (f: ReturnType<typeof mk>): HairGeometry => hairGeometry(f.params, faceLandmarks(f.params, f.width, f.height)) as HairGeometry;
const errors = (f: ReturnType<typeof mk>, g?: HairGeometry) => checkHairShape(f, g).filter((c) => !c.ok && c.severity === 'error').map((c) => c.id);

describe('vérification forme/crâne (classique) : les trois couches', () => {
  it.each(STYLES)('%s : aucune erreur sur 8 graines', (style) => {
    for (let k = 0; k < 8; k++) expect(errors(mk(3000 + k * 31, { style, seed: k, fringe: k % 2 ? 'sweep' : 'none' }))).toEqual([]);
  });

  it('couvre les trois couches', () => {
    const layers = new Set(checkHairShape(mk(1, { style: 'short' })).map((c) => c.layer));
    expect([...layers].sort()).toEqual(['anatomy', 'geometry', 'style']);
  });

  it('chauve : rien à vérifier', () => expect(checkHairShape(mk(1, { style: 'bald' }))).toEqual([]));

  // Contrôles NÉGATIFS : un défaut injecté doit être vu (sinon le contrôle est vide).
  it('détecte une mèche parasite sous le cou (queue de cheval)', () => {
    const f = mk(41, { style: 'ponytail' }), g = geoOf(f), lm = faceLandmarks(f.params, f.width, f.height);
    const stray = [{ x: 0, y: lm.neck.bottomY + 0.2 * lm.H }, { x: 5, y: lm.neck.bottomY + 0.21 * lm.H }, { x: -5, y: lm.neck.bottomY + 0.21 * lm.H }];
    expect(errors(f, { ...g, back: [...g.back, stray] })).toContain('hair-not-below-neck');
  });

  it('détecte des mèches de dessous qui recouvrent la peau entre yeux et bouche', () => {
    const f = mk(42, { style: 'short' }), g = geoOf(f), lm = faceLandmarks(f.params, f.width, f.height);
    const slab = [{ x: -0.3 * lm.W, y: lm.eyeY }, { x: 0.3 * lm.W, y: lm.eyeY }, { x: 0.3 * lm.W, y: lm.mouthY }, { x: -0.3 * lm.W, y: lm.mouthY }];
    expect(errors(f, { ...g, front: [...g.front, slab] })).toContain('hair-covers-face-skin');
  });

  it('détecte une implantation à angle vif', () => {
    const f = mk(43, { style: 'short' }), g = geoOf(f);
    const hl = g.hairline.map((q, i) => (i === 10 ? { x: q.x, y: q.y + 0.08 * (g.boundary.skull.chinY - g.boundary.skull.topY) } : q));
    expect(errors(f, { ...g, hairline: hl })).toContain('hair-hairline-no-corner');
  });

  it('sharpTeeth : une scie est comptée, une vague ronde ne l\'est pas', () => {
    const saw = Array.from({ length: 41 }, (_, i) => ({ x: i, y: i % 2 ? 0 : 6 }));
    const wave = Array.from({ length: 81 }, (_, i) => ({ x: i * 0.5, y: 3 * Math.sin(i * 0.15) }));
    expect(sharpTeeth(saw, 0.5)).toBeGreaterThan(10);
    expect(sharpTeeth(wave, 0.5)).toBe(0);
  });
});

describe('correctifs de forme : preuves chiffrées', () => {
  it('queue de cheval : plus aucune mèche sous le bas du cou rendu', () => {
    for (let k = 0; k < 10; k++) {
      const f = mk(500 + k * 7, { style: 'ponytail', seed: k }), g = geoOf(f), lm = faceLandmarks(f.params, f.width, f.height);
      expect(Math.max(...g.locks.flatMap((l) => l.poly.map((q) => q.y)))).toBeLessThanOrEqual(lm.neck.bottomY + 0.02 * lm.H + 1e-6);
    }
  });

  it('frange : bord en festons arrondis (pas plus de 4 dents aiguës)', () => {
    for (const style of ['short', 'bob', 'long'] as const) for (let k = 0; k < 6; k++) {
      const f = mk(900 + k * 11, { style, fringe: 'straight', seed: k }), g = geoOf(f), lm = faceLandmarks(f.params, f.width, f.height);
      if (g.fringeBottom) expect(sharpTeeth(g.fringeBottom, 0.012 * lm.H)).toBeLessThanOrEqual(4);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { compose, normalizeDeg, resolveAnchors, selectAnchors, surfaceNormalDeg, type Similarity } from '../src/composition/anchors';
import { HostSpec } from '../src/schema';

const host = (over: Record<string, unknown> = {}): ReturnType<typeof HostSpec.parse> =>
  HostSpec.parse({ id: 'h', kind: 'host', material: { preset: 'matte', color: '#c0c0c0' }, ...over });

describe('normalizeDeg', () => {
  it('ramène tout angle dans (-180, 180]', () => {
    expect(normalizeDeg(0)).toBe(0);
    expect(normalizeDeg(180)).toBe(180);
    expect(normalizeDeg(-180)).toBe(180);
    expect(normalizeDeg(370)).toBeCloseTo(10, 9);
    expect(normalizeDeg(-370)).toBeCloseTo(-10, 9);
    expect(normalizeDeg(540)).toBe(180);
  });
});

describe('compose (similarités 2D)', () => {
  const id: Similarity = { x: 0, y: 0, rotationDeg: 0, scale: 1 };

  it('l\'identité est neutre à gauche et à droite', () => {
    const s: Similarity = { x: 3, y: -4, rotationDeg: 40, scale: 1.5 };
    expect(compose(id, s)).toEqual(s);
    expect(compose(s, id)).toEqual(s);
  });

  it('translation ∘ translation = somme', () => {
    const a: Similarity = { x: 10, y: 5, rotationDeg: 0, scale: 1 };
    const b: Similarity = { x: -2, y: 7, rotationDeg: 0, scale: 1 };
    const c = compose(a, b);
    expect(c.x).toBeCloseTo(8, 9);
    expect(c.y).toBeCloseTo(12, 9);
  });

  it('rotation de 90° envoie (1,0) local sur (0,1) monde', () => {
    const a: Similarity = { x: 0, y: 0, rotationDeg: 90, scale: 1 };
    const b: Similarity = { x: 1, y: 0, rotationDeg: 0, scale: 1 };
    const c = compose(a, b);
    expect(c.x).toBeCloseTo(0, 9);
    expect(c.y).toBeCloseTo(1, 9);
  });

  it('les échelles se multiplient, les rotations s\'additionnent (normalisées)', () => {
    const a: Similarity = { x: 0, y: 0, rotationDeg: 170, scale: 2 };
    const b: Similarity = { x: 0, y: 0, rotationDeg: 30, scale: 3 };
    const c = compose(a, b);
    expect(c.scale).toBeCloseTo(6, 9);
    expect(c.rotationDeg).toBeCloseTo(-160, 9); // 200 normalisé
  });

  it('n\'est pas commutative en général', () => {
    const a: Similarity = { x: 5, y: 0, rotationDeg: 90, scale: 1 };
    const b: Similarity = { x: 0, y: 0, rotationDeg: 0, scale: 1 };
    const ab = compose(a, { ...b, x: 1 });
    const ba = compose({ ...b, x: 1 }, a);
    expect(ab).not.toEqual(ba);
  });
});

describe('surfaceNormalDeg', () => {
  it('ellipse : haut/droite/bas/gauche => 0°, 90°, 180°, -90°', () => {
    const h = host({ shape: 'ellipse', width: 200, height: 100 });
    expect(surfaceNormalDeg(h, 0, -50)).toBeCloseTo(0, 6);
    expect(surfaceNormalDeg(h, 100, 0)).toBeCloseTo(90, 6);
    expect(surfaceNormalDeg(h, 0, 50)).toBeCloseTo(180, 6);
    expect(surfaceNormalDeg(h, -100, 0)).toBeCloseTo(-90, 6);
  });

  it('rectangle arrondi : la normale est celle de la face la plus proche', () => {
    const h = host({ shape: 'rounded_rect', width: 200, height: 100 });
    expect(surfaceNormalDeg(h, 5, -40)).toBeCloseTo(0, 6);
    expect(surfaceNormalDeg(h, 90, 5)).toBeCloseTo(90, 6);
  });
});

describe('resolveAnchors', () => {
  it('ancre explicite : coordonnées normalisées => pixels (± demi-dimensions)', () => {
    const h = host({ width: 200, height: 100, anchors: [{ id: 'a', x: 0.5, y: -1 }] });
    const [a] = resolveAnchors(h);
    expect(a).toBeDefined();
    expect(a?.x).toBeCloseTo(50, 9);
    expect(a?.y).toBeCloseTo(-50, 9);
  });

  it('motif ring : count ancres réparties uniformément, groupées sous group=id du motif', () => {
    const h = host({ patterns: [{ type: 'ring', id: 'r', count: 4, radius: 1, startDeg: 0, follow: 'none' }] });
    const anchors = resolveAnchors(h);
    expect(anchors).toHaveLength(4);
    expect(anchors.every((a) => a.group === 'r')).toBe(true);
    expect(anchors.map((a) => a.id)).toEqual(['r-1', 'r-2', 'r-3', 'r-4']);
    // startDeg=0 => la première ancre est en haut (0, -ry)
    expect(anchors[0]?.x).toBeCloseTo(0, 6);
    expect(anchors[0]?.y).toBeCloseTo(-150, 6); // height défaut 300, radius 1 => ry=150
  });

  it('motif ring avec follow="surface" oriente chaque ancre selon la normale', () => {
    const h = host({ width: 200, height: 200, patterns: [{ type: 'ring', id: 'r', count: 4, radius: 1, startDeg: 0, follow: 'surface' }] });
    const anchors = resolveAnchors(h);
    // ancre du haut (0, -1) => normale à 0°
    expect(anchors[0]?.rotationDeg).toBeCloseTo(0, 3);
    // ancre de droite (index 1, startDeg 0, pas 90°) => normale à 90°
    expect(anchors[1]?.rotationDeg).toBeCloseTo(90, 3);
  });

  it('motif line : count ancres réparties entre from et to, count=1 => milieu', () => {
    const h = host({
      width: 200,
      height: 200,
      patterns: [{ type: 'line', id: 'l', count: 3, from: { x: -1, y: 0 }, to: { x: 1, y: 0 } }],
    });
    const anchors = resolveAnchors(h);
    expect(anchors.map((a) => a.x)).toEqual([-100, 0, 100]);
    const single = resolveAnchors(
      host({ width: 200, height: 200, patterns: [{ type: 'line', id: 'l', count: 1, from: { x: -1, y: 0 }, to: { x: 1, y: 0 } }] }),
    );
    expect(single[0]?.x).toBeCloseTo(0, 9);
  });

  it('ancres explicites puis motifs, dans l\'ordre de déclaration', () => {
    const h = host({
      anchors: [{ id: 'a' }],
      patterns: [{ type: 'ring', id: 'r', count: 2, follow: 'none' }],
    });
    expect(resolveAnchors(h).map((a) => a.id)).toEqual(['a', 'r-1', 'r-2']);
  });
});

describe('selectAnchors', () => {
  const h = host({
    anchors: [{ id: 'a' }, { id: 'b' }],
    patterns: [{ type: 'ring', id: 'r', count: 3, follow: 'none' }],
  });

  it('résout des ancres nommées et des motifs entiers', () => {
    const sel = selectAnchors(h, { anchors: ['b'], patterns: ['r'] });
    expect(sel.anchors.map((a) => a.id)).toEqual(['b', 'r-1', 'r-2', 'r-3']);
    expect(sel.missing).toEqual([]);
  });

  it('signale précisément les noms introuvables, sans jeter', () => {
    const sel = selectAnchors(h, { anchors: ['b', 'zzz'], patterns: ['nope'] });
    expect(sel.anchors.map((a) => a.id)).toEqual(['b']);
    expect(sel.missing).toEqual([
      { kind: 'anchors', index: 1, name: 'zzz' },
      { kind: 'patterns', index: 0, name: 'nope' },
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { EyeSpec, compileScene } from '../src';
import { placeHighlights } from '../src/geometry/eye';
import { HighlightItem } from '../src/schema/eye-highlights';

const ctx = { c: { x: 0, y: 0 }, irisRx: 50, irisRy: 56, half: { x: 0.6, y: -0.6 }, bbox: { x: -100, y: -60, w: 200, h: 120 } };
const hl = (o: object) => HighlightItem.parse(o);
const scene = (highlights: object) =>
  compileScene({ width: 640, height: 520, background: '#3b4157', objects: [{ kind: 'eye', id: 'e', transform: { x: 320, y: 260 }, shape: { width: 400, height: 240 }, highlights }] } as never);

describe('OPT-01/04 — système de reflets', () => {
  it('ancrage lumière : le reflet physique suit la direction de la source, le secondaire est à l’opposé', () => {
    const [a, b] = placeHighlights([hl({ kind: 'reflection', role: 'primary' }), hl({ kind: 'reflection', role: 'secondary' })], ctx);
    expect(a!.cx).toBeGreaterThan(0); expect(a!.cy).toBeLessThan(0);
    expect(b!.cx).toBeLessThan(0); expect(b!.cy).toBeGreaterThan(0);
  });

  it('règle d’occlusion : confinement à l’iris, jamais hors de l’ellipse (centre + marge)', () => {
    for (const x of [-1.5, 0, 1.5]) for (const y of [-1.5, 0, 1.5]) for (const size of [0.05, 0.3, 0.8]) {
      const [p] = placeHighlights([hl({ anchor: 'iris', confine: 'iris', x, y, size })], ctx);
      expect(Math.hypot((p!.cx - ctx.c.x) / ctx.irisRx, (p!.cy - ctx.c.y) / ctx.irisRy)).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('règle d’occlusion : confinement à l’ouverture (globe) même pour un reflet très loin', () => {
    const [p] = placeHighlights([hl({ anchor: 'globe', x: 1.5, y: 1.5, size: 0.3 })], ctx);
    expect(p!.clamped).toBe(true);
    expect(p!.cx + p!.rx).toBeLessThanOrEqual(100 + 1e-9);
    expect(p!.cy + p!.ry).toBeLessThanOrEqual(60 + 1e-9);
  });

  it('formes : star/sparkle/diamond/cross ont un contour, circle/ellipse non ; la rotation tourne le contour', () => {
    const shapes = ['circle', 'ellipse', 'star', 'diamond', 'sparkle', 'cross'] as const;
    const out = Object.fromEntries(shapes.map((s) => [s, placeHighlights([hl({ shape: s, anchor: 'iris' })], ctx)[0]!.outline.length]));
    expect(out.circle).toBe(0); expect(out.ellipse).toBe(0);
    for (const s of ['star', 'diamond', 'sparkle', 'cross'] as const) expect(out[s]).toBeGreaterThan(0);
    const a = placeHighlights([hl({ shape: 'diamond', anchor: 'iris', rotationDeg: 0 })], ctx)[0]!.outline;
    const b = placeHighlights([hl({ shape: 'diamond', anchor: 'iris', rotationDeg: 45 })], ctx)[0]!.outline;
    expect(b).not.toEqual(a);
  });

  it('liste vide = rendu historique inchangé ; liste non vide remplace les deux reflets', () => {
    const legacy = scene({});
    const same = scene({ list: [] });
    expect(legacy.ok && same.ok && legacy.svg === same.svg).toBe(true);
    const custom = scene({ list: [{ shape: 'star', anchor: 'iris', x: 0.3, y: -0.3, softness: 0.4, intensity: 0.6, confine: 'iris' }] });
    expect(custom.ok).toBe(true);
    if (custom.ok && legacy.ok) {
      expect(custom.svg).not.toBe(legacy.svg);
      expect(custom.svg).toContain('hl0-glow');
      expect(custom.svg).toContain('hl0-soft');
    }
  });

  it('le schéma limite la liste à 6 reflets et valide la forme', () => {
    expect(EyeSpec.safeParse({ kind: 'eye', id: 'e', highlights: { list: Array.from({ length: 7 }, () => ({})) } }).success).toBe(false);
    expect(EyeSpec.safeParse({ kind: 'eye', id: 'e', highlights: { list: [{ shape: 'blob' }] } }).success).toBe(false);
  });
});

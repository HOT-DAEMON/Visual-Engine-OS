import { describe, expect, it } from 'vitest';
import { compileScene } from '../src';
import { SceneSpec } from '../src/schema';

const eye = (over: Record<string, unknown> = {}) => ({ kind: 'eye', id: 'a', ...over });
const scene = (objects: unknown[], over: Record<string, unknown> = {}) => ({ objects, ...over });

describe('SceneSpec', () => {
  it('une scène minimale reçoit tous les défauts (y compris imbriqués)', () => {
    const s = SceneSpec.parse(scene([eye()]));
    expect(s.width).toBe(640);
    expect(s.light.azimuthDeg).toBe(330);
    const e = s.objects[0];
    expect(e?.kind).toBe('eye');
    if (e?.kind === 'eye') {
      expect(e.iris.fibers).toBe(48);
      expect(e.iris.material.base.type).toBe('radial');
      expect(e.sclera.roughness).toBeGreaterThan(0.8); // preset matte résolu
      expect(e.highlights.primary.opacity).toBe(1);
    }
  });

  it('est strict : clé inconnue rejetée', () => {
    expect(SceneSpec.safeParse(scene([eye({ inconnu: 1 })])).success).toBe(false);
    expect(SceneSpec.safeParse(scene([eye()], { extra: true })).success).toBe(false);
  });

  it('rejette couleurs, bornes et valeurs non finies', () => {
    expect(SceneSpec.safeParse(scene([eye({ pupil: { color: '#12345' } })])).success).toBe(false);
    expect(SceneSpec.safeParse(scene([eye({ shape: { width: 5 } })])).success).toBe(false);
    expect(SceneSpec.safeParse(scene([eye({ transform: { x: NaN } })])).success).toBe(false);
    expect(SceneSpec.safeParse(scene([eye({ transform: { x: Infinity } })])).success).toBe(false);
    expect(SceneSpec.safeParse(scene([eye({ seed: 1.5 })])).success).toBe(false);
  });

  it('rejette les identifiants dangereux ou dupliqués', () => {
    expect(SceneSpec.safeParse(scene([eye({ id: 'a" onload="x' })])).success).toBe(false);
    expect(SceneSpec.safeParse(scene([eye({ id: 'A' })])).success).toBe(false);
    const dup = SceneSpec.safeParse(scene([eye(), eye()]));
    expect(dup.success).toBe(false);
    if (!dup.success) expect(dup.error.issues[0]?.path).toEqual(['objects', 1, 'id']);
  });

  it('rejette des stops non croissants', () => {
    const bad = {
      base: { type: 'radial', stops: [{ offset: 0.8, color: '#000000' }, { offset: 0.2, color: '#ffffff' }] },
    };
    expect(SceneSpec.safeParse(scene([eye({ iris: { material: bad } })])).success).toBe(false);
  });

  it('résout les presets de matériaux', () => {
    const s = SceneSpec.parse(
      scene([{ kind: 'panel', id: 'p', material: { preset: 'polished_metal', color: '#c0c8d0' } }]),
    );
    const p = s.objects[0];
    if (p?.kind !== 'panel') throw new Error('panneau attendu');
    expect(p.material.metallic).toBe(1);
    expect(p.material.roughness).toBeLessThan(0.15);
  });

  it('rejette un preset inconnu', () => {
    expect(
      SceneSpec.safeParse(scene([{ kind: 'panel', id: 'p', material: { preset: 'or_massif', color: '#c0c8d0' } }])).success,
    ).toBe(false);
  });
});

describe('compileScene : erreurs lisibles', () => {
  it('n\'émet jamais de SVG pour une entrée invalide et liste les chemins', () => {
    const r = compileScene(scene([eye({ pupil: { size: 5 } })]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.startsWith('objects.0.pupil.size'))).toBe(true);
  });
  it('dans une union de matériaux, ne garde que la branche la plus proche', () => {
    const r = compileScene(scene([{ kind: 'panel', id: 'p', material: { preset: 'polished_metal', color: 'rouge' } }]));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.length).toBeLessThanOrEqual(2);
      expect(r.issues.join('\n')).toContain('#rrggbb');
    }
  });
});

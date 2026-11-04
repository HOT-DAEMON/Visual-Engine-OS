import { describe, expect, it } from 'vitest';
import { compileScene, generateRandomFace, renderScene, SceneSpec } from '../src';
import { bodyMarkup, composeFigure } from '../src/body';
import { dominantColor } from '../src/materials';
import { hostFace } from '../src/render/face';
import type { HostSpec } from '../src/schema';

/** Corps branché au pipeline principal : même résultat que l'ancienne composition par chaîne, mais validé, typé et dans `compileScene`. */
const sceneOf = (seed: number): { scene: Record<string, unknown> & { objects: unknown[] }; host: HostSpec } => {
  const f = generateRandomFace(seed, { id: 'f0', transform: { x: 0, y: 0, scale: 1 } });
  // Scène minimale : fond + objets du visage (hôte + yeux posés), comme les scripts d'artefacts.
  const scene = { width: 640, height: 900, background: '#f4f1ec', objects: [...f.objects] } as Record<string, unknown> & { objects: unknown[] };
  const host = SceneSpec.parse(scene).objects.find((o) => o.kind === 'host') as HostSpec;
  return { scene, host };
};
const withBody = (scene: Record<string, unknown> & { objects: unknown[] }, over: Record<string, unknown> = {}) => ({
  ...scene,
  objects: [...scene.objects, { kind: 'body', id: 'b0', host: 'f0', body: { age: 28, sex: 1, muscularity: 0.6 }, ...over }],
});

describe('corps dans le pipeline principal', () => {
  it('produit le même SVG que composeFigure(visage, corps) sur 3 graines', () => {
    for (const seed of [3, 11, 42]) {
      const { scene, host } = sceneOf(seed);
      const { params, lm } = hostFace(host);
      const a = { h: lm.H, chinY: lm.chinY, baseY: lm.neck.bottomY, baseHalf: lm.neck.half * (1 + params.neck.flare) };
      const m = bodyMarkup({ age: 28, sex: 1, muscularity: 0.6 }, a, { skin: dominantColor(host.material.base), level: 3, mode: 'skin', uid: 'b0' });
      const legacy = composeFigure(renderScene(SceneSpec.parse(scene)), m);
      const r = compileScene(withBody(scene));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.svg).toBe(legacy);
    }
  });

  it("le corps est dessiné DERRIÈRE le visage et son ancre vient des repères stylisés de l'hôte", () => {
    const { scene, host } = sceneOf(11);
    const r = compileScene(withBody(scene));
    if (!r.ok) throw new Error(r.issues.join('\n'));
    const first = r.svg.indexOf('<g transform=');
    expect(first).toBeGreaterThan(0);
    expect(r.svg.slice(first)).toContain('b0'); // le premier groupe (sous la scène) est celui du corps
    const { lm } = hostFace(host);
    expect(lm.neck.bottomY).toBeGreaterThan(lm.chinY); // le cou descend sous le menton : le corps a de la place
  });

  it('rejette un hôte introuvable, un hôte qui n’est pas un visage, et deux corps sur le même hôte', () => {
    const { scene } = sceneOf(11);
    const bad = (objs: unknown[]) => {
      const r = compileScene({ ...scene, objects: objs });
      return r.ok ? [] : r.issues;
    };
    expect(bad([...scene.objects, { kind: 'body', id: 'b0', host: 'nope' }]).join('|')).toMatch(/hôte introuvable/);
    expect(bad([...scene.objects, { kind: 'host', id: 'disc', material: { preset: 'matte', color: '#eec9ad' } }, { kind: 'body', id: 'b0', host: 'disc' }]).join('|')).toMatch(/shape: 'face'/);
    expect(bad([...scene.objects, { kind: 'body', id: 'b0', host: 'f0' }, { kind: 'body', id: 'b1', host: 'f0' }]).join('|')).toMatch(/un seul corps/);
  });

  it('est déterministe et sans coordonnée absolue : même scène ⇒ même chaîne', () => {
    const { scene } = sceneOf(5);
    const a = compileScene(withBody(scene));
    const b = compileScene(withBody(scene));
    expect(a.ok && b.ok && a.svg === b.svg).toBe(true);
  });
});

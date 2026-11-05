import { describe, expect, it } from 'vitest';
import { compileScene, generateRandomFace, SceneSpec } from '../src';
import { hostFace } from '../src/render/face';
import { deriveSkull } from '../src/skull/derive';
import type { HostSpec } from '../src/schema';

/** Tête de profil branchée au pipeline principal (`kind: 'head_profile'`, docs/PIPELINE-PROFILE.md). */
const faceObjs = (seed: number) => generateRandomFace(seed, { id: 'f0', transform: { x: 150, y: 220, scale: 0.8 } }).objects;
const scene = (seed: number, extra: Record<string, unknown>[] = [{ kind: 'head_profile', id: 'p0', host: 'f0', transform: { x: 330, y: 20, scale: 0.9 } }]) => ({ width: 700, height: 460, background: '#ece6dc', objects: [...faceObjs(seed), ...extra] });

describe('tête de profil dans le pipeline principal', () => {
  it('compile, est déterministe, et le profil est le vrai moteur (contour de crâne, oreille, nez)', () => {
    const a = compileScene(scene(11)), b = compileScene(scene(11));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.svg).toBe(b.svg);
    const solo = compileScene(scene(11, []));
    expect(solo.ok && a.svg.length > (solo as { svg: string }).svg.length + 5000).toBe(true);
    expect(a.svg).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('le crâne est DÉRIVÉ du visage de l\'hôte : deux hôtes de largeurs différentes donnent deux longueurs de tête différentes', () => {
    const lengths = [11, 42, 3, 7, 19].map((seed) => {
      const host = SceneSpec.parse(scene(seed, [])).objects.find((o) => o.kind === 'host') as HostSpec;
      const { params, lm } = hostFace(host);
      return deriveSkull(params, lm.W / lm.H, {}, {}).lengthH;
    });
    expect(new Set(lengths.map((l) => l.toFixed(3))).size).toBeGreaterThan(2);
    for (const l of lengths) { expect(l).toBeGreaterThan(0.7); expect(l).toBeLessThan(0.95); }
  });

  it('la variation libre bornée change le profil sans casser la dérivation', () => {
    const base = compileScene(scene(11)), varied = compileScene(scene(11, [{ kind: 'head_profile', id: 'p0', host: 'f0', variation: { ci: 1, axes: { zygoma: 1 } }, transform: { x: 330, y: 20, scale: 0.9 } }]));
    expect(base.ok && varied.ok).toBe(true);
    if (base.ok && varied.ok) expect(base.svg).not.toBe(varied.svg);
  });

  it('rejette : hôte introuvable, hôte non-visage, deux profils sur le même hôte, champ inconnu', () => {
    expect(compileScene(scene(11, [{ kind: 'head_profile', id: 'p0', host: 'nope' }])).ok).toBe(false);
    expect(compileScene(scene(11, [{ kind: 'head_profile', id: 'p0', host: 'f0' }, { kind: 'head_profile', id: 'p1', host: 'f0' }])).ok).toBe(false);
    expect(compileScene(scene(11, [{ kind: 'head_profile', id: 'p0', host: 'f0', depth: 3 }])).ok).toBe(false);
    const robot = { kind: 'host', id: 'h1', shape: 'rect', width: 100, height: 100 };
    expect(compileScene({ width: 300, height: 300, objects: [robot, { kind: 'head_profile', id: 'p0', host: 'h1' }] }).ok).toBe(false);
  });
});

import { verifyPipeline } from '../src/verify';
describe('vérification du profil dans verifyPipeline', () => {
  it('3 couches + contrôles croisés face ↔ profil, sur 6 graines : aucune erreur', () => {
    for (const seed of [3, 7, 11, 19, 42, 55]) {
      const rep = verifyPipeline(scene(seed));
      const mine = rep.checks.filter((c) => c.id.startsWith('profile.p0.'));
      expect(mine.length).toBeGreaterThan(15);
      expect(new Set(mine.map((c) => c.layer))).toEqual(new Set(['geometry', 'anatomy', 'style']));
      expect(rep.failures.map((c) => `seed ${seed} ${c.id}=${c.value}`)).toEqual([]);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { faceLandmarks } from '../src/face';
import { hairGeometry } from '../src/face/hair';
import { poseHair, skullOf } from '../src/face/pose';
import { FaceParams } from '../src/schema';
import { checkHairPose } from '../src/verify/hair-pose';
import { stackDepth } from '../src/verify/hair-pose-overlap';
import { hairFace, type CleanStyle } from '../scripts/lib/hair-faces';

/** Règles des mèches sous pose (passe 8) : corpus sans erreur, et un contrôle négatif par règle (`docs/ROTATION-HAIR-PASS-8.md`). */
const STYLES: CleanStyle[] = ['buzz', 'short', 'spiky', 'curly', 'afro', 'bob', 'long', 'ponytail', 'bun', 'braids'];
const RULES = ['pose.strand-conform', 'pose.strand-face-cover', 'pose.strand-stack'];
const face = (style: CleanStyle, seed: number) => {
  const f = hairFace(style, 1, { seed }), host = f.objects[0] as unknown as { face: Record<string, unknown>; width: number; height: number };
  return { params: FaceParams.parse(host.face), width: host.width, height: host.height };
};
const base = (style: CleanStyle, seed: number, yaw: number) => {
  const f = face(style, seed), lm = faceLandmarks(f.params, f.width, f.height), g0 = hairGeometry(f.params, lm)!;
  return { f, lm, g0, g: poseHair(g0, skullOf(lm), yaw, lm.W) };
};
const failing = (style: CleanStyle, seed: number, yaw: number, mutate: (g: ReturnType<typeof base>['g'], W: number) => ReturnType<typeof base>['g']): string[] => {
  const b = base(style, seed, yaw);
  return checkHairPose(b.f, yaw, mutate(b.g, b.lm.W)).filter((c) => !c.ok).map((c) => c.id);
};

describe('règles des mèches sous pose : corpus', () => {
  for (const style of STYLES) it(`${style} : 3 graines × 6 lacets, les 3 règles sont évaluées, aucune erreur`, () => {
    for (const seed of [9001, 9002, 9003]) for (const yaw of [-45, -30, -15, 15, 30, 45]) {
      const cs = checkHairPose(face(style, seed), yaw);
      for (const id of RULES) expect(cs.some((c) => c.id === id)).toBe(true);
      expect(cs.filter((c) => !c.ok && c.severity === 'error').map((c) => `${seed}/${yaw} ${c.id}`)).toEqual([]);
    }
  });
});

describe('règles des mèches sous pose : contrôles négatifs', () => {
  it('ligne médiane décalée de 20 px (mèche détachée du crâne) → pose.strand-conform', () => {
    expect(failing('long', 9002, 30, (g) => ({ ...g, locks: g.locks.map((l) => ({ ...l, spine: l.spine?.map((q) => ({ x: q.x + 20, y: q.y })) })) }))).toContain('pose.strand-conform');
  });
  it('mèche posée au milieu du visage (face 0 % → posé ≥ 5 %) → pose.strand-face-cover', () => {
    const ids = failing('long', 9002, 30, (g, W) => {
      const slab = [{ x: -0.3 * W, y: -0.05 * W }, { x: 0.1 * W, y: -0.05 * W }, { x: 0.1 * W, y: 0.55 * W }, { x: -0.3 * W, y: 0.55 * W }];
      return { ...g, locks: [...g.locks, { ...g.locks.find((l) => l.layer === 'front')!, poly: slab, spine: undefined }] };
    });
    expect(ids).toContain('pose.strand-face-cover');
  });
  it('mèches triplées (superposition) → pose.strand-stack', () => {
    const ids = failing('long', 9002, 30, (g) => ({ ...g, locks: [...g.locks, ...g.locks, ...g.locks] }));
    expect(ids).toContain('pose.strand-stack');
  });
  it('contrôle de la mesure : empilement de mèches triplées ≈ 3 × (le comptage mesure bien le nombre de mèches)', () => {
    const { g, lm } = base('long', 9002, 30), one = stackDepth(g.locks.map((l) => l.poly), lm.W, lm.H), three = stackDepth([...g.locks, ...g.locks, ...g.locks].map((l) => l.poly), lm.W, lm.H);
    expect(three).toBe(3 * one);
  });
});

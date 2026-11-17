import { describe, expect, it } from 'vitest';
import { faceLandmarks } from '../src/face';
import { hairGeometry } from '../src/face/hair';
import { poseHair, skullOf } from '../src/face/pose';
import { FaceParams } from '../src/schema';
import { checkHairPose } from '../src/verify/hair-pose';
import { hairFace, type CleanStyle } from '../scripts/lib/hair-faces';

/** Couche de vérification des cheveux sous pose (géométrie, anatomie, style) : corpus multi-graines et contrôles négatifs (`docs/ROTATION-HAIR-VERIFY.md`). */
const STYLES: CleanStyle[] = ['buzz', 'short', 'spiky', 'curly', 'afro', 'bob', 'long', 'ponytail', 'bun', 'braids'];
const YAWS = [-45, -30, -15, 0, 15, 30, 45];
const face = (style: CleanStyle, seed: number) => {
  const f = hairFace(style, 1, { seed }), host = f.objects[0] as unknown as { face: Record<string, unknown>; width: number; height: number };
  return { params: FaceParams.parse(host.face), width: host.width, height: host.height };
};

describe('checkHairPose : corpus', () => {
  for (const style of STYLES) it(`${style} : 3 graines × 7 lacets, aucun contrôle d'erreur ne tombe`, () => {
    for (const seed of [9001, 9002, 9003]) for (const yaw of YAWS) {
      const bad = checkHairPose(face(style, seed), yaw).filter((c) => !c.ok && c.severity !== 'warn');
      expect(bad.map((c) => `${seed}/${yaw} ${c.id} ${c.value}`)).toEqual([]);
    }
  });
});

describe('checkHairPose : contrôles négatifs (un défaut injecté doit être vu)', () => {
  const base = (style: CleanStyle, yaw: number) => {
    const f = face(style, 9001), lm = faceLandmarks(f.params, f.width, f.height), g0 = hairGeometry(f.params, lm)!;
    return { f, lm, g0, g: poseHair(g0, skullOf(lm), yaw, lm.W) };
  };
  const failing = (style: CleanStyle, yaw: number, mutate: (g: ReturnType<typeof base>['g'], lmW: number) => ReturnType<typeof base>['g']) => {
    const b = base(style, yaw);
    return checkHairPose(b.f, yaw, mutate(b.g, b.lm.W)).filter((c) => !c.ok).map((c) => c.id);
  };

  it('mèche étirée ×2 → pose.strand-scale.max', () => {
    const ids = failing('long', 30, (g) => ({ ...g, locks: g.locks.map((l, i) => (i % 2 ? l : { ...l, poly: l.poly.map((q) => ({ x: (l.spine?.[0]?.x ?? 0) + (q.x - (l.spine?.[0]?.x ?? 0)) * 2.2, y: q.y })) })) }));
    expect(ids).toContain('pose.strand-scale.max');
  });
  it('mèche écrasée en trait → pose.strand-scale.min', () => {
    const ids = failing('long', 30, (g) => ({ ...g, locks: g.locks.map((l) => ({ ...l, poly: l.poly.map((q) => ({ x: (l.spine?.[0]?.x ?? 0) + (q.x - (l.spine?.[0]?.x ?? 0)) * 0.1, y: q.y })) })) }));
    expect(ids).toContain('pose.strand-scale.min');
  });
  it('racine décollée → pose.root-glued', () => {
    const ids = failing('short', 30, (g) => ({ ...g, locks: g.locks.map((l) => ({ ...l, poly: l.poly.map((q) => ({ x: q.x + 6, y: q.y })), spine: l.spine?.map((q) => ({ x: q.x + 6, y: q.y })) })) }));
    expect(ids).toContain('pose.root-glued');
  });
  it('implantation hors du crâne → pose.hairline-on-skull', () => {
    const ids = failing('short', 30, (g) => ({ ...g, hairline: g.hairline.map((q) => ({ x: q.x * 1.6, y: q.y })) }));
    expect(ids).toContain('pose.hairline-on-skull');
  });
  it('implantation auto-sécante (extrémités échangées) → pose.hairline-cross', () => {
    const ids = failing('short', 30, (g) => { const h = [...g.hairline], n = h.length; [h[0], h[n - 1]] = [h[n - 1]!, h[0]!]; return { ...g, hairline: h }; });
    expect(ids).toContain('pose.hairline-cross');
  });
  it('coque gonflée de 20 px → pose.shell-bound', () => {
    const ids = failing('short', 30, (g) => ({ ...g, base: g.base.map((p) => p.map((q) => ({ x: q.x + Math.sign(q.x) * 20, y: q.y }))) }));
    expect(ids).toContain('pose.shell-bound');
  });
  it('coordonnée NaN → pose.finite', () => {
    const ids = failing('bob', 30, (g) => ({ ...g, scalp: g.scalp.map((q, i) => (i ? q : { x: NaN, y: q.y })) }));
    expect(ids).toContain('pose.finite');
  });
  it('mèche de devant non fondue (opacité forcée à 1 côté qui se détourne) → pose.over-fade', () => {
    const b = base('long', 45), n = b.g.locks.filter((l) => l.alpha !== undefined).length;
    if (n === 0) return;   // pas de mèche de devant détournée sur cette graine : le contrôle n'a rien à juger
    const ids = failing('long', 45, (g) => ({ ...g, locks: g.locks.map((l) => ({ ...l, alpha: undefined })) }));
    expect(ids).toContain('pose.over-fade');
  });
  it('mèche supprimée → pose.layers', () => {
    const ids = failing('short', 30, (g) => ({ ...g, locks: g.locks.slice(1) }));
    expect(ids).toContain('pose.layers');
  });
  it('chauve : aucun contrôle', () => {
    const f = face('short', 9001);
    expect(checkHairPose({ ...f, params: FaceParams.parse({ ...f.params, hair: { ...f.params.hair, style: 'bald' } }) }, 30)).toEqual([]);
  });
});

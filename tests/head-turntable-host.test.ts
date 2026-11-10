import { describe, expect, it } from 'vitest';
import { generateRandomFace, SceneSpec } from '../src';
import { placedEyesByHost } from '../src/anatomy/placed';
import { head3dSubject, hostEyesOf } from '../src/render/head-3d';
import { HeadRenders } from '../src/head-turntable/verify-head';
import { eyeOverlap, hostChecks, hostOverlap } from '../src/head-turntable/verify-host';
import type { HeadTurnSpec, HostEye } from '../src/head-turntable';
import type { HostSpec } from '../src/schema';

function subject(seed: number, withEyes = true): { spec: HeadTurnSpec; eyes: ReturnType<typeof hostEyesOf> } {
  const f = generateRandomFace(seed, { id: 'f0', transform: { x: 150, y: 220, scale: 0.8 } } as never);
  const sc = SceneSpec.parse({ width: 700, height: 460, objects: [...f.objects, { kind: 'head_3d', id: 't0', host: 'f0', resolution: 1 }] });
  const host = sc.objects.find((o) => o.kind === 'host') as HostSpec, eyes = hostEyesOf(host, placedEyesByHost(sc).get('f0') ?? []);
  return { spec: head3dSubject(host, { skull: {}, variation: { ci: 0, axes: {} }, hair: undefined, hairline: 'host' }, undefined, withEyes ? eyes : undefined).spec, eyes };
}
const shift = (e: HostEye, dx: number, dy: number): HostEye => ({ ...e, upper: e.upper.map((q) => ({ x: q.x + dx, y: q.y + dy })), lower: e.lower.map((q) => ({ x: q.x + dx, y: q.y + dy })), iris: { ...e.iris, cx: e.iris.cx + dx, cy: e.iris.cy + dy } });

describe('recouvrement de la tête 3D à 0° sur le visage de l\'hôte', () => {
  for (const seed of [11, 42, 77]) {
    it(`graine ${seed} : silhouette, peau et yeux de l'hôte se superposent`, () => {
      const { spec } = subject(seed), r0 = new HeadRenders(spec).at(0, true), o = hostOverlap(spec, r0)!;
      expect(o.rows).toBeGreaterThanOrEqual(10);
      expect(o.iou).toBeGreaterThan(0.95);
      expect(o.coverage).toBeGreaterThan(0.96);
      expect(o.skinCover).toBeGreaterThan(0.97);
      for (const side of [1, -1] as const) { const m = eyeOverlap(spec, r0, side)!; expect(m.meanD).toBeLessThan(0.004); expect(m.gaze).toBeLessThan(0.02); }
      const { geometry, anatomy } = hostChecks(spec, r0);
      expect([...geometry, ...anatomy].filter((c) => !c.ok)).toEqual([]);
    });
  }

  it('un hôte chauve n\'a pas d\'épaisseur de coiffure sur le crâne : le contour 3D recouvre le contour du visage sur tout le crâne', () => {
    const { spec } = subject(42), r0 = new HeadRenders(spec).at(0, true), o = hostOverlap(spec, r0)!;
    expect(spec.hairline.knots.every(([, y]) => y < 0)).toBe(true);
    expect(o.rows).toBeGreaterThanOrEqual(20);   // les rangées du crâne comptent (aucune n'est bordée de cheveux)
    expect(o.iou).toBeGreaterThan(0.99);
  });

  it('les yeux de la tête sont ceux de l\'hôte : largeur, hauteur et rayon d\'iris viennent de leur géométrie, pas de la planche', () => {
    const { spec, eyes } = subject(11), { spec: planche } = subject(11, false), E = eyes!;
    const w = (e: HostEye): number => { const xs = [...e.upper, ...e.lower].map((q) => q.x); return Math.max(...xs) - Math.min(...xs); };
    expect(spec.eye.w).toBeCloseTo((w(E.right) + w(E.left)) / 2, 6);
    expect(spec.eye.irisR).toBeCloseTo((E.right.iris.rx + E.left.iris.rx) / 2, 6);
    expect(Math.abs(spec.eye.w - planche.eye.w)).toBeGreaterThan(0.01);   // la planche mettait l'œil à l'échelle de l'orbite : 0,19 U contre 0,15 réel sur cet hôte
  });

  it('le contrôle est sensible : un œil décalé de 0,03 U, ou un regard décalé de 0,04 U, est refusé', () => {
    const { spec } = subject(11), r0 = new HeadRenders(spec).at(0, true), E = spec.eyeHost!;
    const moved = { ...spec, eyeHost: { ...E, right: shift(E.right, 0.03, 0.02) } }, base = hostChecks(moved, r0).anatomy;
    expect(base.find((c) => c.id === 'head.host.eye.right.outline')!.ok).toBe(false);
    const gaze = { ...spec, eyeHost: { ...E, left: { ...E.left, iris: { ...E.left.iris, cx: E.left.iris.cx + 0.04 } } } };
    expect(hostChecks(gaze, r0).anatomy.find((c) => c.id === 'head.host.eye.left.gaze')!.ok).toBe(false);
  });
});

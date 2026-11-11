import { describe, expect, it } from 'vitest';
import { generateRandomFace, SceneSpec } from '../src';
import { placedEyesByHost } from '../src/anatomy/placed';
import { head3dSubject, hostEyesOf } from '../src/render/head-3d';
import { HeadRenders } from '../src/head-turntable/verify-head';
import { browChecks, browMeasure } from '../src/head-turntable/verify-brow';
import { REGION, type HeadTurnSpec, type HostBrow } from '../src/head-turntable';
import type { HostSpec } from '../src/schema';

function subject(seed: number): { spec: HeadTurnSpec } {
  const f = generateRandomFace(seed, { id: 'f0', transform: { x: 150, y: 220, scale: 0.8 } } as never);
  const sc = SceneSpec.parse({ width: 700, height: 460, objects: [...f.objects, { kind: 'head_3d', id: 't0', host: 'f0', resolution: 1 }] });
  const host = sc.objects.find((o) => o.kind === 'host') as HostSpec;
  return { spec: head3dSubject(host, { skull: {}, variation: { ci: 0, axes: {} }, hair: undefined, hairline: 'host' }, undefined, hostEyesOf(host, placedEyesByHost(sc).get('f0') ?? [])).spec };
}
const count = (r: { regions: Uint8Array }): number => r.regions.reduce((n, v) => n + (v === REGION.brow ? 1 : 0), 0);
const shiftBrow = (b: HostBrow, dy: number): HostBrow => ({ ...b, outline: b.outline.map((q) => ({ x: q.x, y: q.y + dy })), line: b.line.map((q) => ({ x: q.x, y: q.y + dy })) });

describe('sourcils de l\'hôte dans la tête 3D', () => {
  for (const seed of [3, 42, 77]) {
    it(`graine ${seed} : le sourcil rendu est celui du moteur de sourcil de l'hôte (position, aire, au-dessus de l'œil, suit la rotation)`, () => {
      const { spec } = subject(seed), E = spec.eyeHost!, R = new HeadRenders(spec);
      expect(E.right.brow && E.left.brow).toBeTruthy();
      expect(E.right.brow!.outline.length).toBeGreaterThanOrEqual(40);
      const cs = browChecks(spec, R.at(0, true), R.at(35, true), 35);
      expect(cs.length).toBeGreaterThanOrEqual(9);
      expect(cs.filter((c) => !c.ok)).toEqual([]);
      expect(count(R.at(0, true))).toBeGreaterThan(100);
    });
  }

  it('un hôte sans sourcil n\'en reçoit pas : aucun pixel de sourcil, contrôles « none » satisfaits', () => {
    const { spec } = subject(11), R = new HeadRenders(spec);
    expect(spec.eyeHost!.right.brow).toBeUndefined();
    expect(count(R.at(0, true))).toBe(0);
    const cs = browChecks(spec, R.at(0, true), R.at(35, true), 35);
    expect(cs.map((c) => c.id).sort()).toEqual(['head.host.brow.left.none', 'head.host.brow.right.none']);
    expect(cs.every((c) => c.ok)).toBe(true);
  });

  it('le contrôle est sensible : un sourcil décalé de 0,03 U, ou mêlé à la paupière, est refusé', () => {
    const { spec } = subject(42), R = new HeadRenders(spec), r0 = R.at(0, true), E = spec.eyeHost!;
    const moved = { ...spec, eyeHost: { ...E, right: { ...E.right, brow: shiftBrow(E.right.brow!, 0.03) } } };
    expect(browChecks(moved, r0, R.at(35, true), 35).find((c) => c.id === 'head.host.brow.right.line')!.ok).toBe(false);
    const sunk = shiftBrow(E.right.brow!, 0.2), m = browMeasure(r0, 1, sunk, E.right.upper);
    expect(m.gap).toBeLessThan(0);
  });

  it('la spec lit le vrai sourcil : point haut et queue de `brow` viennent de la ligne médiane de l\'hôte, pas de la planche', () => {
    const { spec } = subject(77), E = spec.eyeHost!, mid = (E.right.brow!.line.reduce((m, q) => Math.min(m, q.y), 9) + E.left.brow!.line.reduce((m, q) => Math.min(m, q.y), 9)) / 2;
    expect(spec.brow.yMid).toBeCloseTo(mid, 9);
    const { spec: other } = subject(42);
    expect(Math.abs(spec.brow.yMid - other.brow.yMid)).toBeGreaterThan(0.02);
  });
});

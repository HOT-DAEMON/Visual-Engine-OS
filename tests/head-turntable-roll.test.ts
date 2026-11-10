import { describe, expect, it } from 'vitest';
import { Head3dSpec } from '../src/schema/head-3d';
import { REF_SPEC, defaultFrame, renderHead } from '../src/head-turntable';
import { ROLL_MAX, rollRig } from '../src/head-turntable/roll';
import { HeadRenders } from '../src/head-turntable/verify-head';
import { ROLL_PROBE, rollChecks } from '../src/head-turntable/verify-roll';

const frame = defaultFrame(300), R = (yaw: number, roll: number, pitch = 0) => renderHead({ yaw, pitch, roll }, REF_SPEC, { frame, ss: 1 });
const eyeLine = (r: ReturnType<typeof R>): number => {
  const px: [number, number][] = []; let mx = 0;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (r.regions[y * r.w + x] === 3) { px.push([x, y]); mx += x; }
  mx /= px.length;
  const c = (a: [number, number][]) => [a.reduce((s, q) => s + q[0], 0) / a.length, a.reduce((s, q) => s + q[1], 0) / a.length] as const;
  const l = c(px.filter((q) => q[0] < mx)), r2 = c(px.filter((q) => q[0] >= mx));
  return (Math.atan2(r2[1] - l[1], r2[0] - l[0]) * 180) / Math.PI;
};

describe('roulis de la tête 3D', () => {
  it('roulis 0 ou absent : rendu strictement identique', () => {
    const a = renderHead({ yaw: 30, pitch: 10 }, REF_SPEC, { frame, ss: 1 }), b = renderHead({ yaw: 30, pitch: 10, roll: 0 }, REF_SPEC, { frame, ss: 1 });
    expect(Buffer.from(a.rgba).equals(Buffer.from(b.rgba))).toBe(true);
  });
  it('convention : roulis > 0 = la tête s\'incline vers la droite de l\'image (sens horaire) ; ± symétriques ; la ligne des yeux tourne de l\'angle demandé', () => {
    const t0 = eyeLine(R(0, 0)), tp = eyeLine(R(0, 25)) - t0, tm = eyeLine(R(0, -25)) - t0;
    expect(tp).toBeGreaterThan(23.5); expect(tp).toBeLessThan(26.5);
    expect(tm).toBeLessThan(-23.5); expect(tm).toBeGreaterThan(-26.5);
  });
  it('le gréement pivote au haut du cou et plie le cou depuis sa base : base immobile, sommet suivant', () => {
    const g = rollRig(REF_SPEC, 30);
    expect(g.T.y).toBeCloseTo(REF_SPEC.neck.y0, 9); expect(g.B.y).toBeCloseTo(REF_SPEC.neck.y1, 9);
    expect(g.bend / g.roll).toBeGreaterThan(0.2); expect(g.bend / g.roll).toBeLessThan(0.6);
  });
  it('de profil, le roulis incline la tête vers ou loin de la caméra : la silhouette change, le rendu reste d\'un seul tenant', () => {
    const a = R(90, 0), b = R(90, 25);
    let diff = 0; for (let i = 0; i < a.ids.length; i++) if ((a.ids[i] === 0) !== (b.ids[i] === 0)) diff++;
    expect(diff).toBeGreaterThan(200);
  });
  it('contrôles de roulis : angle, rigidité, jonction, base du cou', () => {
    const rr = new HeadRenders(REF_SPEC, 300), { geometry, anatomy } = rollChecks(REF_SPEC, rr.at(0, true), rr.rolled(0, ROLL_PROBE), rr.rolled(60, -ROLL_PROBE));
    expect([...geometry, ...anatomy].filter((c) => !c.ok)).toEqual([]);
    expect(geometry.map((c) => c.id)).toEqual(['head.roll.eyeline', 'head.roll.rigid', 'head.roll.joined']);
    expect(anatomy.map((c) => c.id)).toEqual(['head.roll.neck-base']);
  });
  it('schéma : ±40° acceptés, au-delà refusé ; 0 par défaut', () => {
    const base = { kind: 'head_3d', id: 't0', host: 'f0' };
    expect(Head3dSpec.parse(base).roll).toBe(0);
    expect(Head3dSpec.parse({ ...base, roll: ROLL_MAX }).roll).toBe(40);
    expect(() => Head3dSpec.parse({ ...base, roll: 41 })).toThrow();
    expect(() => Head3dSpec.parse({ ...base, roll: -41 })).toThrow();
  });
});

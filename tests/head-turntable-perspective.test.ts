import { describe, expect, it } from 'vitest';
import { defaultFrame, REF_SPEC, renderHead } from '../src/head-turntable';
import { variedHead } from '../src/head-turntable/engines/from-face';
import { project, toCam, v3 } from '../src/head-turntable/math';
import { REGION } from '../src/head-turntable/types';

const fr = defaultFrame(420);
const widthAtRow = (r: ReturnType<typeof renderHead>, y: number): number => { let n = 0; for (let x = 0; x < r.w; x++) if (r.ids[y * r.w + x]) n++; return n; };

describe('caméra en perspective (optionnelle ; référence : rotation-3d/01, 02, 06)', () => {
  it('sans `persp` : projection orthographique STRICTEMENT identique (aucun écart sur la planche)', () => {
    const c = toCam(v3(0.2, 0.7, 0.3), { yaw: 30, pitch: 17.7 });
    expect(project(c, { yaw: 30, pitch: 17.7 })).toEqual({ x: c.x, y: c.y, z: c.z, iw: 1 });
    const a = renderHead({ yaw: 30, pitch: 17.7 }, REF_SPEC, { frame: fr, ss: 1 }), b = renderHead({ yaw: 30, pitch: 17.7, persp: undefined }, REF_SPEC, { frame: fr, ss: 1 });
    expect(Buffer.from(a.rgba).equals(Buffer.from(b.rgba))).toBe(true);
  });

  it('le centre de la tête ne bouge pas ; un point plus PROCHE de la caméra est grossi, un point plus loin est réduit', () => {
    const v = { yaw: 0, pitch: 0, persp: 4 }, f = project(toCam(v3(0, 0.5, 0), v), v);
    expect(f.x).toBeCloseTo(0, 12); expect(f.y).toBeCloseTo(0.5, 12);
    const near = project(toCam(v3(0.3, 0.5, 0.4), v), v), far = project(toCam(v3(0.3, 0.5, -0.4), v), v);
    expect(near.x).toBeGreaterThan(0.3); expect(far.x).toBeLessThan(0.3);
    expect(near.x / 0.3).toBeCloseTo(4 / (4 - 0.4), 9);
  });

  it('en contre-plongée le menton (proche) grossit : la largeur de la mâchoire augmente en perspective, le sommet du crâne (loin) diminue', () => {
    const s = variedHead(11).spec, view = { yaw: 0, pitch: 35 };
    const o = renderHead(view, s, { frame: fr, ss: 1 }), p = renderHead({ ...view, persp: 3 }, s, { frame: fr, ss: 1 });
    let top = -1, jaw = -1; for (let y = 0; y < o.h && top < 0; y++) if (widthAtRow(o, y) > 0) top = y;
    for (let y = o.h - 1; y >= 0 && jaw < 0; y--) if (o.regions[y * o.w + Math.floor(o.w / 2)] === REGION.skin) jaw = y;
    const rowTop = top + 25, rowJaw = jaw - 10;
    expect(widthAtRow(p, rowTop)).toBeLessThanOrEqual(widthAtRow(o, rowTop) + 2);
    expect(widthAtRow(p, rowJaw)).toBeGreaterThan(widthAtRow(o, rowJaw));
  });

  it('la perspective est déterministe et continue : distance infinie → orthographique (écart de pixels quasi nul à 60 U)', () => {
    const s = variedHead(3).spec, a = renderHead({ yaw: 40, pitch: 20 }, s, { frame: fr, ss: 1 }), b = renderHead({ yaw: 40, pitch: 20, persp: 60 }, s, { frame: fr, ss: 1 });
    let diff = 0; for (let i = 0; i < a.ids.length; i++) if ((a.ids[i] === 0) !== (b.ids[i] === 0)) diff++;
    expect(diff / a.ids.length).toBeLessThan(0.01);
  });
});

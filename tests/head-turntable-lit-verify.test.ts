import { describe, expect, it } from 'vitest';
import { generateRandomFace, SceneSpec } from '../src';
import { placedEyesByHost } from '../src/anatomy/placed';
import { head3dSubject, hostEyesOf } from '../src/render/head-3d';
import { litChecks } from '../src/head-turntable/verify-light';
import { alaDeviationDeg, alaWeight } from '../src/head-turntable/nose-light';
import { hairSheen, hairTones, strandTangent } from '../src/head-turntable/hair-light';
import { cullFarEar } from '../src/head-turntable/engines/ear-cull';
import { buildParts } from '../src/head-turntable/parts';
import { PART } from '../src/head-turntable/mesh';
import { rasterize } from '../src/head-turntable/raster';
import { defaultFrame } from '../src/head-turntable/render';
import { norm, v3 } from '../src/head-turntable/math';
import { REF_SPEC } from '../src/head-turntable/spec';
import { bounceAt, lightModelOf, shadeAt, toLab } from '../src/relief';
import type { HostSpec } from '../src/schema';

const subject = (seed: number) => {
  const f = generateRandomFace(seed, { id: 'f0', transform: { x: 150, y: 220, scale: 0.8 } } as never);
  const sc = SceneSpec.parse({ width: 700, height: 460, objects: [...f.objects, { kind: 'head_3d', id: 't0', host: 'f0', resolution: 1 }] });
  const host = sc.objects.find((o) => o.kind === 'host') as HostSpec;
  return head3dSubject(host, { skull: {}, variation: { ci: 0, axes: {} }, hair: undefined, hairline: 'host' }, undefined, hostEyesOf(host, placedEyesByHost(sc).get('f0') ?? [])).spec;
};
const CEL = lightModelOf({ azimuthDeg: 30, elevationDeg: 40, shadowHardness: 0.9, sourceSize: 0.15 }, { style: 'cel2' });

describe('tête en rotation éclairée : couche de vérification (géométrie / anatomie / style)', () => {
  it('graine 11, lumière trois-quarts droite en cel : aucun contrôle bloquant en échec', () => {
    const cs = litChecks(subject(11), CEL);
    expect(cs.filter((c) => c.layer === 'geometry').length).toBeGreaterThanOrEqual(5);
    expect(cs.filter((c) => c.layer === 'anatomy').length).toBeGreaterThanOrEqual(4);
    expect(cs.filter((c) => c.layer === 'style').length).toBeGreaterThanOrEqual(3);
    expect(cs.filter((c) => c.kind === 'hard' && !c.ok).map((c) => `${c.id}=${c.value}`)).toEqual([]);
  }, 60_000);

  it('le contrôle des ailes du nez est sensible : sans adoucissement des normales (ellipsoïdes bruts) l\'écart dépasse 35°, avec : ≤ 35°', () => {
    const spec = REF_SPEC, v = { yaw: 30, pitch: 0 }, fr = defaultFrame(420), g = rasterize(cullFarEar(buildParts(spec), v), v, { w: fr.w * 2, h: fr.h * 2, ppu: fr.ppu * 2, ox: fr.ox * 2, oy: fr.oy * 2 });
    const s: { p: ReturnType<typeof v3>; n: ReturnType<typeof v3> }[] = [];
    for (let k = 0; k < g.w * g.h; k++) if (g.id[k] === PART.bump) { const p = v3(g.P[3 * k]!, g.P[3 * k + 1]!, g.P[3 * k + 2]!); if (alaWeight(spec, p) >= 0.999) s.push({ p, n: norm(v3(g.N[3 * k]!, g.N[3 * k + 1]!, g.N[3 * k + 2]!)) }); }
    expect(s.length).toBeGreaterThan(100);
    expect(alaDeviationDeg(spec, s, false)).toBeGreaterThan(35);
    expect(alaDeviationDeg(spec, s)).toBeLessThanOrEqual(35);
  });

  it('lumière de rebond : par en dessous seulement, jamais sur une surface occultée, bornée par `bounce` ; nulle en cel sous le seuil', () => {
    const soft = lightModelOf({ azimuthDeg: 30, elevationDeg: 40 }, { style: 'soft' });
    const under = bounceAt(soft, norm({ x: 0, y: 0.8, z: 0.6 }), 0), over = bounceAt(soft, norm({ x: 0, y: -0.8, z: 0.6 }), 0);
    expect(under).toBeGreaterThan(0.05); expect(under).toBeLessThanOrEqual(soft.bounce + 1e-9);
    expect(over).toBe(0);
    expect(bounceAt(soft, norm({ x: 0, y: 0.8, z: 0.6 }), 1)).toBe(0);
    expect(bounceAt(CEL, norm({ x: 0, y: -0.8, z: 0.6 }), 0)).toBe(0);
  });

  it('cheveux : ombre dérivée des cheveux (écart ΔL borné à 55 % de leur clarté), brin le long du méridien, brillance nulle côté ombre et au sommet', () => {
    const t = hairTones(REF_SPEC, CEL), L = toLab(REF_SPEC.palette.hair).L, Ls = toLab(t.shadow).L;
    expect(Ls).toBeGreaterThanOrEqual(0.44 * L - 0.01);
    const side = strandTangent(norm(v3(1, 0, 0)));
    expect(side.y).toBeGreaterThan(0.99);
    expect(Math.hypot(strandTangent(v3(0, -1, 0)).x, strandTangent(v3(0, -1, 0)).y)).toBe(0);
    const n = norm(v3(0.3, -0.6, 0.7)), sh = shadeAt(CEL, { x: 0, y: 0, z: 1 }, 1, 0);   // cast = 1 : tout à l'ombre
    expect(hairSheen(CEL, n, 0.3, { yaw: 0, pitch: 0 }, sh)).toBe(0);
  });
});

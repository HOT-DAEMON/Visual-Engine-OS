import { describe, expect, it } from 'vitest';
import { REF_SPEC, sectionAt, sectionPoint, surfaceZ, halfWidthAtZ } from '../src/head-turntable';
import { variedHead } from '../src/head-turntable/engines/from-face';
import { SKULL_SHAPE, hasSkullModel, skullFields, skullWeight } from '../src/head-turntable/engines/skull-model';
import { HeadRenders, verifyHeadSubject } from '../src/head-turntable/verify-head';
import { skullAnatomyChecks, skullGeometryChecks } from '../src/head-turntable/verify-skull';

const heads = [1, 2, 3, 4, 5, 6, 7, 8].map(variedHead);

describe('moitié arrière en superellipse (pb, qb)', () => {
  const s = { y: 0.4, a: 0.2, zc: 0.1, b: 0.3, zf: 0.4, zb: -0.2, zw: 0.05, pf: 2, qf: 2, pb: 2.8, qb: 2.3 };
  it('passe par (a, zw), (0, zf) et (0, zb) ; surfaceZ et halfWidthAtZ sont réciproques à l\'arrière', () => {
    expect(sectionPoint(s, Math.PI / 2).x).toBeCloseTo(s.a, 9); expect(sectionPoint(s, Math.PI).z).toBeCloseTo(s.zb, 9);
    for (const x of [0.02, 0.08, 0.14, 0.19]) expect(halfWidthAtZ(s, surfaceZ(s, x, false))).toBeCloseTo(x, 6);
    for (let th = Math.PI / 2 + 0.1; th < Math.PI; th += 0.25) { const q = sectionPoint(s, th); expect(surfaceZ(s, q.x, false)).toBeCloseTo(q.z, 6); }
  });
  it('pb = qb = 2 (ou absents) redonne la demi-ellipse d\'origine', () => {
    const e = { ...s, pb: 2, qb: 2 }, o = { ...s, pb: undefined, qb: undefined };
    for (const th of [2, 2.6, 3.0, 3.5, 4.2]) expect(sectionPoint(e, th)).toEqual(sectionPoint(o, th));
  });
  it('un occiput aplati (pb > 2) recule davantage de surface à l\'arrière qu\'une ellipse', () => {
    const flat = { ...s, pb: 3, qb: 2.4 }, ell = { ...s, pb: 2, qb: 2 };
    expect(surfaceZ(flat, 0.12, false)).toBeLessThan(surfaceZ(ell, 0.12, false));
  });
});

describe('modèle de crâne (skull-model)', () => {
  const e = heads[0]!.spec.engine!;
  it('la planche garde ses ellipses : aucune rangée du crâne ne porte de forme', () => {
    expect(hasSkullModel(REF_SPEC.engine!)).toBe(false);
    expect(REF_SPEC.rows.filter((r) => r.y < 0.76).every((r) => r.zw === undefined && r.pb === undefined && r.qb === undefined)).toBe(true);
  });
  it('poids nul au vertex et à la mâchoire, plein sur la voûte et le visage', () => {
    expect(skullWeight(0)).toBe(0); expect(skullWeight(SKULL_SHAPE.out1)).toBe(0); expect(skullWeight(0.4)).toBeCloseTo(1, 9);
    expect(skullFields(e, 0.0, 0.3, 0.4, -0.3)).toBeNull(); expect(skullFields(e, 0.8, 0.3, 0.4, -0.3)).toBeNull();
  });
  it('plus la coupe est large par rapport à sa profondeur, plus l\'occiput est plat ; un chignon l\'affine', () => {
    const wide = skullFields(e, 0.3, 0.55, 0.4, -0.3)!, narrow = skullFields(e, 0.3, 0.3, 0.4, -0.3)!;
    expect(wide.pb).toBeGreaterThan(narrow.pb); expect(wide.qb).toBeGreaterThan(narrow.qb);
  });
  it('exposants bornés, point large à l\'intérieur de la coupe', () => {
    for (const h of heads) for (const r of h.spec.rows) {
      if (r.y < 0.76) for (const v of [r.pf ?? 2, r.qf ?? 2, r.pb ?? 2, r.qb ?? 2]) { expect(v).toBeGreaterThanOrEqual(1.4); expect(v).toBeLessThanOrEqual(2.9); }
      if (r.zw !== undefined && r.y < 0.76) { expect(r.zw).toBeGreaterThan(r.zb); expect(r.zw).toBeLessThan(r.zf); }
    }
  });
  it('la forme ne change ni le profil (zf, zb) ni la largeur : contrôles de géométrie et d\'anatomie du crâne sans échec', () => {
    for (const h of heads) {
      expect(hasSkullModel(h.spec.engine!)).toBe(true);
      const g = skullGeometryChecks(h.spec, new HeadRenders(h.spec, 200)).filter((c) => c.id !== 'head.geo.skull.45.concavity' && c.id !== 'head.geo.skull.135.concavity');
      expect(g.filter((c) => !c.ok).map((c) => `${c.id}=${c.value}`)).toEqual([]);
      expect(skullAnatomyChecks(h.spec).filter((c) => !c.ok && c.kind !== 'info').map((c) => c.id)).toEqual([]);
    }
  });
  it('les têtes ont des vues de dessus DIFFÉRENTES (pas une ellipse unique) : étendue de pb ≥ 0,4 et de la position du point large ≥ 0,05', () => {
    const pb = heads.map((h) => sectionAt(h.spec, 0.3).pb ?? 2), wf = heads.map((h) => { const c = sectionAt(h.spec, 0.15); return (c.zw - c.zb) / (c.zf - c.zb); });
    expect(Math.max(...pb) - Math.min(...pb)).toBeGreaterThan(0.4); expect(Math.max(...wf) - Math.min(...wf)).toBeGreaterThan(0.05);
  });
  it('couche de vérification complète : aucun échec bloquant (2 graines)', () => {
    for (const h of [heads[1]!, heads[4]!]) {
      const r = verifyHeadSubject({ id: `seed${h.seed}`, spec: h.spec, lengthH: h.profile.derivation.lengthH }, new HeadRenders(h.spec, 420));
      expect(r.hardFailures.map((c) => `${c.id}=${c.value}`)).toEqual([]);
      expect(r.layers.flatMap((l) => l.checks).some((c) => c.id === 'head.geo.skull.convex')).toBe(true);
    }
  });
});

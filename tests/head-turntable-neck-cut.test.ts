import { describe, expect, it } from 'vitest';
import { defaultFrame, REF_SPEC, refView, renderHead } from '../src/head-turntable';
import { variedHead } from '../src/head-turntable/engines/from-face';
import { CUT_SLOPE, CUT_TILT_DEG, neckCutY, neckSection } from '../src/head-turntable/engines/neck3d';
import { neckMark, neckReliefOf } from '../src/head-turntable/engines/neck-relief';
import { neckCutRing, neckMeshes, NECK_EXT, PART } from '../src/head-turntable/mesh';
import { neckClipPx } from '../src/head-turntable/neck-clip';
import { BUCKET_VIEWS, bottomRatio, cutOf, neckCutChecks, share } from '../src/head-turntable/verify-neck-cut';

const fr = defaultFrame(520);

describe('bas du cou : anneau oblique de l\'orifice thoracique, prolongation, coupe par le cadre', () => {
  for (const seed of [3, 5, 11, 21]) {
    it(`graine ${seed} : anneau coplanaire, devant plus bas de la pente réglée, pas de seau, contrôles des 3 couches satisfaits`, () => {
      const h = variedHead(seed), m = cutOf(h.spec);
      expect(m.planarity).toBeLessThan(1e-6);
      expect(m.slopeDeg).toBeCloseTo(CUT_TILT_DEG, 3);
      expect(m.dropFrontBack).toBeGreaterThan(0.03);
      const c = neckCutChecks(h.spec), all = [...c.geometry, ...c.anatomy, ...c.style];
      expect(all.length).toBe(6);
      expect(all.filter((k) => !k.ok)).toEqual([]);
    });
  }

  it('la planche garde son disque horizontal mesuré : aucun contrôle, anneau de coupe à y1 exact, le « socle » y est bien mesuré (> 0,15 du cou ; mesuré 0,26)', () => {
    const c = neckCutChecks(REF_SPEC);
    expect([...c.geometry, ...c.anatomy, ...c.style]).toEqual([]);
    const ring = neckMeshes(REF_SPEC)[1]!.P.slice(0, 64);
    expect(Math.max(...ring.map((p) => p.y)) - Math.min(...ring.map((p) => p.y))).toBeLessThan(1e-12);
    expect(share(renderHead(refView(0), REF_SPEC, { frame: fr, ss: 2 }))).toBeGreaterThan(0.15);   // la mesure détecte l'ancien comportement : le contrôle « socle » n'est pas aveugle
  });

  it('pas de seau : aucun pixel de plan de coupe aux vues de contre-plongée, bas du cou droit ; la planche, elle, garde son disque', () => {
    const s = variedHead(3).spec;
    for (const v of BUCKET_VIEWS) {
      const r = renderHead(v, s, { frame: fr, ss: 2 });
      expect(share(r)).toBe(0);
      expect(bottomRatio(r)).toBeGreaterThan(0.9);
    }
    expect(neckMeshes(s).every((m) => m.id !== PART.neckCut)).toBe(true);
    expect(neckMeshes(REF_SPEC).some((m) => m.id === PART.neckCut)).toBe(true);
    expect(bottomRatio(renderHead({ yaw: 90, pitch: 30 }, REF_SPEC, { frame: fr, ss: 2 }))).toBeLessThan(0.7);   // le contrôle n'est pas aveugle : le disque de la planche se resserre (ellipse)
  });

  it('le cou se prolonge de NECK_EXT sous sa base ; la ligne de coupe du cadre passe par le point le plus bas de l\'anneau, perspective comprise', () => {
    const s = variedHead(5).spec, ring = neckCutRing(s), mesh = neckMeshes(s)[0]!;
    expect(Math.max(...mesh.P.map((p) => p.y))).toBeCloseTo(s.neck.y1 + NECK_EXT, 9);
    expect(Math.max(...ring.map((p) => p.y))).toBeLessThan(s.neck.y1 + NECK_EXT);
    expect(neckClipPx(REF_SPEC, { yaw: 0, pitch: 0 }, fr)).toBeUndefined();
    const o = neckClipPx(s, { yaw: 0, pitch: 40 }, fr)!, p = neckClipPx(s, { yaw: 0, pitch: 40, persp: 3.5 }, fr)!;
    expect(Number.isFinite(o)).toBe(true);
    expect(p).toBeGreaterThan(o);   // en perspective le bas du cou, plus proche de la caméra sous le menton, est plus bas dans l'image
  });

  it('la clavicule et la fosse sus-sternale suivent le plan de coupe : aucune marque sous le plan, et des marques à moins de 0,08 U au-dessus', () => {
    for (const seed of [3, 11, 77]) {
      const e = variedHead(seed).spec.engine!, spec = variedHead(seed).spec, y1 = spec.neck.y1;
      if (neckReliefOf(e).clavicle <= 0.05) continue;
      const b = neckSection(e, y1, y1);
      let below = 0, near = 0;
      for (let j = 0; j <= 80; j++) for (let k = 0; k < 120; k++) {
        const psi = (j / 80) * 0.55 * Math.PI, z = b.zc + b.b * Math.cos(psi), yb = neckCutY(e, z, y1), y = yb - 0.1 + (k / 120) * 0.12, x = b.a * Math.sin(psi);
        if (!neckMark(spec, { x, y, z })) continue;
        if (y > yb + 1e-9) below++; else if (yb - y < 0.08) near++;
      }
      expect(below).toBe(0);
      expect(near).toBeGreaterThan(0);
    }
  });

  it('pente d\'ancrage cohérente : neckCutY = y1 + pente × (z − centre de la base)', () => {
    const spec = variedHead(5).spec, e = spec.engine!, y1 = spec.neck.y1, b = neckSection(e, y1, y1);
    expect(neckCutY(e, b.zc, y1)).toBeCloseTo(y1, 12);
    expect(neckCutY(e, b.zc + 0.1, y1)).toBeCloseTo(y1 + 0.1 * CUT_SLOPE, 12);
  });
});

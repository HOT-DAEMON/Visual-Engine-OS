import { describe, expect, it } from 'vitest';
import { defaultFrame, REF_SPEC, refView, renderHead } from '../src/head-turntable';
import { variedHead } from '../src/head-turntable/engines/from-face';
import { CUT_SLOPE, CUT_TILT_DEG, neckCutY, neckSection } from '../src/head-turntable/engines/neck3d';
import { neckMark, neckReliefOf } from '../src/head-turntable/engines/neck-relief';
import { neckMeshes } from '../src/head-turntable/mesh';
import { cutOf, neckCutChecks, share } from '../src/head-turntable/verify-neck-cut';

const fr = defaultFrame(520);

describe('coupe oblique du cou (plan de l\'orifice thoracique)', () => {
  for (const seed of [3, 5, 11, 21]) {
    it(`graine ${seed} : plan coplanaire, devant plus bas de la pente réglée, pas de socle à 17,7°, contrôles des 3 couches satisfaits`, () => {
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

  it('le plan de coupe est vu quand la caméra le voit (tangage 60°) et caché sous 25° : même seuil que la pente', () => {
    const s = variedHead(3).spec, below = share(renderHead({ yaw: 0, pitch: CUT_TILT_DEG - 8 }, s, { frame: fr, ss: 2 })), above = share(renderHead({ yaw: 0, pitch: CUT_TILT_DEG + 25 }, s, { frame: fr, ss: 2 }));
    expect(below).toBeLessThan(0.02);   // plan tourné vers le bas et l'arrière : de face et sous la pente, on ne le voit pas
    expect(above).toBeGreaterThan(0.3);
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

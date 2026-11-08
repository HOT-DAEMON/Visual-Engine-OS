import { describe, expect, it } from 'vitest';
import { REF_SPEC, buildParts, defaultFrame, rasterize, refView, headPoint } from '../src/head-turntable';
import { PART, headMesh } from '../src/head-turntable/mesh';
import { variedHead } from '../src/head-turntable/engines/from-face';
import { headRelief } from '../src/head-turntable/engines/head-relief';
import { cheekRelief } from '../src/head-turntable/engines/cheek-relief';
import { parietalAmplitude, skullAsymmetry, skullRelief } from '../src/head-turntable/engines/skull-relief';
import { cullFarEar, farEarSide } from '../src/head-turntable/engines/ear-cull';
import { neckSection } from '../src/head-turntable/engines/neck3d';
import { engineHead } from '../src/head-turntable/engines/face-model';
import { fitFromProfile } from '../src/head-turntable/engines/from-face';
import { HeadRenders } from '../src/head-turntable/verify-head';
import { reliefAnatomyChecks, reliefGeometryChecks, reliefStyleChecks } from '../src/head-turntable/verify-relief';

const heads = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(variedHead);
const D = Math.PI / 180;

describe('relief du crâne et des joues', () => {
  it('la planche (silhouette mesurée) n\'a AUCUN relief ajouté : son maillage de tête est celui des sections', () => {
    expect(headRelief(REF_SPEC.engine)).toBeNull();
    const m = headMesh(REF_SPEC, 24, 0.1);
    for (const p of m.P.slice(0, 200)) { expect(Number.isFinite(p.x + p.y + p.z)).toBe(true); }
  });
  it('12 têtes : amplitude bornée, nulle à la face (< 4°) et à 90° pour les joues, continue', () => {
    for (const h of heads) {
      const e = h.spec.engine!, rel = headRelief(e)!;
      expect(rel).not.toBeNull();
      let mx = 0; for (let y = 0.05; y < 1; y += 0.0125) for (let a = 0; a <= 360; a += 3) mx = Math.max(mx, Math.abs(rel(y, a * D)));
      expect(mx).toBeLessThan(0.04); expect(mx).toBeGreaterThan(0.004);
      for (const y of [0.2, 0.5, 0.7, 0.9]) { expect(Math.abs(rel(y, 2 * D))).toBeLessThan(0.002); expect(Math.abs(cheekRelief(e, y, Math.PI / 2))).toBeLessThan(0.001); }
    }
  });
  it('éminence pariétale : derrière l\'oreille (95° – 135°) et au tiers supérieur, sur 12 têtes', () => {
    for (const h of heads) {
      const e = h.spec.engine!; let best = { v: -1, y: 0, az: 0 };
      for (let y = 0.05; y <= 0.7; y += 0.0125) for (let az = 0; az <= 180; az += 3) { const v = skullRelief(e, y, az * D); if (v > best.v) best = { v, y, az }; }
      expect(best.az).toBeGreaterThanOrEqual(95); expect(best.az).toBeLessThanOrEqual(135); expect(best.y).toBeGreaterThan(0.12); expect(best.y).toBeLessThan(0.4);
      expect(parietalAmplitude(e)).toBeGreaterThanOrEqual(0.006);
    }
  });
  it('asymétrie : une asymétrie nulle donne un relief symétrique ; une asymétrie non nulle le rend dissymétrique (sans dépasser 0,03 U)', () => {
    const base = heads[0]!, p = base.profile.face.params as Record<string, unknown>;
    const sym = engineHead(fitFromProfile({ ...base.profile, face: { ...base.profile.face, params: { ...p, asymmetry: { eyeScale: 0, eyeOpenness: 0, eyeRollDeg: 0, eyeDy: 0, mouthTiltDeg: 0 } } } } as never));
    expect(skullAsymmetry(sym)).toBe(0);
    for (const y of [0.2, 0.3]) for (const az of [30, 60, 112, 150]) expect(skullRelief(sym, y, az * D)).toBeCloseTo(skullRelief(sym, y, -az * D), 12);
    const e = base.spec.engine!; expect(Math.abs(skullAsymmetry(e))).toBeGreaterThan(0.05);
    let diff = 0; for (const y of [0.2, 0.3]) for (const az of [40, 112, 150]) diff = Math.max(diff, Math.abs(skullRelief(e, y, az * D) - skullRelief(e, y, -az * D)));
    expect(diff).toBeGreaterThan(0.0005); expect(diff).toBeLessThan(0.03);
  });
  it('le maillage de la tête ne dépasse jamais la demi-largeur de la section (contour de face intact)', () => {
    const h = heads[2]!, m = headMesh(h.spec, 96, 0.025);
    for (const p of m.P) expect(Math.abs(p.x)).toBeLessThanOrEqual(headPoint(h.spec, p.y, Math.PI / 2).x + 1e-9);
  });
});

describe('oreille lointaine à 20°', () => {
  it('convention : omise entre 8° et 35° (et symétriquement de dos) ; jamais à 0°, 90°, 180°', () => {
    expect(farEarSide({ yaw: 20, pitch: 0 })).toBe(-1); expect(farEarSide({ yaw: -20, pitch: 0 })).toBe(1); expect(farEarSide({ yaw: 160, pitch: 0 })).toBe(-1);
    for (const y of [0, 5, 45, 90, 135, 180]) expect(farEarSide({ yaw: y, pitch: 0 })).toBe(0);
  });
  it('sans l\'omission l\'oreille lointaine EST rastérisée à 20° (le contrôle n\'est pas vacuant) ; avec elle, elle disparaît', () => {
    const parts = buildParts(REF_SPEC), f = defaultFrame(400), v = refView(20);   // la planche : 829 px d'oreille lointaine à 600 px de haut sans omission (0 – 580 px selon la graine)
    const count = (ms: typeof parts): number => { const g = rasterize(ms, v, f); let n = 0; for (let y = 0; y < g.h; y++) for (let x = 0; x < f.ox; x++) if (g.id[y * g.w + x] === PART.ear) n++; return n; };
    expect(count(parts)).toBeGreaterThan(200); expect(count(cullFarEar(parts, v) as typeof parts)).toBe(0);
  });
});

describe('jonction cou → épaules', () => {
  it('têtes issues d\'un visage : le cou s\'évase vers les trapèzes sans marche ; la planche garde ses 10 %', () => {
    for (const h of heads.slice(0, 4)) { const e = h.spec.engine!, y1 = h.spec.neck.y1; expect(neckSection(e, y1, y1).a / neckSection(e, 0.9, y1).a).toBeGreaterThan(1.08); }
    const e = REF_SPEC.engine!, y1 = REF_SPEC.neck.y1; expect(neckSection(e, y1, y1).a / neckSection(e, y1 - 0.2, y1).a).toBeCloseTo(1.1, 2);
  });
});

describe('couche de vérification des reliefs', () => {
  it('6 têtes : géométrie, anatomie et style sans échec bloquant', () => {
    for (const h of heads.slice(0, 6)) {
      const R = new HeadRenders(h.spec, 420), all = [...reliefGeometryChecks(h.spec), ...reliefAnatomyChecks(h.spec, R), ...reliefStyleChecks(h.spec, R)];
      expect(all.length).toBeGreaterThanOrEqual(17);
      expect(all.filter((c) => c.kind === 'hard' && !c.ok).map((c) => `${c.id}=${c.value}`)).toEqual([]);
    }
  }, 120000);
  it('la planche : pas de contrôle de relief de crâne ni de joue, mais l\'oreille lointaine à 20° et le cou sont contrôlés', () => {
    const R = new HeadRenders(REF_SPEC, 420);
    expect(reliefGeometryChecks(REF_SPEC)).toEqual([]);
    const st = reliefStyleChecks(REF_SPEC, R); expect(st.map((c) => c.id)).toContain('head.style.ear.far20'); expect(st.filter((c) => !c.ok && c.kind === 'hard')).toEqual([]);
  }, 60000);
});

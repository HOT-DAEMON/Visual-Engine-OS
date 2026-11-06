import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { earModel } from '../src/face/ear/geometry';
import { placeEarPoint, projectPoint } from '../src/face/ear/project';
import { cachedRenderer, defaultFrame, REF_SPEC, refView, renderHead, verifyHeadTurn, type RotationMeasures } from '../src/head-turntable';
import { earMesh, earPoint, earRig } from '../src/head-turntable/engines/ear3d';
import { ENGINE_FIT } from '../src/head-turntable/engines/engine-fit';
import { engineHead } from '../src/head-turntable/engines/face-model';
import { engineRows } from '../src/head-turntable/engines/rows';
import { engineSpec } from '../src/head-turntable/engines/spec-engine';
import { MEASURED_SPEC } from '../src/head-turntable/spec';
import { REF_ROWS } from '../src/head-turntable/ref-fit';
import { sectionAt } from '../src/head-turntable';
import { engineAnatomy } from '../src/head-turntable/verify-engines';

const measures = JSON.parse(readFileSync('references/face/rotation_head.measures.json', 'utf8')) as RotationMeasures;

describe('head-turntable : les moteurs existants sont réellement utilisés', () => {
  it("les modules du pont importent les moteurs (oreille, repères/mâchoire, crâne, nez, bouche, œil) — garde-fou contre un moteur « à côté »", () => {
    const src = readdirSync('src/head-turntable/engines').filter((f) => f.endsWith('.ts')).map((f) => readFileSync(`src/head-turntable/engines/${f}`, 'utf8')).join('\n');
    for (const m of ['face/ear/place', 'face/ear/geometry', 'face/ear/project', 'face/landmarks', 'face/outline', 'skull/geometry', 'face/nose', 'face/mouth/geometry', 'geometry/eye']) expect(src, m).toContain(`../../${m}`);
  });
  it('REF_SPEC porte la tête des moteurs et sa table de sections EST celle du moteur (pas une copie)', () => {
    expect(REF_SPEC.engine).toBeDefined();
    const R = engineRows(REF_SPEC.engine!, undefined, ENGINE_FIT.hairTh);
    REF_SPEC.rows.forEach((r, i) => { expect(r.a).toBe(R[i]!.a); expect(r.zf).toBe(R[i]!.zf); expect(r.zb).toBe(R[i]!.zb); });
  });
  it('le calage reste proche des mesures de la planche (a, zf, zb)', () => {
    const R = REF_SPEC.rows;
    const rms = (k: 'a' | 'zf' | 'zb'): number => Math.sqrt(REF_ROWS.filter((m) => m.y >= 0.05 && m.y <= 0.9).reduce((s, m) => s + (R[REF_ROWS.indexOf(m)]![k] - m[k]) ** 2, 0) / REF_ROWS.filter((m) => m.y >= 0.05 && m.y <= 0.9).length);
    expect(rms('a')).toBeLessThan(0.015); expect(rms('zf')).toBeLessThan(0.025); expect(rms('zb')).toBeLessThan(0.045);
  });
  it("les repères de la spec sont ceux du moteur de repères (ligne des yeux, base du nez)", () => {
    const e = REF_SPEC.engine!;
    expect(REF_SPEC.eye.y).toBeCloseTo(0.05 + (e.lm.eyeY + 500) / 1000, 9);
    expect(REF_SPEC.nose.baseY).toBeCloseTo(0.05 + (e.nose.baseY + 500) / 1000, 9);
  });
});

describe('head-turntable : oreille du moteur d\'oreille', () => {
  it('projectPoint = placeEarPoint + caméra de lacet (refactor sans changement de comportement)', () => {
    const rig = earRig(REF_SPEC, 1), q = { x: 0.31, y: 0.42 };
    for (const yaw of [0, 33, 90, 135, 200]) {
      const P = placeEarPoint(rig.pl, q, 0.01, rig.pivot), f = (yaw * Math.PI) / 180, S = projectPoint(rig.pl, q, 0.01, yaw, rig.pivot);
      expect(S.x).toBeCloseTo(P.X * Math.cos(f) - P.Z * Math.sin(f), 12); expect(S.y).toBeCloseTo(P.y, 12);
    }
  });
  it("le maillage est fini, fermé et ses normales sortent du pavillon", () => {
    for (const side of [1, -1] as const) {
      const [m] = earMesh(earRig(REF_SPEC, side));
      expect(m!.P.length).toBeGreaterThan(2000); expect(m!.UV!.length).toBe(m!.P.length);
      for (const p of [...m!.P, ...m!.N]) expect([p.x, p.y, p.z].every(Number.isFinite)).toBe(true);
    }
  });
  it("les deux oreilles penchent du même côté dans le repère de la tête (compensation du signe de rotation du moteur)", () => {
    const R = earRig(REF_SPEC, 1), L = earRig(REF_SPEC, -1);
    const a = earPoint(R, 0.3, 0.2, 0), b = earPoint(L, 0.3, 0.2, 0);
    expect(Math.abs(a.y - b.y)).toBeLessThan(0.006); expect(Math.abs(a.z - b.z)).toBeLessThan(0.012); expect(a.x * b.x).toBeLessThan(0);
  });
  it("l'oreille est attachée au crâne et à la hauteur de l'œil / base du nez (règle d'alignement du moteur)", () => {
    const rg = earRig(REF_SPEC, 1), m = earModel(REF_SPEC.engine!.p.ears, 1);
    expect(rg.pl.topY + rg.pl.hPx * m.landmarks.crus!.y).toBeCloseTo(REF_SPEC.eye.y, 1);
  });
});

describe('head-turntable : couche de vérification enrichie par les moteurs', () => {
  const at = cachedRenderer(REF_SPEC);
  it('les trois couches contiennent des contrôles « eng.* » et passent', () => {
    const rep = verifyHeadTurn(measures, REF_SPEC, at);
    for (const l of rep.layers) expect(l.checks.some((c) => c.id.startsWith('eng.')), l.layer).toBe(true);
    expect(rep.hardFailures.map((c) => `${c.id}=${c.value}`)).toEqual([]);
  });
  it("détecte une oreille décollée à 58° (hors canon 21°–38°) : eng.ear.angle échoue, la référence passe", () => {
    const ears = ENGINE_FIT.face.ears as { attach: Record<string, unknown> };
    const bad = engineSpec({ ...ENGINE_FIT, face: { ...ENGINE_FIT.face, ears: { ...ears, attach: { ...ears.attach, openingDeg: 58 } } } }, MEASURED_SPEC);
    expect(engineAnatomy(bad).find((k) => k.id === 'eng.ear.angle')!.ok).toBe(false);
    expect(engineAnatomy(REF_SPEC).find((k) => k.id === 'eng.ear.angle')!.ok).toBe(true);
  });
  it("détecte une oreille posée sur un autre crâne : eng.ear.root échoue quand le crâne change sous l'oreille", () => {
    const base = engineSpec(ENGINE_FIT, MEASURED_SPEC), other = { ...base, rows: base.rows.map((r) => ({ ...r, a: r.a * 0.8 })) };
    const rg = earRig(base, 1), p = earPoint(rg, 0, 0.5, 0), sr = sectionAt(other, p.y);
    expect(Math.abs(p.x - sr.a * Math.sqrt(Math.max(0, 1 - ((p.z - sr.zc) / sr.b) ** 2)))).toBeGreaterThan(0.02);
  });
  it("détecte une mâchoire à angle vif et un angle gonial hors canon", () => {
    const sharp = engineHead(ENGINE_FIT, { jaw: { angle: 0, taper: 1 }, jawWidth: 0.9 });
    expect(sharp.lm.jaw.gonialDeg).toBeLessThan(ENGINE_FIT.face && engineHead().lm.jaw.gonialDeg);
  });
  it('rend un tour complet sans NaN : 8 lacets de 45° en 45°', () => {
    for (let yaw = 0; yaw < 360; yaw += 45) { const r = renderHead(refView(yaw), REF_SPEC, { frame: defaultFrame(220), ss: 1 }); expect(r.ids.some((v) => v > 0)).toBe(true); }
  });
});

import { describe, expect, it } from 'vitest';
import { composeEar, earGeometry, faceLandmarks } from '../src/face';
import { inPoly, polyArea } from '../src/face/poly';
import { FaceParams } from '../src/schema';
import { checkEars } from '../src/verify/ear';

/** Passe 6 : proportions vérifiées sur le MODÈLE (références `references/orreil`) et couche de vérification sur des oreilles composées. */
const models = (character: 'natural' | 'caricature' | 'fantasy', n: number, base = 9000) => Array.from({ length: n }, (_, i) => {
  const p = FaceParams.parse({ anatomyEngine: 'structured', ears: composeEar(base + i, { character }) });
  return { p, lm: faceLandmarks(p, 300, 400), geo: earGeometry(p, faceLandmarks(p, 300, 400)) };
});
const median = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] as number;

describe('passe 6 : conque, lobule, anthélix (références orreil)', () => {
  const N = models('natural', 24);
  it('la conque (cavum + cymba) occupe plus de 26 % du pavillon (médiane) et la peau nue reste sous 20 %', () => {
    const conch: number[] = [], bare: number[] = [];
    for (const { geo } of N) for (const e of geo) {
      const m = e.model!, area = Math.abs(polyArea(m.outline));
      conch.push(['cavum', 'cymba'].reduce((t, id) => t + Math.abs(polyArea(m.structures.find((x) => x.id === id)!.poly)), 0) / area);
      const xs = m.outline.map((q) => q.x), ys = m.outline.map((q) => q.y), x0 = Math.min(...xs), y0 = Math.min(...ys);
      let ins = 0, nb = 0;
      for (let a = 0; a < 40; a++) for (let b = 0; b < 60; b++) {
        const qx = x0 + ((a + 0.5) / 40) * (Math.max(...xs) - x0), qy = y0 + ((b + 0.5) / 60) * (Math.max(...ys) - y0);
        if (!inPoly(m.outline, qx, qy)) continue; ins++;
        if (!m.structures.some((s) => s.kind !== 'ext' && !String(s.id).includes(':shade') && inPoly(s.poly, qx, qy))) nb++;
      }
      bare.push(nb / ins);
    }
    expect(median(conch)).toBeGreaterThan(0.26);
    expect(median(bare)).toBeLessThan(0.2);
  });
  it('le lobule n\'a plus de corde droite et se fond dans l\'hélix ; la conque reste dans le pavillon (0 erreur de vérification, 0 avertissement « natural »)', () => {
    for (const { p, lm } of N) {
      const bad = checkEars(p, lm, '#b98a62').filter((c) => !c.ok);
      expect(bad.map((c) => `${c.severity}:${c.id}`)).toEqual([]);
    }
  });
  it('« caricature » et « fantasy » : aucune erreur (les avertissements de conque réduite des familles félines/draconiques restent permis)', () => {
    for (const ch of ['caricature', 'fantasy'] as const) for (const { p, lm } of models(ch, 20, 700)) {
      const errs = checkEars(p, lm, '#b98a62').filter((c) => !c.ok && c.severity === 'error');
      expect(errs.map((c) => c.id)).toEqual([]);
    }
  });
  it('le fond du cavum, les courbes libres d\'anthélix et le site de Darwin changent le MODÈLE (pas seulement le rendu)', () => {
    const base = (m: object) => earGeometry(FaceParams.parse({ anatomyEngine: 'structured', ears: { engine: 'morphology', seed: 11, morph: m } }), faceLandmarks(FaceParams.parse({ anatomyEngine: 'structured' }), 300, 400))[0]!.model!;
    expect(base({ concha: { floor: 0.8 } }).structures.some((s) => s.id === 'concha:floor')).toBe(true);
    expect(base({ concha: { floor: 0 } }).structures.some((s) => s.id === 'concha:floor')).toBe(false);
    const up = (v: number) => base({ antihelix: { upperBend: v } }).structures.find((s) => s.id === 'antihelix:upper')!.poly;
    expect(Math.max(...up(0.8).map((q, i) => Math.hypot(q.x - up(-0.8)[i]!.x, q.y - up(-0.8)[i]!.y)))).toBeGreaterThan(0.03);
    const dw = (v: number) => base({ helix: { darwin: 0.8, darwinSite: v } }).structures.find((s) => s.id === 'darwin')!.poly;
    expect(Math.abs(dw(0.9)[0]!.y - dw(-0.9)[0]!.y)).toBeGreaterThan(0.08);
  });
});

describe('passe 6 : attache sur mâchoire fuyante', () => {
  it('le bas du lobule pend à moins de 0,2 H de la tête (médiane, 24 têtes) — avant : 0,21 H, max 0,39', async () => {
    const { generateRandomFace } = await import('../src');
    const { projectEar } = await import('../src/face/ear/project');
    const gaps: number[] = [];
    for (let i = 0; i < 24; i++) {
      const probe = generateRandomFace(11 + i, { id: 'f0', hairEngine: 'classic' });
      const p = FaceParams.parse({ ...(probe.params as object), anatomyEngine: 'structured', ears: composeEar(5000 + i, { character: 'natural' }) });
      for (const e of earGeometry(p, faceLandmarks(p, probe.width, probe.height))) {
        const f = projectEar(e.model!, e.placement!, 0, 'face'), lb = f.landmarks.lobuleBottom!;
        gaps.push((Math.abs(lb.x) - e.placement!.headX!(lb.y)) / e.placement!.hPx);
      }
    }
    expect(median(gaps)).toBeLessThan(0.2);
  });
});

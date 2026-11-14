import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { faceLandmarks, noseGeometry } from '../src/face';
import { SLIT, sdSlit } from '../src/face/nose/base-mass';
import { underviewRelief } from '../src/relief';
import { FaceParams } from '../src/schema';
import { noseLitReliefChecks, nostrilElongations } from '../src/verify/nose-lit';

const geo = (shape: number) => { const p = FaceParams.parse({ anatomyEngine: 'structured', nose: { nostrils: { shape } } }); return noseGeometry(p, faceLandmarks(p, 300, 380)); };
const elong = (shape: number, pitch: number): number[] => nostrilElongations(underviewRelief(geo(shape), { pitchDeg: pitch }, 2), 8);

describe('narines vues de dessous : fentes mesurées sur les réfs 03/04 (docs/NOSE-NOSTRIL-SLIT.md)', () => {
  it('les constantes viennent des mesures versionnées (réf. 04 : élévation de l\'extrémité externe, longueur / ellipse)', () => {
    const m = JSON.parse(readFileSync('references/nez/measures-04-nostrils.json', 'utf8')).summary;
    expect(m.strokes).toBeGreaterThanOrEqual(9);
    expect(SLIT.outerRiseDeg).toBeCloseTo(m.outerEndRiseDeg.median, 0);
    expect(SLIT.lengthOverWidth).toBeCloseTo(m.lengthOverEllipseMajor.median, 1);
    // allongement par défaut (shape 0,55) : au plus la médiane de la réf. 04 (majorant), au moins celle de la réf. 03 (2,23)
    const e = 1 + SLIT.elongPerShape * 0.55;
    expect(e).toBeGreaterThanOrEqual(2.1); expect(e).toBeLessThanOrEqual(m.elongation.median);
  });
  it('la fente est allongée dans son plan, extrémité externe relevée, et symétrique (miroir)', () => {
    const A = 6, B = 2.5; let xs: number[] = [], ws: number[] = [];
    for (let w = -12; w <= 12; w += 0.1) for (let x = -12; x <= 12; x += 0.1) if (sdSlit(x, w, 0, 0, 1, A, B, SLIT.outerRiseDeg, 0) < 0) { xs.push(x); ws.push(w); }
    const ext = (v: number[]) => Math.max(...v) - Math.min(...v);
    expect(ext(xs) / ext(ws)).toBeGreaterThan(1.5);   // boîte englobante d une ellipse A/B = 2,4 inclinée de 23° : ≈ 1,75 (pas 2,4)
    const out = xs.map((x, i) => ({ x, w: ws[i]! })).filter((q) => q.x > 3), inn = xs.map((x, i) => ({ x, w: ws[i]! })).filter((q) => q.x < -3);
    const mean = (a: { w: number }[]) => a.reduce((s, q) => s + q.w, 0) / a.length;
    expect(mean(out)).toBeGreaterThan(mean(inn));                       // extrémité externe : w plus grand
    expect(sdSlit(4, 1, 0, 0, 1, A, B, 23, 0.9)).toBeCloseTo(sdSlit(-4, 1, 0, 0, -1, A, B, 23, 0.9), 9);
  });
  it('dans le rendu, l\'allongement suit le paramètre `shape` (ronde → fente) à 40° et à 60° : la forme produit une différence visible', () => {
    for (const pitch of [40, 60]) {
      const v = [0, 0.3, 0.55, 1].map((s) => Math.min(...elong(s, pitch)));
      for (let i = 1; i < v.length; i++) expect(v[i]!).toBeGreaterThan(v[i - 1]! + 0.2);
      expect(v[0]!).toBeLessThan(1.45);        // creux presque rond
      expect(v[2]!).toBeGreaterThan(2);         // fente à la forme par défaut
    }
  });
  it('la règle de vérification détecte l\'ancien creux rond (shape = 0 demandé en 0,55) et accepte la fente', () => {
    const relief = (shape: number) => underviewRelief(geo(shape), { pitchDeg: 40 }, 2);
    const okRule = (r: ReturnType<typeof relief>, asked: number) => noseLitReliefChecks(r, 40, 2, asked).find((c) => c.id === 'nose-lit-nostril-elongated')!;
    expect(okRule(relief(0.55), 0.55).ok).toBe(true);
    expect(okRule(relief(0), 0.55).ok).toBe(false);
  });
});

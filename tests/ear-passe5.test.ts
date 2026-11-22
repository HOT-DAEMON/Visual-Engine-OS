import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { composeEar, earGeometry, faceLandmarks, inPoly, polyArea } from '../src/face';
import { projectEar } from '../src/face/ear/project';
import { earViewSvg } from '../src/render/face/ear/sheet';
import { FaceParams } from '../src/schema';
import { checkEars } from '../src/verify/ear';

/** Passe 5 : plus de jupe de peau, bord antérieur sur la tête, conque plus grande, oreille lisible de face, axe scapha.curvature visible. */
const heads = (n: number) => Array.from({ length: n }, (_, i) => FaceParams.parse({ anatomyEngine: 'structured', ears: composeEar(9000 + i, { character: 'natural' }) }));

describe('passe 5 : attache sans jupe, conque, lisibilité frontale', () => {
  it('aucune « jupe » : la projection n\'expose plus de bande de racine, et le bord antérieur touche la tête (≤ 6 % de H) sur 40 têtes', () => {
    for (const p of heads(40)) for (const e of earGeometry(p, faceLandmarks(p, 300, 400))) {
      const m = e.model!, pl = e.placement!;
      const pe = projectEar(m, pl, 0, 'face');
      expect('root' in pe).toBe(false);
      let gap = 0;
      for (const sg of m.segments.filter((x) => ['C06', 'C05', 'C04'].includes(x.id))) for (let k = sg.from; k <= sg.to; k++) { const q = pe.plate[k % m.outline.length]!; gap = Math.max(gap, Math.abs(q.x) - pl.headX!(q.y)); }
      expect(gap / pl.hPx).toBeLessThanOrEqual(0.06);
    }
  }, 120000);

  it('la conque (cavum + cymba) occupe ≥ 20 % de l\'aire du pavillon et la peau lisse reste ≤ 50 % (60 oreilles « natural »)', () => {
    for (const p of heads(30)) for (const e of earGeometry(p, faceLandmarks(p, 300, 400))) {
      const m = e.model!;
      const area = Math.abs(polyArea(m.outline));
      const conch = ['cavum', 'cymba'].reduce((t, id) => t + Math.abs(polyArea(m.structures.find((q) => q.id === id)!.poly)), 0);
      expect(conch / area).toBeGreaterThanOrEqual(0.2);
      const covers = m.structures.filter((x) => x.kind !== 'ext' && x.id !== 'lobule' && !String(x.id).startsWith('scapha:'));
      const xs = m.outline.map((q) => q.x), ys = m.outline.map((q) => q.y);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      let inside = 0, bare = 0;
      for (let a = 0; a < 40; a++) for (let b = 0; b < 60; b++) { const qx = x0 + ((a + 0.5) / 40) * (x1 - x0), qy = y0 + ((b + 0.5) / 60) * (y1 - y0); if (!inPoly(m.outline, qx, qy)) continue; inside++; if (!covers.some((c) => inPoly(c.poly, qx, qy))) bare++; }
      expect(bare / inside).toBeLessThanOrEqual(0.5);
    }
  }, 120000);

  it('de face, l\'oreille n\'est jamais un trait : largeur/hauteur ≥ 0,34 sur 60 oreilles « natural »', () => {
    for (const p of heads(30)) for (const e of earGeometry(p, faceLandmarks(p, 300, 400))) {
      const f = projectEar(e.model!, e.placement!, 0, 'face');
      expect((f.bbox.x1 - f.bbox.x0) / e.placement!.hPx).toBeGreaterThanOrEqual(0.34);
    }
  }, 120000);

  it('scapha.curvature : ±0,8 change ≥ 378 px dans la meilleure des trois vues (axe jusqu\'ici trop discret)', () => {
    const render = (v: number, view: 'close-up' | 'three-quarter' | 'profile'): Uint8Array => {
      const p = FaceParams.parse({ anatomyEngine: 'structured', ears: { engine: 'morphology', seed: 11, style: { detail: 0.9 }, morph: { scapha: { curvature: v } } } });
      return new Resvg(earViewSvg(p, faceLandmarks(p, 300, 400), { view, width: 240, height: 320, skin: '#b98a62' }), { fitTo: { mode: 'width', value: 240 } }).render().pixels;
    };
    const diff = (a: Uint8Array, b: Uint8Array): number => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!) > 24) n++; return n; };
    expect(Math.max(...(['close-up', 'three-quarter', 'profile'] as const).map((v) => diff(render(-0.8, v), render(0.8, v))))).toBeGreaterThanOrEqual(378);
  });

  it('les contrôles de la couche anatomie (conque, peau lisse) sont présents et sans erreur sur la tête par défaut', () => {
    const p = FaceParams.parse({ anatomyEngine: 'structured' });
    const c = checkEars(p, faceLandmarks(p, 300, 400), '#9a7650');
    for (const id of ['ear-concha-share-L', 'ear-bare-share-R', 'ear-anterior-touches-head-L']) expect(c.find((x) => x.id === id)?.ok, id).toBe(true);
  });
});

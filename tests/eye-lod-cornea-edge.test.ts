import { describe, expect, it } from 'vitest';
import { EyeSpec, compileScene, renderScene } from '../src';
import { EDGE_MAX_DEV, corneaWarp, eyeLod, irisLod, irregularEdges, microLod, openingGeometry, resolveEyePixels } from '../src/geometry/eye';
import { applyCornea } from '../src/render/eye/cornea';
import { compileEye, resolveEye, withAutoLod } from '../src/render/eye/eye';
import { renderIrisDetail } from '../src/render/eye/iris-detail';
import { lightVector } from '../src/lighting/light';
import { verifyEye } from '../src/verify/eye';
import { measurePupilRadiusPx } from '../scripts/lib/verify-eye-cornea-render';
import { BASE } from '../scripts/lib/eye-param-sweeps';
import { famEye } from '../scripts/eye-refs/calibrate-atoms-lib';

const eyeSpec = (o: object = {}) => EyeSpec.parse({ kind: 'eye', id: 'e', ...o });
const sceneSvg = (eye: object, scale: number, pixelRatio = 1) => {
  const r = compileScene({ width: 700, height: 460, background: '#3b4157', objects: [{ kind: 'eye', id: 'e', transform: { x: 350, y: 230, scale }, ...eye, eyebrow: null }] } as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return pixelRatio === 1 ? r.svg : renderScene(r.scene, { pixelRatio });
};
const ve = (o: object) => verifyEye({ kind: 'eye', id: 'e', ...o });
const count = (svg: string, tag: string): number => (svg.match(new RegExp(`<${tag}[ >/]`, 'g')) ?? []).length;
const MICRO = { vessels: { density: 0.9, thickness: 0.5, tint: '#c4574e', visibility: 0.6, branching: 0.8 }, imperfections: 6 };

describe('EYE-07 — LOD automatique (lod.eyePixels dérivé de la scène)', () => {
  it('résolution : explicite > dérivé ; dérivé = largeur × échelle monde × pixelRatio, borné au schéma', () => {
    expect(resolveEyePixels(120, 300, 1)).toBe(120);
    expect(resolveEyePixels(null, 300, 0.5)).toBeCloseTo(150, 9);
    expect(resolveEyePixels(null, 300, 0.5, 2)).toBeCloseTo(300, 9);
    expect(resolveEyePixels(null, 300, 0.0001)).toBe(8);
    expect(resolveEyePixels(null, 300, 1000)).toBe(8000);
    expect(withAutoLod(eyeSpec({ microdetail: {}, transform: { scale: 0.2 }, shape: { width: 300 } })).eye.microdetail?.lod.eyePixels).toBeCloseTo(60, 9);
    expect(withAutoLod(eyeSpec({ microdetail: { lod: { eyePixels: 500 } }, transform: { scale: 0.2 } })).eye.microdetail?.lod.eyePixels).toBe(500);
  });

  it('le rendu lit le LOD dérivé : un petit œil perd ses vaisseaux fins, un grand les garde ; pixelRatio 2 les rend', () => {
    const e = { shape: { width: 300, height: 170 }, microdetail: MICRO, renderQuality: 'reference' };
    const big = sceneSvg(e, 1.2); const small = sceneSvg(e, 0.1); const smallRetina = sceneSvg(e, 0.1, 6);
    expect(count(small, 'path')).toBeLessThan(count(big, 'path'));
    expect(count(smallRetina, 'path')).toBeGreaterThan(count(small, 'path'));
    // grand œil : identique à un LOD explicite « pleine précision »
    expect(sceneSvg({ ...e, microdetail: { ...MICRO, lod: { eyePixels: 8000 } } }, 1.2)).toBe(big);
  });

  it('LOD de l\'iris : monotone, `null` = pleine précision ; seul le TRACÉ est réduit (mêmes tirages, sous-ensemble)', () => {
    expect(irisLod(null)).toEqual({ fibers: 1, minAtomPx: 0 });
    let prev = -1; for (const px of [10, 24, 50, 80, 120, 400]) { const l = irisLod(px); expect(l.fibers).toBeGreaterThanOrEqual(prev); prev = l.fibers; }
    expect(eyeLod(300, 0.42).iris.fibers).toBe(1); expect(eyeLod(40, 0.42).micro.vessels).toBeLessThan(1);
    const fam = EyeSpec.parse({ ...(famEye('fire-halo') as object), kind: 'eye', id: 'e' });
    const full = renderIrisDetail(fam, { x: 0, y: 0 }, 100, 100, 'e', null).markup.join('');
    const huge = renderIrisDetail(fam, { x: 0, y: 0 }, 100, 100, 'e', 50).markup.join('');
    const tiny = renderIrisDetail(fam, { x: 0, y: 0 }, 100, 100, 'e', 0.12).markup.join('');
    expect(huge).toBe(full);
    expect(tiny.length).toBeLessThan(full.length * 0.9);
    expect(count(tiny, 'path')).toBeLessThan(count(full, 'path'));
  });

  it('verifyEye lit le même LOD que le rendu', () => {
    const e = { shape: { width: 300, height: 170 }, microdetail: MICRO, transform: { scale: 0.12 } };
    expect(ve(e).failures).toEqual([]);
  });
});

describe('EYE-07E — bords palpébraux irréguliers', () => {
  const g = openingGeometry(eyeSpec().shape, eyeSpec().canthi);
  const O = { irregularity: 1, grain: 1 };
  it('déterministe, graine-dépendant, nul à 0, canthi fixes, déviation bornée', () => {
    const a = irregularEdges(g, O, 5); expect(irregularEdges(g, O, 5)).toEqual(a); expect(irregularEdges(g, O, 6)).not.toEqual(a);
    const z = irregularEdges(g, { irregularity: 0, grain: 1 }, 5); expect(z.maxDev).toBe(0);
    for (const [p, q] of [[a.upper[0], g.pi], [a.upper[a.upper.length - 1], g.po], [a.lower[0], g.po]] as const) { expect(p!.x).toBeCloseTo(q.x, 6); expect(p!.y).toBeCloseTo(q.y, 6); }
    expect(a.maxDev).toBeLessThanOrEqual(EDGE_MAX_DEV * g.hEff + 1e-9); expect(a.maxDev).toBeGreaterThan(EDGE_MAX_DEV * g.hEff * 0.2);
  });
  it('le LOD retire le festonnage fin sans toucher l\'ondulation lente', () => {
    const full = irregularEdges(g, O, 5, 1); const low = irregularEdges(g, O, 5, 0);
    expect(low.lower).not.toEqual(full.lower);
    const rough = (pts: readonly { x: number; y: number }[]) => pts.slice(2).reduce((s, p, i) => s + Math.abs(p.y - 2 * (pts[i + 1] as { y: number }).y + (pts[i] as { y: number }).y), 0);
    expect(rough(low.lower)).toBeLessThan(rough(full.lower));
  });
  it('rendu : le MÊME tracé découpe l\'ouverture et guide les bords libres ; null = historique', () => {
    const e = { shape: { width: 300, height: 170 }, microdetail: { edge: { irregularity: 0.8, grain: 0.7 }, vessels: null, chroma: null, tearFilm: null, occlusion: 0 } };
    const svg = sceneSvg(e, 1);
    const clip = /<clipPath id="e-opening"><path d="([^"]+)"/.exec(svg)?.[1] ?? '';
    const upperSeg = clip.split('Z')[0]!.slice(clip.indexOf('C')).split('C').slice(1, 6).join('C');
    expect(clip.split('C').length).toBeGreaterThan(90); expect(svg).toContain(upperSeg.slice(0, 40));
    expect(sceneSvg({ ...e, microdetail: { ...e.microdetail, edge: null } }, 1)).not.toBe(svg);
    expect(ve(e).failures).toEqual([]);
  });
});

describe('EYE-03 / OPT-02 — cornée et réfraction réelle', () => {
  const P = { curvature: 0.76, depth: 0.61, index: 1.376, strength: 1 };
  it('loi : identité à 0, limbe fixe, monotone, croît avec l\'indice ; agrandissement humain ≈ 1,1', () => {
    const id = corneaWarp({ ...P, strength: 0 }); for (const r of [0, 0.3, 0.7, 1]) expect(id(r)).toBe(r);
    for (const s of [0.5, 1, 2, 3]) { const w = corneaWarp({ ...P, strength: s }); expect(w(0)).toBe(0); expect(w(1)).toBe(1); let prev = -1; for (let i = 0; i <= 100; i++) { const v = w(i / 100); expect(v).toBeGreaterThanOrEqual(prev); prev = v; } }
    expect(corneaWarp({ ...P, index: 1.6 })(0.5)).toBeGreaterThan(corneaWarp({ ...P, index: 1.2 })(0.5));
    const mag = corneaWarp(P)(0.3) / 0.3; expect(mag).toBeGreaterThan(1.05); expect(mag).toBeLessThan(1.2);
  });
  it('applyCornea : identité EXACTE sans cornée ; reflets non réfractés ; couches et détail remappés', () => {
    const e = EyeSpec.parse({ ...(famEye('emerald-facets') as object), kind: 'eye', id: 'e' });
    expect(applyCornea(e)).toBe(e);
    const c = applyCornea({ ...e, cornea: { curvature: 0.76, depth: 0.61, index: 1.376, refraction: 1.5, haze: 0.3 } });
    expect(c.highlights).toEqual(e.highlights);
    expect(c.pupil.size).toBeGreaterThan(e.pupil.size);
    expect(c.iris.detail?.collarette?.radius).toBeGreaterThan(e.iris.detail?.collarette?.radius ?? 1);
    expect(c.iris.layers[0]!.inner).toBeGreaterThanOrEqual(e.iris.layers[0]!.inner);
    expect(resolveEye({ ...e, cornea: { curvature: 0.76, depth: 0.61, index: 1.376, refraction: 1.5, haze: 0.3 } }).pupil.size).toBeCloseTo(c.pupil.size, 9);
  });
  it('PIXELS : le rayon apparent de la pupille mesuré sur l\'image suit la loi (± 1,5 px) et croît avec la réfraction', () => {
    const shape = { ...(BASE.shape as object), width: 420, height: 240 }; let prev = 0;
    for (const co of [null, { refraction: 1 }, { refraction: 3 }]) {
      const m = measurePupilRadiusPx({ ...BASE, shape, cornea: co });
      expect(Math.abs(m.measured - m.predicted)).toBeLessThan(1.5); expect(m.measured).toBeGreaterThan(prev - 0.01); prev = m.measured; expect(m.pupilLum).toBeLessThan(m.irisLum * 0.5);
    }
  });
  it('vérification : œil humain sans avertissement ; exagération (réfraction 3) signalée en warn, jamais en erreur', () => {
    const human = ve({ ...BASE, cornea: {} }); expect(human.failures).toEqual([]); expect(human.checks.filter((c) => c.id.startsWith('cornea-') && !c.ok)).toEqual([]);
    const wild = ve({ ...BASE, cornea: { refraction: 3, curvature: 1.05, index: 1.9 } }); expect(wild.failures).toEqual([]);
    expect(wild.checks.find((c) => c.id === 'cornea-pupil-magnification')?.ok).toBe(false);
  });
  it('halo cornéoscléral : présent avec `haze`, absent en fini flat', () => {
    const html = (c: object, extra: object = {}) => sceneSvg({ ...BASE, cornea: c, ...extra }, 1);
    expect(html({ haze: 0.8 })).toContain('e-haze'); expect(html({ haze: 0 })).not.toContain('e-haze'); expect(html({ haze: 0.8 }, { finish: 'flat' })).not.toContain('e-haze');
    void compileEye; void lightVector; void microLod;
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compileScene, expandScene, generateRandomFace, GALLERY_IDENTITIES, galleryPair, SceneSpec } from '../src';
import { faceLandmarks, fitEyeToFace, halfWidthAt, eyeReach } from '../src/face';
import { openingGeometry } from '../src/geometry/eye';
import { EyeSpec, FaceParams, type SceneInput } from '../src/schema';
import { compose } from '../src/composition/anchors';

const sceneOf = (objects: SceneInput['objects'], w = 400, h = 500): SceneInput => ({ width: w, height: h, background: '#333333', objects });
const ids = Array.from({ length: GALLERY_IDENTITIES }, (_, i) => i);

describe('visage aléatoire', () => {
  it('est déterministe et varie selon la seed', () => {
    expect(JSON.stringify(generateRandomFace(5))).toBe(JSON.stringify(generateRandomFace(5)));
    const set = new Set(Array.from({ length: 40 }, (_, i) => JSON.stringify(generateRandomFace(i).objects[0])));
    expect(set.size).toBe(40);
  });

  it.each(ids)('identité de galerie %i : scène valide, SVG fini, yeux = paire de la galerie', (i) => {
    const f = generateRandomFace(900 + i, { identity: i, transform: { x: 200, y: 250 } });
    const r = compileScene(sceneOf(f.objects));
    if (!r.ok) throw new Error(r.issues.join('\n'));
    expect(r.svg).not.toMatch(/NaN|Infinity/);
    const pair = galleryPair(i, { kind: 'neutral', intensity: 1 });
    const left = f.objects[1] as { shape: { outerSide: string; style: string } };
    const right = f.objects[2] as { shape: { outerSide: string } };
    expect(left.shape.outerSide).toBe('left');
    expect(right.shape.outerSide).toBe('right');
    expect(left.shape.style).toBe((pair.left.shape as { style: string }).style);
  });

  it('les yeux de la galerie de paires publiée sont bien ceux du vivier', () => {
    const g = JSON.parse(readFileSync(new URL('../examples/gallery-pairs.json', import.meta.url), 'utf8')) as { objects: { iris: unknown; lashes: unknown; seed: number }[] };
    ids.forEach((i) => {
      const e = g.objects[i * 2];
      const p = galleryPair(i).left;
      expect(JSON.stringify(e?.iris)).toBe(JSON.stringify(p.iris));
      expect(e?.seed).toBe(p.seed);
    });
  });
});

describe('yeux enfants du visage : position définie par le visage', () => {
  const lmFor = (seed: number): { lm: ReturnType<typeof faceLandmarks>; f: ReturnType<typeof generateRandomFace> } => {
    const f = generateRandomFace(seed, { identity: 0 });
    const host = SceneSpec.parse(sceneOf(f.objects)).objects[0];
    if (host?.kind !== 'host') throw new Error('hôte attendu');
    return { lm: faceLandmarks(FaceParams.parse(host.face), host.width, host.height), f };
  };

  it.each(ids)('identité %i : le canthus interne tombe EXACTEMENT sur le repère du visage, après expansion de la scène', (i) => {
    const f = generateRandomFace(1200 + i, { identity: i });
    const scene = SceneSpec.parse(sceneOf(f.objects));
    const host = scene.objects[0];
    if (host?.kind !== 'host') throw new Error('hôte attendu');
    const lm = faceLandmarks(FaceParams.parse(host.face), host.width, host.height);
    const eyes = expandScene(scene).filter((o) => o.kind === 'eye');
    expect(eyes).toHaveLength(2);
    for (const e of eyes) {
      if (e.kind !== 'eye') continue;
      const g = openingGeometry(e.shape, e.canthi);
      const w = compose({ ...e.transform }, { x: g.pi.x, y: g.pi.y, rotationDeg: 0, scale: 1 });
      const P = e.shape.outerSide === 'left' ? lm.innerCanthus.left : lm.innerCanthus.right;
      const wanted = compose(host.transform, { x: P.x, y: P.y, rotationDeg: 0, scale: 1 });
      expect(w.x).toBeCloseTo(wanted.x, 6);
      expect(w.y).toBeCloseTo(wanted.y, 6);
    }
  });

  it.each(ids)('identité %i : œil entier dans le crâne, sous le front, au-dessus du nez, sans franchir la ligne médiane', (i) => {
    const { lm } = lmFor(1200 + i);
    for (const side of ['left', 'right'] as const) {
      const eye = galleryPair(i)[side];
      const fit = fitEyeToFace(eye, side, lm);
      const b = fit.footprint;
      const hw = (y: number): number => halfWidthAt(lm.outline, y);
      for (const y of [b.minY, (b.minY + b.maxY) / 2, b.maxY]) expect(Math.abs(b.minX)).toBeLessThan(hw(y));
      for (const y of [b.minY, (b.minY + b.maxY) / 2, b.maxY]) expect(Math.abs(b.maxX)).toBeLessThan(hw(y));
      expect(b.minY).toBeGreaterThanOrEqual(lm.browLimitY - 1e-6);
      expect(b.maxY).toBeLessThanOrEqual(lm.lowerLimitY + 1e-6);
      expect(b.maxY).toBeLessThan(lm.noseBaseY);
      if (side === 'left') expect(b.maxX).toBeLessThan(0);
      else expect(b.minX).toBeGreaterThan(0);
    }
  });

  it('paire en miroir : empreintes symétriques et même ligne des yeux', () => {
    const { lm } = lmFor(77);
    const l = fitEyeToFace(galleryPair(3).left, 'left', lm);
    const r = fitEyeToFace(galleryPair(3).right, 'right', lm);
    expect(l.scale).toBeCloseTo(r.scale, 9);
    expect(l.anchor.y).toBe(r.anchor.y);
    expect(l.footprint.minX).toBeCloseTo(-r.footprint.maxX, 6);
    expect(l.footprint.maxX).toBeCloseTo(-r.footprint.minX, 6);
  });

  it('indifférent à la forme et à la grosseur : toutes les formes, de minuscule à énorme, gardent le même canthus et restent dans l\'orbite', () => {
    const { lm } = lmFor(31);
    const styles = ['almond', 'round', 'sharp', 'drooping', 'chibi', 'angular', 'compressed', 'rounded_rect', 'triangle', 'circle', 'diamond', 'diamond_v2'] as const;
    for (const style of styles) {
      for (const size of [0.3, 1, 4]) {
        const eye = { ...galleryPair(0).left, shape: { ...galleryPair(0).left.shape, style } };
        const fit = fitEyeToFace(eye, 'left', lm, { size });
        expect(fit.anchor).toEqual(lm.innerCanthus.left);
        const spec = EyeSpec.parse({ ...eye, place: undefined });
        const g = openingGeometry(spec.shape, spec.canthi);
        expect(fit.transform.x).toBeCloseTo(-fit.scale * g.pi.x, 9);
        expect(fit.footprint.maxX).toBeLessThan(0);
        expect(fit.footprint.minX).toBeGreaterThan(-lm.W / 2);
        expect(fit.footprint.minY).toBeGreaterThanOrEqual(lm.browLimitY - 1e-6);
        expect(fit.footprint.maxY).toBeLessThanOrEqual(lm.lowerLimitY + 1e-6);
        expect(eyeReach(spec).aperture * fit.scale).toBeLessThan(lm.W / 2);
      }
    }
  });

  it('un œil plus gros demandé rétrécit (jamais ne déborde) ; un œil plus petit reste plus petit', () => {
    const { lm } = lmFor(31);
    const eye = galleryPair(5).left;
    const s = (size: number): number => fitEyeToFace(eye, 'left', lm, { size }).scale;
    expect(s(0.5)).toBeLessThan(s(1));
    expect(s(10)).toBeLessThanOrEqual(s(100) + 1e-9);
    expect(fitEyeToFace(eye, 'left', lm, { size: 100 }).limitedBy).not.toBe('target');
  });
});

describe('cohérence expression / bouche', () => {
  it('joie : commissures relevées et bouche ouverte ; tristesse : commissures baissées', () => {
    const m = (kind: 'joyful' | 'sad'): { curve: number; open: number } => {
      const h = generateRandomFace(4, { expression: { kind, intensity: 1 } }).objects[0] as { face: { mouth: { curve: number; open: number } } };
      return h.face.mouth;
    };
    expect(m('joyful').curve).toBeGreaterThan(0.5);
    expect(m('joyful').open).toBeGreaterThan(0.3);
    expect(m('sad').curve).toBeLessThan(-0.5);
  });
  it('yeux aléatoires (hors galerie) acceptés', () => {
    const f = generateRandomFace(11, { eyeSource: 'random' });
    expect(f.identity).toBeNull();
    expect(compileScene(sceneOf(f.objects)).ok).toBe(true);
  });
  it('`face` refusé sur un hôte non-visage', () => {
    const r = compileScene({ objects: [{ kind: 'host', id: 'h', material: { preset: 'matte', color: '#eec9ad' }, face: {} }] });
    expect(r.ok).toBe(false);
  });
});

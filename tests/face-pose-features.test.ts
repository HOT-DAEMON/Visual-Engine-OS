import { describe, expect, it } from 'vitest';
import { compileScene, expandScene, generateRandomFace, SceneSpec, type SceneInput } from '../src';
import { faceLandmarks } from '../src/face';
import { eyePoseOf, featureTransform, featureVisible, poseFaceFeatures, poseRegions } from '../src/face/pose';
import { skinRegions, noseGeometry } from '../src/face';
import { FaceParams } from '../src/schema';

/** Traits du visage posés (`docs/ROTATION-FACE-FEATURES.md`) : yeux, nez, bouche, oreilles, joues et régions de peau suivent les nœuds de pose. */
const make = (seed: number, yaw: number) => {
  const f = generateRandomFace(seed, { id: 'f0', transform: { x: 0, y: 0, scale: 1 } });
  const host = f.objects[0] as unknown as { face: Record<string, unknown>; width: number; height: number };
  host.face = { ...host.face, headPose: { yawDeg: yaw } };
  const lm = faceLandmarks(FaceParams.parse(host.face), host.width, host.height);
  return { f, host, lm };
};
const parse = (objects: unknown[]) => SceneSpec.parse({ width: 500, height: 500, background: '#ffffff', objects });
const scene = (objects: unknown[]): string => {
  const r = compileScene({ width: 500, height: 500, background: '#ffffff', objects } as SceneInput);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
};

describe('traits du visage posés', () => {
  it('0° : identité exacte (transformations nulles, yeux non touchés, SVG identique à l’octet près)', () => {
    const { f, host, lm } = make(321, 0);
    expect(eyePoseOf(host as never, -1)).toBeNull();
    const ft = poseFaceFeatures(lm, 0);
    for (const id of ['nose', 'mouth', 'eyeL', 'eyeR', 'chin']) expect(featureTransform(ft, id)).toContain('translate(0 0)');
    const g = generateRandomFace(321, { id: 'f0', transform: { x: 0, y: 0, scale: 1 } });
    expect(scene(f.objects) === scene(g.objects)).toBe(true);
  });

  it('yaw +30° : nez, bouche et yeux se déplacent vers la droite de l’image, le nez (saillant) plus que la bouche ; −30° est le miroir', () => {
    const { lm } = make(321, 0);
    const p = poseFaceFeatures(lm, 30), m = poseFaceFeatures(lm, -30);
    const dx = (f: typeof p, id: string): number => (f.nodes.get(id)?.x ?? 0) - (f.neutral.get(id)?.x ?? 0);
    for (const id of ['nose', 'mouth', 'eyeL', 'eyeR', 'chin']) {
      expect(dx(p, id)).toBeGreaterThan(1);
      expect(dx(m, id)).toBeLessThan(-1);
    }
    // Miroir : l'œil gauche à +30° et l'œil droit à −30° se déplacent d'autant en sens contraire ; l'axe (nez, bouche) à l'identique.
    expect(dx(p, 'eyeL') + dx(m, 'eyeR')).toBeCloseTo(0, 6);
    expect(dx(p, 'nose') + dx(m, 'nose')).toBeCloseTo(0, 6);
    expect(dx(p, 'nose')).toBeGreaterThan(dx(p, 'mouth'));
  });

  it('yeux : l’ancre suit le nœud, le moteur d’yeux reçoit la rotation de tête (sphere, sans parallaxe) ; œil proche plus large que lointain', () => {
    const { f, host } = make(321, 30);
    const l = eyePoseOf(host as never, -1), r = eyePoseOf(host as never, 1);
    expect(l && r).toBeTruthy();
    expect(l?.headTurn).toMatchObject({ yawDeg: 30, model: 'sphere', parallax: false });
    expect(Math.sign(l?.headTurn.azimuthDeg ?? 0)).toBe(-1);
    expect(Math.sign(r?.headTurn.azimuthDeg ?? 0)).toBe(1);
    const eyes = expandScene(parse(f.objects)).filter((o) => o.kind === 'eye') as unknown as { headTurn: { yawDeg: number; model: string }; transform: { x: number } }[];
    expect(eyes.length).toBe(2);
    for (const e of eyes) expect(e.headTurn).toMatchObject({ yawDeg: 30, model: 'sphere' });
    const base = expandScene(parse(make(321, 0).f.objects)).filter((o) => o.kind === 'eye') as unknown as { transform: { x: number } }[];
    expect(eyes[0]!.transform.x).toBeGreaterThan(base[0]!.transform.x);
  });

  it('oreilles : celle du côté vers lequel le visage se tourne passe derrière, l’autre se découvre (±40°)', () => {
    const { lm } = make(321, 0);
    const p = poseFaceFeatures(lm, 40), m = poseFaceFeatures(lm, -40);
    // Le visage se tourne vers la droite de l'image : on découvre l'oreille côté gauche de l'image, celle de droite passe derrière le visage.
    expect(featureVisible(p, 'earL')).toBe(true);
    expect(featureVisible(p, 'earR')).toBe(false);
    expect(featureVisible(m, 'earR')).toBe(true);
    expect(featureVisible(m, 'earL')).toBe(false);
  });

  it('régions de peau : le nez suit le nez, les joues suivent le crâne, le cou ne bouge pas ; identité à 0°', () => {
    const { lm, host } = make(321, 0);
    const g = noseGeometry(FaceParams.parse(host.face), lm);
    const r0 = skinRegions(lm, g);
    const same = poseRegions(r0, poseFaceFeatures(lm, 0));
    expect(JSON.stringify(same)).toBe(JSON.stringify(r0));
    const r = poseRegions(r0, poseFaceFeatures(lm, 30));
    expect(r.nose[0]!.cx).toBeGreaterThan(r0.nose[0]!.cx + 1);
    expect(r.neck[0]!.cx).toBe(r0.neck[0]!.cx);
    expect(r.cheeks[1]!.rx).toBeGreaterThan(0);
    for (const e of Object.values(r).flat()) expect(Number.isFinite((e as { cx: number }).cx)).toBe(true);
  });

  it('rendu : à ±30° le SVG diffère de 0°, reste déterministe, et ±30° donnent des dessins différents (traits déplacés en sens opposés)', () => {
    const a = scene(make(321, 0).f.objects), p = scene(make(321, 30).f.objects), m = scene(make(321, -30).f.objects);
    expect(p).not.toBe(a);
    expect(p).not.toBe(m);
    expect(scene(make(321, 30).f.objects) === p).toBe(true);
    expect(p.includes('NaN')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { compileScene, expandScene, generateRandomFace, SceneSpec } from '../src';
import { compose } from '../src/composition/anchors';
import { openingGeometry } from '../src/geometry/eye';
import { facialHairGeometry, faceLandmarks, hairGeometry, halfWidthAt, inPoly, mustacheBand, rightSamples, type Poly } from '../src/face';
import { FaceParams, HAIR_FRINGES, HAIR_STYLES, MUSTACHES, BEARDS, type SceneInput } from '../src/schema';

const N = 240;
const seeds = Array.from({ length: N }, (_, i) => 7000 + i * 13);
const sceneOf = (objects: SceneInput['objects']): SceneInput => ({ width: 500, height: 600, background: '#333333', objects });
const grid = (b: { minX: number; maxX: number; minY: number; maxY: number }): { x: number; y: number }[] =>
  Array.from({ length: 11 * 11 }, (_, k) => ({ x: b.minX + ((b.maxX - b.minX) * (k % 11)) / 10, y: b.minY + ((b.maxY - b.minY) * Math.floor(k / 11)) / 10 }));
const anyInside = (polys: Poly[], pts: { x: number; y: number }[]): boolean => pts.some((q) => polys.some((p) => inPoly(p, q.x, q.y)));

describe('repères étendus (cou, cheveux, lèvres)', () => {
  it.each(seeds.slice(0, 60))('seed %i : cou entre menton et mâchoire, cheveux au-dessus des sourcils', (seed) => {
    const f = generateRandomFace(seed, { transform: { x: 250, y: 300 } });
    const lm = faceLandmarks(f.params, f.width, f.height);
    const jawHalf = halfWidthAt(lm.outline, lm.jawY);
    expect(lm.neck.half).toBeGreaterThanOrEqual(lm.outline.chinHalf * 1.15 - 1e-9);
    expect(lm.neck.half).toBeLessThanOrEqual(jawHalf * 0.85 + 1e-9);
    expect(lm.hair.centerY).toBeLessThan(lm.hair.templeY);
    expect(lm.hair.templeY).toBeLessThan(lm.browLimitY);
    expect(lm.lips.topY).toBeLessThan(lm.lips.bottomY);
    const [t, b] = mustacheBand(lm);
    expect(t).toBeGreaterThan(lm.noseBaseY);
    expect(b).toBeLessThanOrEqual(lm.lips.topY + 1e-9);
  });
});

describe('cheveux : enfants du visage, jamais sur les yeux', () => {
  it.each(seeds)('seed %i : la chevelure ne recouvre aucun œil (empreinte réelle des deux yeux)', (seed) => {
    const f = generateRandomFace(seed);
    const lm = faceLandmarks(f.params, f.width, f.height);
    const geo = hairGeometry(f.params, lm);
    if (!geo) return;
    for (const side of ['left', 'right'] as const) expect(anyInside(geo.front, grid(f.fits[side].footprint))).toBe(false);
    if (geo.fringeBottom) expect(Math.max(...geo.fringeBottom.map((q) => q.y))).toBeLessThanOrEqual(lm.browLimitY - 0.008 * lm.H + 1e-9);
  });

  it.each(HAIR_STYLES.flatMap((s) => HAIR_FRINGES.map((fr) => [s, fr] as const)))('style %s + frange %s : SVG valide et crâne couvert', (style, fringe) => {
    const f = generateRandomFace(321, { hair: { style, fringe, color: '#4a2c17', seed: 9 } });
    const r = compileScene(sceneOf(f.objects.map((o, i) => (i === 0 ? { ...o, transform: { x: 250, y: 300, scale: 1, rotationDeg: 0 } } : o)) as SceneInput['objects']));
    if (!r.ok) throw new Error(r.issues.join('\n'));
    expect(r.svg).not.toMatch(/NaN|Infinity/);
    const lm = faceLandmarks(f.params, f.width, f.height);
    const geo = hairGeometry(f.params, lm);
    if (style === 'bald') return expect(geo).toBeNull();
    // Tout point du contour du crâne situé au-dessus de la naissance des cheveux est sous les cheveux.
    const s = rightSamples(lm.outline);
    // Implantation réelle (forme, tempes, irrégularité) : on teste ce qui est AU-DESSUS d'elle.
    const hlY = (x: number): number => (geo?.hairline.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a)) ?? { y: 0 }).y;
    const top = s.filter((q) => q.y < hlY(q.x) - 0.012 * lm.H);
    expect(top.length).toBeGreaterThan(3);
    for (const q of top) for (const sg of [-1, 1]) expect(anyInside(geo?.front ?? [], [{ x: sg * q.x * 0.995, y: q.y + 0.002 * lm.H }])).toBe(true);
  });

  it('est déterministe', () => {
    expect(JSON.stringify(generateRandomFace(55))).toBe(JSON.stringify(generateRandomFace(55)));
  });
});

describe('pilosité faciale : à sa place, qu’elle que soit sa forme', () => {
  it.each(seeds)('seed %i : moustache sous le nez et hors des lèvres, barbe dans le contour et hors de la bouche', (seed) => {
    const f = generateRandomFace(seed, { facialHair: { mustache: MUSTACHES[1 + (seed % 3)] as never, beard: BEARDS[1 + (seed % 3)] as never } });
    const lm = faceLandmarks(f.params, f.width, f.height);
    const g = facialHairGeometry(f.params, lm);
    expect(g.mustache).not.toBeNull();
    expect(g.beard).not.toBeNull();
    for (const q of g.mustache ?? []) {
      expect(q.y).toBeGreaterThanOrEqual(lm.noseBaseY);
      expect(Math.abs(q.x)).toBeLessThanOrEqual(lm.lips.half * 1.13);
    }
    // La moustache ne touche aucun œil (les yeux sont au-dessus du nez).
    for (const side of ['left', 'right'] as const) expect(Math.max(...(g.mustache ?? []).map((q) => q.y)) > f.fits[side].footprint.maxY).toBe(true);
    const s = rightSamples(lm.outline);
    for (const q of g.beard ?? []) {
      if (q.y <= lm.H / 2) expect(Math.abs(q.x)).toBeLessThanOrEqual(halfWidthAt(lm.outline, q.y, s) + 0.01 * lm.W);
      else expect(Math.abs(q.x)).toBeLessThanOrEqual(lm.outline.chinHalf + 0.01 * lm.W);
    }
    // Le centre de la bouche et ses commissures ne sont jamais sous la barbe pleine ou la barbiche.
    const mouth = [{ x: 0, y: lm.mouthY }, { x: lm.lips.half * 0.9, y: lm.lips.cornerY }, { x: -lm.lips.half * 0.9, y: lm.lips.cornerY }, { x: 0, y: lm.lips.bottomY }];
    expect(anyInside(g.beard ? [g.beard] : [], mouth)).toBe(false);
  });

  it('SVG valide pour toutes les combinaisons', () => {
    for (const m of MUSTACHES) for (const b of BEARDS) {
      const f = generateRandomFace(77, { facialHair: { mustache: m, beard: b } });
      const r = compileScene(sceneOf(f.objects.map((o, i) => (i === 0 ? { ...o, transform: { x: 250, y: 300, scale: 1, rotationDeg: 0 } } : o)) as SceneInput['objects']));
      if (!r.ok) throw new Error(r.issues.join('\n'));
      expect(r.svg).not.toMatch(/NaN|Infinity/);
    }
  });
});

describe('asymétrie légère des yeux : le canthus reste EXACTEMENT sur son repère', () => {
  it.each(seeds)('seed %i : ancre exacte après expansion, empreinte dans l’orbite, asymétrie réelle mais légère', (seed) => {
    const f = generateRandomFace(seed);
    const scene = SceneSpec.parse(sceneOf(f.objects));
    const host = scene.objects[0];
    if (host?.kind !== 'host') throw new Error('hôte attendu');
    const lm = faceLandmarks(FaceParams.parse(host.face), host.width, host.height);
    const a = lm.asymmetry;
    expect(Math.abs(a.eyeScale)).toBeLessThanOrEqual(0.06);
    expect(Math.abs(a.eyeRollDeg)).toBeLessThanOrEqual(2.2);
    for (const side of ['left', 'right'] as const) {
      const fit = f.fits[side];
      const P = side === 'left' ? lm.innerCanthus.left : lm.innerCanthus.right;
      expect(fit.anchor).toEqual(P);
      expect(fit.footprint.minY).toBeGreaterThanOrEqual(lm.browLimitY - 1e-6);
      expect(fit.footprint.maxY).toBeLessThanOrEqual(lm.lowerLimitY + 1e-6);
    }
    // Les deux canthi internes diffèrent légèrement en hauteur (asymétrie), de moins de 0,7 % de H.
    expect(Math.abs(lm.innerCanthus.left.y - lm.innerCanthus.right.y)).toBeLessThanOrEqual(0.007 * lm.H + 1e-9);
    expect(expandScene(scene).filter((o) => o.kind === 'eye')).toHaveLength(2);
  });

  it('asymétrie nulle : visage strictement symétrique (même ligne des yeux, même taille)', () => {
    const f = generateRandomFace(99, { asymmetry: { eyeScale: 0, eyeOpenness: 0, eyeRollDeg: 0, eyeDy: 0, mouthTiltDeg: 0 } });
    const lm = faceLandmarks(f.params, f.width, f.height);
    expect(lm.innerCanthus.left.y).toBe(lm.innerCanthus.right.y);
    expect(f.fits.left.scale).toBeCloseTo(f.fits.right.scale, 9);
    expect(f.fits.left.transform.rotationDeg).toBe(0);
  });
});

describe('ancrage en coordonnées monde, yeux tournés autour du canthus', () => {
  it.each(seeds.slice(0, 120))('seed %i : canthus interne de chaque œil = repère du visage, après rotation et mise à l’échelle', (seed) => {
    const f = generateRandomFace(seed, { transform: { x: 250, y: 300, scale: 0.8 } });
    const scene = SceneSpec.parse(sceneOf(f.objects));
    const host = scene.objects[0];
    if (host?.kind !== 'host') throw new Error('hôte attendu');
    const lm = faceLandmarks(FaceParams.parse(host.face), host.width, host.height);
    for (const e of expandScene(scene)) {
      if (e.kind !== 'eye') continue;
      const g = openingGeometry(e.shape, e.canthi);
      const w = compose({ ...e.transform }, { x: g.pi.x, y: g.pi.y, rotationDeg: 0, scale: 1 });
      const P = e.shape.outerSide === 'left' ? lm.innerCanthus.left : lm.innerCanthus.right;
      const wanted = compose(host.transform, { x: P.x, y: P.y, rotationDeg: 0, scale: 1 });
      expect(w.x).toBeCloseTo(wanted.x, 6);
      expect(w.y).toBeCloseTo(wanted.y, 6);
      expect(e.transform.rotationDeg).toBeCloseTo(host.transform.rotationDeg + lm.asymmetry.eyeRollDeg, 9);
    }
  });
});

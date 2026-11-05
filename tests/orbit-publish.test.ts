import { describe, expect, it } from 'vitest';
import { generateRandomFace, SceneSpec, compileScene } from '../src';
import { placedEyesByHost } from '../src/anatomy/placed';
import { ORBIT_MIDLINE_GAP, orbitRatio, openingInHost, publishedOrbits, publishOrbit, sideOf } from '../src/anatomy/orbit';
import { hostFace } from '../src/render/face';
import { noseGeometry } from '../src/face';
import { faceComponents } from '../src/render/face/components';
import { verifyOrbits } from '../src/verify/orbit';
import type { HostSpec } from '../src/schema';

const sceneOf = (seed: number) => SceneSpec.parse({ width: 640, height: 900, objects: generateRandomFace(seed, { id: 'f0', transform: { x: 0, y: 0, scale: 1 } }).objects });
const setup = (seed: number) => {
  const scene = sceneOf(seed);
  const host = scene.objects.find((o) => o.kind === 'host') as HostSpec;
  const { params, lm } = hostFace(host);
  const eyes = placedEyesByHost(scene).get('f0') ?? [];
  return { scene, params, lm, eyes, orbits: publishedOrbits(lm, eyes) };
};

describe("orbite publiée par l'œil (docs/ORBIT-PUBLISH.md)", () => {
  it("un œil déjà dans l'orbite a priori la laisse INCHANGÉE (zéro dérive pour les visages conformes)", () => {
    const o = { cx: 60, cy: 0, rx: 40, ry: 30 };
    const p = publishOrbit(o, [{ x: 50, y: 0 }, { x: 70, y: 5 }], 300);
    expect(p).toMatchObject({ ...o, grown: false, growth: 1 });
  });

  it('un œil qui dépasse : orbite agrandie, contient TOUS les points avec marge, écart à la ligne médiane respecté, symétrique à gauche', () => {
    const pts = [{ x: 30, y: -50 }, { x: 95, y: -48 }, { x: 96, y: 40 }, { x: 31, y: 42 }, { x: 62, y: -60 }, { x: 62, y: 55 }];
    const prior = { cx: 62, cy: 0, rx: 38, ry: 25 };
    const r = publishOrbit(prior, pts, 300);
    expect(r.grown).toBe(true);
    expect(orbitRatio(r, pts)).toBeLessThan(1);
    expect(r.cx - r.rx).toBeGreaterThanOrEqual(ORBIT_MIDLINE_GAP * 300 - 1e-9);
    expect(r.rx).toBeGreaterThanOrEqual(prior.rx);
    expect(r.ry).toBeGreaterThanOrEqual(prior.ry);
    const l = publishOrbit({ ...prior, cx: -62 }, pts.map((p) => ({ x: -p.x, y: p.y })), 300);
    expect(l.cx).toBeCloseTo(-r.cx, 9);
    expect(l.rx).toBeCloseTo(r.rx, 9);
    expect(l.ry).toBeCloseTo(r.ry, 9);
  });

  it('sur 120 visages : œil toujours contenu, orbites dans le crâne et disjointes, verifyOrbits sans erreur', () => {
    let grownCount = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const { params, lm, eyes, orbits } = setup(seed);
      for (const pe of eyes) expect(orbitRatio(orbits[sideOf(pe)], openingInHost(pe)), `seed ${seed}`).toBeLessThan(1);
      const failures = verifyOrbits('f0', params, lm, eyes, orbits).filter((c) => !c.ok && c.severity === 'error');
      expect(failures.map((c) => `seed ${seed} ${c.id} ${c.value}`)).toEqual([]);
      grownCount += Number(orbits.left.grown) + Number(orbits.right.grown);
    }
    expect(grownCount).toBeGreaterThan(10); // la correction est réellement exercée
  });

  it("contrôle négatif : sans publication (a priori seul), la vérification DÉTECTE l'œil hors de l'ombre d'orbite", () => {
    let detected = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { params, lm, eyes, orbits } = setup(seed);
      if (!orbits.left.grown && !orbits.right.grown) continue;
      const prior = { left: { ...lm.orbit.left, grown: false, growth: 1 }, right: { ...lm.orbit.right, grown: false, growth: 1 } };
      // Le polygone d'ombre est construit avec l'a priori, mais l'œil reste celui du visage : la contenance doit échouer.
      const bad = verifyOrbits('f0', params, lm, eyes, prior).filter((c) => c.id.startsWith('orbit.shadow-contains-eye') && !c.ok);
      if (bad.length) detected++;
    }
    expect(detected).toBeGreaterThan(3);
  });

  it("le graphe de contact consomme l'orbite publiée : le polygone d'ombre grandit pour un œil qui dépassait, et reste identique sinon", () => {
    let checkedGrown = 0, checkedSame = 0;
    for (let seed = 1; seed <= 40 && (checkedGrown < 2 || checkedSame < 2); seed++) {
      const { params, lm, orbits } = setup(seed);
      const g = noseGeometry(params, lm);
      const area = (cs: ReturnType<typeof faceComponents>['components'], id: string) => {
        const q = cs.find((c) => c.id === id)!.polys[0]!;
        return Math.abs(q.reduce((a, p, i) => a + (p.x * q[(i + 1) % q.length]!.y - q[(i + 1) % q.length]!.x * p.y), 0)) / 2;
      };
      const withPub = faceComponents(params, lm, g, orbits).components, without = faceComponents(params, lm, g).components;
      for (const [side, id] of [['left', 'orbitL'], ['right', 'orbitR']] as const) {
        if (orbits[side].grown) { expect(area(withPub, id)).toBeGreaterThan(area(without, id)); checkedGrown++; }
        else { expect(area(withPub, id)).toBeCloseTo(area(without, id), 9); checkedSame++; }
      }
    }
    expect(checkedGrown).toBeGreaterThanOrEqual(2);
    expect(checkedSame).toBeGreaterThanOrEqual(2);
  });

  it('la scène complète compile et le rendu est déterministe', () => {
    const s = sceneOf(7);
    const a = compileScene(s), b = compileScene(s);
    expect(a.ok && b.ok && a.svg === b.svg).toBe(true);
  });
});

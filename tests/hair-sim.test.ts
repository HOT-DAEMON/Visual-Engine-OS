import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { faceLandmarks, hairGeometry } from '../src/face';
import { makeCollider } from '../src/face/hair/sim/collider';
import { ARCHETYPES } from '../src/face/hair/sim/archetypes';
import { simulateChain, type ChainSpec } from '../src/face/hair/sim/verlet';
import { HAIR_ARCHETYPES } from '../src/schema';
import { hairSimStats, verifyFace } from '../src/verify';

const face = (seed: number, sim: Record<string, unknown>) =>
  generateRandomFace(seed, { identity: 3, hairEngine: 'classic', hair: { style: 'short', texture: 'straight', color: '#23232b', seed: 5, volume: 0.5, density: 0.85, part: 0.2, sim: { enabled: true, ...sim } } as never, facialHair: { mustache: 'none', beard: 'none' } } as never);
const geoOf = (f: ReturnType<typeof face>) => hairGeometry(f.params, faceLandmarks(f.params, f.width, f.height))!;

describe('cheveux simulés (Verlet)', () => {
  it('chaque archétype du schéma a une définition (sauf none) et des masses de part positive', () => {
    for (const a of HAIR_ARCHETYPES.filter((x) => x !== 'none')) {
      expect(ARCHETYPES[a], a).toBeDefined();
      expect(ARCHETYPES[a]!.masses.every((m) => m.share > 0 && m.len[0] <= m.len[1])).toBe(true);
    }
  });

  it('déterministe : même graine → mêmes sommets', () => {
    const a = geoOf(face(7, { archetype: 'tousled' }));
    const b = geoOf(face(7, { archetype: 'tousled' }));
    expect(JSON.stringify(a.locks.map((l) => l.poly))).toBe(JSON.stringify(b.locks.map((l) => l.poly)));
  });

  it('désactivé par défaut : aucune mèche simulée, aucun changement du moteur existant', () => {
    const f = generateRandomFace(7, { hairEngine: 'classic', hair: { style: 'short', color: '#23232b' } as never } as never);
    expect(f.params.hair.sim.enabled).toBe(false);
    expect(geoOf(f).skinShadows ?? []).toHaveLength(0);
    expect(geoOf(f).locks.some((l) => l.sim)).toBe(false);
  });

  it('le collisionneur garde la chaîne hors du crâne et la longueur des segments tient', () => {
    const f = face(3, {});
    const lm = faceLandmarks(f.params, f.width, f.height);
    const body = makeCollider(lm, 0.02 * lm.W);
    const strict = makeCollider(lm, 0);
    const root = body.surface(lm.hair.templeY - 0.1 * lm.H, 0.6);
    const spec: ChainSpec = { root, dir: { x: 0.3, y: 0.9, z: 0.3 }, length: 0.4 * lm.H, points: 20, gravity: 1, float: 0, wind: 0, gustPhase: 0, stiffness: 0.3, cling: 0.7, az: 0.6, curl: 0, wave: 0, reach: 0.2 * lm.W };
    const pts = simulateChain(spec, body);
    const ds = spec.length / 19;
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y, pts[i]!.z - pts[i - 1]!.z);
      expect(d).toBeCloseTo(ds, 5);
      expect(strict.push(pts[i]!).hit, `point ${i} dans le corps`).toBe(false);
    }
  });

  it('la gravité fait retomber : la pointe d\'une mèche molle est plus basse que sa racine', () => {
    const f = face(3, {});
    const lm = faceLandmarks(f.params, f.width, f.height);
    const body = makeCollider(lm, 0.02 * lm.W);
    const root = body.surface(lm.hair.templeY - 0.15 * lm.H, 1.0);
    const base = { root, dir: { x: 0.6, y: 0.2, z: 0.1 }, length: 0.3 * lm.H, points: 16, wind: 0, gustPhase: 0, stiffness: 0.15, cling: 0.6, az: 1.0, curl: 0, wave: 0, reach: 0.3 * lm.W };
    const fall = simulateChain({ ...base, gravity: 1, float: 0 }, body);
    const float = simulateChain({ ...base, gravity: 1, float: 1 }, body);
    expect(fall[fall.length - 1]!.y).toBeGreaterThan(root.y);
    expect(float[float.length - 1]!.y).toBeLessThan(fall[fall.length - 1]!.y);
  });

  it('détecteur « électrocuté » : l\'anti-gravité volontaire fait monter la part de mèches dressées', () => {
    const calm = hairSimStats(face(11, { archetype: 'messy_bangs' }), geoOf(face(11, { archetype: 'messy_bangs' })));
    const f = face(11, { archetype: 'messy_bangs', float: 1, stiffness: 1 });
    const wild = hairSimStats(f, geoOf(f));
    expect(wild.electrocutedShare).toBeGreaterThan(calm.electrocutedShare);
    expect(calm.electrocutedShare).toBeLessThanOrEqual(calm.tolerance);
  });

  it('les 15 archétypes passent la vérification (géométrie, anatomie, style) sur 3 visages', () => {
    for (const a of HAIR_ARCHETYPES.filter((x) => x !== 'none')) {
      for (const seed of [321, 12, 77]) {
        const r = verifyFace(face(seed, { archetype: a }));
        expect(r.failures.map((c) => `${a}/${seed}/${c.id}`)).toEqual([]);
      }
    }
  }, 120_000);

  it('la couverture du cuir chevelu est complète et les ombres sur la peau sont produites', () => {
    const f = face(321, { archetype: 'side_sweep' });
    const g = geoOf(f);
    expect(hairSimStats(f, g).scalpCoverage).toBeGreaterThanOrEqual(0.8);
    expect(g.skinShadows!.length).toBeGreaterThan(0);
  });
});

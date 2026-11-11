import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { faceLandmarks, noseGeometry, noseArchetype, noseArchetypeResidual, NOSE_ARCHETYPE_NAMES, REPRODUCIBLE_MAX, widthProfile25 } from '../src/face';
import { FaceParams } from '../src/schema';
import { NOSE_FIT } from '../src/face/nose/archetypes.generated';

/**
 * Archétypes de nez tirés des silhouettes MESURÉES de references/nez/06.png. Le test RECALCULE le résidu depuis la référence (il ne relit pas
 * seulement le nombre stocké) : si le moteur change, l'archétype doit être réajusté (`npx tsx scripts/nose-refs/fit.ts`) ou la doc corrigée.
 */
const refs = JSON.parse(readFileSync('references/nez/measures-06.json', 'utf8')).shapes as { index: number; aspectWoverH: number; widthProfile25: number[] }[];
const ORDER = ['pyramide', 'ellipse-large', 'cloche-ailes', 'plat-trapeze', 'losange-petit'] as const;
const UPPER = 18;
const residual = (name: (typeof ORDER)[number]): { r: number; aspect: number } => {
  const patch: Record<string, unknown> = { anatomyEngine: 'structured' };
  const flat = NOSE_FIT[name].params as Record<string, number>;
  for (const [path, v] of Object.entries(flat)) { const ks = path.split('.'); let c = patch as Record<string, any>; for (const k of ks.slice(0, -1)) c = (c[k] ??= {}); c[ks[ks.length - 1]!] = v; }
  const p = FaceParams.parse(patch), m = widthProfile25(noseGeometry(p, faceLandmarks(p, 300, 380)).silhouette), ref = refs[ORDER.indexOf(name)]!;
  let e = 0; for (let i = 0; i < UPPER; i++) e += (m.profile[i]! - ref.widthProfile25[i]!) ** 2;
  return { r: Math.sqrt(e / UPPER) + 0.25 * Math.abs(Math.log(m.aspect / ref.aspectWoverH)), aspect: m.aspect };
};

describe('archétypes de nez issus de references/nez/06.png', () => {
  it('la mesure des 5 silhouettes de référence existe (segmentation, pas saisie à la main)', () => {
    expect(refs).toHaveLength(5);
    for (const r of refs) { expect(r.widthProfile25).toHaveLength(25); expect(r.aspectWoverH).toBeGreaterThan(0.5); }
  });
  for (const name of ORDER) it(`le résidu stocké de « ${name} » est celui que le moteur actuel produit`, () => {
    expect(Math.abs(residual(name).r - noseArchetypeResidual(name))).toBeLessThan(0.01);
  });
  for (const name of NOSE_ARCHETYPE_NAMES) it(`« ${name} » reproduit la silhouette de référence (résidu ≤ ${REPRODUCIBLE_MAX}) et donne un visage valide`, () => {
    expect(residual(name).r).toBeLessThanOrEqual(REPRODUCIBLE_MAX);
    expect(() => FaceParams.parse({ anatomyEngine: 'structured', ...noseArchetype(name) })).not.toThrow();
  });
  it('les deux archétypes sont réellement différents (rapport L/H et largeur des ailes)', () => {
    const a = residual('pyramide'), b = residual('cloche-ailes');
    expect(Math.abs(a.aspect - b.aspect)).toBeGreaterThan(0.05);
  });
  it('les trois autres formes de la planche sont déclarées NON reproductibles (résidu > seuil) : la doc ne doit pas les prétendre faites', () => {
    for (const n of ['ellipse-large', 'plat-trapeze', 'losange-petit'] as const) expect(noseArchetypeResidual(n)).toBeGreaterThan(REPRODUCIBLE_MAX);
  });
});

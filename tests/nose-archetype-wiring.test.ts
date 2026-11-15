import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { faceLandmarks, noseGeometry, widthProfile25 } from '../src/face';
import { generateRandomFace } from '../src/generation/random-face';

/**
 * Branchement des archétypes de nez (`pyramide`, `cloche-ailes`) dans le générateur aléatoire (`noseArchetype`). Étude chiffrée :
 * `references/nez/archetype-engines.json` (script `scripts/nose-refs/archetype-engines.ts`) et `docs/NOSE-ARCHETYPE-WIRING.md`.
 */
const study = JSON.parse(readFileSync('references/nez/archetype-engines.json', 'utf8')) as Record<string, { neutral: { classic: { r: number }; structured: { r: number } }; random: { classic: { median: number }; structured: { median: number } }; refAspect: number }>;
const SEEDS = Array.from({ length: 24 }, (_, i) => (i + 1) * 7919);
const aspect = (seed: number, opts: Parameters<typeof generateRandomFace>[1]): number => {
  const f = generateRandomFace(seed, opts); return widthProfile25(noseGeometry(f.params, faceLandmarks(f.params, f.width, f.height)).silhouette).aspect;
};
const stripNose = (p: Record<string, unknown>): string => JSON.stringify({ ...p, nose: undefined });

describe('archétypes de nez branchés dans le générateur aléatoire', () => {
  it('sans l\'option, rien ne bouge : visage identique graine pour graine', () => {
    for (const s of SEEDS.slice(0, 6)) expect(JSON.stringify(generateRandomFace(s).params)).toBe(JSON.stringify(generateRandomFace(s, { noseArchetype: undefined }).params));
  });
  it('avec l\'option, SEUL le nez change : tous les autres axes du visage sont identiques', () => {
    for (const s of SEEDS.slice(0, 8)) for (const a of ['pyramide', 'cloche-ailes'] as const) {
      expect(stripNose(generateRandomFace(s, { noseArchetype: a }).params as never)).toBe(stripNose(generateRandomFace(s).params as never));
      expect(JSON.stringify(generateRandomFace(s, { noseArchetype: a }).params.nose)).not.toBe(JSON.stringify(generateRandomFace(s).params.nose));
    }
  });
  for (const [name, ref] of [['pyramide', 0.73], ['cloche-ailes', 0.9767]] as const) it(`« ${name} » : L/H des visages aléatoires centré sur la référence (${ref}) et resserré par rapport au tirage libre`, () => {
    const withA = SEEDS.map((s) => aspect(s, { noseArchetype: name })), free = SEEDS.map((s) => aspect(s, {}));
    const sd = (a: number[]) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };
    const median = [...withA].sort((x, y) => x - y)[Math.floor(withA.length / 2)]!;
    expect(Math.abs(median - ref)).toBeLessThan(0.08);
    expect(sd(withA)).toBeLessThan(sd(free) * 0.5);
  });
  it('moteurs classic et structured : même silhouette (écart de L/H médian < 0,01), conforme à l\'étude stockée', () => {
    for (const n of ['pyramide', 'cloche-ailes'] as const) {
      expect(Math.abs(study[n]!.random.classic.median - study[n]!.random.structured.median)).toBeLessThan(0.01);
      expect(Math.abs(study[n]!.neutral.classic.r - study[n]!.neutral.structured.r)).toBeLessThan(1e-6);
      for (const s of SEEDS.slice(0, 8)) expect(Math.abs(aspect(s, { noseArchetype: n }) - aspect(s, { noseArchetype: n, structure: true }))).toBeLessThan(0.02);
    }
  });
  it('`noseArchetype: \'random\'` est déterministe, utilise les deux archétypes, et `anatomy.nose` explicite garde le dernier mot', () => {
    const pick = (s: number) => JSON.stringify(generateRandomFace(s, { noseArchetype: 'random' }).params.nose);
    expect(pick(SEEDS[0]!)).toBe(pick(SEEDS[0]!));
    const kinds = new Set(SEEDS.map((s) => pick(s) === JSON.stringify(generateRandomFace(s, { noseArchetype: 'pyramide' }).params.nose) ? 'p' : 'c'));
    expect(kinds.size).toBe(2);
    expect(generateRandomFace(SEEDS[0]!, { noseArchetype: 'pyramide', anatomy: { nose: { tip: { rotation: 0.123 } } } }).params.nose.tip.rotation).toBeCloseTo(0.123, 6);
  });
});

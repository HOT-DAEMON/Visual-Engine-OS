import { describe, expect, it } from 'vitest';
import { compileScene, EyeSpec } from '../src';
import { generateRandomEye } from '../src/generation/random-eye';

const N = 200;
const sample = (n: number, opts: Parameters<typeof generateRandomEye>[1] = {}) =>
  Array.from({ length: n }, (_, i) => generateRandomEye(i * 7919 + 1, opts));

describe('generateRandomEye : validité', () => {
  it(`${N} seeds consécutives produisent toutes un EyeSpec valide`, () => {
    for (const input of sample(N)) {
      const r = EyeSpec.safeParse(input);
      if (!r.success) throw new Error(`seed invalide : ${JSON.stringify(r.error.issues)}`);
    }
  });

  it('chaque œil généré se compile en SVG sans NaN ni Infinity', () => {
    for (const input of sample(30)) {
      const res = compileScene({ objects: [input] });
      if (!res.ok) throw new Error(res.issues.join('\n'));
      expect(res.svg).not.toMatch(/NaN|Infinity/);
    }
  });
});

describe('generateRandomEye : déterminisme', () => {
  it('même seed => même œil, structurellement identique', () => {
    expect(generateRandomEye(42)).toEqual(generateRandomEye(42));
  });

  it('même seed => même SVG (bout en bout)', () => {
    const svgOf = (seed: number) => {
      const r = compileScene({ objects: [{ ...generateRandomEye(seed), id: 'e' }] });
      if (!r.ok) throw new Error(r.issues.join('\n'));
      return r.svg;
    };
    expect(svgOf(1000)).toBe(svgOf(1000));
  });

  it("l'id par défaut dépend de la seed (pas de collision triviale entre deux seeds)", () => {
    expect(generateRandomEye(1).id).not.toBe(generateRandomEye(2).id);
  });
});

describe('generateRandomEye : diversité combinatoire (composition quasi infinie)', () => {
  it(`${N} seeds ne produisent aucun doublon exact`, () => {
    const seen = new Set(sample(N).map((e) => JSON.stringify(e)));
    expect(seen.size).toBe(N);
  });

  it('la forme (largeur/hauteur/inclinaison) varie sur l\'échantillon', () => {
    const widths = new Set(sample(N).map((e) => e.shape?.width));
    expect(widths.size).toBeGreaterThan(N * 0.9);
  });

  it('la famille/couleur d\'iris varie (dégradés distincts sur l\'échantillon)', () => {
    const mids = new Set(
      sample(N).map((e) => {
        const base = e.iris?.material && 'base' in e.iris.material ? e.iris.material.base : undefined;
        return base && 'stops' in base ? base.stops[1]?.color : undefined;
      }),
    );
    expect(mids.size).toBeGreaterThan(N * 0.9);
  });

  it('la présence du sourcil, la forme de la pupille, le côté externe et le style d\'enveloppe varient', () => {
    const s = sample(N);
    expect(new Set(s.map((e) => e.eyebrow === null)).size).toBe(2);
    expect(new Set(s.map((e) => e.pupil?.shape)).size).toBeGreaterThanOrEqual(2);
    expect(new Set(s.map((e) => e.shape?.outerSide)).size).toBe(3);
    expect(new Set(s.map((e) => e.shape?.style)).size).toBeGreaterThanOrEqual(3);
  });

  it('la richesse des cils varie (dispersion des fibres, matériau propre, brillance)', () => {
    const s = sample(N);
    const upperLengthVar = s.map((e) => e.lashes?.upper?.lengthVariation);
    expect(Math.max(...(upperLengthVar as number[]))).toBeGreaterThan(0.3);
    expect(Math.min(...(upperLengthVar as number[]))).toBeLessThan(0.3);
    expect(s.some((e) => e.lashes?.upper?.material !== null && e.lashes?.upper?.material !== undefined)).toBe(true);
    expect(s.some((e) => e.lashes?.upper?.material === null)).toBe(true);
    expect(s.some((e) => (e.lashes?.upper?.gloss ?? 0) > 0)).toBe(true);
  });

  it('la richesse de la pupille varie (type de remplissage, présence de contour, visibilité)', () => {
    const s = sample(N);
    expect(new Set(s.map((e) => e.pupil?.fill?.type)).size).toBeGreaterThanOrEqual(2);
    expect(new Set(s.map((e) => (e.pupil?.outlines?.length ?? 0) > 0)).size).toBe(2);
    expect(s.some((e) => e.pupil?.visible === false)).toBe(true);
    expect(s.some((e) => e.pupil?.visible !== false)).toBe(true);
  });

  it('l\'archétype est parfois null (composition libre), parfois l\'un des 6 préréglages', () => {
    const archetypes = new Set(sample(N).map((e) => e.archetype));
    expect(archetypes.has(null)).toBe(true);
    expect(archetypes.size).toBeGreaterThanOrEqual(4); // null + au moins 3 préréglages distincts sur 200 tirages
  });

  it('le pli épicanthique est parfois présent, parfois absent (curseur continu, pas un seul groupe)', () => {
    const amounts = sample(N).map((e) => e.epicanthicFold?.amount ?? 0);
    expect(amounts.some((a) => a === 0)).toBe(true);
    expect(amounts.some((a) => a > 0)).toBe(true);
  });

  it('les traits varient INDÉPENDAMMENT (la forme ne prédit pas la couleur d\'iris)', () => {
    // Preuve de composition combinatoire, pas de "profils" figés : pour une même largeur arrondie,
    // on doit trouver plusieurs couleurs d'iris différentes sur un échantillon assez grand.
    const s = sample(400);
    const byWidthBucket = new Map<number, Set<string>>();
    for (const e of s) {
      const w = e.shape?.width;
      const base = e.iris?.material && 'base' in e.iris.material ? e.iris.material.base : undefined;
      const color = base && 'stops' in base ? base.stops[1]?.color : undefined;
      if (w === undefined || color === undefined) continue;
      const bucket = Math.round(w / 10);
      if (!byWidthBucket.has(bucket)) byWidthBucket.set(bucket, new Set());
      byWidthBucket.get(bucket)?.add(color);
    }
    const withVariety = [...byWidthBucket.values()].filter((set) => set.size > 1);
    expect(withVariety.length).toBeGreaterThan(0);
  });

  it('respecte families : restreint la variété de couleur sans casser la validité', () => {
    const blues = sample(50, { irisFamilies: ['blue'] });
    for (const e of blues) expect(EyeSpec.safeParse(e).success).toBe(true);
  });

  it('respecte un expression imposé (désactive le tirage aléatoire d\'émotion)', () => {
    for (const e of sample(20, { expression: { kind: 'neutral', intensity: 1 } })) {
      expect(e.expression).toEqual({ kind: 'neutral', intensity: 1 });
    }
  });
});

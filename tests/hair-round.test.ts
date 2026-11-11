import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { faceLandmarks, hairGeometry } from '../src/face';
import { checkHairRound, fringeAspect, ROUND_LIMITS, roundMetrics } from '../src/verify';
import { boundGain, GAIN_SPAN } from '../src/face/hair/thickness';
import { splitByAspect, FRINGE_ASPECT_MAX, SPLIT_MAX, spineLength } from '../src/face/hair/fringe-split';
import { NO_FACIAL_HAIR } from '../scripts/lib/hair-faces';

const seeds = Array.from({ length: 24 }, (_, i) => 9000 + i * 71);
const face = (style: string, seed: number) => generateRandomFace(seed, { hair: { style } as never, hairEngine: 'v2' });
const errs = (style: string, sd: number): string[] => checkHairRound(face(style, sd)).filter((c) => !c.ok && c.severity === 'error').map((c) => c.id);

describe('forme ronde des volumes (docs/HAIR-ROUND.md)', () => {
  it.each(['afro', 'curly'])('%s : aucun contrôle d\'erreur de la forme ronde n\'échoue', (style) => {
    for (const sd of seeds) expect(errs(style, sd), `${style} ${sd}`).toEqual([]);
  });

  it.each(['afro', 'curly'])('%s : le dôme est centré (asymétrie de la masse bornée)', (style) => {
    for (const sd of seeds) {
      const f = face(style, sd);
      const lm = faceLandmarks(f.params, f.width, f.height);
      const m = roundMetrics(hairGeometry(f.params, lm)!, lm);
      expect(m.lop, `${style} ${sd}`).toBeLessThanOrEqual(ROUND_LIMITS.lop);
      expect(m.topOff, `${style} ${sd}`).toBeLessThanOrEqual(ROUND_LIMITS.topOff);
    }
  });

  it('le gain d\'asymétrie est borné pour afro et bouclé, intact pour les autres coiffures', () => {
    const wide = (s: number): number => 0.35 + 1.75 * ((s + 1) / 2);
    for (const st of ['afro', 'curly'] as const) {
      const g = boundGain(wide, st), span = GAIN_SPAN[st]!;
      for (const s of [-1, -0.3, 0, 0.6, 1]) { expect(g(s)).toBeGreaterThanOrEqual(1 - span - 1e-9); expect(g(s)).toBeLessThanOrEqual(1 + span + 1e-9); }
    }
    expect(boundGain(wide, 'long')(-1)).toBeCloseTo(0.35, 9);
    expect(boundGain(wide, 'short')(1)).toBeCloseTo(2.1, 9);
  });

  it('contrôle négatif : un dôme penché (masse décalée d\'un côté) est détecté', () => {
    const f = face('afro', seeds[0] as number);
    const lm = faceLandmarks(f.params, f.width, f.height);
    const g = hairGeometry(f.params, lm)!;
    const lean = (p: { x: number; y: number }[]) => p.map((q) => ({ x: q.x + (q.y < 0 ? 0.25 * lm.W : 0.25 * lm.W), y: q.y }));
    const c = checkHairRound(f, { ...g, base: [lean(g.base[0] as never)] as never });
    expect(c.find((x) => x.id === 'round-dome-centered')?.ok).toBe(false);
  });
});

describe('franges : pas de triangles trapus (docs/HAIR-FRINGE-ASPECT.md)', () => {
  it('splitByAspect : une mèche étroite reste telle quelle, une mèche large est répartie sans dépasser le rapport', () => {
    const c = Array.from({ length: 9 }, (_, i) => ({ x: i * 0.2, y: i * 4 }));
    const len = spineLength(c);
    expect(splitByAspect(c, 0.5 * len)).toHaveLength(1);
    const parts = splitByAspect(c, 2.5 * len);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.length).toBeLessThanOrEqual(SPLIT_MAX);
    for (const p of parts) expect(p.width / spineLength(p.centre)).toBeLessThanOrEqual(FRINGE_ASPECT_MAX + 1e-6);
    // moignon : jamais plus de SPLIT_MAX pièces, largeur plafonnée
    const stub = splitByAspect(c, 40 * len);
    expect(stub.length).toBeLessThanOrEqual(SPLIT_MAX);
    expect(stub.reduce((a, p) => a + p.width, 0)).toBeLessThanOrEqual(SPLIT_MAX * FRINGE_ASPECT_MAX * len * 1.2 / 0.9 + 1e-6);
  });

  it('splitByAspect : ligne horizontale ou quasi (écart en y nul) → coordonnées finies et bornées (régression : division par l\'écart en y, boucle infinie)', () => {
    for (const dy of [0, 1e-9, 0.01]) {
      const c = Array.from({ length: 9 }, (_, i) => ({ x: -165 + i * 20, y: -143.6 - i * dy }));
      const len = spineLength(c);
      for (const w of [0.3 * len, 3 * len, 40 * len]) {
        for (const p of splitByAspect(c, w)) {
          for (const q of p.centre) {
            expect(Number.isFinite(q.x) && Number.isFinite(q.y)).toBe(true);
            expect(Math.abs(q.x)).toBeLessThan(1000);
          }
        }
      }
    }
  });

  it('courte série : la part de mèches de frange plus larges que longues reste faible (mesuré avant : 12 %, après : 3 % sur 30 visages)', () => {
    const shares: number[] = [];
    for (const sd of seeds) { const f = face('short', sd); const lm = faceLandmarks(f.params, f.width, f.height); const a = fringeAspect(hairGeometry(f.params, lm)!); if (a.n) shares.push(a.wideShare); }
    const mean = shares.reduce((a, b) => a + b, 0) / shares.length;
    expect(mean).toBeLessThan(0.06);
  });

  it('contrôle négatif : une frange en blocs est signalée', () => {
    const f = face('short', seeds[1] as number);
    const lm = faceLandmarks(f.params, f.width, f.height);
    const g = hairGeometry(f.params, lm)!;
    const locks = g.locks.map((l) => (l.bang && l.w0 ? { ...l, w0: l.w0 * 100 } : l));
    const c = checkHairRound(f, { ...g, locks });
    expect(c.find((x) => x.id === 'fringe-aspect-max')?.ok).toBe(false);
  });
});

describe('gabarit de revue : les cheveux seuls (planches)', () => {
  it('NO_FACIAL_HAIR neutralise aussi les pattes (sinon « plaques anguleuses » aux joues des queues et des tresses)', () => {
    expect(NO_FACIAL_HAIR).toEqual({ mustache: 'none', beard: 'none', sideburns: 'none' });
  });
});

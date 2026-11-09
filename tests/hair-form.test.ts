import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { faceLandmarks, hairGeometry, type HairGeometry } from '../src/face';
import { gridOver, paint } from '../src/face/hair/coverage';
import { FILL, shellCoverage } from '../src/face/hair/crown-fill';
import { inPoly } from '../src/face/poly';
import { checkHairForm } from '../src/verify/hair-form';
import type { tierHueShift } from '../src/render/face/hair-look';
import { HAIR_STYLES } from '../src/schema';
import { hairFaceSpec, type CleanStyle } from '../scripts/lib/hair-faces';

const STYLES = HAIR_STYLES.filter((s) => s !== 'bald') as CleanStyle[];
const face = (st: CleanStyle, k: number) => {
  const sp = hairFaceSpec(st, k, { engine: 'v2', seed: 41000 + k * 31 + STYLES.indexOf(st) * 5 });
  return generateRandomFace(sp.seed, sp.opts);
};
const lmOf = (f: ReturnType<typeof face>) => faceLandmarks(f.params, f.width, f.height);
const geoOf = (f: ReturnType<typeof face>): HairGeometry => hairGeometry(f.params, lmOf(f)) as HairGeometry;
const failing = (f: ReturnType<typeof face>, g: HairGeometry) => checkHairForm(f, g).filter((c) => !c.ok);

describe('grille de couverture (règle nonzero)', () => {
  const rect = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }, { x: 0, y: 6 }];
  it('un rectangle marque exactement les cellules dont le centre est dedans, une seule fois', () => {
    const g = gridOver(rect, 1), d = new Uint8Array(g.nx * g.ny);
    expect(paint(g, rect, d)).toBe(60);
    expect(paint(g, rect, d)).toBe(0);
  });
  it('accord avec inPoly sur un polygone simple (concave)', () => {
    const poly = [{ x: 0, y: 0 }, { x: 12, y: 1 }, { x: 6, y: 5 }, { x: 13, y: 9 }, { x: 1, y: 8 }];
    const g = gridOver(poly, 0.5), d = new Uint8Array(g.nx * g.ny);
    paint(g, poly, d);
    let diff = 0;
    for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) if ((d[j * g.nx + i] === 1) !== inPoly(poly, g.x0 + (i + 0.5) * g.cell, g.y0 + (j + 0.5) * g.cell)) diff++;
    expect(diff).toBe(0);
  });
  it('une boucle qui se recoupe reste couverte (nonzero) : le pair-impair y ferait un trou', () => {
    const lap = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    const g = gridOver(lap, 1), d = new Uint8Array(g.nx * g.ny);
    expect(paint(g, lap, d)).toBe(100);
    expect(inPoly(lap, 5, 5)).toBe(false);
  });
});

describe('remplissage de la coque', () => {
  it('est déterministe : deux constructions du même visage donnent la même géométrie', () => {
    const f = face('afro', 2);
    const a = geoOf(f), b = geoOf(f);
    expect(b.locks.length).toBe(a.locks.length);
    expect(JSON.stringify(b.locks.at(-1)!.poly)).toBe(JSON.stringify(a.locks.at(-1)!.poly));
  });

  it('les coiffures à volume ont un bord de coque nettement mieux couvert (avant : afro 0,74, bouclé 0,58, court 0,62 en moyenne)', () => {
    const mean = (st: CleanStyle): number => {
      let s = 0;
      for (let k = 0; k < 6; k++) {
        const f = face(st, k), g = geoOf(f), lm = lmOf(f);
        s += shellCoverage(g.boundary.skull, g.base[0] as never, lm.W, g.locks.filter((l) => l.layer === 'front' && l.rank !== 'hairline').map((l) => l.poly)).rim;
      }
      return s / 6;
    };
    expect(mean('afro')).toBeLessThan(0.45);
    expect(mean('curly')).toBeLessThan(0.4);
    expect(mean('short')).toBeLessThan(0.55);
  });

  it('les mèches de remplissage sont marquées : présentes sur l\'afro, absentes sur les coiffures attachées et la coupe rase', () => {
    for (let k = 0; k < 4; k++) {
      expect(geoOf(face('afro', k)).locks.filter((l) => l.fill).length, `afro k${k}`).toBeGreaterThan(0);
      for (const st of ['buzz', 'ponytail', 'bun', 'braids'] as const) expect(geoOf(face(st, k)).locks.filter((l) => l.fill).length, `${st} k${k}`).toBe(0);
    }
  });

  it('seules les coiffures déclarées reçoivent un remplissage ; les attachées et la coupe rase restent des aplats', () => {
    expect(Object.keys(FILL).sort()).toEqual(['afro', 'bob', 'curly', 'long', 'short', 'spiky']);
    for (const st of ['buzz', 'ponytail', 'bun', 'braids'] as const) expect(FILL[st]).toBeUndefined();
  });
});

describe('couche de vérification de la forme (corpus)', () => {
  it('aucun contrôle d\'erreur n\'échoue sur 10 coiffures × 6 visages', () => {
    for (const st of STYLES) for (let k = 0; k < 6; k++) {
      const f = face(st, k);
      const bad = checkHairForm(f).filter((c) => !c.ok && c.severity === 'error').map((c) => c.id);
      expect(bad, `${st} k${k}`).toEqual([]);
    }
  });

  it('les trois couches sont présentes', () => {
    const layers = new Set(checkHairForm(face('afro', 1)).map((c) => c.layer));
    expect([...layers].sort()).toEqual(['anatomy', 'geometry', 'style']);
  });
});

describe('contrôles négatifs : chaque contrôle sait échouer', () => {
  it('shell-rim-bare(-hard) : sans aucune mèche avant, le bord est un aplat', () => {
    const f = face('afro', 3), g = geoOf(f);
    const bare = { ...g, locks: g.locks.filter((l) => l.layer !== 'front') } as HairGeometry;
    const ids = failing(f, bare).map((c) => c.id);
    expect(ids).toContain('shell-rim-bare');
    expect(ids).toContain('shell-rim-bare-hard');
  });

  it('fill-clears-free-ear : des mèches posées dans la zone d\'une oreille dégagée sont refusées', () => {
    for (let k = 0; k < 12; k++) {
      const f = face('short', k), g = geoOf(f), side = (['left', 'right'] as const).find((s) => g.sides[s].ear !== 'covered');
      if (!side) continue;
      const z = g.sides[side].earZone, c = z.reduce((a, q) => ({ x: a.x + q.x / z.length, y: a.y + q.y / z.length }), { x: 0, y: 0 });
      const tri = [{ x: c.x - 2, y: c.y - 2 }, { x: c.x + 2, y: c.y - 2 }, { x: c.x, y: c.y + 2 }];
      const lock = { ...g.locks[0]!, poly: tri, rank: 'main' as const, layer: 'front' as const, part: undefined, sim: undefined };
      const hit = { ...g, locks: [...g.locks, lock, lock, lock, lock] } as HairGeometry;
      expect(failing(f, hit).map((q) => q.id)).toContain(`fill-clears-free-ear-${side}`);
      return;
    }
    throw new Error('aucun visage à oreille dégagée dans l\'échantillon');
  });

  it('fill-style-scope : du remplissage sur une coiffure attachée, ou au-delà du plafond, est refusé', () => {
    const f = face('bun', 1), g = geoOf(f), one = { ...g.locks[0]!, fill: 1 };
    expect(failing(f, { ...g, locks: [...g.locks, one] } as HairGeometry).map((c) => c.id)).toContain('fill-style-scope');
    const a = face('afro', 1), ga = geoOf(a);
    expect(failing(a, { ...ga, locks: [...ga.locks, ...Array.from({ length: FILL.afro!.max + 1 }, (_, i) => ({ ...one, fill: i + 1 }))] } as HairGeometry).map((c) => c.id)).toContain('fill-style-scope');
  });

  it('fringe-reach-bound : une frange projetée loin du crâne est refusée', () => {
    for (let k = 0; k < 12; k++) {
      const f = face('short', k), g = geoOf(f), fr = g.locks.find((l) => l.kind === 'fringe' && l.layer === 'front' && !l.sim);
      if (!fr) continue;
      const far = { ...fr, poly: fr.poly.map((q) => ({ x: q.x + Math.sign(q.x || 1) * 0.4 * lmOf(f).W, y: q.y })) };
      expect(failing(f, { ...g, locks: [...g.locks, far] } as HairGeometry).map((c) => c.id)).toContain('fringe-reach-bound');
      return;
    }
    throw new Error('aucune frange dans l\'échantillon');
  });

  it('fill-within-reach : une mèche bornée envoyée loin du crâne est refusée', () => {
    const f = face('curly', 2), g = geoOf(f), b = g.locks.find((l) => l.bounded && l.layer === 'front' && !l.sim);
    expect(b, 'population contrôlée non vide').toBeDefined();
    const far = { ...b!, poly: b!.poly.map((q) => ({ x: q.x + Math.sign(q.x || 1) * 0.6 * lmOf(f).W, y: q.y })) };
    expect(failing(f, { ...g, locks: [...g.locks, far] } as HairGeometry).map((c) => c.id)).toContain('fill-within-reach');
  });

  it('tier-hue-near-hair : la teinte d\'étage cumulée sans plafond (ancien rendu) est refusée, le rendu actuel est accepté', () => {
    const uncapped = ((h: { tiers: { underHue: number } }, t: number) => h.tiers.underHue * t) as typeof tierHueShift;
    for (let k = 0; k < 40; k++) {
      const f = face('long', k), p = f.params.hair;
      if (p.tiers.count < 3 || Math.abs(p.tiers.underHue) * p.tiers.count < 60) continue;
      expect(checkHairForm(f, undefined, uncapped).filter((c) => !c.ok).map((c) => c.id)).toContain('tier-hue-near-hair');
      expect(checkHairForm(f).filter((c) => !c.ok).map((c) => c.id)).not.toContain('tier-hue-near-hair');
      return;
    }
    throw new Error('aucun visage à étages très décalés dans l\'échantillon');
  });
});

describe('contrôles négatifs de la série 3 (repousse, frange, dômes)', () => {
  const ids = (f: ReturnType<typeof face>, g: HairGeometry) => failing(f, g).map((c) => c.id);

  it('comb-inside-shell : des stries envoyées hors de la coque sont refusées', () => {
    const f = face('ponytail', 1), g = geoOf(f), W = lmOf(f).W;
    expect(g.locks.some((l) => l.comb)).toBe(true);
    expect(ids(f, g)).not.toContain('comb-inside-shell');
    const locks = g.locks.map((l) => (l.comb ? { ...l, poly: l.poly.map((q) => ({ x: q.x + 2 * W, y: q.y })) } : l));
    expect(ids(f, { ...g, locks } as HairGeometry)).toContain('comb-inside-shell');
  });

  it('dome-combed : un dôme sans stries (aplat) est refusé', () => {
    const f = face('bun', 2), g = geoOf(f);
    expect(ids(f, g)).not.toContain('dome-combed');
    expect(ids(f, { ...g, locks: g.locks.filter((l) => !l.comb) } as HairGeometry)).toContain('dome-combed');
  });

  it('comb-style-scope : des stries sur une coiffure pendante sont refusées', () => {
    const f = face('long', 1), g = geoOf(f), src = geoOf(face('ponytail', 1)).locks.find((l) => l.comb);
    expect(src).toBeDefined();
    expect(ids(f, g)).not.toContain('comb-style-scope');
    expect(ids(f, { ...g, locks: [...g.locks, src!] } as HairGeometry)).toContain('comb-style-scope');
  });

  it('fringe-rhythm-natural : une frange en peigne (largeurs et pas égaux) est refusée', () => {
    for (let k = 0; k < 40; k++) {
      const f = face('short', k), g = geoOf(f);
      const fr = g.locks.filter((l) => l.bang && l.spine && l.w0 !== undefined && l.layer === 'front' && (l.rank === 'main' || l.rank === 'mass'));
      if (fr.length < 6) continue;
      const xs = fr.map((l) => (l.spine as { x: number }[])[0]!.x), x0 = Math.min(...xs), step = 0.03 * lmOf(f).W;
      const order = fr.map((_, i) => i).sort((a, b) => xs[a]! - xs[b]!);
      const comb = g.locks.map((l) => {
        const i = fr.indexOf(l);
        if (i < 0) return l;
        const dx = x0 + order.indexOf(i) * step - xs[i]!;
        return { ...l, w0: 0.02 * lmOf(f).W, spine: (l.spine as { x: number; y: number }[]).map((q) => ({ x: q.x + dx, y: q.y })) };
      });
      expect(ids(f, g)).not.toContain('fringe-rhythm-natural');
      expect(ids(f, { ...g, locks: comb } as HairGeometry)).toContain('fringe-rhythm-natural');
      return;
    }
    throw new Error('aucune frange de 6 mèches ou plus dans l\'échantillon');
  });

  it('root-band-inside : test positif — la repousse reste sous RIM_FROM de l\'épaisseur de coque', () => {
    for (let k = 0; k < 60; k++) {
      const f = face('long', k);
      if (!f.params.hair.rootColor || f.params.hair.sim.enabled) continue;
      expect(ids(f, geoOf(f))).not.toContain('root-band-inside');
      return;
    }
    throw new Error('aucun visage à racine sombre dans l\'échantillon');
  });
});

import { describe, expect, it } from 'vitest';
import { compileScene, generateRandomFace, type SceneInput } from '../src';
import { faceLandmarks, facialHairGeometry, hairGeometry, inPoly, polyArea, type Poly } from '../src/face';
import { buildHairline } from '../src/face/hair/hairline';
import { FaceParams, HAIR_STYLES, HAIR_TEXTURES, SIDEBURNS } from '../src/schema';

const absArea = (p: Poly): number => Math.abs(polyArea(p));
const seeds = Array.from({ length: 120 }, (_, i) => 31000 + i * 11);
const STYLES = HAIR_STYLES.filter((s) => s !== 'bald');
const grid = (b: { minX: number; maxX: number; minY: number; maxY: number }): { x: number; y: number }[] =>
  Array.from({ length: 121 }, (_, k) => ({ x: b.minX + ((b.maxX - b.minX) * (k % 11)) / 10, y: b.minY + ((b.maxY - b.minY) * Math.floor(k / 11)) / 10 }));
const hit = (polys: Poly[], pts: { x: number; y: number }[]): boolean => pts.some((q) => polys.some((p) => inPoly(p, q.x, q.y)));
const withHair = (seed: number, hair: Record<string, unknown>, facialHair: Record<string, unknown> = {}) => generateRandomFace(seed, { hair: hair as never, facialHair: facialHair as never });
const geo = (f: ReturnType<typeof generateRandomFace>) => hairGeometry(f.params, faceLandmarks(f.params, f.width, f.height));

describe('ligne d\'implantation', () => {
  it.each(seeds.slice(0, 60))('seed %i : toujours au-dessus des sourcils, de la tempe gauche à la droite', (seed) => {
    const f = generateRandomFace(seed);
    const lm = faceLandmarks(f.params, f.width, f.height);
    const hl = buildHairline(f.params, lm);
    for (const q of hl.pts) {
      expect(q.y).toBeLessThanOrEqual(lm.browLimitY - 0.03 * lm.H + 1e-9);
      expect(q.y).toBeGreaterThanOrEqual(-lm.H / 2);
    }
    expect((hl.pts[0] as { x: number }).x).toBeLessThan(0);
    expect((hl.pts[hl.pts.length - 1] as { x: number }).x).toBeGreaterThan(0);
  });

  it('le recul des tempes relève les coins ; sans irrégularité ni raie, la ligne ronde est symétrique', () => {
    const f = generateRandomFace(777, { hair: { style: 'short', hairlineShape: 'round', recession: 0, irregularity: 0, part: 0 } });
    const lm = faceLandmarks(f.params, f.width, f.height);
    const a = buildHairline(f.params, lm);
    for (let i = 0; i < a.pts.length; i++) expect((a.pts[i] as { y: number }).y).toBeCloseTo((a.pts[a.pts.length - 1 - i] as { y: number }).y, 9);
    const g = generateRandomFace(777, { hair: { style: 'short', hairlineShape: 'round', recession: 1, irregularity: 0, part: 0 } });
    const b = buildHairline(g.params, faceLandmarks(g.params, g.width, g.height));
    const bay = (h: { pts: { y: number }[] }): number => Math.min(...h.pts.slice(8, 20).map((q) => q.y));
    expect(bay(b)).toBeLessThan(bay(a) - 0.02 * lm.H);
  });

  it('pic de veuve : le centre descend plus bas que la ligne ronde ; l\'irrégularité casse la symétrie', () => {
    const mk = (hairlineShape: string, irregularity = 0) => {
      const f = generateRandomFace(778, { hair: { style: 'short', hairlineShape, recession: 0, irregularity, part: 0 } as never });
      return buildHairline(f.params, faceLandmarks(f.params, f.width, f.height));
    };
    const mid = (h: { pts: { y: number }[] }): number => (h.pts[32] as { y: number }).y;
    expect(mid(mk('widow'))).toBeGreaterThan(mid(mk('round')) + 0.02 * 400);
    const r = mk('round', 1);
    const asym = r.pts.some((q, i) => Math.abs(q.y - (r.pts[r.pts.length - 1 - i] as { y: number }).y) > 0.002);
    expect(asym).toBe(true);
  });
});

describe('coiffure × texture : deux axes indépendants', () => {
  const combos = STYLES.flatMap((s) => HAIR_TEXTURES.map((t) => [s, t] as const));
  it.each(combos)('%s + %s : SVG valide, aucun œil recouvert', (style, texture) => {
    for (const seed of [41, 42, 43]) {
      const f = withHair(seed, { style, texture, fringe: seed === 42 ? 'curtain' : 'sweep', color: '#4a2c17', seed: seed * 3, tie: { height: 0.9, side: seed === 43 ? 0.8 : 0, tail: 0.7, thickness: 0.6, double: seed === 43 } });
      const g = geo(f);
      expect(g).not.toBeNull();
      expect(g?.texture).toBe(texture);
      for (const side of ['left', 'right'] as const) expect(hit(g?.front ?? [], grid(f.fits[side].footprint))).toBe(false);
      const r = compileScene({ width: 500, height: 600, background: '#333333', objects: f.objects.map((o, i) => (i === 0 ? { ...o, transform: { x: 250, y: 300, scale: 1, rotationDeg: 0 } } : o)) as SceneInput['objects'] });
      if (!r.ok) throw new Error(r.issues.join('\n'));
      expect(r.svg).not.toMatch(/NaN|Infinity/);
    }
  });

  it('même coiffure, autre texture : mèches différentes, MÊME implantation', () => {
    const geos = HAIR_TEXTURES.map((texture) => geo(withHair(99, { style: 'long', texture, seed: 5 })));
    for (const g of geos) expect(JSON.stringify(g?.hairline)).toBe(JSON.stringify(geos[0]?.hairline));
    const sigs = new Set(geos.map((g) => JSON.stringify(g?.locks.slice(0, 3).map((l) => l.poly))));
    expect(sigs.size).toBe(HAIR_TEXTURES.length);
  });

  it('crépu : mèches plus larges et chemin plus long que raide ; tressé : segments de tresse', () => {
    const area = (t: string): number => (geo(withHair(5, { style: 'short', texture: t, seed: 9 }))?.locks.filter((l) => l.rank === 'main').reduce((s, l) => s + absArea(l.poly), 0)) ?? 0;
    expect(area('coily')).toBeGreaterThan(area('straight'));
    const braided = geo(withHair(5, { style: 'short', texture: 'braided', seed: 9 }));
    expect(braided?.locks.some((l) => l.rank === 'plait')).toBe(true);
    expect(braided?.locks.some((l) => l.rank === 'fine')).toBe(false);
  });
});

describe('mèches principales et secondaires, longueur et densité', () => {
  it('deux rangs de mèches, dont les fines sont plus étroites', () => {
    const g = geo(withHair(12, { style: 'short', texture: 'straight', seed: 3 }));
    const w = (rank: string): number => {
      const ls = g?.locks.filter((l) => l.rank === rank) ?? [];
      return ls.reduce((s, l) => s + absArea(l.poly), 0) / Math.max(1, ls.length);
    };
    expect(g?.locks.filter((l) => l.rank === 'main').length).toBeGreaterThan(10);
    expect(g?.locks.filter((l) => l.rank === 'fine').length).toBeGreaterThan(30);
    expect(w('fine')).toBeLessThan(w('main'));
  });

  it('la variance de longueur allonge la dispersion des pointes ; l\'éclaircissement retire des mèches et montre le cuir chevelu', () => {
    const spread = (lengthVariance: number): number => {
      const ys = (geo(withHair(21, { style: 'bob', texture: 'straight', seed: 4, lengthVariance, fringe: 'none' }))?.locks.filter((l) => l.layer === 'front' && l.rank === 'main') ?? []).map((l) => Math.max(...l.poly.map((q) => q.y)));
      const m = ys.reduce((a, b) => a + b, 0) / ys.length;
      return Math.sqrt(ys.reduce((a, b) => a + (b - m) ** 2, 0) / ys.length);
    };
    expect(spread(0.9)).toBeGreaterThan(spread(0) + 1);
    const count = (thinning: number): number => seeds.slice(0, 20).reduce((s, sd) => s + (geo(withHair(sd, { style: 'short', texture: 'straight', thinning, density: 0.8, seed: sd }))?.locks.length ?? 0), 0);
    expect(count(0.9)).toBeLessThan(count(0) * 0.85);
    expect(geo(withHair(21, { style: 'short', thinning: 0.9 }))?.bare.thin.length).toBe(2);
    expect(geo(withHair(21, { style: 'short', thinning: 0 }))?.bare.thin.length).toBe(0);
  });

  it('la raie découvre le cuir chevelu (sauf crâne rasé)', () => {
    expect(geo(withHair(8, { style: 'long', partWidth: 0.7 }))?.bare.part).not.toBeNull();
    expect(geo(withHair(8, { style: 'buzz' }))?.bare.part).toBeNull();
  });
});

describe('queue, chignon, tresses', () => {
  it('queue : attache visible au-dessus du crâne, mèches derrière la tête ; couettes = 2 attaches', () => {
    const one = geo(withHair(30, { style: 'ponytail', tie: { height: 1, side: 0, tail: 0.8, thickness: 0.6, double: false } }));
    expect(one?.ties.length).toBe(1);
    expect(one?.ties[0]?.front).toBe(true);
    expect(one?.back.length).toBeGreaterThan(5);
    const two = geo(withHair(30, { style: 'ponytail', tie: { height: 0.6, side: 0.9, tail: 0.6, thickness: 0.5, double: true } }));
    expect(two?.ties.length).toBe(2);
    expect((two?.ties[0]?.at.x ?? 0) * (two?.ties[1]?.at.x ?? 0)).toBeLessThan(0);
  });

  it('chignon : disque + spirales derrière la tête ; tresses : une chaîne de segments par tresse', () => {
    const bun = geo(withHair(31, { style: 'bun', tie: { height: 1, side: 0, tail: 0.5, thickness: 0.7, double: false } }));
    expect(bun?.ties.length).toBe(1);
    expect(bun?.locks.filter((l) => l.layer === 'back').length).toBe(4);
    const mk = (count: number) => geo(withHair(32, { style: 'braids', texture: 'straight', braids: { count, thickness: 0.5 } }))?.locks.filter((l) => l.rank === 'plait').length ?? 0;
    expect(mk(4)).toBeGreaterThan(mk(2) * 1.6);
  });

  it.each(seeds.slice(0, 40))('seed %i : l\'attache reste au crâne (jamais sur le visage)', (seed) => {
    const f = withHair(seed, { style: seed % 2 ? 'ponytail' : 'bun', tie: { height: (seed % 10) / 10, side: seed % 3 === 0 ? 0 : 0.8, tail: 0.6, thickness: 0.5, double: seed % 5 === 0 } });
    const lm = faceLandmarks(f.params, f.width, f.height);
    for (const t of geo(f)?.ties ?? []) {
      expect(t.at.y).toBeLessThan(lm.jawY);
      for (const side of ['left', 'right'] as const) expect(hit([[{ x: t.at.x - t.rx, y: t.at.y - t.rx }, { x: t.at.x + t.rx, y: t.at.y - t.rx }, { x: t.at.x + t.rx, y: t.at.y + t.rx }, { x: t.at.x - t.rx, y: t.at.y + t.rx }]], grid(f.fits[side].footprint))).toBe(false);
    }
  });
});

describe('pilosité faciale : barbes, favoris, moustache, transitions', () => {
  const fg = (seed: number, fh: Record<string, unknown>) => {
    const f = withHair(seed, { style: 'short' }, { seed: 6, length: 0.8, ...fh });
    return { f, lm: faceLandmarks(f.params, f.width, f.height), g: facialHairGeometry(f.params, faceLandmarks(f.params, f.width, f.height)) };
  };
  it.each(SIDEBURNS.filter((s) => s !== 'none').flatMap((s) => seeds.slice(0, 40).map((sd) => [s, sd] as const)))('favoris %s, seed %i : ne recouvrent aucun œil', (kind, seed) => {
    const { f, g } = fg(seed, { sideburns: kind });
    expect(g.sideburns.length).toBe(2);
    for (const side of ['left', 'right'] as const) expect(hit(g.sideburns, grid(f.fits[side].footprint))).toBe(false);
  });

  it('barbe longue plus basse que la pleine, courte au ras du menton ; moustache seule sans barbe ; crayon plus fin', () => {
    const lowest = (beard: string): number => Math.max(...(fg(3, { beard, mustache: 'none' }).g.beard ?? [{ y: -1e9 }]).map((q) => q.y));
    const { lm } = fg(3, { beard: 'full' });
    expect(lowest('long')).toBeGreaterThan(lowest('full') + 0.04 * lm.H);
    expect(lowest('short')).toBeLessThanOrEqual(lm.H / 2 + 0.012 * lm.H);
    const only = fg(3, { beard: 'none', mustache: 'full' }).g;
    expect(only.beard).toBeNull();
    expect(only.mustache).not.toBeNull();
    const area = (m: string): number => absArea(fg(3, { beard: 'none', mustache: m }).g.mustache as Poly);
    expect(area('pencil')).toBeLessThan(area('thin'));
  });

  it('transition et zones clairsemées modifient le rendu (lisière diffuse, poils épars)', () => {
    const svg = (fh: Record<string, unknown>): string => {
      const f = withHair(3, { style: 'short' }, { beard: 'full', mustache: 'full', seed: 6, ...fh });
      const r = compileScene({ width: 500, height: 600, background: '#333333', objects: f.objects.map((o, i) => (i === 0 ? { ...o, transform: { x: 250, y: 300, scale: 1, rotationDeg: 0 } } : o)) as SceneInput['objects'] });
      if (!r.ok) throw new Error(r.issues.join('\n'));
      return r.svg;
    };
    expect(svg({ transition: 0 })).not.toBe(svg({ transition: 1 }));
    expect(svg({ patchiness: 0 })).not.toBe(svg({ patchiness: 0.7 }));
  });
});

describe('axes indépendants, jamais couplés à une origine', () => {
  const faces = Array.from({ length: 500 }, (_, i) => generateRandomFace(60000 + i * 13));
  const lightness = (hex: string): number => {
    const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255) as [number, number, number];
    return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
  };
  const skinOf = (f: (typeof faces)[number]): number => lightness((f.objects[0] as { material: { color: string } }).material.color);

  it('toutes les combinaisons peau claire/foncée × texture existent (pas de couplage)', () => {
    for (const t of HAIR_TEXTURES) {
      expect(faces.some((f) => f.params.hair.texture === t && skinOf(f) > 0.65)).toBe(true);
      expect(faces.some((f) => f.params.hair.texture === t && skinOf(f) < 0.4)).toBe(true);
    }
  });

  it('texture crépue et peau claire coexistent ; cheveux blonds raides et peau foncée aussi', () => {
    expect(faces.some((f) => f.params.hair.texture === 'coily' && skinOf(f) > 0.65 && f.params.hair.style !== 'bald')).toBe(true);
    expect(faces.some((f) => f.params.hair.texture === 'straight' && lightness(f.params.hair.color) > 0.45 && skinOf(f) < 0.4)).toBe(true);
  });

  it('la clarté de peau ne prédit pas la texture : fréquence de crépu comparable chez clairs et foncés', () => {
    const rate = (pred: (f: (typeof faces)[number]) => boolean): number => {
      const g = faces.filter(pred);
      return g.filter((f) => f.params.hair.texture === 'coily').length / g.length;
    };
    expect(Math.abs(rate((f) => skinOf(f) > 0.55) - rate((f) => skinOf(f) <= 0.55))).toBeLessThan(0.1);
  });

  it('sous-ton continu de rosé à doré : teintes variées à clarté égale', () => {
    const hues = faces.map((f) => (f.objects[0] as { material: { color: string } }).material.color);
    expect(new Set(hues).size).toBeGreaterThan(450);
  });

  it('pli de l\'œil indépendant : le pli tiré est celui des deux yeux, monopaupière possible avec toute peau', () => {
    for (const f of faces.slice(0, 80)) {
      for (const e of f.objects.slice(1)) {
        const eye = e as unknown as { lids: { crease: { height: number } }; epicanthicFold: { amount: number } };
        expect(eye.lids.crease.height).toBeCloseTo(f.axes.fold.crease, 9);
        expect(eye.epicanthicFold.amount).toBeCloseTo(f.axes.fold.epicanthic, 9);
      }
    }
    expect(faces.some((f) => f.axes.fold.crease === 0 && skinOf(f) < 0.4)).toBe(true);
    expect(faces.some((f) => f.axes.fold.crease === 0 && skinOf(f) > 0.65)).toBe(true);
  });

  it('sourcils et cils : systèmes distincts de la chevelure (teinte, épaisseur, densité propres)', () => {
    const differ = faces.filter((f) => f.axes.browLash.browColor.toLowerCase() !== f.params.hair.color.toLowerCase()).length;
    expect(differ).toBeGreaterThan(faces.length * 0.9);
    const darker = faces.filter((f) => lightness(f.axes.browLash.browColor) < lightness(f.params.hair.color) - 0.1).length;
    const lighter = faces.filter((f) => lightness(f.axes.browLash.browColor) > lightness(f.params.hair.color) + 0.1).length;
    expect(darker).toBeGreaterThan(20);
    expect(lighter).toBeGreaterThan(5);
    expect(new Set(faces.map((f) => f.axes.browLash.hairs)).size).toBeGreaterThan(80);
    for (const f of faces.slice(0, 60)) {
      const bl = f.axes.browLash;
      for (const e of f.objects.slice(1)) {
        const eye = e as unknown as { eyebrow: { thickness: number; hairs: number; material: { color: string } } };
        expect(eye.eyebrow.thickness).toBeCloseTo(bl.thickness, 9);
        expect(eye.eyebrow.hairs).toBe(bl.hairs);
        expect(eye.eyebrow.material.color).toBe(bl.browColor);
      }
    }
  });

  it('est déterministe, y compris le rendu', () => {
    const svg = (): string => {
      const f = generateRandomFace(4242, { transform: { x: 250, y: 300 } });
      const r = compileScene({ width: 500, height: 600, background: '#333333', objects: f.objects });
      if (!r.ok) throw new Error(r.issues.join('\n'));
      return r.svg;
    };
    expect(svg()).toBe(svg());
    expect(FaceParams.parse(generateRandomFace(4242).params)).toEqual(generateRandomFace(4242).params);
  });
});

describe('tresses pendantes : hors du visage', () => {
  it.each(seeds.slice(0, 30))('seed %i : chaque segment de tresse est hors du contour du visage', (seed) => {
    const f = withHair(seed, { style: 'braids', texture: 'straight', braids: { count: 1 + (seed % 6), thickness: 0.5 } });
    const lm = faceLandmarks(f.params, f.width, f.height);
    const plaits = geo(f)?.locks.filter((l) => l.rank === 'plait') ?? [];
    expect(plaits.length).toBeGreaterThan(0);
    for (const l of plaits) {
      const cx = l.poly.reduce((s, q) => s + Math.abs(q.x), 0) / l.poly.length;
      const cy = l.poly.reduce((s, q) => s + q.y, 0) / l.poly.length;
      if (cy < lm.jawY) expect(cx).toBeGreaterThan(0.4 * lm.W);
    }
  });
});

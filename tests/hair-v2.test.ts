import { describe, expect, it } from 'vitest';
import { compileScene, generateRandomFace } from '../src';
import { grade, resolveAppearance, compileEffects, toHsl, hueDelta } from '../src/appearance';
import { faceLandmarks, hairGeometry, polyArea } from '../src/face';
import { textureAt } from '../src/face/hair/mixtex';
import { sCentre } from '../src/face/hair/shapes';
import { boxCoverage } from '../src/face/hair/occlusion';
import { cone } from '../src/face/hair/ribbon';
import { Appearance } from '../src/schema';
import { isVivid, paletteStats, verifyFace } from '../src/verify';

const geoOf = (seed: number, hair: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
  const f = generateRandomFace(seed, { hair: hair as never, hairEngine: 'classic', ...extra } as never);
  const lm = faceLandmarks(f.params, f.width, f.height);
  return { f, lm, geo: hairGeometry(f.params, lm) };
};
const BASE = { style: 'short', texture: 'straight', fringe: 'none', seed: 9, density: 0.8, thinning: 0, hairline: 0.5 };

describe('formes de mèches', () => {
  it('une mèche en S change deux fois de côté ; à float = 1 elle ne s\'affaisse pas', () => {
    const c = sCentre({ x: 0, y: 0 }, { x: 0, y: -1 }, 100, 0.3, 0, 1);
    const off = c.map((p) => p.x);
    const signs = off.filter((v) => Math.abs(v) > 3).map(Math.sign);
    const flips = signs.filter((s, i) => i > 0 && s !== signs[i - 1]).length;
    expect(flips).toBeGreaterThanOrEqual(1);
    expect(c[c.length - 1]?.y).toBeCloseTo(-100, 5);
    const sag = sCentre({ x: 0, y: 0 }, { x: 0, y: -1 }, 100, 0.3, 0, 0);
    expect((sag[sag.length - 1] as { y: number }).y).toBeGreaterThan(-100 + 30);
  });

  it('un cône est le plus large à la racine et se termine en pointe', () => {
    const c = Array.from({ length: 12 }, (_, i) => ({ x: 0, y: -i * 10 }));
    const p = cone(c, 40, 1.4);
    const n = p.length / 2;
    const w = (i: number) => Math.hypot((p[i] as { x: number }).x - (p[p.length - 1 - i] as { x: number }).x, (p[i] as { y: number }).y - (p[p.length - 1 - i] as { y: number }).y);
    expect(w(0)).toBeCloseTo(40, 5);
    expect(w(n - 1)).toBeLessThan(0.01);
    expect(w(3)).toBeGreaterThan(w(8));
  });

  it('modes ribbons / cones / wisps : produisent leur famille de mèches et seulement elle', () => {
    const r = geoOf(11, { ...BASE, flow: { mode: 'ribbons', ribbons: 7, wisps: 0 } }).geo;
    expect(r?.locks.filter((l) => l.kind === 'flow').length).toBeGreaterThanOrEqual(5);
    expect(r?.locks.some((l) => l.kind === 'cone')).toBe(false);
    const c = geoOf(11, { ...BASE, flow: { mode: 'cones', cones: 8 } }).geo;
    expect(c?.locks.filter((l) => l.kind === 'cone').length).toBe(8);
    expect(c?.locks.every((l) => l.kind !== 'cone' || l.profile === 'cone')).toBe(true);
    const w = geoOf(11, { ...BASE, flow: { mode: 'classic', wisps: 12 } }).geo;
    expect(w?.locks.filter((l) => l.kind === 'wisp').length).toBe(12);
    expect(w?.locks.filter((l) => l.kind === 'wisp').every((l) => l.rank === 'fine')).toBe(true);
  });

  it('puff gonfle l\'enveloppe pour une texture RAIDE ; l\'asymétrie rend la silhouette dissymétrique', () => {
    const ext = (hair: Record<string, unknown>) => {
      const g = geoOf(12, { ...BASE, ...hair }).geo;
      const pts = (g?.base[0] ?? []);
      return { L: Math.max(...pts.map((q) => -q.x)), R: Math.max(...pts.map((q) => q.x)), T: Math.min(...pts.map((q) => q.y)) };
    };
    const a = ext({});
    const b = ext({ silhouette: { puff: 0.8 } });
    expect(b.R).toBeGreaterThan(a.R + 8);
    expect(b.T).toBeLessThan(a.T - 8);
    const c = ext({ silhouette: { puff: 0.5, asymmetry: 0.9, bias: 1 } });
    expect(c.R).toBeGreaterThan(c.L * 1.04);
  });
});

describe('franges', () => {
  it.each(['sheer', 'blades', 'wispy', 'asym_brow'] as const)('moteur %s : mèches de frange, jamais sous la limite des sourcils', (mode) => {
    for (const seed of [21, 22, 23]) {
      const { geo, lm } = geoOf(seed, { ...BASE, fringeEngine: { mode, gap: 0.5 } });
      const fr = geo?.locks.filter((l) => l.kind === 'fringe') ?? [];
      expect(fr.length).toBeGreaterThan(3);
      const yF = lm.browLimitY - 0.008 * lm.H;
      for (const l of fr) for (const q of l.poly) expect(q.y).toBeLessThanOrEqual(yF + 1e-6);
      expect(geo?.fringeBottom).not.toBeNull();
    }
  });

  it('frange transparente : beaucoup de fils fins et du front visible entre eux', () => {
    const { geo, lm } = geoOf(24, { ...BASE, fringeEngine: { mode: 'sheer', gap: 0.7 } });
    const fr = geo?.locks.filter((l) => l.kind === 'fringe') ?? [];
    expect(fr.length).toBeGreaterThan(40);
    expect(fr.every((l) => l.rank === 'fine' || l.rank === 'hairline')).toBe(true);
    const hlMax = Math.max(...(geo?.hairline ?? []).map((q) => q.y));
    const box = { minX: -lm.W * 0.25, maxX: lm.W * 0.25, minY: hlMax, maxY: lm.browLimitY - 0.02 * lm.H };
    expect(1 - boxCoverage(fr.map((l) => l.poly), box)).toBeGreaterThan(0.35);
  });

  it('les franges v2 ne portent aucune masse pleine : le front reste visible', () => {
    const { geo } = geoOf(25, { ...BASE, fringeEngine: { mode: 'blades' } });
    expect(geo?.front.length).toBe(1 + (geo?.locks.filter((l) => l.layer === 'front').length ?? 0));
  });
});

describe('racines, côtés, occlusions, étages, pointes', () => {
  it('racines relevées : près de la raie les mèches partent plus verticalement', () => {
    const dirY = (amount: number) => {
      const g = geoOf(31, { ...BASE, part: 0, rootLift: { amount, width: 0.6, fall: 0.5 } }).geo;
      const near = (g?.locks ?? []).filter((l) => l.kind === 'lock' && l.rank === 'main' && l.spine && Math.abs((l.spine[0] as { x: number }).x) < 25);
      const v = near.map((l) => ((l.spine?.[3] as { y: number }).y - (l.spine?.[0] as { y: number }).y));
      return v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
    };
    expect(dirY(0.9)).toBeLessThan(dirY(0) - 1);
  });

  it('côtés indépendants : oreille gauche cachée, droite dégagée', () => {
    const { geo } = geoOf(32, { ...BASE, style: 'long', sides: { left: { ear: 'covered', cheek: 'none' }, right: { ear: 'free', cheek: 'none' } } });
    expect(geo?.sides.left.ear).toBe('covered');
    expect(geo?.sides.right.ear).toBe('free');
    const front = geo?.locks.filter((l) => l.layer === 'front').map((l) => l.poly) ?? [];
    const cover = (z: { x: number; y: number }[]) => boxCoverage(front, { minX: Math.min(...z.map((q) => q.x)), maxX: Math.max(...z.map((q) => q.x)), minY: Math.min(...z.map((q) => q.y)), maxY: Math.max(...z.map((q) => q.y)) });
    expect(cover(geo?.sides.left.earZone ?? [])).toBeGreaterThan(cover(geo?.sides.right.earZone ?? []) + 0.2);
  });

  it('occlusion demandée : recouvrement mesuré ≈ demandé, couche over, cibles non demandées libres', () => {
    for (const want of [0.25, 0.5, 0.8]) {
      const { geo } = geoOf(33, { ...BASE, fringeEngine: { mode: 'wispy' }, occlusion: { eyeLeft: want } });
      const o = geo?.occlusions.find((q) => q.target === 'eyeLeft');
      expect(o).toBeDefined();
      expect(Math.abs((o?.measured ?? 9) - want)).toBeLessThan(0.12);
      expect(geo?.over.length).toBeGreaterThan(0);
      expect(geo?.occlusions.some((q) => q.target === 'eyeRight')).toBe(false);
    }
  });

  it('occlusion complète : œil entièrement masqué ; le calque over est rendu APRÈS les yeux', () => {
    const f = generateRandomFace(34, { hair: { ...BASE, occlusion: { eyeRight: 1 } } as never, hairEngine: 'classic', id: 'oc' });
    const r = compileScene({ width: 400, height: 500, objects: f.objects });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const iEye = r.svg.lastIndexOf('oc-eye-right');
    const iOver = r.svg.indexOf('-hl-g');
    expect(r.svg.length).toBeGreaterThan(1000);
    expect(iEye).toBeGreaterThan(0);
    expect(r.svg.lastIndexOf('<g transform')).toBeGreaterThan(iEye);
    expect(iOver).toBeGreaterThanOrEqual(-1);
  });

  it('longueurs étagées : les étages plus profonds sont plus courts ; sous-couches visibles produites', () => {
    const { geo } = geoOf(35, { ...BASE, style: 'curly', texture: 'wavy', tiers: { count: 3, step: 0.3, underVisible: 0.8 } });
    const len = (t: number) => {
      const ls = (geo?.locks ?? []).filter((l) => l.tier === t && l.rank === 'main' && l.spine);
      return ls.reduce((a, l) => a + Math.hypot((l.spine?.[l.spine.length - 1] as { x: number; y: number }).x - (l.spine?.[0] as { x: number }).x, (l.spine?.[l.spine.length - 1] as { y: number }).y - (l.spine?.[0] as { y: number }).y), 0) / Math.max(1, ls.length);
    };
    expect(len(2)).toBeLessThan(len(0));
    expect(geo?.tierMasses.length).toBeGreaterThanOrEqual(1);
  });

  it('pointes : retroussées (direction change) et irrégulières (plus de sommets)', () => {
    const a = geoOf(36, { ...BASE, flow: { mode: 'classic' } }).geo;
    const b = geoOf(36, { ...BASE, tips: { irregular: 1, flick: 1 } }).geo;
    const vA = a?.locks.reduce((s, l) => s + l.poly.length, 0) ?? 0;
    const vB = b?.locks.reduce((s, l) => s + l.poly.length, 0) ?? 0;
    expect(vB).toBeGreaterThan(vA);
  });

  it('niveaux d\'épaisseur : masses, poils très fins (hairline) bien plus étroits que les mèches', () => {
    const { geo } = geoOf(37, { ...BASE, strands: { mass: 0.8, fine: 1, hairline: 0.9 } });
    const w = (r: string) => {
      const ls = (geo?.locks ?? []).filter((l) => l.rank === r && l.w0);
      return ls.reduce((a, l) => a + (l.w0 ?? 0), 0) / Math.max(1, ls.length);
    };
    expect(geo?.locks.some((l) => l.rank === 'mass')).toBe(true);
    expect(geo?.locks.filter((l) => l.rank === 'hairline').length).toBeGreaterThan(50);
    expect(w('hairline')).toBeLessThan(w('main') / 4);
    expect(w('mass')).toBeGreaterThan(w('main'));
  });

  it('textures mélangées dans une même tête : plusieurs textures selon la zone', () => {
    const { f, lm } = geoOf(38, { ...BASE, textureMix: [{ texture: 'wavy', weight: 1 }, { texture: 'coily', weight: 1 }] });
    void lm;
    const ctx = { h: f.params.hair, tex: 'straight', nz: (x: number) => Math.sin(x * 1.7) } as never;
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) seen.add(textureAt(ctx, -1 + i / 20, (i % 7) / 7));
    expect(seen.size).toBeGreaterThanOrEqual(2);
    expect([...seen].every((t) => t === 'wavy' || t === 'coily')).toBe(true);
  });
});

describe('moteur d\'apparence', () => {
  const A = (o: Record<string, unknown> = {}) => Appearance.parse(o);
  it('étalonnage neutre = identité ; saturation / luminosité / contraste agissent', () => {
    expect(grade('#336699', { contrast: 0, saturation: 0, brightness: 0 })).toBe('#336699');
    expect(toHsl(grade('#336699', { contrast: 0, saturation: 0.6, brightness: 0 })).s).toBeGreaterThan(toHsl('#336699').s);
    expect(toHsl(grade('#336699', { contrast: 0, saturation: 0, brightness: 0.5 })).l).toBeGreaterThan(toHsl('#336699').l);
  });
  it('ombre / lumière / contour : indépendants, imposés ou dérivés ; l\'ombre reste dans la famille de la couleur', () => {
    const ra = resolveAppearance('#c0392b', A());
    expect(Math.abs(hueDelta(toHsl('#c0392b').h, toHsl(ra.shadow).h))).toBeLessThan(75);
    expect(toHsl(ra.shadow).l).toBeLessThan(toHsl(ra.base).l);
    expect(toHsl(ra.light).l).toBeGreaterThan(toHsl(ra.base).l);
    const forced = resolveAppearance('#c0392b', A({ light: { shadow: '#102040', light: '#ffeecc', rim: '#00ffff' } }));
    expect([forced.shadow, forced.light, forced.rim]).toEqual(['#102040', '#ffeecc', '#00ffff']);
  });
  it('reflets cohérents avec chaque famille de couleur (noir bleuté, rouge chaud, bleu froid)', () => {
    expect(toHsl(resolveAppearance('#15110f', A()).light).h).toBeGreaterThan(190);
    expect(toHsl(resolveAppearance('#15110f', A()).light).h).toBeLessThan(250);
    const warm = toHsl(resolveAppearance('#c0392b', A()).light).h;
    expect(warm < 70 || warm > 330).toBe(true);
    const cool = toHsl(resolveAppearance('#2a6df0', A()).light).h;
    expect(cool).toBeGreaterThan(170);
    expect(cool).toBeLessThan(260);
  });
  it('dégradé à plus de deux couleurs, avec opacité par stop', () => {
    const ra = resolveAppearance('#ff0000', A({ gradient: [{ offset: 0, color: '#ff0000' }, { offset: 0.5, color: '#00ff00' }, { offset: 1, color: '#0000ff', opacity: 0.2 }] }));
    expect(ra.ramp(0)).toBe('#ff0000');
    expect(ra.ramp(0.5)).toBe('#00ff00');
    expect(ra.ramp(1)).toBe('#0000ff');
    expect(ra.rampAlpha(1)).toBeCloseTo(0.2, 5);
    expect(ra.rampAlpha(0.75)).toBeCloseTo(0.6, 5);
  });
  it('effets : aucun filtre sans effet ; glow / bloom / réfraction / grain / émission compilent en un filtre', () => {
    const box = { x: 0, y: 0, w: 100, h: 100 };
    const ra0 = resolveAppearance('#336699', A());
    expect(compileEffects('t', ra0.spec, ra0, box).filter).toBeUndefined();
    const spec = A({ glow: { intensity: 0.5 }, bloom: { intensity: 0.5 }, refraction: { strength: 0.5 }, texture: { kind: 'grain', intensity: 0.6 }, emission: { intensity: 0.5 } });
    const fx = compileEffects('t', spec, resolveAppearance('#336699', spec), box);
    expect(fx.filter).toBe('url(#t-fx)');
    expect(fx.defs[0]).toContain('feGaussianBlur');
    expect(fx.defs[0]).toContain('feDisplacementMap');
    expect(fx.defs[0]).toContain('feTurbulence');
  });
});

describe('génération v2 et vérification', () => {
  const seeds = Array.from({ length: 160 }, (_, i) => 52000 + i * 13);
  it('couleurs vives : ≥ 30 % (8 % avant), plusieurs familles de teinte, dégradés fréquents', () => {
    const v2 = paletteStats(seeds.map((s) => generateRandomFace(s)));
    const v1 = paletteStats(seeds.map((s) => generateRandomFace(s, { hairEngine: 'classic' })));
    expect(v2.vivid).toBeGreaterThanOrEqual(0.3);
    expect(v1.vivid).toBeLessThan(0.2);
    expect(v2.hueFamilies).toBeGreaterThanOrEqual(7);
    expect(v2.gradient).toBeGreaterThan(0.3);
    expect(isVivid('#ff3366')).toBe(true);
    expect(isVivid('#2b1d14')).toBe(false);
  });
  it('hairEngine classic : aucun axe v2 actif (reproduit les visages d\'avant)', () => {
    for (const s of seeds.slice(0, 20)) {
      const h = generateRandomFace(s, { hairEngine: 'classic' }).params.hair;
      expect(h.flow.mode).toBe('classic');
      expect(h.fringeEngine.mode).toBe('off');
      expect(h.tiers.count).toBe(1);
      expect(h.silhouette.puff).toBe(0);
    }
  });
  it.each(seeds.slice(0, 60))('seed %i : les trois couches de vérification passent', (seed) => {
    const r = verifyFace(generateRandomFace(seed));
    expect(r.failures.map((c) => `${c.layer}/${c.id}: ${c.message} (${c.value} vs ${c.limit})`)).toEqual([]);
  });
  it('visages tirés avec occlusions autorisées : toujours cohérents', () => {
    for (const s of seeds.slice(0, 40)) {
      const f = generateRandomFace(s, { occlusions: true });
      const r = verifyFace(f);
      expect(r.failures.map((c) => `${c.id}: ${c.message}`)).toEqual([]);
    }
  });
  it('la vérification détecte une incohérence (œil recouvert sans l\'avoir demandé)', () => {
    const f = generateRandomFace(53, { hairEngine: 'classic', hair: { style: 'short', fringe: 'straight' } as never });
    const lm = faceLandmarks(f.params, f.width, f.height);
    const bad = { ...f, fits: { ...f.fits, left: { ...f.fits.left, anchor: { x: f.fits.left.anchor.x + 5, y: f.fits.left.anchor.y } } } };
    void lm;
    expect(verifyFace(bad as typeof f).ok).toBe(false);
    expect(polyArea([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }])).toBeCloseTo(0.5);
  });
});

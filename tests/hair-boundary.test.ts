import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { faceLandmarks, hairGeometry, inPoly, type HairGeometry } from '../src/face';
import { buildBoundary, projectBoundary, rootFrames, windDir } from '../src/face/hair/boundary';
import { edgeStyle } from '../src/face/hair/boundary/edge-style';
import { buildHairline } from '../src/face/hair/hairline';
import { HAIR_STYLES, HAIR_TEXTURES } from '../src/schema';
import { verifyFace } from '../src/verify';
import { checkHairBoundary, selfCrossings } from '../src/verify/hair-boundary';

const STYLES = HAIR_STYLES.filter((s) => s !== 'bald');
const seeds = Array.from({ length: 40 }, (_, i) => 12000 + i * 97);
const mk = (seed: number, hair: Record<string, unknown> = {}, engine: 'classic' | 'v2' = 'classic') => generateRandomFace(seed, { hairEngine: engine, hair: hair as never });
const lmOf = (f: ReturnType<typeof mk>) => faceLandmarks(f.params, f.width, f.height);
const geoOf = (f: ReturnType<typeof mk>): HairGeometry => hairGeometry(f.params, lmOf(f)) as HairGeometry;
const failing = (f: ReturnType<typeof mk>, geo?: HairGeometry) => checkHairBoundary(f, geo).filter((c) => !c.ok).map((c) => c.id);

describe('lisière : l\'implantation est POSÉE SUR LE CRÂNE', () => {
  // Défaut du moteur d'origine : seule l'ordonnée était bornée ; recul fort ou implantation haute ⇒ points dans le vide (jusqu'à +54 % du contour).
  it.each(seeds)('seed %i : aucun point de l\'implantation hors du contour, même avec un recul fort', (seed) => {
    for (const recession of [0, 0.5, 1]) {
      const f = mk(seed, { style: 'short', recession, hairline: 0.2 });
      const lm = lmOf(f);
      const b = buildBoundary(f.params, lm);
      for (const q of b.hairline.pts) expect(Math.abs(q.x)).toBeLessThanOrEqual(b.skull.a(q.y) + 1e-6);
    }
  });

  it('le correctif ne bouge pas une implantation qui était déjà sur le crâne (recul 0, implantation moyenne)', () => {
    const f = mk(777, { style: 'short', hairlineShape: 'round', recession: 0, irregularity: 0, part: 0 });
    const hl = buildHairline(f.params, lmOf(f));
    for (let i = 0; i < hl.pts.length; i++) expect((hl.pts[i] as { y: number }).y).toBeCloseTo((hl.pts[hl.pts.length - 1 - i] as { y: number }).y, 9);
  });
});

describe('lisière : géométrie, anatomie, style sur tous les styles × textures × moteurs', () => {
  it('aucun contrôle (error ni warn) ne échoue sur 10 styles × 5 textures × 2 moteurs × 3 graines', () => {
    const bad: string[] = [];
    for (const engine of ['classic', 'v2'] as const) for (const style of STYLES) for (const texture of HAIR_TEXTURES) for (const seed of seeds.slice(0, 3)) {
      const f = mk(seed, { style, texture }, engine);
      for (const id of failing(f)) bad.push(`${engine}/${style}/${texture}/${seed}:${id}`);
    }
    expect(bad).toEqual([]);
  });

  it('le chauve n\'a pas de lisière ; verifyFace embarque les contrôles de lisière', () => {
    expect(checkHairBoundary(mk(5, { style: 'bald' }))).toEqual([]);
    const r = verifyFace(mk(21, { style: 'long' }));
    expect(r.checks.some((c) => c.id === 'boundary-above-brows')).toBe(true);
    expect(r.failures.filter((c) => c.id.startsWith('boundary') || c.id.startsWith('shell'))).toEqual([]);
  });
});

describe('lisière : contrôles NÉGATIFS (une lisière sabotée doit être détectée)', () => {
  const f = mk(321, { style: 'short', sideburns: 0.5 });
  const geo = geoOf(f);
  type Loop = HairGeometry['boundary']['loop'][number][];
  const sab = (patch: (loop: Loop) => Loop, marks?: Partial<HairGeometry['boundary']['marks']>): HairGeometry => ({ ...geo, boundary: { ...geo.boundary, loop: patch([...geo.boundary.loop]), marks: { ...geo.boundary.marks, ...marks } } });

  it('la base saine passe', () => expect(failing(f)).toEqual([]));

  it('un point de l\'implantation hors du contour est détecté (inside-contour + projection de face)', () => {
    const bad = sab((l) => l.map((q, i) => (i === 20 ? { ...q, p: { x: q.p.x * 6, y: q.p.y } } : q)));
    expect(failing(f, bad)).toContain('boundary-inside-contour');
  });

  it('une implantation qui descend sous les sourcils est détectée', () => {
    const bad = sab((l) => l.map((q) => (q.kind === 'front' ? { ...q, y: q.y + 0.3 * lmOf(f).H, p: { x: q.p.x, y: q.p.y + 0.3 * lmOf(f).H } } : q)));
    expect(failing(f, bad)).toContain('boundary-above-brows');
  });

  it('un parcours qui se croise est détecté', () => {
    const bad = sab((l) => { const k = l.findIndex((q) => q.kind === 'sideburn'); const t = l[k + 2] as (typeof l)[number]; l[k + 2] = l[k + 5] as (typeof l)[number]; l[k + 5] = t; return l; });
    expect(failing(f, bad)).toContain('boundary-no-self-crossing');
    expect(selfCrossings([{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 }])).toBe(1);
    expect(selfCrossings([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }])).toBe(0);
  });

  it('un trou dans le parcours est détecté', () => {
    const bad = sab((l) => l.filter((_, i) => i < 10 || i > 70));
    expect(failing(f, bad)).toContain('boundary-closed-no-hole');
  });

  it('une lisière qui traverse l\'oreille est détectée', () => {
    const ear = geo.sides.right.earZone;
    const c = { x: ear.reduce((a, q) => a + q.x, 0) / ear.length, y: ear.reduce((a, q) => a + q.y, 0) / ear.length };
    const bad = sab((l) => l.map((q) => (q.kind === 'ear' && q.az > 0 && q.az < Math.PI / 2 ? { ...q, p: c } : q)));
    expect(failing(f, bad)).toContain('boundary-clears-ear');
  });

  it('une coque qui recouvre le visage est détectée ; une nuque qui remonte à l\'oreille aussi', () => {
    const lm = lmOf(f);
    const box = [{ x: -lm.W / 2, y: lm.eyeY - 40 }, { x: lm.W / 2, y: lm.eyeY - 40 }, { x: lm.W / 2, y: lm.chinY }, { x: -lm.W / 2, y: lm.chinY }];
    expect(failing(f, { ...geo, base: [box] })).toContain('shell-off-face-skin');
    expect(failing(f, sab((l) => l, { napeY: geo.boundary.marks.earBottomY.left }))).toContain('boundary-nape-below-ears');
  });

  it('une oreille « libre » recouverte par la coque est détectée', () => {
    const z = geo.sides.left.earZone;
    const big = [{ x: Math.min(...z.map((q) => q.x)) - 20, y: Math.min(...z.map((q) => q.y)) - 20 }, { x: Math.max(...z.map((q) => q.x)) + 20, y: Math.min(...z.map((q) => q.y)) - 20 }, { x: Math.max(...z.map((q) => q.x)) + 20, y: Math.max(...z.map((q) => q.y)) + 20 }, { x: Math.min(...z.map((q) => q.x)) - 20, y: Math.max(...z.map((q) => q.y)) + 20 }];
    expect(failing(f, { ...geo, base: [big] })).toContain('shell-clears-free-ear-left');
  });
});

describe('lisière : rotation de la tête et vent', () => {
  const f = mk(321, { style: 'short' });
  const b = buildBoundary(f.params, lmOf(f));
  const dist = (a: { x: number; y: number; z: number }, c: { x: number; y: number; z: number }): number => Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z);

  it('la rotation est RIGIDE : les distances 3D entre points de la lisière sont conservées (lacet + tangage)', () => {
    const P0 = projectBoundary(b, 0, 0);
    for (const [yaw, pitch] of [[25, 0], [-50, 10], [70, -15]] as const) {
      const P1 = projectBoundary(b, yaw, pitch);
      for (const [i, j] of [[0, 30], [10, 70], [40, 100]] as const) expect(dist(P1[i] as never, P1[j] as never)).toBeCloseTo(dist(P0[i] as never, P0[j] as never), 6);
    }
  });

  it('de face tout l\'hémisphère avant est visible et la nuque est cachée ; à 60° le côté qui fuit se cache', () => {
    const P0 = projectBoundary(b, 0, 0);
    b.loop.forEach((q, i) => {
      if (q.kind === 'front') expect((P0[i] as { visible: boolean }).visible).toBe(true);
      if (q.kind === 'nape' && Math.abs(q.az) > (110 * Math.PI) / 180) expect((P0[i] as { visible: boolean }).visible).toBe(false);
    });
    const P60 = projectBoundary(b, 60, 0);
    const i = b.loop.findIndex((q) => q.kind === 'sideburn' && q.az > 0.5);
    const j = b.loop.findIndex((q) => q.kind === 'sideburn' && q.az < -0.5);
    expect((P60[i] as { visible: boolean }).visible).toBe(false);
    expect((P60[j] as { visible: boolean }).visible).toBe(true);
    expect((P60[b.loop.findIndex((q) => q.kind === 'front' && Math.abs(q.az) < 0.05)] as { x: number }).x).toBeGreaterThan(0);
  });

  it('repères de racine : sur la surface, normale unitaire, écoulement TANGENT à la surface, abscisse croissante', () => {
    const fr = rootFrames(b, 60);
    expect(fr).toHaveLength(60);
    fr.forEach((r, k) => {
      expect(Math.hypot(r.normal.x, r.normal.y, r.normal.z)).toBeCloseTo(1, 9);
      expect(Math.abs(r.flow.x * r.normal.x + r.flow.y * r.normal.y + r.flow.z * r.normal.z)).toBeLessThan(1e-4);
      expect(r.u).toBeCloseTo(k / 60, 12);
      expect((r.pos.x / b.skull.a(r.pos.y)) ** 2 + (r.pos.z / b.skull.b(r.pos.y)) ** 2).toBeCloseTo(1, 6);
    });
  });

  it('vent : sans vent ou cheveu raide, la direction est l\'écoulement naturel ; le vent la dévie, toujours tangente', () => {
    const r = rootFrames(b, 40)[5] as ReturnType<typeof rootFrames>[number];
    const none = windDir(r, { x: 0, y: 0, z: 0 }, 1);
    expect(none.dir.x).toBeCloseTo(r.flow.x, 9);
    const stiff = windDir(r, { x: 5, y: 0, z: 0 }, 0);
    expect(stiff.dir.y).toBeCloseTo(r.flow.y, 9);
    const windy = windDir(r, { x: 3, y: 0, z: 0 }, 1);
    expect(windy.dir.x).toBeGreaterThan(none.dir.x);
    expect(Math.abs(windy.dir.x * r.normal.x + windy.dir.y * r.normal.y + windy.dir.z * r.normal.z)).toBeLessThan(0.05);
  });
});

describe('style de la lisière : netteté selon la coiffure, contraste selon la couleur', () => {
  it('coiffure tirée en arrière = bord franc ; rasé / crépu = bord flou', () => {
    const e = (s: (typeof STYLES)[number], t: (typeof HAIR_TEXTURES)[number]) => edgeStyle(s, t, '#2b1d14', '#d9b08c', 0.2);
    expect(e('bun', 'straight').crisp).toBeGreaterThan(e('short', 'straight').crisp);
    expect(e('short', 'straight').crisp).toBeGreaterThan(e('afro', 'coily').crisp);
    expect(e('buzz', 'straight').strayShare).toBeGreaterThan(e('bun', 'straight').strayShare);
  });

  it('noir sur peau claire contraste plus que blond sur peau claire ; l\'ombre compense le faible contraste', () => {
    const dark = edgeStyle('short', 'straight', '#101010', '#e8c9a8', 0.2);
    const blond = edgeStyle('short', 'straight', '#e6d28a', '#e8c9a8', 0.2);
    expect(dark.contrast).toBeGreaterThan(blond.contrast + 0.3);
    expect(blond.shadowAlpha).toBeGreaterThan(dark.shadowAlpha);
    expect(dark.strayAlpha).toBeGreaterThan(blond.strayAlpha);
  });
});

describe('coque : suit la forme du crâne et le comportement des oreilles', () => {
  it('une oreille « libre » reste dégagée même pour une coiffure longue ; « couverte » la recouvre', () => {
    for (const seed of seeds.slice(0, 12)) {
      const free = geoOf(mk(seed, { style: 'long', sides: { left: { ear: 'free' }, right: { ear: 'free' } } }));
      const cov = geoOf(mk(seed, { style: 'long', sides: { left: { ear: 'covered' }, right: { ear: 'covered' } } }));
      const inside = (g: HairGeometry, side: 'left' | 'right'): number => g.sides[side].earZone.filter((q) => g.base.some((p) => inPoly(p, q.x, q.y))).length;
      expect(inside(free, 'left')).toBeLessThanOrEqual(inside(cov, 'left'));
      expect(failing(mk(seed, { style: 'long', sides: { left: { ear: 'free' }, right: { ear: 'free' } } }))).toEqual([]);
    }
  });

  it('l\'épaisseur de la couronne grandit avec le volume ; les côtés suivent le style (bouclé ≥ queue)', () => {
    const width = (hair: Record<string, unknown>): number => Math.max(...geoOf(mk(40, hair)).base[0]!.map((q) => Math.abs(q.x)));
    expect(width({ style: 'short', volume: 0.9 })).toBeGreaterThan(width({ style: 'short', volume: 0.1 }));
    expect(width({ style: 'curly', volume: 0.5 })).toBeGreaterThanOrEqual(width({ style: 'ponytail', volume: 0.5 }));
  });
});

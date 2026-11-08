import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { faceLandmarks, hairGeometry, type HairGeometry } from '../src/face';
import { REACH, conformReach, reachBudget, windReach } from '../src/face/hair/reach';
import { TIE, tieSpots } from '../src/face/hair/tie';
import { VOCAB } from '../src/face/hair/vocab';
import { distanceOutsideSkull } from '../src/face/hair/thickness';
import { ROOT_MIN_RATIO, hairAppearance, rootColorOf } from '../src/render/face/hair-look';
import { luminance } from '../src/core/color';
import { checkHairCoherence } from '../src/verify/hair-coherence';
import { HAIR_STYLES } from '../src/schema';
import { hairFaceSpec, type CleanStyle } from '../scripts/lib/hair-faces';

const STYLES = HAIR_STYLES.filter((s) => s !== 'bald') as CleanStyle[];
/** `hair` : surcharges des paramètres de cheveux (vent, attache, racine…) : seul ce champ est lu par `hairFaceSpec`. */
const face = (st: CleanStyle, k: number, hair: Record<string, unknown> = {}) => {
  const sp = hairFaceSpec(st, k, { engine: 'v2', seed: 41000 + k * 31 + STYLES.indexOf(st) * 5, hair });
  return generateRandomFace(sp.seed, sp.opts);
};
const lmOf = (f: ReturnType<typeof face>) => faceLandmarks(f.params, f.width, f.height);
const geoOf = (f: ReturnType<typeof face>): HairGeometry => hairGeometry(f.params, lmOf(f)) as HairGeometry;
const errors = (f: ReturnType<typeof face>, g?: HairGeometry) => checkHairCoherence(f, g).filter((c) => !c.ok && c.severity === 'error').map((c) => c.id);

describe('portée de l\'enveloppe réelle (conformReach)', () => {
  it('chaque coiffure : l\'enveloppe des mèches construites sous borne reste dans la portée (le polygone, pas seulement l\'axe)', () => {
    for (const st of STYLES) for (let k = 0; k < 6; k++) {
      const f = face(st, k), g = geoOf(f), lm = lmOf(f), S = g.boundary.skull;
      const hang = st === 'bob' || st === 'long';
      let away = 0;
      for (const l of g.locks) if (l.bounded && !l.sim) for (const q of l.poly) if (q.y <= (hang ? lm.hair.sideY : Infinity)) away = Math.max(away, distanceOutsideSkull(S, q) / lm.W);
      expect(away, `${st} k${k}`).toBeLessThanOrEqual(REACH[st].side + 0.02);
    }
  });

  it('régression : une coupe courte n\'a plus de ruban large à plusieurs fois la portée (0,336 W mesuré pour 0,07 W)', () => {
    let worst = 0;
    for (let k = 0; k < 24; k++) {
      const f = face('short', k), g = geoOf(f), lm = lmOf(f), S = g.boundary.skull;
      for (const l of g.locks) if (l.rank === 'mass' && !l.sim) for (const q of l.poly) worst = Math.max(worst, distanceOutsideSkull(S, q) / lm.W);
    }
    expect(worst).toBeLessThan(REACH.short.side + 0.02);
  });

  it('un point déjà dans la portée ne bouge pas ; un sommet hors portée est ramené vers l\'axe sans disparaître', () => {
    const f = face('short', 3), g = geoOf(f), lm = lmOf(f), S = g.boundary.skull;
    const { side } = reachBudget('short', S, lm.W, lm.H);
    const y = S.topY + 0.15 * lm.H, x0 = S.a(y);
    const spine = [{ x: x0 * 0.5, y }, { x: x0, y }];
    const poly = [{ x: x0 * 0.5, y: y - 3 }, { x: x0 + 3 * lm.W, y }, { x: x0, y: y + 3 }];
    // Contexte minimal : seul ce que `conformReach` lit (style, crâne, dimensions, mèches pendantes).
    const ctx = { h: f.params.hair, boundary: g.boundary, lm, def: { hang: false } } as never;
    const out = conformReach(ctx, spine, poly, true).poly;
    expect(out[0]).toEqual(poly[0]);
    expect(distanceOutsideSkull(S, out[1]!) ).toBeLessThanOrEqual(side + 1);
    expect(out[1]!.x).toBeLessThan(poly[1]!.x);
  });
});

describe('vent couplé à la portée', () => {
  it('à pleine force, une mèche reste dans la portée + tolérance du vent ; sans vent la tolérance est nulle', () => {
    for (const st of ['short', 'bob', 'curly'] as CleanStyle[]) for (let k = 0; k < 4; k++) {
      const f = face(st, k, { wind: { x: 1, y: 0.6, flex: 1 } });
      expect(f.params.hair.wind.flex, 'la surcharge de vent est appliquée').toBe(1);
      expect(geoOf(f).locks.some((l) => l.bounded), 'le vent déplace bien des mèches bornées').toBe(true);
      const fails = checkHairCoherence(f).filter((c) => !c.ok && (c.id === 'lock-envelope-bound' || c.id === 'lock-envelope-rise'));
      expect(fails.map((c) => c.id), `${st} k${k}`).toEqual([]);
    }
    const f = face('short', 1), g = geoOf(f), lm = lmOf(f);
    const w0 = windReach('short', g.boundary.skull, lm.W, lm.H, Infinity, 0), w1 = windReach('short', g.boundary.skull, lm.W, lm.H, Infinity, 1);
    const q = { x: g.boundary.skull.a(g.boundary.skull.topY + 0.2 * lm.H) + (REACH.short.side + 0.06) * lm.W, y: g.boundary.skull.topY + 0.2 * lm.H };
    expect(w0.allowed(q)).toBe(false);
    expect(w1.allowed(q)).toBe(true);
  });
});

describe('attaches posées sur la tête (tie)', () => {
  it('chignon : latéral au-dessus de l\'oreille, centré sur le dessus, toujours visible de face, rayon borné', () => {
    for (let k = 0; k < 24; k++) {
      const f = face('bun', k), ids = checkHairCoherence(f).filter((c) => !c.ok).map((c) => c.id);
      expect(ids, `bun k${k}`).toEqual([]);
    }
  });

  it('queue latérale : jamais sous le haut de l\'oreille ; longueur et éventail bornés', () => {
    for (let k = 0; k < 24; k++) expect(errors(face('ponytail', k)), `ponytail k${k}`).toEqual([]);
  });

  it('tieSpots : la plage d\'un chignon latéral est dans la moitié haute du crâne (casque audio évité)', () => {
    for (let k = 0; k < 12; k++) {
      const f = face('bun', k, { tie: { side: 0.8, double: true, height: 0 } }), g = geoOf(f), lm = lmOf(f);
      expect(f.params.hair.tie.double, 'la surcharge d\'attache est appliquée').toBe(true);
      expect(g.ties.length).toBe(2);
      const earTop = Math.min(g.boundary.marks.earTopY.left, g.boundary.marks.earTopY.right);
      for (const t of g.ties) expect(t.at.y, `bun k${k}`).toBeLessThan(earTop - 0.02 * lm.H);
    }
    expect(TIE.bunRadiusSide).toBeLessThan(TIE.bunRadiusTop);
    expect(typeof tieSpots).toBe('function');
  });
});

describe('teinte racine et vocabulaire de formes', () => {
  it('rootColorOf : jamais sous ROOT_MIN_RATIO × la luminance des cheveux, même avec une racine quasi noire', () => {
    for (let k = 0; k < 60; k++) {
      const f = face(STYLES[k % STYLES.length]!, k, { rootColor: '#0a0806' });
      expect(f.params.hair.rootColor, 'la racine presque noire est appliquée').toBe('#0a0806');
      const ra = hairAppearance(f.params.hair), lum = luminance(ra.base);
      if (lum < 0.02) continue;
      expect(luminance(rootColorOf(ra, f.params.hair)) / lum, `k${k}`).toBeGreaterThanOrEqual(ROOT_MIN_RATIO - 0.01);
    }
  });

  it('une racine déjà assez claire n\'est pas modifiée', () => {
    const f = face('short', 2), ra = hairAppearance(f.params.hair);
    const h = { ...f.params.hair, rootColor: ra.base };
    expect(rootColorOf(ra, h)).toBe(ra.base);
  });

  it('aucun cône sur les coiffures hors vocabulaire (bob, long, attachées)', () => {
    for (const st of STYLES) if (!VOCAB[st].cones) for (let k = 0; k < 8; k++) expect(geoOf(face(st, k)).locks.filter((l) => l.kind === 'cone').length, `${st} k${k}`).toBe(0);
  });
});

describe('contrôles négatifs : un défaut injecté est vu', () => {
  const clone = (g: HairGeometry, patch: Partial<HairGeometry>): HairGeometry => ({ ...g, ...patch });

  it('enveloppe d\'une mèche qui s\'envole', () => {
    const f = face('short', 4), g = geoOf(f), lm = lmOf(f);
    const i = g.locks.findIndex((l) => l.bounded && !l.sim);
    const locks = g.locks.map((l, j) => (j === i ? { ...l, poly: l.poly.map((q) => ({ x: q.x + 0.4 * lm.W * Math.sign(q.x || 1), y: q.y })) } : l));
    expect(errors(f)).toEqual([]);
    expect(errors(f, clone(g, { locks }))).toContain('lock-envelope-bound');
  });

  it('constructeur sans borne : mèche libre non marquée', () => {
    const f = face('long', 2), g = geoOf(f);
    const locks = g.locks.map((l, j) => (j === g.locks.findIndex((q) => q.bounded && !q.sim) ? { ...l, bounded: false } : l));
    expect(errors(f, clone(g, { locks }))).toContain('envelope-coverage');
  });

  it('attache à hauteur d\'oreille et attache flottante', () => {
    const f = face('bun', 5, { tie: { side: 0.8, double: false, height: 0.5 } }), g = geoOf(f), lm = lmOf(f);
    const earTop = Math.min(g.boundary.marks.earTopY.left, g.boundary.marks.earTopY.right);
    const t = g.ties[0]!;
    expect(errors(f)).toEqual([]);
    expect(errors(f, clone(g, { ties: [{ ...t, at: { x: t.at.x, y: earTop + 0.02 * lm.H } }] }))).toContain('tie-above-ear');
    expect(errors(f, clone(g, { ties: [{ ...t, at: { x: t.at.x * 3, y: t.at.y } }] }))).toContain('tie-on-skull');
  });

  it('chignon caché derrière le crâne', () => {
    const f = face('bun', 6, { tie: { side: 0, double: false, height: 0.5 } }), g = geoOf(f), S = g.boundary.skull;
    const locks = g.locks.map((l) => (l.part === 'bun' && l.poly.length === 48 ? { ...l, poly: l.poly.map((q) => ({ x: q.x * 0.1, y: S.topY + 0.5 * (S.chinY - S.topY) })) } : l));
    expect(errors(f, clone(g, { locks }))).toContain('bun-visible');
  });

  it('cône sur des cheveux pendants', () => {
    const f = face('bob', 3), g = geoOf(f);
    const cone = { ...g.locks[0]!, kind: 'cone' as const };
    expect(errors(f, clone(g, { locks: [...g.locks, cone] }))).toContain('style-vocabulary');
  });

  it('trou dans la coque du crâne', () => {
    const f = face('short', 7, { thinning: 0 }), g = geoOf(f);
    expect(errors(f)).toEqual([]);
    expect(errors(f, clone(g, { base: [], locks: g.locks.filter((l) => l.layer === 'back') }))).toContain('crown-covered');
  });
});

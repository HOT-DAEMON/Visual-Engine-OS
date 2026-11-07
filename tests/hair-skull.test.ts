import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { faceLandmarks, hairGeometry, type HairGeometry } from '../src/face';
import { backMassBottom, backMassCloseHeight, backMassShape, rowExtents } from '../src/face/hair/back-mass';
import { isBodyLock } from '../src/face/hair/body-lock';
import { REACH } from '../src/face/hair/reach';
import { distanceOutsideSkull, maxShell, shellThickness, THICKNESS, withinShell } from '../src/face/hair/thickness';
import { backMassFill, BACK_FADE } from '../src/render/face/hair-back-fade';
import { checkHairSkull } from '../src/verify/hair-skull';
import { HAIR_STYLES } from '../src/schema';
import { hairFaceSpec } from '../scripts/lib/hair-faces';

const STYLES = HAIR_STYLES.filter((s) => s !== 'bald');
const mk = (seed: number, hair: Record<string, unknown> = {}) => generateRandomFace(seed, { hair: hair as never } as never);
const geoOf = (f: ReturnType<typeof mk>): HairGeometry => hairGeometry(f.params, faceLandmarks(f.params, f.width, f.height)) as HairGeometry;
const errors = (f: ReturnType<typeof mk>, g?: HairGeometry) => checkHairSkull(f, g).filter((c) => !c.ok && c.severity === 'error').map((c) => c.id);
const failing = (f: ReturnType<typeof mk>, g?: HairGeometry) => checkHairSkull(f, g).filter((c) => !c.ok).map((c) => c.id);

describe('épaisseur anatomique de la coque (thickness)', () => {
  it('genou doux : identité sous 70 % du plafond, saturation au-dessus, jamais au-delà', () => {
    for (const s of STYLES) {
      const { cap } = THICKNESS[s];
      expect(shellThickness(s, 0.5 * cap)).toBeCloseTo(0.5 * cap, 12);
      expect(shellThickness(s, 0.7 * cap)).toBeCloseTo(0.7 * cap, 12);
      expect(shellThickness(s, 10 * cap)).toBeLessThanOrEqual(cap + 1e-9);
      expect(shellThickness(s, 2 * cap)).toBeGreaterThan(shellThickness(s, cap));
    }
  });

  it('les coiffures tirées sont plus fines que les coiffures volumineuses', () => {
    expect(THICKNESS.ponytail.cap).toBeLessThan(THICKNESS.curly.cap);
    expect(THICKNESS.buzz.cap).toBeLessThan(THICKNESS.short.cap);
    expect(THICKNESS.curly.cap).toBeLessThan(THICKNESS.afro.cap);
  });

  it('distanceOutsideSkull : 0 dans le crâne, croissante en s\'éloignant', () => {
    const f = mk(7, { style: 'short' }), g = geoOf(f), S = g.boundary.skull;
    const y = (S.topY + S.chinY) / 2;
    expect(distanceOutsideSkull(S, { x: 0, y })).toBeCloseTo(0, 3);
    const d1 = distanceOutsideSkull(S, { x: S.a(y) + 5, y }), d2 = distanceOutsideSkull(S, { x: S.a(y) + 20, y });
    expect(d1).toBeGreaterThan(0);
    expect(d2).toBeGreaterThan(d1);
    expect(d1).toBeLessThanOrEqual(5 + 1e-6);
  });

  it('withinShell ramène un point lointain dans le volume admis, sans toucher un point interne', () => {
    const f = mk(7, { style: 'long' }), g = geoOf(f), S = g.boundary.skull, W = faceLandmarks(f.params, f.width, f.height).W;
    const y = S.topY + 0.3 * (S.chinY - S.topY);
    const far = withinShell('long', S, W, { x: S.a(y) + 3 * W, y: S.topY - 3 * W });
    expect(far.x).toBeLessThanOrEqual(S.a(y) + maxShell('long', W) + 1e-6);
    expect(far.y).toBeGreaterThanOrEqual(S.topY - maxShell('long', W) - 1e-6);
    const inside = { x: 0.2 * S.a(y), y };
    expect(withinShell('long', S, W, inside)).toEqual(inside);
  });
});

describe('masse arrière (back-mass)', () => {
  const f = mk(11, { style: 'long' }), g = geoOf(f), lm = faceLandmarks(f.params, f.width, f.height);

  it('rowExtents parcourt les arêtes : aucune ligne n\'est sautée entre deux sommets éloignés', () => {
    const tri = [{ x: -10, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 100 }];
    const { lo, hi } = rowExtents([tri], 0, 10, 11);
    expect(lo.every(Number.isFinite)).toBe(true);
    expect(hi[10]).toBeCloseTo(0, 6);
    expect(hi[5]).toBeCloseTo(5, 6);
    expect(lo[5]).toBeCloseTo(-5, 6);
  });

  it('une masse existe pour un long, ferme son bas et reste symétrique-fermée', () => {
    expect(g.backBase && g.backBase.length).toBeGreaterThan(20);
    const bb = g.backBase!, ys = bb.map((q) => q.y), y1 = Math.max(...ys);
    const bottomWidth = Math.max(...bb.filter((q) => q.y > y1 - 0.01 * (y1 - Math.min(...ys))).map((q) => Math.abs(q.x)));
    expect(bottomWidth).toBeLessThan(0.5 * Math.max(...bb.map((q) => Math.abs(q.x))));
  });

  it('backMassBottom est nul sans pointes arrière, et la hauteur de fermeture est bornée', () => {
    expect(backMassBottom(lm, [])).toBeNull();
    const yBot = lm.hair.sideY + 0.6 * lm.H;
    expect(backMassCloseHeight(lm, yBot)).toBeLessThanOrEqual(0.3 * (yBot - lm.hair.sideY) + 1e-9);
  });

  it('backMassShape sans mèches arrière : aucune masse', () => {
    expect(backMassShape({ lm, skull: g.boundary.skull, polys: [], backPolys: [], crown: 5 })).toBeNull();
  });

  it('dégradé de fondu : opaque au-dessus de la mâchoire, transparent en bas', () => {
    expect(BACK_FADE.before).toBeGreaterThan(0);
    const r = backMassFill('t', g.backBase!, lm, '#222');
    expect(r.fill).toContain('url(#');
    expect(r.def).toContain('linearGradient');
    expect(r.def).toContain('stop-opacity');
  });

  it('isBodyLock : mèches de corps (lock, cheek, fringe, simulée) oui ; cône, volute, occluder non', () => {
    const base = { poly: [], rank: 'main', tone: 0, layer: 'front' } as never;
    expect(isBodyLock({ ...(base as object), kind: 'lock' } as never)).toBe(true);
    expect(isBodyLock({ ...(base as object), kind: 'cheek' } as never)).toBe(true);
    expect(isBodyLock({ ...(base as object) } as never)).toBe(true);
    expect(isBodyLock({ ...(base as object), kind: 'cone' } as never)).toBe(false);
    expect(isBodyLock({ ...(base as object), kind: 'wisp' } as never)).toBe(false);
    expect(isBodyLock({ ...(base as object), kind: 'occluder' } as never)).toBe(false);
  });
});

describe('masses d\'étage', () => {
  it('les pointes des mèches d\'un étage dépassent sous sa masse (plus de coin coloré qui pend sous le menton)', () => {
    let seen = 0;
    for (let k = 0; k < 8; k++) {
      const sp = hairFaceSpec('long', k, { engine: 'v2', seed: 950 + k * 17, identity: k });
      const f = generateRandomFace(sp.seed, sp.opts), H = faceLandmarks(f.params, f.width, f.height).H, g = geoOf(f);
      for (const m of g.tierMasses) {
        const own = g.locks.filter((l) => l.layer === 'front' && (l.tier ?? 0) === m.tier && (l.kind === 'lock' || (l.kind === 'flow' && l.sim === true)));
        if (own.length < 3) continue;
        seen++;
        const lowestTip = Math.max(...own.flatMap((l) => l.poly.map((q) => q.y)));
        expect(Math.max(...m.poly.map((q) => q.y))).toBeLessThanOrEqual(lowestTip - 0.05 * H + 1e-6);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('portée des formes libres (reach)', () => {
  it('les coiffures tirées ou longues portent moins haut que les coiffures qui se dressent', () => {
    for (const s of ['bob', 'long', 'ponytail', 'bun', 'braids'] as const) expect(REACH[s].up).toBeLessThan(REACH.spiky.up);
    expect(REACH.buzz.up).toBeLessThan(REACH.short.up);
    expect(REACH.afro.up).toBeGreaterThanOrEqual(REACH.curly.up);
  });

  it.each(STYLES)('%s : aucune mèche de corps dessinée ne dépasse la portée sur 6 graines', (style) => {
    if (style === 'ponytail' || style === 'bun' || style === 'braids') return; // attache hors portée par construction
    for (let k = 0; k < 6; k++) {
      const f = mk(5200 + k * 29, { style });
      const g = geoOf(f), H = faceLandmarks(f.params, f.width, f.height).H;
      const body = g.locks.filter((l) => l.layer !== 'over' && l.sim !== true && l.kind === 'lock');
      const rise = body.length ? (g.boundary.skull.topY - Math.min(...body.flatMap((l) => l.poly.map((q) => q.y)))) / H : 0;
      expect(rise).toBeLessThanOrEqual(REACH[style].up + 0.025 + 1e-6);
    }
  });
});

describe('vérification crâne ↔ cheveux : les trois couches', () => {
  it('couvre géométrie, anatomie et style', () => {
    const layers = new Set(checkHairSkull(mk(1, { style: 'long' })).map((c) => c.layer));
    expect([...layers].sort()).toEqual(['anatomy', 'geometry', 'style']);
  });

  it('chauve : rien à vérifier', () => expect(checkHairSkull(mk(1, { style: 'bald' }))).toEqual([]));

  it.each(STYLES)('%s : aucune erreur sur 6 graines', (style) => {
    // Visages à axes v2 COHÉRENTS avec la coiffure imposée (un buzz tiré comme « long » recevrait un rideau d'oreille que la génération naturelle écarte).
    for (let k = 0; k < 6; k++) { const sp = hairFaceSpec(style, k, { engine: 'v2', seed: 6100 + k * 37 }); expect(errors(generateRandomFace(sp.seed, sp.opts))).toEqual([]); }
  });

  // Contrôles NÉGATIFS : un défaut injecté doit être vu (sinon le contrôle est vide).
  it('détecte une coque qui s\'envole du crâne', () => {
    const f = mk(21, { style: 'short' }), g = geoOf(f), lm = faceLandmarks(f.params, f.width, f.height);
    const base = (g.base[0] ?? []).map((q) => ({ x: q.x * 1.4, y: q.y - 0.3 * lm.H }));
    expect(failing(f, { ...g, base: [base] })).toContain('skull-shell-bound');
  });

  it('détecte un couvercle plat sur la masse arrière', () => {
    const f = mk(22, { style: 'long' }), g = geoOf(f), bb = g.backBase!;
    const y0 = Math.min(...bb.map((q) => q.y)), span = Math.max(...bb.map((q) => q.y)) - y0, w = Math.max(...bb.map((q) => Math.abs(q.x)));
    const edge = (x0: number, y0_: number, x1: number, y1_: number) => Array.from({ length: 12 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / 12, y: y0_ + ((y1_ - y0_) * i) / 12 }));
    const lid = [...edge(-w, y0, w, y0), ...edge(w, y0, w, y0 + span), ...edge(w, y0 + span, -w, y0 + span), ...edge(-w, y0 + span, -w, y0)];
    const ids = failing(f, { ...g, backBase: lid });
    expect(ids).toContain('back-mass-no-lid');
    expect(ids).toContain('back-mass-no-bar');
    expect(ids).toContain('back-mass-closed-bottom');
  });

  it('détecte un trou entre la masse arrière et la tête', () => {
    const f = mk(23, { style: 'long' }), g = geoOf(f);
    const thin = g.backBase!.map((q) => ({ x: q.x * 0.5, y: q.y }));
    expect(failing(f, { ...g, backBase: thin })).toContain('back-mass-above-skull');
  });

  it('détecte une corne : cône très haut au-dessus du crâne', () => {
    const f = mk(24, { style: 'long' }), g = geoOf(f), S = g.boundary.skull, H = faceLandmarks(f.params, f.width, f.height).H;
    const horn = { poly: [{ x: 0, y: S.topY }, { x: 6, y: S.topY - 0.4 * H }, { x: -6, y: S.topY }], rank: 'main', tone: 0, layer: 'front', kind: 'cone' } as never;
    expect(failing(f, { ...g, locks: [...g.locks, horn] })).toContain('free-reach-bound');
  });

  it('détecte une mèche de corps recourbée par-dessus le sommet', () => {
    const f = mk(25, { style: 'bob' }), g = geoOf(f), S = g.boundary.skull, H = faceLandmarks(f.params, f.width, f.height).H;
    const loop = { poly: [{ x: 0, y: S.topY }, { x: 4, y: S.topY - 0.3 * H }, { x: -4, y: S.topY }], rank: 'main', tone: 0, layer: 'back', kind: 'lock' } as never;
    expect(failing(f, { ...g, locks: [...g.locks, loop] })).toContain('body-reach-bound');
  });
});

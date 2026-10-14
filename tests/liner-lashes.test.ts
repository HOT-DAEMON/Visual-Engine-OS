import { describe, expect, it } from 'vitest';
import { compileScene, EyeSpec } from '../src';
import { linerGeometry, linerTopOffset, openingGeometry, upperFrame, upperLashes, lowerLashes } from '../src/geometry/eye';

const mk = (over: Record<string, unknown> = {}) => EyeSpec.parse({ id: 'e', kind: 'eye', ...over });
const geomOf = (over: Record<string, unknown> = {}) => {
  const e = mk(over);
  return { e, g: openingGeometry(e.shape, e.canthi), th: e.lids.thickness * e.shape.height };
};
const LINER = { liner: {} };

describe('lids.liner : schéma', () => {
  it('null par défaut ; {} donne les valeurs par défaut ; clés inconnues refusées', () => {
    expect(mk().lids.liner).toBeNull();
    const l = mk({ lids: LINER }).lids.liner!;
    expect(l.wing.length).toBeGreaterThan(0);
    expect(l.lowerReach).toBe(0);
    expect(EyeSpec.safeParse({ id: 'e', kind: 'eye', lids: { liner: { couleur: '#000000' } } }).success).toBe(false);
    expect(EyeSpec.safeParse({ id: 'e', kind: 'eye', lids: { liner: { wing: { length: 9 } } } }).success).toBe(false);
  });
});

describe('linerGeometry : liner ailé', () => {
  it("l'épaisseur croît du début jusqu'au sommet, sans rien ajouter avant `start`", () => {
    const { e, th } = geomOf({ lids: LINER });
    const p = e.lids.liner!;
    expect(linerTopOffset(p, th, p.start - 0.05)).toBe(0);
    const a = linerTopOffset(p, th, p.start + 0.1);
    const b = linerTopOffset(p, th, (p.start + p.peak) / 2);
    const c = linerTopOffset(p, th, p.peak);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(c).toBeGreaterThan(th * (0.5 + p.thickness * 0.8));
  });

  it("l'aile dépasse le canthus externe vers l'extérieur et se relève (pointe au-dessus du canthus)", () => {
    for (const style of ['almond', 'diamond_v2', 'triangle', 'circle']) {
      const { e, g, th } = geomOf({ shape: { style }, lids: { liner: { wing: { length: 0.3, liftDeg: 25 } } } });
      const geo = linerGeometry(g, e.lids.liner!, th);
      expect((geo.tip.x - g.po.x) * g.s).toBeGreaterThan(g.w * 0.2);
      expect(geo.tip.y).toBeLessThan(g.po.y);
    }
  });

  it("la longueur de l'aile suit `wing.length` (pointe à ~ length × largeur du départ de l'aile)", () => {
    const reach = (length: number) => {
      const { e, g, th } = geomOf({ lids: { liner: { wing: { length } } } });
      const tip = linerGeometry(g, e.lids.liner!, th).tip;
      return Math.hypot(tip.x - g.po.x, tip.y - g.po.y);
    };
    expect(reach(0.6)).toBeGreaterThan(reach(0.15) * 2.5);
  });

  it("miroir : outerSide 'left' donne une aile symétrique (pointe de l'autre côté)", () => {
    const r = geomOf({ shape: { outerSide: 'right', tiltDeg: 0 }, lids: LINER });
    const l = geomOf({ shape: { outerSide: 'left', tiltDeg: 0 }, lids: LINER });
    const tr = linerGeometry(r.g, r.e.lids.liner!, r.th).tip;
    const tl = linerGeometry(l.g, l.e.lids.liner!, l.th).tip;
    expect(tl.x).toBeCloseTo(-tr.x, 4);
    expect(tl.y).toBeCloseTo(tr.y, 4);
  });

  it('la pointe est exacte (aiguille) : les deux bords se rejoignent en un seul point', () => {
    const { e, g, th } = geomOf({ lids: { liner: { wing: { sharpness: 1 } } } });
    const geo = linerGeometry(g, e.lids.liner!, th);
    expect(geo.top[geo.top.length - 1]).toEqual(geo.tip);
    expect(geo.bottom[0]).toEqual(geo.tip);
  });

  it('liner inférieur : vide à 0, effilé et non vide au-delà', () => {
    const none = geomOf({ lids: LINER });
    expect(linerGeometry(none.g, none.e.lids.liner!, none.th).lower).toHaveLength(0);
    const low = geomOf({ lids: { liner: { lowerReach: 0.4 } } });
    expect(linerGeometry(low.g, low.e.lids.liner!, low.th).lower.length).toBeGreaterThan(10);
  });

  it('tous les points sont finis, pour tous les styles et réglages extrêmes', () => {
    for (const style of ['almond', 'round', 'sharp', 'drooping', 'chibi', 'angular', 'compressed', 'rounded_rect', 'triangle', 'circle', 'diamond', 'diamond_v2']) {
      for (const liner of [{}, { thickness: 4, start: 0, peak: 0.2, wing: { length: 1.5, liftDeg: 70, curve: 1, sharpness: 0 } }, { thickness: 0.1, start: 0.9, peak: 1, wing: { length: 0, liftDeg: -20, curve: -1 } }]) {
        const { e, g, th } = geomOf({ shape: { style }, lids: { liner } });
        const geo = linerGeometry(g, e.lids.liner!, th);
        for (const p of [...geo.top, ...geo.bottom, ...geo.gloss, ...geo.lower]) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
    }
  });
});

describe('liner : rendu', () => {
  const scene = (over: Record<string, unknown>) => {
    const r = compileScene({ objects: [{ kind: 'eye', id: 'e', ...over }] });
    if (!r.ok) throw new Error(r.issues.join('\n'));
    return r.svg;
  };
  it("sans liner : aucun élément de liner ; avec liner : forme `e-liner` et l'ancienne pointe n'est plus dessinée", () => {
    expect(scene({})).not.toContain('id="e-liner"');
    const withLiner = scene({ lids: { wing: 1, liner: {} } });
    expect(withLiner).toContain('id="e-liner"');
    const legacyWing = scene({ lids: { wing: 1 } });
    expect(legacyWing).not.toBe(scene({ lids: { wing: 0 } })); // l'ancienne pointe existe bien sans liner
    // avec liner, `lids.wing` est ignoré
    expect(scene({ lids: { wing: 1, liner: {} } })).toBe(scene({ lids: { wing: 0, liner: {} } }));
  });
  it('dégradé de liner uniquement si `tipColor` est fourni', () => {
    expect(scene({ lids: { liner: {} } })).not.toContain('e-liner-grad');
    expect(scene({ lids: { liner: { color: '#112233', tipColor: '#33aaff' } } })).toContain('e-liner-grad');
  });
  it('déterministe : même scène, même SVG', () => {
    const s = { lids: { liner: { tipColor: '#33aaff', lowerReach: 0.3 } }, lashes: { upper: { clump: 0.6, flick: { count: 3 } } } };
    expect(scene(s)).toBe(scene(s));
  });
});

describe('cils : mèches, allongement externe, cils longs, redressement', () => {
  const up = (lashes: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => {
    const { e, g, th } = geomOf({ lashes: { upper: lashes }, ...extra });
    return { lashes: upperLashes(g, e.lashes.upper, th, 1234), g, th, e };
  };

  it('valeurs par défaut inchangées : 16 cils quadratiques, aucun cil cubique, mêmes valeurs que clump 0 / outerLength 0 explicites', () => {
    const base = up();
    expect(base.lashes).toHaveLength(16);
    expect(base.lashes.every((l) => l.ctrl2 === undefined)).toBe(true);
    expect(up({ clump: 0, outerLength: 0, outerLift: 0, flick: { count: 0 } }).lashes).toEqual(base.lashes);
    const { e, g, th } = geomOf();
    expect(lowerLashes(g, e.lashes.lower, th, 9)).toHaveLength(6);
  });

  it("`outerLength` allonge les cils de la moitié externe et laisse la partie interne intacte", () => {
    const a = up().lashes;
    const b = up({ outerLength: 1 }).lashes;
    const len = (l: { base: { x: number; y: number }; tip: { x: number; y: number } }) => Math.hypot(l.tip.x - l.base.x, l.tip.y - l.base.y);
    expect(len(b[b.length - 1]!)).toBeGreaterThan(len(a[a.length - 1]!) * 1.6);
    expect(len(b[0]!)).toBeCloseTo(len(a[0]!), 6);
  });

  it("`clump` rapproche les pointes d'un même paquet (dispersion des pointes réduite), sans toucher aux racines", () => {
    const a = up({ count: 18 }).lashes;
    const b = up({ count: 18, clump: 1, clumpSize: 3 }).lashes;
    expect(b).toHaveLength(a.length);
    for (let i = 0; i < a.length; i++) expect(b[i]!.base).toEqual(a[i]!.base);
    // Les écarts entre pointes VOISINES : ceux d'un même paquet (majoritaires) se resserrent, donc la
    // médiane chute ; les écarts entre paquets, eux, subsistent (les paquets restent distincts).
    const gaps = (ls: typeof a) => ls.slice(1).map((l, i) => Math.hypot(l.tip.x - ls[i]!.tip.x, l.tip.y - ls[i]!.tip.y)).sort((x, y) => x - y);
    const median = (v: number[]) => v[Math.floor(v.length / 2)]!;
    expect(median(gaps(b))).toBeLessThan(median(gaps(a)) * 0.6);
    expect(Math.max(...gaps(b))).toBeGreaterThan(median(gaps(b)) * 2);
  });

  it('`flick` ajoute `count` cils cubiques, plantés sur la partie externe, dirigés vers l\'extérieur et plus longs que les cils ordinaires', () => {
    const base = up();
    const f = up({ flick: { count: 4, length: 0.6, reach: 0.15 } });
    const extra = f.lashes.slice(base.lashes.length);
    expect(f.lashes).toHaveLength(base.lashes.length + 4);
    expect(extra.every((l) => l.ctrl2 !== undefined)).toBe(true);
    for (const l of extra) {
      expect((l.tip.x - l.base.x) * f.g.s).toBeGreaterThan(0);
      expect((l.base.x - f.g.pi.x) * f.g.s).toBeGreaterThan(f.g.w * 0.6);
    }
    const len = (l: (typeof extra)[number]) => Math.hypot(l.tip.x - l.base.x, l.tip.y - l.base.y);
    expect(len(extra[extra.length - 1]!)).toBeGreaterThan(len(extra[0]!));
    expect(len(extra[extra.length - 1]!)).toBeGreaterThan(Math.max(...base.lashes.map(len)));
  });

  it('`outerLift` redresse les cils externes vers le haut (pointe plus haute), sans changer les cils internes', () => {
    const a = up({ count: 20 }).lashes;
    const b = up({ count: 20, outerLift: 1 }).lashes;
    const rise = (l: { base: { y: number }; tip: { y: number } }) => l.base.y - l.tip.y;
    expect(rise(b[b.length - 1]!)).toBeGreaterThan(rise(a[a.length - 1]!));
    expect(b[0]!.tip.x).toBeCloseTo(a[0]!.tip.x, 6);
  });

  it('avec un liner, les racines des cils prennent place sur son bord haut (plus loin de la paupière)', () => {
    const { e, g, th } = geomOf({ lids: LINER });
    const plain = upperLashes(g, e.lashes.upper, th, 5);
    const root = (t: number) => linerTopOffset(e.lids.liner!, th, t) * 0.88;
    const on = upperLashes(g, e.lashes.upper, th, 5, root);
    const dist = (l: { base: { x: number; y: number } }) => {
      let best = Infinity;
      for (let i = 0; i <= 200; i++) {
        const f = upperFrame(g, i / 200);
        best = Math.min(best, Math.hypot(l.base.x - f.pos.x, l.base.y - f.pos.y));
      }
      return best;
    };
    expect(dist(on[on.length - 2]!)).toBeGreaterThan(dist(plain[plain.length - 2]!) + th * 0.5);
  });

  it('déterminisme et indépendance : les cils ordinaires ne dépendent pas des options ajoutées', () => {
    const a = up({ clump: 0, flick: { count: 0 } }).lashes;
    const b = up({ clump: 0, flick: { count: 5 } }).lashes.slice(0, a.length);
    expect(b).toEqual(a);
  });

  it('rendu sans NaN/Infinity aux réglages extrêmes, œil miroir et styles allongés', () => {
    for (const style of ['almond', 'triangle', 'diamond_v2', 'circle', 'compressed']) {
      for (const outerSide of ['right', 'left']) {
        const r = compileScene({
          objects: [
            {
              kind: 'eye',
              id: 'e',
              shape: { style, outerSide },
              lids: { liner: { thickness: 4, wing: { length: 1.5, liftDeg: 70, curve: 1 }, lowerReach: 1 } },
              lashes: { upper: { count: 60, outerLength: 2, outerLift: 1, clump: 1, clumpSize: 6, flick: { count: 8, length: 1.5, reach: 0.35, liftDeg: 80, curl: 1 } }, lower: { count: 30, clump: 1 } },
            },
          ],
        });
        if (!r.ok) throw new Error(r.issues.join('\n'));
        expect(r.svg).not.toMatch(/NaN|Infinity/);
      }
    }
  });
});

import { describe, expect, it } from 'vitest';
import { bundle, set } from './helpers-structure';

/** Mesures du menton (T5) : chacune est lue sur la géométrie réelle. */
function chin(patch: Record<string, unknown>) {
  const { g, lm } = bundle(patch);
  const c = g.chin;
  return {
    width: c.widthPx,
    height: c.heightPx,
    projection: c.projectionPx,
    flatness: c.flatness,
    symphysisWidth: c.symphysis.widthPx / c.widthPx,
    symphysisDepth: c.symphysis.depthPx / c.heightPx,
    dimple: c.dimple.rx,
    upper: c.upper.ry,
    lateral: c.lateral.right.rx,
    lower: c.lower.ry,
    bottomY: lm.outline.bottomY,
  };
}
type C = ReturnType<typeof chin>;

describe('menton — contrôles séparés (T5)', () => {
  const base = chin({ chin: { symphysis: 'round' } });
  const VAR: Record<string, [keyof C, Record<string, unknown>]> = {
    largeur: ['width', { chinWidth: 0.3 }],
    hauteur: ['height', { chin: { height: 0.09 } }],
    projection: ['projection', { chin: { projection: 0.95 } }],
    rondeur: ['flatness', { chin: { form: 1 } }],
    'largeur de la symphyse': ['symphysisWidth', { chin: { symphysisWidth: 1 } }],
    'profondeur de la symphyse': ['symphysisDepth', { chin: { symphysisDepth: 1 } }],
    fossette: ['dimple', { chin: { dimple: 1 } }],
    'transition supérieure': ['upper', { chin: { upperBlend: 1 } }],
    'raccord latéral': ['lateral', { chin: { lateralBlend: 1 } }],
    'transition inférieure': ['lower', { chin: { lowerBlend: 1 } }],
  };
  for (const [name, [key, patch]] of Object.entries(VAR)) {
    it(`« ${name} » change sa mesure`, () => {
      const m = chin({ chin: { symphysis: 'round', ...((patch.chin as object) ?? {}) }, ...(patch.chinWidth ? { chinWidth: patch.chinWidth } : {}) });
      expect(Math.abs(m[key] - base[key]) / Math.abs(base[key])).toBeGreaterThan(0.03);
    });
  }

  it('la hauteur ne change jamais la longueur du visage (bas du menton fixe)', () => {
    expect(chin({ chin: { height: 0.09, symphysis: 'round' } }).bottomY).toBeCloseTo(base.bottomY, 9);
  });

  it('la projection, la fossette et les transitions ne changent ni la largeur ni la hauteur du menton', () => {
    for (const patch of [{ projection: 0.95 }, { dimple: 1 }, { upperBlend: 1 }, { lateralBlend: 1 }, { lowerBlend: 1 }]) {
      const m = chin({ chin: { symphysis: 'round', ...patch } });
      expect(m.width).toBeCloseTo(base.width, 6);
      expect(m.height).toBeCloseTo(base.height, 6);
    }
  });

  it('la forme continue va du pointu au carré en passant par le rond (rondeur croissante)', () => {
    const f = [-1, 0, 1].map((form) => chin({ chin: { form } }).flatness);
    expect(f[0]).toBeLessThan(f[1] as number);
    expect(f[1]).toBeLessThan(f[2] as number);
  });

  it('`form: null` reproduit exactement les symphyses historiques', () => {
    const a = bundle({ chin: { symphysis: 'square' } }).lm.outline.bottomY;
    const b = bundle({ chin: { symphysis: 'square', form: null } }).lm.outline.bottomY;
    expect(a).toBe(b);
  });
});

describe('joues et sillons (T8)', () => {
  it('chaque contrôle de joue agit sur sa région', () => {
    const base = bundle().g.tissue.cheeks.right;
    expect(bundle(set({}, 'cheek.boneProjection', 1)).g.tissue.cheeks.right.zygoma.rx).toBeGreaterThan(base.zygoma.rx);
    expect(bundle(set({}, 'cheek.volume', 1)).g.tissue.cheeks.right.volume.rx).toBeGreaterThan(base.volume.rx);
    expect(bundle(set({}, 'cheek.hollow', 1)).g.tissue.cheeks.right.hollow.rx).toBeGreaterThan(base.hollow.rx);
    expect(bundle(set({}, 'cheek.lateralWidth', 1)).g.tissue.cheeks.right.lateralWidthPx).toBeGreaterThan(base.lateralWidthPx);
    expect(bundle(set({}, 'cheek.masseterBlend', 1)).g.tissue.cheeks.right.masseterBlend.rx).toBeGreaterThan(base.masseterBlend.rx);
  });

  it('des joues pleines bombent la branche montante, des joues creuses la rentrent (neutre à 0,5)', () => {
    const at = (v: number) => bundle(set({}, 'cheek.volume', v)).lm.outline.keys.gonion.x;
    expect(at(0.5)).toBeCloseTo(bundle().lm.outline.keys.gonion.x, 9);
    const ramusX = (v: number): number => Math.max(...bundle(set({}, 'cheek.volume', v)).g.mandible.ramus.map((q) => q.x));
    expect(ramusX(1)).toBeGreaterThanOrEqual(ramusX(0.5));
    expect(ramusX(0)).toBeLessThanOrEqual(ramusX(0.5));
  });

  it('les plis existent comme polylignes distinctes (nasogénien et péri-buccal)', () => {
    const f = bundle().g.tissue.folds;
    for (const line of [f.nasolabial.left, f.nasolabial.right, f.perioral.left, f.perioral.right]) expect(line.length).toBeGreaterThan(3);
  });
});

describe('cou (T9)', () => {
  it('l\'inclinaison de la tête et l\'ouverture de la bouche ferment l\'angle cervico-mentonnier', () => {
    const rest = bundle().g.neck.cervicomentalDeg;
    expect(bundle({ deform: { articulation: { headPitchDeg: 20 } } }).g.neck.cervicomentalDeg).toBeLessThan(rest);
    expect(bundle({ mouth: { open: 1 } }).g.neck.cervicomentalDeg).toBeLessThan(rest);
    expect(bundle({ deform: { articulation: { headPitchDeg: -20 } } }).g.neck.cervicomentalDeg).toBeGreaterThan(rest);
  });

  it('un angle plus fermé donne une ombre sous-mentonnière plus profonde', () => {
    const open = bundle({ neck: { cervicomentalDeg: 140 } }).g.neck.shadowReachPx;
    const closed = bundle({ neck: { cervicomentalDeg: 95 } }).g.neck.shadowReachPx;
    expect(closed).toBeGreaterThan(open);
  });

  it('le platysma se tend à la bouche ouverte et à la tête inclinée, pas au repos', () => {
    expect(bundle().g.neck.platysmaTension).toBe(0);
    expect(bundle({ mouth: { open: 1 } }).g.neck.platysmaTension).toBeGreaterThan(0.1);
    expect(bundle({ deform: { articulation: { headPitchDeg: 25 } } }).g.neck.platysmaTension).toBeGreaterThan(0.1);
  });

  it('la largeur du cou est un paramètre à part : elle suit `neck.width`, pas le menton', () => {
    const a = bundle({ neck: { width: 0.34 } }).g.neck.halfWidthPx;
    const b = bundle({ neck: { width: 0.52 } }).g.neck.halfWidthPx;
    expect(b).toBeGreaterThan(a);
  });
});

import { describe, expect, it } from 'vitest';
import { faceLandmarks, halfWidthAt, jawDerived, outlinePath, rightSamples } from '../src/face';
import { FaceParams, SYMPHYSIS_SHAPES, type FaceParamsInput } from '../src/schema';
import { generateRandomFace } from '../src';

const W = 320;
const H = 420;
const lmOf = (over: FaceParamsInput = {}) => {
  const p = FaceParams.parse(over);
  return { p, lm: faceLandmarks(p, W, H) };
};

describe('moteur de menton et de mâchoire', () => {
  it('HAUTEUR du menton : déplace le sillon, ne rallonge jamais le visage', () => {
    const a = lmOf({ chin: { height: 0.09 } }).lm;
    const b = lmOf({ chin: { height: 0.14 } }).lm;
    expect(b.chin.sulcusY).toBeLessThan(a.chin.sulcusY); // menton plus haut = sillon plus haut
    expect(b.chin.heightPx).toBeGreaterThan(a.chin.heightPx);
    expect(b.outline.bottomY).toBe(a.outline.bottomY);
    expect(b.H).toBe(a.H);
    // Les points du contour au-dessus du coin du menton ne changent pas de position verticale d'extrémité : le bas reste à H/2.
    expect(rightSamples(a.outline).at(-1)?.y).toBeCloseTo(H / 2, 9);
    expect(rightSamples(b.outline).at(-1)?.y).toBeCloseTo(H / 2, 9);
  });

  it('PROJECTION du menton : ne change NI le contour NI la hauteur, seulement la grandeur de projection', () => {
    const a = lmOf({ chin: { projection: 0.1 } }).lm;
    const b = lmOf({ chin: { projection: 0.9 } }).lm;
    expect(outlinePath(b.outline)).toBe(outlinePath(a.outline));
    expect(b.chin.heightPx).toBe(a.chin.heightPx);
    expect(b.chin.projectionPx).toBeGreaterThan(a.chin.projectionPx * 4);
  });

  it('LARGEUR du menton : ne change ni la hauteur ni le bas du visage', () => {
    const a = lmOf({ chinWidth: 0.1 }).lm;
    const b = lmOf({ chinWidth: 0.4 }).lm;
    expect(b.outline.chinHalf).toBeGreaterThan(a.outline.chinHalf * 2);
    expect(b.chin.heightPx).toBeCloseTo(a.chin.heightPx, 9);
    expect(b.outline.bottomY).toBe(a.outline.bottomY);
  });

  it('largeur de la mandibule et hauteur du coin de mâchoire sont indépendantes du menton', () => {
    const a = lmOf({ jawWidth: 0.6 }).lm;
    const b = lmOf({ jawWidth: 0.95 }).lm;
    expect(b.jaw.gonion.x).toBeGreaterThan(a.jaw.gonion.x);
    expect(b.chin.heightPx).toBeCloseTo(a.chin.heightPx, 9);
  });

  it('angle mandibulaire : plus il est obtus, plus le coin est arrondi (le contour est plus étroit au niveau du coin)', () => {
    const w = (angle: number): number => {
      const { lm } = lmOf({ jaw: { angle } });
      return halfWidthAt(lm.outline, lm.jaw.gonion.y);
    };
    expect(w(1)).toBeLessThan(w(0.5));
    expect(w(0.5)).toBeLessThan(w(0));
    expect(lmOf({ jaw: { angle: 0 } }).lm.jaw.gonialDeg).toBe(95);
    expect(lmOf({ jaw: { angle: 1 } }).lm.jaw.gonialDeg).toBe(140);
  });

  it('symphyse : le bas du menton est plus large carré que rond que pointu', () => {
    const bottomWidth = (symphysis: (typeof SYMPHYSIS_SHAPES)[number]): number => {
      const { lm } = lmOf({ chin: { symphysis }, chinWidth: 0.3 });
      return halfWidthAt(lm.outline, lm.chinY - 0.015 * H);
    };
    expect(bottomWidth('square')).toBeGreaterThan(bottomWidth('round'));
    expect(bottomWidth('round')).toBeGreaterThan(bottomWidth('pointed'));
  });

  it('mobilité : l\'ouverture de la bouche abaisse la mandibule, d\'autant plus que la mobilité est forte ; rigide = rien ne bouge', () => {
    const drop = (open: number, mobility: number): number => lmOf({ mouth: { open }, jaw: { mobility } }).lm.jaw.drop;
    expect(drop(0, 1)).toBe(0);
    expect(drop(1, 0)).toBe(0);
    expect(drop(1, 1)).toBeGreaterThan(drop(1, 0.5));
    expect(drop(1, 0.5)).toBeGreaterThan(drop(0.4, 0.5));
    for (const open of [0.3, 1]) expect(drop(open, 1)).toBeLessThanOrEqual(0.08 * H + 1e-9);
    // Le bas du menton suit l'abaissement exactement.
    const { lm } = lmOf({ mouth: { open: 1 }, jaw: { mobility: 1 } });
    expect(lm.chinY).toBeCloseTo(H / 2 + lm.jaw.drop, 9);
  });

  it('déformation des tissus à l\'ouverture : lèvre étirée, sillon aplati, plis creusés, joues remontées ; `tissue = 0` désactive tout', () => {
    const t = (open: number, tissue: number) => jawDerived(FaceParams.parse({ mouth: { open }, jaw: { tissue } }), W, H).tissue;
    expect(t(0, 1)).toEqual({ lipStretch: 0, sulcusFlatten: 0, nasolabialDeepen: 0, cheekLift: 0, submentalTension: t(0, 1).submentalTension });
    expect(t(1, 0).lipStretch).toBe(0);
    expect(t(1, 1).lipStretch).toBeGreaterThan(t(0.5, 1).lipStretch);
    expect(t(1, 1).sulcusFlatten).toBeGreaterThan(0);
    expect(t(1, 1).nasolabialDeepen).toBeGreaterThan(0);
    expect(t(1, 1).cheekLift).toBeGreaterThan(0);
    // La lèvre inférieure s'amincit vraiment à l'ouverture.
    expect(lmOf({ mouth: { open: 1 }, jaw: { tissue: 1 } }).lm.lips.lowerH).toBeLessThan(lmOf({ mouth: { open: 1 }, jaw: { tissue: 0 } }).lm.lips.lowerH);
  });

  it('transition mâchoire → cou : l\'épaisseur sous-mentonnière augmente la tension d\'ombre', () => {
    const s = (submental: number) => jawDerived(FaceParams.parse({ jaw: { submental } }), W, H).tissue.submentalTension;
    expect(s(1)).toBeGreaterThan(s(0));
  });

  it('le coin du menton reste sous la lèvre inférieure et sous le coin de mâchoire, pour 200 visages', () => {
    for (let s = 1; s <= 200; s++) {
      const f = generateRandomFace(s * 53);
      const lm = faceLandmarks(f.params, f.width, f.height);
      expect(lm.outline.keys.chinCorner.y).toBeGreaterThanOrEqual(lm.jaw.gonion.y);
      expect(lm.chin.sulcusY).toBeGreaterThan(lm.lips.bottomY);
      expect(lm.outline.keys.chinCorner.y).toBeGreaterThan(lm.lips.cornerY);
    }
  });

  it('continuité C1 du contour pour les quatre symphyses (sauf l\'apex voulu du menton pointu)', () => {
    for (const symphysis of SYMPHYSIS_SHAPES) for (const angle of [0, 0.5, 1]) for (const taper of [0, 1]) {
      const { lm } = lmOf({ chin: { symphysis }, jaw: { angle, taper } });
      const segs = lm.outline.right;
      for (let i = 0; i < segs.length - 1; i++) {
        const a = segs[i]!;
        const b = segs[i + 1]!;
        const u = { x: a.p3.x - a.p2.x, y: a.p3.y - a.p2.y };
        const v = { x: b.p1.x - b.p0.x, y: b.p1.y - b.p0.y };
        const cos = (u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y));
        expect(Math.acos(Math.min(1, cos)) * (180 / Math.PI)).toBeLessThan(3);
      }
    }
  });
});

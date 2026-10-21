import { describe, expect, it } from 'vitest';
import { polyArea } from '../src/face/poly';
import { bundle } from './helpers-structure';

const OPEN_SMILE = { mouth: { open: 0.8, gums: 1 }, deform: { expression: { smile: 1, grimace: 0.6 } } };

describe('bouche — éléments individualisés (T7)', () => {
  it('lèvres, arc de Cupidon, commissures, cavité, dents, gencive, langue, plis : tous présents quand la bouche est ouverte et retroussée', () => {
    const m = bundle(OPEN_SMILE).mouth;
    expect(m.upperLip.length).toBeGreaterThan(10);
    expect(m.lowerLip.length).toBeGreaterThan(10);
    expect(m.cupid.peakLeft.x).toBeLessThan(m.cupid.dip.x);
    expect(m.cupid.peakRight.x).toBeGreaterThan(m.cupid.dip.x);
    expect(m.corners.left.x).toBeLessThan(0);
    expect(m.corners.right.x).toBeGreaterThan(0);
    expect(m.cavity.length).toBeGreaterThan(10);
    expect(m.upperTeeth.length).toBeGreaterThan(4);
    expect(m.lowerTeeth.length).toBeGreaterThan(4);
    expect(m.gums.length).toBeGreaterThan(4);
    expect(m.tongue.length).toBeGreaterThan(4);
    expect(m.folds.left.length).toBeGreaterThan(3);
  });

  it('fermée : ni cavité, ni dents, ni langue', () => {
    const m = bundle({ mouth: { open: 0 } }).mouth;
    expect([m.cavity.length, m.upperTeeth.length, m.lowerTeeth.length, m.tongue.length]).toEqual([0, 0, 0, 0]);
  });

  it('l\'arc de Cupidon a un creux au centre (profondeur) et deux pics (largeur) ; le tubercule descend sur la ligne de fermeture', () => {
    const shallow = bundle({ mouth: { cupid: { depth: 0 } } }).mouth;
    const deep = bundle({ mouth: { cupid: { depth: 1 } } }).mouth;
    expect(deep.cupid.dip.y - deep.cupid.peakRight.y).toBeGreaterThan(shallow.cupid.dip.y - shallow.cupid.peakRight.y);
    const flat = bundle({ mouth: { cupid: { tubercle: 0 } } }).mouth;
    const bump = bundle({ mouth: { cupid: { tubercle: 1 } } }).mouth;
    expect(bump.cupid.tubercle.y).toBeGreaterThan(flat.cupid.tubercle.y);
  });

  it('asymétrie : une commissure plus haute que l\'autre, dans le sens demandé', () => {
    const l = bundle({ mouth: { cornerAsym: -1 } }).mouth.corners;
    const r = bundle({ mouth: { cornerAsym: 1 } }).mouth.corners;
    expect(l.left.y).toBeLessThan(l.right.y);
    expect(r.right.y).toBeLessThan(r.left.y);
  });

  it('la ligne de fermeture ondulée n\'est plus symétrique, la ligne régulière l\'est', () => {
    const asym = (w: number): number => {
      const c = bundle({ mouth: { lineWave: w } }).mouth.closure;
      return Math.max(...c.map((q, i) => Math.abs(q.y - (c[c.length - 1 - i] as { y: number }).y)));
    };
    expect(asym(0)).toBeLessThan(1e-9);
    expect(asym(1)).toBeGreaterThan(0.3);
  });

  it('volume des lèvres : la plénitude règle l\'épaisseur des deux lèvres séparément', () => {
    const a = bundle({ mouth: { upperLip: 0.1, lowerLip: 0.1 } }).mouth.areas;
    const b = bundle({ mouth: { upperLip: 0.9, lowerLip: 0.1 } }).mouth.areas;
    const c = bundle({ mouth: { upperLip: 0.1, lowerLip: 0.9 } }).mouth.areas;
    expect(b.upper).toBeGreaterThan(a.upper * 1.5);
    expect(b.lower).toBeCloseTo(a.lower, 0);
    expect(c.lower).toBeGreaterThan(a.lower * 1.5);
  });
});

describe('bouche — adaptation au visage (T7)', () => {
  it('large sur une mâchoire carrée, étroite sur un menton proéminent, extrême en caricature', () => {
    const square = bundle({ jawWidth: 0.95, mouth: { fit: 1, width: 0.3 } }).mouth.halfWidth;
    const narrowJaw = bundle({ jawWidth: 0.62, mouth: { fit: 1, width: 0.3 } }).mouth.halfWidth;
    expect(square).toBeGreaterThan(narrowJaw);
    // `fit: 0` : la largeur est absolue, la mâchoire ne la change pas.
    expect(bundle({ jawWidth: 0.95, mouth: { fit: 0, width: 0.2 } }).mouth.halfWidth).toBeCloseTo(bundle({ jawWidth: 0.62, mouth: { fit: 0, width: 0.2 } }).mouth.halfWidth, 6);
    // Étroite : la largeur demandée est respectée sous la borne du contour.
    expect(bundle({ chin: { projection: 0.95 }, mouth: { width: 0.18 } }).mouth.halfWidth).toBeLessThan(square);
    // Caricature : la bouche reste dans le contour (80 % de la demi-largeur), même poussée au maximum.
    const { mouth, lm } = bundle({ stylization: { mouthSize: 1 }, mouth: { width: 0.5 }, deform: { expression: { grimace: 1, caricature: 1 } } });
    expect(mouth.halfWidth).toBeLessThanOrEqual(0.8 * lm.W / 2 + 1e-6);
  });
});

describe('bouche — articulation : la lèvre inférieure suit la mandibule (T11)', () => {
  it('la lèvre inférieure descend plus au centre qu\'aux commissures (poids d\'attache), pas uniformément', () => {
    const m = bundle({ mouth: { open: 0.8 } }).mouth;
    const mid = (m.closure.length - 1) / 2;
    const drop = (i: number): number => (m.lowerLip[i] as { y: number }).y - (m.closure[i] as { y: number }).y;
    expect(drop(mid)).toBeGreaterThan(drop(1) * 2);
    expect(drop(1)).toBeGreaterThan(0);
  });

  it('la translation latérale de la mandibule déplace les dents inférieures et PAS les supérieures', () => {
    const rest = bundle({ mouth: { open: 0.8 } }).mouth;
    const shifted = bundle({ mouth: { open: 0.8 }, deform: { articulation: { jawShift: 1 } } }).mouth;
    const cx = (poly: readonly { x: number }[]): number => poly.reduce((s, q) => s + q.x, 0) / poly.length;
    expect(cx(shifted.lowerTeeth) - cx(rest.lowerTeeth)).toBeGreaterThan(3);
    expect(cx(shifted.upperTeeth)).toBeCloseTo(cx(rest.upperTeeth), 9);
  });

  it('la protrusion remonte la denture inférieure vers la supérieure', () => {
    const rest = bundle({ mouth: { open: 0.8 } }).mouth;
    const out = bundle({ mouth: { open: 0.8 }, deform: { articulation: { protrusion: 1 } } }).mouth;
    expect(out.lowerTeethY).toBeLessThan(rest.lowerTeethY);
  });

  it('l\'ouverture abaisse les dents inférieures de façon monotone et laisse les supérieures en place', () => {
    const ys = [0.3, 0.6, 0.9].map((open) => bundle({ mouth: { open } }).mouth);
    expect(ys[1]!.lowerTeethY).toBeGreaterThan(ys[0]!.lowerTeethY);
    expect(ys[2]!.lowerTeethY).toBeGreaterThan(ys[1]!.lowerTeethY);
    expect(ys[1]!.upperTeethTopY).toBeCloseTo(ys[0]!.upperTeethTopY, 9);
  });
});

describe('bouche — maintien du volume (H)', () => {
  it('élargir la bouche par l\'expression amincit les lèvres dans le même rapport (aire conservée à ±4 %)', () => {
    const narrow = { mouth: { width: 0.2 } };
    const rest = bundle(narrow).mouth;
    for (const e of [{ smile: 1 }, { grimace: 1 }, { smile: 1, caricature: 1 }]) {
      const m = bundle({ ...narrow, deform: { expression: e } }).mouth;
      expect(m.widthScale, JSON.stringify(e)).toBeGreaterThan(1.02);
      const ratio = (m.areas.upper + m.areas.lower) / (rest.areas.upper + rest.areas.lower);
      expect(ratio, JSON.stringify(e)).toBeGreaterThan(0.96);
      expect(ratio, JSON.stringify(e)).toBeLessThan(1.04);
    }
    // Garde-fou : l'aire d'un polygone de lèvre est bien mesurée (non nulle).
    expect(Math.abs(polyArea(rest.upperLip))).toBeGreaterThan(50);
  });
});

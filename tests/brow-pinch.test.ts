import { describe, expect, it } from 'vitest';
import { browGeometry, openingGeometry } from '../src/geometry/eye';
import { EyeSpec } from '../src/schema';

const eye = (over: Record<string, unknown> = {}) => EyeSpec.parse({ id: 'e', kind: 'eye', ...over });

/** Sourcil résolu pour un pinch et un outerSide donnés, sur un œil sinon neutre. */
function brow(pinch: number, outerSide: 'left' | 'right' = 'right') {
  const e = eye({ shape: { outerSide }, eyebrow: { pinch } });
  const g = openingGeometry(e.shape, e.canthi);
  const b = browGeometry(g, e.eyebrow as NonNullable<typeof e.eyebrow>, e.lids.crease.height);
  return { g, b, headX: b.center[0]?.x as number, headY: b.center[0]?.y as number };
}

describe('pinch : géométrie pure (browGeometry)', () => {
  it('pinch=0 : comportement identique à avant (référence, aucune régression)', () => {
    const { g, headX } = brow(0);
    // Tête = xMid - s*len/2, avec xMid = s*w*0.05, s=+1 (outerSide right)
    const lenPx = 1.1 * g.w; // eyebrow.length par défaut = 1.1
    expect(headX).toBeCloseTo(g.w * 0.05 - lenPx / 2, 6);
  });

  it('pinch positif rapproche la tête du sourcil du nez ET l\'abaisse (outerSide=right)', () => {
    const zero = brow(0, 'right');
    const pinched = brow(0.6, 'right');
    // "right" => s=+1 => le nez est du côté x négatif (canthus interne à -w/2) ; se rapprocher du
    // nez, et même le dépasser légèrement, signifie donc un x PLUS NÉGATIF.
    expect(pinched.headX).toBeLessThan(zero.headX);
    expect(pinched.headY).toBeGreaterThan(zero.headY); // plus bas (y augmente vers le bas)
  });

  it('pinch négatif écarte la tête du sourcil du nez ET la relève', () => {
    const zero = brow(0, 'right');
    const spread = brow(-0.6, 'right');
    expect(spread.headX).toBeGreaterThan(zero.headX);
    expect(spread.headY).toBeLessThan(zero.headY);
  });

  it('effet miroir exact entre outerSide=left et outerSide=right (même pinch, symétrie parfaite)', () => {
    const r = brow(0.6, 'right');
    const l = brow(0.6, 'left');
    // Les deux têtes doivent être à la même distance de leur propre canthus interne respectif,
    // et se rapprocher chacune de LEUR nez : symétrie miroir en x, égalité stricte en y.
    expect(l.headX).toBeCloseTo(-r.headX, 6);
    expect(l.headY).toBeCloseTo(r.headY, 6);
  });

  it("l'effet est monotone en fonction du pinch (x décroît, y croît, quand pinch croît)", () => {
    const rows = [-1, -0.5, 0, 0.5, 1].map((p) => brow(p, 'right'));
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]?.headX as number).toBeLessThan(rows[i - 1]?.headX as number);
      expect(rows[i]?.headY as number).toBeGreaterThan(rows[i - 1]?.headY as number);
    }
  });

  it('ne casse rien aux bornes extrêmes combinées (pinch=±1, arch=1, taper=1, gap=0 ou 1)', () => {
    for (const pinch of [-1, 1]) {
      for (const gap of [0, 1]) {
        const e = eye({ eyebrow: { pinch, gap, arch: 1, taper: 1, tiltDeg: 30 } });
        const g = openingGeometry(e.shape, e.canthi);
        const b = browGeometry(g, e.eyebrow as NonNullable<typeof e.eyebrow>, e.lids.crease.height);
        for (const p of b.outline) {
          expect(Number.isFinite(p.x)).toBe(true);
          expect(Number.isFinite(p.y)).toBe(true);
        }
      }
    }
  });
});

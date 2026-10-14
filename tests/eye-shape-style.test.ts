import { describe, expect, it } from 'vitest';
import { openingGeometry } from '../src/geometry/eye';
import { compileScene, EyeSpec } from '../src';

const STYLES = ['almond', 'round', 'sharp', 'drooping'] as const;

const eye = (over: Record<string, unknown> = {}) => EyeSpec.parse({ id: 'e', kind: 'eye', ...over });
function svgOf(input: unknown): string {
  const r = compileScene(input);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
}

describe('shape.style : non-régression et couverture', () => {
  it("'almond' (défaut) produit EXACTEMENT la même géométrie qu'avant l'introduction des styles", () => {
    const g = openingGeometry(eye().shape, eye().canthi);
    // Référence figée : dérivée de la formule d'origine pour les valeurs par défaut
    // (width=200, height=120, upperFraction=0.62, openness=1, tiltDeg=6, roundness=0.4 par défaut).
    expect(g.pi.x).toBeCloseTo(-100, 6);
    expect(g.po.x).toBeCloseTo(100, 6);
    expect(g.u2.y).toBeCloseTo(g.po.y - (4 / 3) * (120 * 0.62), 6);
  });

  it('chaque style produit une géométrie VALIDE (bbox finie, non dégénérée) à tous les réglages par défaut', () => {
    for (const style of STYLES) {
      const g = openingGeometry(eye({ shape: { style } }).shape, eye().canthi);
      expect(Number.isFinite(g.bbox.x)).toBe(true);
      expect(Number.isFinite(g.bbox.y)).toBe(true);
      expect(g.bbox.w).toBeGreaterThan(0);
      expect(g.bbox.h).toBeGreaterThan(0);
    }
  });

  it('les 4 styles produisent 4 géométries VISUELLEMENT DISTINCTES entre elles (aucune paire identique)', () => {
    const geoms = STYLES.map((style) => openingGeometry(eye({ shape: { style } }).shape, eye().canthi));
    for (let i = 0; i < geoms.length; i++) {
      for (let j = i + 1; j < geoms.length; j++) {
        expect(geoms[i]).not.toEqual(geoms[j]);
      }
    }
  });

  it('le canthus INTERNE (pi, u1, l2) est identique entre almond/sharp/drooping (seul l\'externe change)', () => {
    const base = eye().canthi;
    const shapeOf = (style: (typeof STYLES)[number]) => eye({ shape: { style } }).shape;
    const gAlmond = openingGeometry(shapeOf('almond'), base);
    const gSharp = openingGeometry(shapeOf('sharp'), base);
    const gDroop = openingGeometry(shapeOf('drooping'), base);
    for (const g of [gSharp, gDroop]) {
      expect(g.pi).toEqual(gAlmond.pi);
      expect(g.u1).toEqual(gAlmond.u1);
      expect(g.l2).toEqual(gAlmond.l2);
    }
  });

  it("'sharp' relève le coin externe (po.y plus négatif) par rapport à 'almond', 'drooping' l'abaisse", () => {
    const base = eye().canthi;
    const almond = openingGeometry(eye({ shape: { style: 'almond' } }).shape, base);
    const sharp = openingGeometry(eye({ shape: { style: 'sharp' } }).shape, base);
    const droop = openingGeometry(eye({ shape: { style: 'drooping' } }).shape, base);
    expect(sharp.po.y).toBeLessThan(almond.po.y);
    expect(droop.po.y).toBeGreaterThan(almond.po.y);
  });

  it("l'effet de 'sharp'/'drooping' sur po.y est symétrique en miroir entre outerSide left/right", () => {
    for (const style of ['sharp', 'drooping'] as const) {
      const right = openingGeometry(eye({ shape: { style, outerSide: 'right' } }).shape, eye().canthi);
      const left = openingGeometry(eye({ shape: { style, outerSide: 'left' } }).shape, eye().canthi);
      expect(left.po.y).toBeCloseTo(right.po.y, 6); // même écart vertical, quel que soit le côté externe
      expect(left.po.x).toBeCloseTo(-right.po.x, 6);
    }
  });

  it("'round' est plus large en bbox verticale que 'almond', à hauteur nominale égale (silhouette plus bulbeuse)", () => {
    const almond = openingGeometry(eye({ shape: { style: 'almond' } }).shape, eye().canthi);
    const round = openingGeometry(eye({ shape: { style: 'round' } }).shape, eye().canthi);
    expect(round.bbox.h).toBeGreaterThan(almond.bbox.h);
  });

  it('se rend sans NaN/Infinity pour chaque style, combiné aux réglages extrêmes (canthi, tilt, openness)', () => {
    for (const style of STYLES) {
      const svg = svgOf({
        objects: [
          {
            kind: 'eye',
            id: 'e',
            shape: { style, tiltDeg: -30, openness: 0.05, upperFraction: 0.4 },
            canthi: { inner: { roundness: 1 }, outer: { roundness: 0 } },
          },
        ],
      });
      expect(svg).not.toMatch(/NaN|Infinity/);
    }
    for (const style of STYLES) {
      const svg = svgOf({
        objects: [
          {
            kind: 'eye',
            id: 'e',
            shape: { style, tiltDeg: 30, openness: 1.2, upperFraction: 0.8 },
            canthi: { inner: { roundness: 0 }, outer: { roundness: 1 } },
          },
        ],
      });
      expect(svg).not.toMatch(/NaN|Infinity/);
    }
  });

  it('reste cohérent avec le pli épicanthique et le pli palpébral, pour chaque style (aucun crash, aucun NaN)', () => {
    for (const style of STYLES) {
      const svg = svgOf({
        objects: [
          {
            kind: 'eye',
            id: 'e',
            shape: { style },
            epicanthicFold: { amount: 1, reach: 1 },
            lids: { crease: { height: 0.4, depth: 1 } },
          },
        ],
      });
      expect(svg).not.toMatch(/NaN|Infinity/);
    }
  });

  it(
    "'sharp' et 'drooping' restent une silhouette localisée : la bbox ne gonfle jamais " +
      "disproportionnellement avec la hauteur (régression — voir docs/ERRORS.md #8 : le coin " +
      "externe s'échappait jusqu'à ~2,7x la hauteur nominale sur un œil haut avant correction)",
    () => {
      for (const style of ['sharp', 'drooping'] as const) {
        for (const [width, height] of [
          [200, 120],
          [320, 220],
          [180, 300],
          [400, 160],
        ] as const) {
          const g = openingGeometry(eye({ shape: { width, height, style } }).shape, eye().canthi);
          // La bbox verticale reste un multiple RAISONNABLE de la hauteur nominale, quelle que soit
          // la taille de l'œil — c'est exactement l'invariant que l'ancienne formule violait (le
          // ratio grandissait avec la hauteur au lieu de rester constant).
          expect(g.bbox.h).toBeLessThan(height * 1.1);
        }
      }
    },
  );

  it('est rejeté par le schéma si la valeur ne fait pas partie de l\'énumération', () => {
    const r = EyeSpec.safeParse({ id: 'e', kind: 'eye', shape: { style: 'chibi' } });
    expect(r.success).toBe(false);
  });
});

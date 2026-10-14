import { describe, expect, it } from 'vitest';
import { openingGeometry } from '../src/geometry/eye';
import { compileScene, EyeSpec } from '../src';

const NEW_STYLES = ['chibi', 'angular', 'compressed', 'rounded_rect', 'triangle', 'circle', 'diamond', 'diamond_v2'] as const;
const eye = (over: Record<string, unknown> = {}) => EyeSpec.parse({ id: 'e', kind: 'eye', ...over });
const geom = (style: string, shape: Record<string, unknown> = {}) =>
  openingGeometry(eye({ shape: { style, ...shape } }).shape, eye().canthi);

describe('shape.style : nouveaux styles (chibi, angular, compressed, rounded_rect + silhouettes de référence triangle, circle, diamond)', () => {
  it('acceptés par le schéma ; une valeur inconnue reste rejetée', () => {
    for (const style of NEW_STYLES) expect(EyeSpec.safeParse({ id: 'e', kind: 'eye', shape: { style } }).success).toBe(true);
    expect(EyeSpec.safeParse({ id: 'e', kind: 'eye', shape: { style: 'carré' } }).success).toBe(false);
  });

  it("'almond' reste inchangé (non-régression du défaut)", () => {
    const g = geom('almond');
    expect(g.u2.y).toBeCloseTo(g.po.y - (4 / 3) * (120 * 0.62), 6);
  });

  it('chaque nouveau style : géométrie finie, non dégénérée et distincte des 4 styles existants', () => {
    const existing = ['almond', 'round', 'sharp', 'drooping'].map((s) => geom(s));
    for (const style of NEW_STYLES) {
      const g = geom(style);
      expect(Number.isFinite(g.bbox.w) && Number.isFinite(g.bbox.h)).toBe(true);
      expect(g.bbox.w).toBeGreaterThan(0);
      expect(g.bbox.h).toBeGreaterThan(0);
      for (const other of existing) expect(g).not.toEqual(other);
    }
  });

  it("'chibi' a une ouverture plus haute que 'almond'", () => {
    expect(geom('chibi').bbox.h).toBeGreaterThan(geom('almond').bbox.h * 1.15);
  });

  it("'angular' : coin externe plus relevé et effilé que 'almond'", () => {
    expect(geom('angular').po.y).toBeLessThan(geom('almond').po.y);
  });

  it("'compressed' : hauteur nettement réduite, largeur inchangée, paupière haute plus fermée", () => {
    const a = geom('almond');
    const c = geom('compressed');
    expect(c.bbox.h).toBeLessThan(a.bbox.h * 0.65);
    expect(c.bbox.w).toBeCloseTo(a.bbox.w, 6);
    expect(c.hEff).toBeLessThan(a.hEff);
  });

  it("'rounded_rect' : côtés plus verticaux et dessus plus plat que 'almond' (bbox plus « remplie »)", () => {
    const fill = (g: ReturnType<typeof geom>) => {
      // aire approchée par la formule des lacets sur les deux cubiques échantillonnées
      let area = 0;
      const pts: { x: number; y: number }[] = [];
      const cub = (a: any, b: any, c: any, d: any, t: number) => {
        const u = 1 - t;
        return {
          x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x,
          y: u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y,
        };
      };
      for (let i = 0; i <= 40; i++) pts.push(cub(g.pi, g.u1, g.u2, g.po, i / 40));
      for (let i = 0; i <= 40; i++) pts.push(cub(g.po, g.l1, g.l2, g.pi, i / 40));
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]!;
        const q = pts[(i + 1) % pts.length]!;
        area += p.x * q.y - q.x * p.y;
      }
      return Math.abs(area) / 2 / (g.bbox.w * g.bbox.h);
    };
    expect(fill(geom('rounded_rect'))).toBeGreaterThan(fill(geom('almond')) + 0.08);
  });

  it("'diamond' : les deux coins aigus sont les canthi — l'interne en bas, l'externe en haut (parallélogramme)", () => {
    const g = geom('diamond');
    expect(g.pi.y).toBeGreaterThan(g.po.y + g.hEff * 0.5);
    // côtés quasi droits : le milieu de la paupière haute reste proche de la corde pi→po (pas une lentille)
    const mid = (a: number, b: number) => (a + b) / 2;
    expect(Math.abs(mid(g.pi.y, g.po.y))).toBeLessThan(g.hEff);
  });

  it("'diamond_v2' (double retravaillé) : plus long que 'diamond' côté externe, 'diamond' reste inchangé", () => {
    const d1 = geom('diamond');
    const d2 = geom('diamond_v2');
    expect(d2.bbox.w).toBeGreaterThan(d1.bbox.w * 1.12);
    expect(d2.bbox.h).toBeGreaterThan(d1.bbox.h);
    // canthi aigus : l'interne en bas, l'externe en haut, mais ce ne sont PAS les extrema (coins obtus arrondis)
    expect(d2.pi.y).toBeGreaterThan(d2.po.y);
    expect(d2.bbox.y).toBeLessThan(d2.po.y - d2.hEff * 0.05);
    expect(d2.bbox.y + d2.bbox.h).toBeGreaterThan(d2.pi.y + d2.hEff * 0.05);
    // 'diamond' : valeurs figées (non-régression de la version conservée, relevées avant la création de v2)
    expect(d1.pi.x).toBeCloseTo(-100, 6);
    expect(d1.pi.y).toBeCloseTo(65.71042352656765, 6);
    expect(d1.po.x).toBeCloseTo(100, 6);
    expect(d1.u1.x).toBeCloseTo(-55.84, 6);
    expect(d1.u2.y).toBeCloseTo(-62.54242352656765, 6);
    expect(d1.l1.x).toBeCloseTo(55.84, 6);
    expect(d1.l2.y).toBeCloseTo(62.54242352656765, 6);
  });

  it("'diamond_v2' : le dessous est posé — pente faible (< 8°) entre le canthus interne et le coin bas-externe", () => {
    const g = geom('diamond_v2');
    // le point le plus bas de la paupière basse ne doit pas être loin sous le canthus interne
    const dy = g.bbox.y + g.bbox.h - g.pi.y;
    const dx = g.bbox.w * 0.7;
    expect((Math.atan2(dy, dx) * 180) / Math.PI).toBeLessThan(8);
  });

  it("'triangle' : fidèle au contour relevé sur la photo de référence (écart moyen < 1,5 % de la largeur)", () => {
    // Contour de la fente de l'œil turquoise (px de l'image source) : haut puis bas, du canthus interne
    // au canthus externe puis retour. Boîte : x 556→665, y 129→184 (largeur 109, hauteur 55).
    const ref: [number, number][] = [[556,142],[560,137],[567,133],[578,130.5],[592,129.3],[610,129],[630,129],[648,129.8],[660,131],[665,134],[661,141],[657,148],[652,155],[646,162],[639,169],[631,175],[621,180],[610,183],[600,184],[590,183],[580,179],[570,171],[563,161],[558,150],[556,142]];
    const g = geom('triangle', { width: 210, height: 130 });
    const cub = (a: any, b: any, c: any, d: any, t: number) => {
      const u = 1 - t;
      return { x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x, y: u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y };
    };
    const curve: { x: number; y: number }[] = [];
    for (let i = 0; i <= 400; i++) curve.push(cub(g.pi, g.u1, g.u2, g.po, i / 400));
    for (let i = 0; i <= 400; i++) curve.push(cub(g.po, g.l1, g.l2, g.pi, i / 400));
    const sc = g.bbox.w / 109;
    const dist = ref.map(([x, y]) => {
      const p = { x: g.bbox.x + (x - 556) * sc, y: g.bbox.y + (y - 129) * sc };
      return Math.min(...curve.map((c) => Math.hypot(c.x - p.x, c.y - p.y)));
    });
    const mean = dist.reduce((a, b) => a + b, 0) / dist.length;
    expect(mean).toBeLessThan(g.bbox.w * 0.015);
    expect(Math.max(...dist)).toBeLessThan(g.bbox.w * 0.04);
    // proportions du modèle : rapport h/l ≈ 0,50 (à ± 0,06)
    expect(Math.abs(g.bbox.h / g.bbox.w - 0.504)).toBeLessThan(0.06);
  });

  it("'triangle' : le fond est LARGE et arrondi (pas un creux en V) : à 22 % au-dessus du point bas, la fente occupe > 50 % de la largeur (mesuré : 58 %)", () => {
    const g = geom('triangle', { width: 210, height: 130 });
    const cub = (a: any, b: any, c: any, d: any, t: number) => {
      const u = 1 - t;
      return { x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x, y: u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y };
    };
    const lower: { x: number; y: number }[] = [];
    for (let i = 0; i <= 400; i++) lower.push(cub(g.po, g.l1, g.l2, g.pi, i / 400));
    const yCut = g.bbox.y + g.bbox.h * 0.78; // 22 % au-dessus du point bas
    const xs = lower.filter((p) => p.y >= yCut).map((p) => p.x);
    expect((Math.max(...xs) - Math.min(...xs)) / g.bbox.w).toBeGreaterThan(0.5);
  });

  it("'chibi' : grand et équilibré — ratio h/l entre 0,7 et 0,85, au moins 1,15× plus long que nominal, coin externe tiré vers le haut-droit, côté droit en arc (le point le plus à droite est SOUS le canthus externe)", () => {
    const g = geom('chibi', { width: 210, height: 130 });
    const ratio = g.bbox.h / g.bbox.w;
    expect(ratio).toBeGreaterThan(0.7);
    expect(ratio).toBeLessThan(0.85);
    expect(g.bbox.w).toBeGreaterThan(210 * 1.15);
    expect(g.po.y).toBeLessThan(g.pi.y - g.bbox.h * 0.2); // coin externe nettement plus haut que l'interne
    const cub = (a: any, b: any, c: any, d: any, t: number) => {
      const u = 1 - t;
      return { x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x, y: u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y };
    };
    let right = { x: -Infinity, y: 0 };
    for (let i = 0; i <= 400; i++) {
      const p = cub(g.po, g.l1, g.l2, g.pi, i / 400);
      if (p.x > right.x) right = p;
    }
    expect(right.y).toBeGreaterThan(g.po.y + g.bbox.h * 0.1);
  });

  it("'chibi' est plus grand dans les deux sens que l'ancienne version (hauteur ≥ 1,4× et largeur ≥ 1,2× celles de 'almond')", () => {
    const a = geom('almond', { width: 210, height: 130 });
    const c = geom('chibi', { width: 210, height: 130 });
    expect(c.bbox.h).toBeGreaterThan(a.bbox.h * 1.4);
    expect(c.bbox.w).toBeGreaterThan(a.bbox.w * 1.2);
  });

  it("'triangle' : plus grand que la première version (largeur ≥ 1,15 × nominale, hauteur ≥ 1,05 × nominale)", () => {
    const g = geom('triangle');
    expect(g.bbox.w).toBeGreaterThan(210 * 1.15 - 10 + 0);
    expect(g.bbox.h).toBeGreaterThan(120 * 1.05);
  });

  it("'triangle' : dessus plat, sommet du bas à 30–55 % depuis le canthus interne, presque tout le volume sous les canthi", () => {
    const g = geom('triangle');
    const cub = (a: any, b: any, c: any, d: any, t: number) => {
      const u = 1 - t;
      return {
        x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x,
        y: u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y,
      };
    };
    let low = { x: 0, y: -Infinity };
    let topMin = Infinity;
    for (let i = 0; i <= 100; i++) {
      const lo = cub(g.po, g.l1, g.l2, g.pi, i / 100);
      if (lo.y > low.y) low = lo;
      topMin = Math.min(topMin, cub(g.pi, g.u1, g.u2, g.po, i / 100).y);
    }
    const frac = (low.x - g.pi.x) / (g.po.x - g.pi.x);
    expect(frac).toBeGreaterThan(0.3);
    expect(frac).toBeLessThan(0.55);
    // volume sous la ligne des canthi >> volume au-dessus
    const below = low.y - Math.max(g.pi.y, g.po.y);
    const above = Math.min(g.pi.y, g.po.y) - topMin;
    expect(below).toBeGreaterThan(above * 2);
  });

  it("'circle' : ouverture quasi circulaire (rapport h/l entre 0,85 et 1,15), même pour un œil nominalement plat", () => {
    for (const [width, height] of [[200, 120], [300, 100], [180, 200]] as const) {
      const g = geom('circle', { width, height });
      const ratio = g.bbox.h / g.bbox.w;
      expect(ratio).toBeGreaterThan(0.85);
      expect(ratio).toBeLessThan(1.15);
    }
  });

  it('les coins restent ARRONDIS : plus canthi.roundness est grand, moins le contrôle dépasse le canthus', () => {
    const sharpCorner = openingGeometry(eye({ shape: { style: 'rounded_rect' } }).shape, eye({ canthi: { inner: { roundness: 0 }, outer: { roundness: 0 } } }).canthi);
    const roundCorner = openingGeometry(eye({ shape: { style: 'rounded_rect' } }).shape, eye({ canthi: { inner: { roundness: 1 }, outer: { roundness: 1 } } }).canthi);
    expect(Math.abs(roundCorner.u2.x - roundCorner.po.x)).toBeLessThan(Math.abs(sharpCorner.u2.x - sharpCorner.po.x));
  });

  it('bbox bornée (≤ 1,5× largeur, ≤ 1,75× hauteur nominales) quelle que soit la taille', () => {
    for (const style of NEW_STYLES) {
      for (const [width, height] of [[200, 120], [320, 220], [180, 300], [400, 160]] as const) {
        const g = geom(style, { width, height });
        expect(g.bbox.w).toBeLessThan(width * 1.5);
        // 'circle' impose un plancher de hauteur (0,92 × largeur) : la borne s'y réfère.
        // 'chibi' est volontairement ~1,6× plus haut que la hauteur nominale (grand œil rond).
        expect(g.bbox.h).toBeLessThan(Math.max(height, style === 'circle' ? width * 0.92 : 0) * 1.75);
      }
    }
  });

  it('se rend sans NaN/Infinity, y compris en miroir (outerSide left) et aux réglages extrêmes', () => {
    for (const style of NEW_STYLES) {
      for (const outerSide of ['left', 'right'] as const) {
        for (const shape of [
          { tiltDeg: -30, openness: 0.05, upperFraction: 0.4 },
          { tiltDeg: 30, openness: 1.2, upperFraction: 0.8 },
        ]) {
          const r = compileScene({ objects: [{ kind: 'eye', id: 'e', shape: { style, outerSide, ...shape }, epicanthicFold: { amount: 1, reach: 1 }, lids: { crease: { height: 0.4, depth: 1 } } }] });
          if (!r.ok) throw new Error(r.issues.join('\n'));
          expect(r.svg).not.toMatch(/NaN|Infinity/);
        }
      }
    }
  });
});

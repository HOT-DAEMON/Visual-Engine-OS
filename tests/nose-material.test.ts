import { describe, expect, it } from 'vitest';
import { changedOutside, lumaSd, meanIn, noseShot } from './helpers-nose-material';

/**
 * Matériau PROPRE AU NEZ (`skinMaterial.noseDetail` : `tipShine`, `alarBlush`). Chaque axe est mesuré sur des PIXELS rendus (gros plan du nez, peau seule),
 * pas sur des paramètres : effet monotone, localisé dans le nez, indépendant de l'autre axe, et nul à 0 (rendu d'avant). Détails : docs/NOSE-MATERIAL.md.
 */
const SEEDS = [11, 77, 1203]; // 405 et 5 font paniquer resvg (geom.rs) dans ce gros plan, AVANT comme après le matériau : voir docs/NOSE-MATERIAL.md
const luma = (c: number[]): number => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
const boxOf = (s: ReturnType<typeof noseShot>) => ({ x0: s.tip.x - s.alae[1]!.rx - 40, x1: s.tip.x + s.alae[1]!.rx + 40, y0: 0, y1: s.h });

describe('matériau propre au nez', () => {
  it('à 0 (et par défaut) : le SVG est identique à celui sans le contrat', () => {
    const a = noseShot(11, {}), b = noseShot(11, { tipShine: 0, alarBlush: 0 });
    expect(b.svg).toBe(a.svg);
  });
  for (const seed of SEEDS) describe(`graine ${seed}`, () => {
    const base = noseShot(seed, {});
    it('tipShine : la pointe s\'éclaircit de façon monotone, plus de texture lumineuse, rien ailleurs', () => {
      const m = [0.5, 1].map((v) => { const s = noseShot(seed, { tipShine: v }); return { s, l: luma(meanIn(s, s.tip)) }; });
      const l0 = luma(meanIn(base, base.tip));
      expect(m[0]!.l).toBeGreaterThan(l0 + 2);
      expect(m[1]!.l).toBeGreaterThan(m[0]!.l + 1);
      expect(m[1]!.l - l0).toBeLessThan(0.15 * l0); // un reflet de peau, pas du métal
      expect(lumaSd(m[1]!.s, m[1]!.s.tip)).toBeGreaterThan(lumaSd(base, base.tip) + 2);
      expect(changedOutside(base, m[1]!.s, boxOf(base)).outsideShare).toBe(0);
      expect(Math.abs(luma(meanIn(m[1]!.s, m[1]!.s.alae[1]!)) - luma(meanIn(base, base.alae[1]!)))).toBeLessThan(1.5);
    });
    it('alarBlush : les ailes rougissent de façon monotone (R−G), la pointe ne bouge pas, rien hors du nez', () => {
      const red = (s: typeof base, e: typeof base.tip) => { const c = meanIn(s, e); return c[0] - c[1]; };
      const r0 = red(base, base.alae[1]!), r5 = red(noseShot(seed, { alarBlush: 0.5 }), base.alae[1]!);
      const s1 = noseShot(seed, { alarBlush: 1 }), r1 = red(s1, base.alae[1]!);
      expect(r5).toBeGreaterThan(r0 + 0.5);
      expect(r1).toBeGreaterThan(r5 + 0.5);
      expect(red(s1, base.alae[0]!)).toBeGreaterThan(red(base, base.alae[0]!) + 1.5); // les deux ailes
      expect(Math.abs(luma(meanIn(s1, s1.tip)) - luma(meanIn(base, base.tip)))).toBeLessThan(1); // débordement sur la pointe mesuré ≤ 0,54 (graines 11, 77, 1203)
      expect(changedOutside(base, s1, boxOf(base)).outsideShare).toBeLessThan(0.05); // mesuré 0,016 à 0,032 : le bord doux de la tache dépasse un peu la boîte des ailes + 40 px
      expect(Math.abs(luma(meanIn(s1, s1.alae[1]!)) - luma(meanIn(base, base.alae[1]!)))).toBeLessThan(0.1 * luma(meanIn(base, base.alae[1]!))); // même ton de peau
    });
  });
}, 240_000);

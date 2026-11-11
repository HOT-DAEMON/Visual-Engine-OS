import { describe, expect, it } from 'vitest';
import { diffField, distTo, mass, reliefOf, type Relief } from './helpers-nose-relief';
import { inPoly } from '../src/face/poly';

/**
 * Le nez dans le moteur d'éclairage unique : chaque axe du nez doit produire une différence de RELIEF visible (en pixels de profondeur)
 * et LOCALISÉE dans sa propre région. Un axe sans effet, ou dont l'effet fuit ailleurs, ferait du nez une collection de paramètres théoriques.
 * Zones : définies à partir de la géométrie de régions du nez de base (celle que le relief lit).
 */
const base = reliefOf({});
const R = base.nose.regions, N = base.nose;
const ellipse = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number): boolean => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
const box = (poly: { x: number; y: number }[]) => { const xs = poly.map((q) => q.x), ys = poly.map((q) => q.y); return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2, rx: (Math.max(...xs) - Math.min(...xs)) / 2, ry: (Math.max(...ys) - Math.min(...ys)) / 2 }; };
const alaZones = [N.alae.left, N.alae.right].map((a) => { const b = box(a.poly); return ellipse(b.cx, b.cy, b.rx * 1.75, b.ry * 1.75); });

interface Case { readonly axis: string; readonly lo: Record<string, unknown>; readonly hi: Record<string, unknown>; readonly zone: (x: number, y: number) => boolean; readonly minMax: number }
const CASES: Case[] = [
  { axis: 'sidewall.slope (palier des parois)', lo: { nose: { sidewall: { slope: 0.05 } } }, hi: { nose: { sidewall: { slope: 0.95 } } }, zone: (x, y) => Math.abs(x) < N.widthPx * 0.6 && y > N.root.y && y < N.tip.c.y + 10, minMax: 8 },
  { axis: 'sidewall.concavity (gouttière)', lo: { nose: { sidewall: { concavity: 0 } } }, hi: { nose: { sidewall: { concavity: 1 } } }, zone: (x, y) => [R.sidewalls.left.gutter, R.sidewalls.right.gutter].some((g) => distTo(g, x, y) < 11), minMax: 3 },
  { axis: 'domes.prominence', lo: { nose: { domes: { prominence: 0.05 } } }, hi: { nose: { domes: { prominence: 0.95 } } }, zone: (x, y) => [R.domes.left, R.domes.right].some((d) => ellipse(d.c.x, d.c.y, 2.2 * d.rx, 2.2 * d.ry)(x, y)), minMax: 4 },
  { axis: 'domes.separation (vallée de la pointe)', lo: { nose: { domes: { separation: 0.05 } } }, hi: { nose: { domes: { separation: 0.95 } } }, zone: (x, y) => Math.abs(x) < N.widthPx * 0.5 && Math.abs(y - N.tip.c.y) < N.tip.ry * 2.5, minMax: 2 },
  { axis: 'alae.volume', lo: { nose: { alae: { volume: 0.05 } } }, hi: { nose: { alae: { volume: 0.95 } } }, zone: (x, y) => alaZones.some((z) => z(x, y)), minMax: 3 },
  { axis: 'nostrils.opening (creux des narines)', lo: { nose: { nostrils: { opening: 0.05 } } }, hi: { nose: { nostrils: { opening: 0.95 } } }, zone: (x, y) => [N.nostrils.left, N.nostrils.right].some((n) => Math.hypot(x - n.c.x, y - n.c.y) < 2.2 * n.a), minMax: 2 },
  { axis: 'groove.depth (sillon alaire)', lo: { nose: { groove: { depth: 0 } } }, hi: { nose: { groove: { depth: 1 } } }, zone: (x, y) => [R.grooves.left.line, R.grooves.right.line].some((g) => distTo(g, x, y) < 9), minMax: 3 },
  { axis: 'tip.projection', lo: { nose: { tip: { projection: 0.05 } } }, hi: { nose: { tip: { projection: 0.95 } } }, zone: (x, y) => Math.abs(x) < N.widthPx * 0.8 && y > N.root.y - 8 && y < N.baseY + 14, minMax: 20 },
];

describe('nez → moteur de relief : chaque axe agit sur sa région', () => {
  for (const c of CASES) {
    it(c.axis, () => {
      const d = diffField(reliefOf(c.lo), reliefOf(c.hi));
      const inZ = d.filter((q) => c.zone(q.x, q.y)), outZ = d.filter((q) => !c.zone(q.x, q.y));
      const maxIn = Math.max(0, ...inZ.map((q) => q.d)), maxOut = Math.max(0, ...outZ.map((q) => q.d));
      expect(maxIn, 'effet visible (px de profondeur)').toBeGreaterThan(c.minMax);
      expect(mass(inZ) / mass(d), 'part de l\'effet dans la région').toBeGreaterThan(0.9);
      expect(maxOut, 'fuite hors région (queue gaussienne seulement)').toBeLessThan(0.25 * maxIn);
    });
  }

  it('le nez reste un seul volume : le relief est fini et la région « nez » existe dans le champ', () => {
    const k = (r: Relief): number => { let n = 0; for (let i = 0; i < r.f.region.length; i++) if (r.f.region[i] === 3) n++; return n; };
    expect(k(base)).toBeGreaterThan(300);
    for (let i = 0; i < base.f.depth.length; i++) { const v = base.f.depth[i]!; expect(v === -Infinity || Number.isFinite(v)).toBe(true); }
  });

  it('les narines creusent : au centre d\'une narine, une ouverture forte est plus basse qu\'une ouverture faible (même point, même géométrie)', () => {
    const at = (r: Relief, x: number, y: number): number => r.f.depth[Math.floor((y - r.g.y0) * r.g.ppu) * r.g.w + Math.floor((x - r.g.x0) * r.g.ppu)]!;
    const lo = reliefOf({ nose: { nostrils: { opening: 0.05 } } }), hi = reliefOf({ nose: { nostrils: { opening: 0.95 } } });
    for (const side of ['left', 'right'] as const) { const n = lo.nose.nostrils[side]; expect(at(hi, n.c.x, n.c.y)).toBeLessThan(at(lo, n.c.x, n.c.y) - 1.5); }
  });

  it('un point au centre de l\'ouverture de narine est bien dans la géométrie de la narine (pas de désalignement région ↔ relief)', () => {
    for (const nl of [R.nostrils.left, R.nostrils.right]) {
      const cx = nl.aperture.reduce((s, q) => s + q.x, 0) / nl.aperture.length, cy = nl.aperture.reduce((s, q) => s + q.y, 0) / nl.aperture.length;
      expect(inPoly(nl.aperture, cx, cy)).toBe(true);
    }
  });
});

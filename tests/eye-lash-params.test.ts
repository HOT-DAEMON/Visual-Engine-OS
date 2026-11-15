import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { compileScene, EyeSpec } from '../src';
import { eyeLashSet, openingGeometry, upperFrame } from '../src/geometry/eye';
import { generateExtraEye } from '../src/generation/eye-gallery-ext';

/** Preuve que `bendDeg`, `rootFuse` et `span` (ajoutés pour les références 12–16) sont CONSOMMÉS : géométrie ET pixels ; et que leurs défauts laissent le rendu historique intact. */
const W = 600, H = 400;
const INK = { material: { base: { type: 'solid', color: '#120e18' }, roughness: 0.6 }, opacity: 1, gloss: 0, colorVariation: 0 };
const base = { ...generateExtraEye(6), eyebrow: null } as Record<string, unknown>;
const up = (over: Record<string, unknown>) => ({ ...base, lashes: { upper: { ...INK, count: 12, length: 0.26, thickness: 1.4, curl: 0.5, sweep: 30, tipSharpness: 0.8, ...over }, lower: { count: 0 } } });
function render(eye: Record<string, unknown>): { svg: string; px: Uint8Array } {
  const r = compileScene({ width: W, height: H, background: '#ff00ff', objects: [{ kind: 'eye', id: 'e', transform: { x: W / 2, y: H / 2 }, ...eye }] } as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return { svg: r.svg, px: new Resvg(r.svg, { fitTo: { mode: 'width', value: W } }).render().pixels as unknown as Uint8Array };
}
const diff = (a: Uint8Array, b: Uint8Array): number => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs((a[i] as number) - (b[i] as number)) + Math.abs((a[i + 1] as number) - (b[i + 1] as number)) + Math.abs((a[i + 2] as number) - (b[i + 2] as number)) > 60) n++; return n; };
const lashesOf = (over: Record<string, unknown>, seed = 3) => {
  const e = EyeSpec.parse({ id: 'e', kind: 'eye', seed, shape: { width: 240 }, lashes: { upper: over } });
  const g = openingGeometry(e.shape, e.canthi);
  return { e, g, th: e.lids.thickness * e.shape.height };
};

describe('bendDeg / rootFuse / span : défauts historiques', () => {
  it('les défauts sont 0 / 0 / 0,05–0,95 et les cils restent des quadratiques sans ctrl2', () => {
    const p = EyeSpec.parse({ id: 'e', kind: 'eye' }).lashes.upper;
    expect(p.bendDeg).toBe(0); expect(p.rootFuse).toBe(0); expect(p.span).toEqual({ from: 0.05, to: 0.95 });
    const { e, g, th } = lashesOf({});
    expect(eyeLashSet(e, g, th).upper.every((l) => l.ctrl2 === undefined)).toBe(true);
  });
  it('écrire les défauts explicitement ne change pas un seul octet du SVG', () => {
    expect(render(up({})).svg).toBe(render(up({ bendDeg: 0, rootFuse: 0, span: { from: 0.05, to: 0.95 } })).svg);
  });
  it('span invalide (to − from < 0,04) et bendDeg hors bornes sont refusés', () => {
    expect(EyeSpec.safeParse({ id: 'e', kind: 'eye', lashes: { upper: { span: { from: 0.5, to: 0.52 } } } }).success).toBe(false);
    expect(EyeSpec.safeParse({ id: 'e', kind: 'eye', lashes: { upper: { bendDeg: 90 } } }).success).toBe(false);
  });
});

describe('bendDeg : courbure en S consommée', () => {
  it('bendDeg > 0 donne des cubiques dont la pointe est plus proche de la normale du bord que la tangente de départ', () => {
    const { e, g, th } = lashesOf({ count: 10, length: 0.3, sweep: 45, bendDeg: 40 });
    const ls = eyeLashSet(e, g, th).upper;
    expect(ls.length).toBe(10); expect(ls.every((l) => l.ctrl2 !== undefined)).toBe(true);
    for (const l of ls) {
      const a0 = Math.atan2(l.ctrl.y - l.base.y, l.ctrl.x - l.base.x);
      const a1 = Math.atan2(l.tip.y - (l.ctrl2 as { y: number }).y, l.tip.x - (l.ctrl2 as { x: number }).x);
      expect(Math.abs(a1 - a0)).toBeGreaterThan(0.2);           // la direction a bien tourné (40° nominal, variation par cil)
    }
  });
  it('bendDeg change des pixels (≥ 400) et son signe change le dessin', () => {
    const a = render(up({})).px; const p = render(up({ bendDeg: 35 })).px; const n = render(up({ bendDeg: -35 })).px;
    expect(diff(a, p)).toBeGreaterThan(400); expect(diff(p, n)).toBeGreaterThan(400);
  });
  it('avec bendDeg, curl déplace la courbure (consommé)', () => {
    expect(diff(render(up({ bendDeg: 40, curl: 0.1 })).px, render(up({ bendDeg: 40, curl: 0.9 })).px)).toBeGreaterThan(200);
  });
  it('les mèches (clump) restent valides pour des cils courbes : tout fini, ctrl2 conservé', () => {
    const { e, g, th } = lashesOf({ count: 12, clump: 0.9, clumpSize: 3, bendDeg: 30 });
    const ls = eyeLashSet(e, g, th).upper;
    expect(ls.every((l) => l.ctrl2 && [l.base, l.ctrl, l.ctrl2, l.tip].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)))).toBe(true);
  });
});

describe('rootFuse : racine fondue consommée', () => {
  it('enfonce la racine dans le trait (décalage signé le long de la normale : +0,3 → −0,6 épaisseur) et élargit la base de 80 %', () => {
    const a = lashesOf({ count: 8, rootFuse: 0 }); const b = lashesOf({ count: 8, rootFuse: 1 });
    const la = eyeLashSet(a.e, a.g, a.th).upper; const lb = eyeLashSet(b.e, b.g, b.th).upper;
    const signed = (l: { base: { x: number; y: number } }, g: typeof a.g): number => { let best = 1e9, s = 0; for (let i = 0; i <= 200; i++) { const f = upperFrame(g, i / 200); const d = Math.hypot(f.pos.x - l.base.x, f.pos.y - l.base.y); if (d < best) { best = d; s = (l.base.x - f.pos.x) * f.N.x + (l.base.y - f.pos.y) * f.N.y; } } return s; };
    const mean = (ls: typeof la, x: typeof a): number => ls.reduce((acc, l) => acc + signed(l, x.g), 0) / ls.length;
    expect(mean(la, a) / a.th).toBeCloseTo(0.3, 1); expect(mean(lb, b) / b.th).toBeCloseTo(-0.6, 1);
    expect(lb[0]!.baseWidth).toBeCloseTo(la[0]!.baseWidth * 1.8, 5);
  });
  it('change des pixels (≥ 300)', () => { expect(diff(render(up({})).px, render(up({ rootFuse: 1 })).px)).toBeGreaterThan(300); });
});

describe('span : zone du bord consommée', () => {
  it('toutes les racines tombent dans [from, to] du bord (position mesurée le long de la courbe)', () => {
    const { e, g, th } = lashesOf({ count: 9, span: { from: 0.6, to: 0.98 }, positionDispersion: 0 });
    const ls = eyeLashSet(e, g, th).upper;
    for (const l of ls) {
      let best = 0, d = 1e9;
      for (let i = 0; i <= 200; i++) { const f = upperFrame(g, i / 200); const k = Math.hypot(f.pos.x - l.base.x, f.pos.y - l.base.y); if (k < d) { d = k; best = i / 200; } }
      expect(best).toBeGreaterThan(0.6 - 0.03); expect(best).toBeLessThan(0.98 + 0.03);
    }
  });
  it('change des pixels par rapport à la répartition sur tout le bord', () => { expect(diff(render(up({})).px, render(up({ span: { from: 0.6, to: 0.98 } })).px)).toBeGreaterThan(500); });
});

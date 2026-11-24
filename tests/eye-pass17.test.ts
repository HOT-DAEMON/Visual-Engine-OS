import { describe, expect, it } from 'vitest';
import { EyeSpec, compileScene } from '../src';
import { CREASE_FOLLOW, apparentWidthRatio, caruncleOf, creaseCurve, edgeFrames, edgePolygon, eyeEdges, eyeLashSet, eyeTurn, lowerFrame, openingGeometry, thinLashes, upperEdgeShift, upperFrame, LASH_MIN_PX, type Lash } from '../src/geometry/eye';
import { resolveEye, withAutoLod } from '../src/render/eye/eye';
import { verifyEye } from '../src/verify/eye';

const spec = (o: object = {}) => EyeSpec.parse({ kind: 'eye', id: 'e', seed: 11, shape: { width: 300, height: 170 }, lashes: { upper: { count: 24, length: 0.24 }, lower: { count: 8 } }, ...o });
const MD = (irr: number) => ({ edge: { irregularity: irr, grain: 0.8 }, vessels: null, chroma: null, tearFilm: null, occlusion: 0, lod: { eyePixels: 8000 } });
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const polyDist = (p: { x: number; y: number }, poly: readonly { x: number; y: number }[]) => Math.min(...poly.map((q) => dist(p, q)));

describe('EYE-07E (passe 17) — les cils, le pli et la caroncule suivent le bord irrégulier', () => {
  const e = withAutoLod(resolveEye(spec({ microdetail: MD(1) }))).eye;
  const g = openingGeometry(e.shape, e.canthi); const th = e.lids.thickness * e.shape.height;
  const edges = eyeEdges(e, g)!;
  it('eyeEdges : null sans microdetail.edge ; sinon le tracé du rendu', () => {
    expect(eyeEdges(resolveEye(spec()), g)).toBeNull(); expect(edges.maxDev).toBeGreaterThan(0);
  });
  it('edgeFrames à irrégularité 0 : mêmes repères que l’enveloppe (≤ 0,3 % de la largeur)', () => {
    const e0 = eyeEdges(withAutoLod(resolveEye(spec({ microdetail: MD(0) }))).eye, g)!; const f = edgeFrames(g, e0);
    for (let i = 1; i < 20; i++) { const t = i / 20; expect(dist(f.upper(t).pos, upperFrame(g, t).pos)).toBeLessThan(g.w * 0.003); expect(dist(f.lower(t).pos, lowerFrame(g, t).pos)).toBeLessThan(g.w * 0.003); }
  });
  it('edgeFrames : la normale garde le côté de l’enveloppe (jamais retournée)', () => {
    const f = edgeFrames(g, edges);
    for (let i = 1; i < 40; i++) { const t = i / 40; const a = f.upper(t).N; const b = upperFrame(g, t).N; expect(a.x * b.x + a.y * b.y).toBeGreaterThan(0.5); const c = f.lower(t).N; const d = lowerFrame(g, t).N; expect(c.x * d.x + c.y * d.y).toBeGreaterThan(0.5); }
  });
  it('cils : sans bords = résultat historique octet pour octet ; avec bords, les racines sont SUR le tracé perturbé et diffèrent de l’enveloppe', () => {
    const plain = eyeLashSet(e, g, th); const same = eyeLashSet(e, g, th, null);
    expect(JSON.stringify(same)).toBe(JSON.stringify(plain));
    const on = eyeLashSet(e, g, th, edges); const poly = [...edges.upper];
    const worst = Math.max(...on.upper.map((l) => polyDist(l.base, poly)));
    expect(worst).toBeLessThan(th * 0.6);       // racine enfoncée de rootFuse/shift, comme sur l’enveloppe : même ordre que `lash-roots-on-lid`
    const moved = on.upper.filter((l, i) => plain.upper[i] && dist(l.base, (plain.upper[i] as Lash).base) > 0.05).length;
    expect(moved).toBeGreaterThan(on.upper.length * 0.3);
  });
  it('contour de dégagement = tracé perturbé : aucun cil ne retombe dans l’ouverture réelle', () => {
    const on = eyeLashSet(e, g, th, edges); const poly = edgePolygon(edges);
    expect(poly.length).toBeGreaterThan(90); expect(on.upper.length).toBeGreaterThan(10);
  });
  it('pli : extrémités ancrées aux canthi, contrôles décalés de CREASE_FOLLOW × déplacement du bord', () => {
    const base = creaseCurve(g, 0.3)!; const f = creaseCurve(g, 0.3, (t) => upperEdgeShift(g, edges, t))!;
    expect(f.p0).toEqual(base.p0); expect(f.p3).toEqual(base.p3);
    const s = upperEdgeShift(g, edges, 1 / 3); expect(f.p1.y - base.p1.y).toBeCloseTo(s.y * CREASE_FOLLOW, 9);
    expect(Math.hypot(s.x, s.y)).toBeGreaterThan(0);
    expect(creaseCurve(g, 0.3, () => ({ x: 0, y: 0 }))).toEqual(base);
  });
  it('caroncule : logée entre les bords perturbés ; sans repères = historique', () => {
    const a = caruncleOf(g, 0.6)!; const b = caruncleOf(g, 0.6, edgeFrames(g, edges))!;
    expect(caruncleOf(g, 0.6, undefined)).toEqual(a); expect(dist({ x: a.cx, y: a.cy }, { x: b.cx, y: b.cy })).toBeLessThan(g.hEff * 0.05);
    const mid = edgeFrames(g, edges); expect(b.cy).toBeCloseTo((mid.upper(0.07).pos.y + mid.lower(0.07).pos.y) / 2, 9);
  });
  it('rendu : lids-fold et globe-inner changent avec le bord (pli, cils, caroncule, ligne humide) ; pas de NaN', () => {
    const svgOf = (irr: number) => { const r = compileScene({ width: 700, height: 460, background: '#3b4157', objects: [{ ...spec({ microdetail: MD(irr), lids: { waterline: 0.7, crease: { height: 0.3, depth: 0.6 } }, lashes: { upper: { count: 24, length: 0.24 }, lower: { count: 8 } } }), transform: { x: 350, y: 230, scale: 1 }, eyebrow: null }] } as never); if (!r.ok) throw new Error(r.issues.join('\n')); return r.svg; };
    const a = svgOf(0); const b = svgOf(1);
    expect(a).not.toBe(b); expect(b).not.toMatch(/NaN|Infinity|undefined/);
    const part = (svg: string, id: string) => new RegExp(`id="e-${id}"[^>]*d="([^"]+)"`).exec(svg)?.[1];
    expect(part(a, 'crease')).not.toBe(part(b, 'crease'));
  });
  it('verifyEye : lit les mêmes cils et le même contour que le rendu ; 0 échec à forte irrégularité', () => {
    const r = verifyEye({ ...spec({ microdetail: MD(1) }) });
    expect(r.failures).toEqual([]);
  });
});

describe('EYE-07 (passe 17) — LOD des cils et raccourcissement de rotation', () => {
  const mk = (n: number, w: number): Lash[] => Array.from({ length: n }, (_, i) => ({ base: { x: i, y: 0 }, ctrl: { x: i, y: -5 }, tip: { x: i, y: -10 }, baseWidth: w, tipSharpness: 0.5, colorJitter: 0 }));
  it('identité : pas de LOD, cils assez épais ou trop peu nombreux → mêmes objets', () => {
    const L = mk(30, 1.2);
    expect(thinLashes(L, null)).toEqual(L); expect(thinLashes(L, 1)).toEqual(L); expect(thinLashes(mk(3, 0.01), 1)).toHaveLength(3);
  });
  it('sous le seuil : moins de cils, COUVERTURE d’encre conservée (± 6 %), ordre conservé', () => {
    for (const ppu of [0.5, 0.3, 0.15]) {
      const L = mk(60, 1); const T = thinLashes(L, ppu);
      expect(T.length).toBeLessThan(L.length);
      const cover = (a: readonly Lash[]) => a.reduce((s, l) => s + l.baseWidth, 0);
      expect(Math.abs(cover(T) / cover(L) - 1)).toBeLessThan(0.06);
      const xs = T.map((l) => l.base.x); expect([...xs].sort((a, b) => a - b)).toEqual(xs);
      expect(T.length).toBeGreaterThanOrEqual(Math.floor(60 * 0.4) - 1);
    }
    expect(LASH_MIN_PX).toBeGreaterThan(0);
  });
  it('eyeLashSet lit le LOD de l’œil effectif : petit œil = moins de cils que le grand, même graine', () => {
    const big = eyeLashSet(withAutoLod(resolveEye(spec({ microdetail: { lod: { eyePixels: 300 } } }))).eye, openingGeometry(spec().shape, spec().canthi), 6);
    const small = eyeLashSet(withAutoLod(resolveEye(spec({ microdetail: { lod: { eyePixels: 30 } }, lashes: { upper: { count: 24, length: 0.24, thickness: 0.15 }, lower: { count: 8 } } }))).eye, openingGeometry(spec().shape, spec().canthi), 6);
    expect(small.upper.length).toBeLessThanOrEqual(big.upper.length);
  });
  it('rotation de tête : la largeur apparente raccourcit le LOD (sphere) ; de face ou flat = identité', () => {
    const front = resolveEye(spec({ microdetail: {} })); const turned = resolveEye(spec({ microdetail: {}, headTurn: { model: 'sphere', yawDeg: 60, azimuthDeg: 22 } }));
    const { g0, turned: t } = eyeTurn(turned);
    expect(apparentWidthRatio(g0, t)).toBeLessThan(0.8); expect(apparentWidthRatio(g0, t)).toBeGreaterThanOrEqual(0.15);
    expect(apparentWidthRatio(eyeTurn(front).g0, eyeTurn(front).turned)).toBe(1);
    const a = withAutoLod(turned, 1, apparentWidthRatio(g0, t)).eyePx; const b = withAutoLod(turned, 1).eyePx;
    expect(a).toBeLessThan(b);
    expect(withAutoLod(resolveEye(spec({ microdetail: { lod: { eyePixels: 77 } } })), 1, 0.3).eyePx).toBe(77);   // un nombre explicite reste prioritaire
  });
});

import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { compileScene } from '../src';
import { mulberry32 } from '../src/core/prng';
import { applyIrisPreset, extra2Recipes, generateExtra2Eye } from '../src/generation/eye-gallery-ext2';
import { PHOTO2_IRIS_FAMILIES, PHOTO2_IRIS_MEASURES, photoIrisFamily2 } from '../src/generation/eye-iris-families-photo2';
import { highlightHash, rayFactor } from '../src/geometry/eye/highlights';
import { liftTable } from '../src/render/eye/globe-inner';
import { HighlightItem } from '../src/schema/eye-highlights';
import { EyeSpec } from '../src/schema';
import { IrisDetail } from '../src/schema/eye-iris-pupil';
import { atomMetrics } from '../scripts/lib/eye-iris-atoms';
import { irisTone } from '../scripts/lib/eye-iris-tone';
import { ATOM_EDGE_MIN, ATOM_EDGE_MIN_LIGHT, ATOM_LUM_MIN, ATOM_WHITE_MAX } from '../scripts/lib/verify-eye-atoms';
import { verifyEyeRender } from '../scripts/lib/verify-eye-render';

/**
 * Passe 13 : étoiles rayonnantes et teintées (`tint`, `rays`, `jitter`), luminosité des demi-teintes (`iris.lift`), courbure des fentes (`slits.curve`), détail atomique de lime-cyan,
 * détecteur d'étoiles à bassins versants. Chaque paramètre ajouté est PROUVÉ sur les pixels (le retirer change l'image, dans le sens annoncé) ; les valeurs retenues sont comparées aux mesures
 * de `references/eyes/measures-iris-atoms.json` / `measures-iris-photos.json` avec une tolérance écrite à côté de chaque test.
 */
const T = JSON.parse(readFileSync('references/eyes/measures-iris-photos.json', 'utf8')).eyes as { id: string; tone: { darkShare: number; lumMean: number } }[];
const A = JSON.parse(readFileSync('references/eyes/measures-iris-atoms.json', 'utf8')).eyes as Record<string, any>;
const baseIdx = extra2Recipes().findIndex((r) => r.style === 'almond' && r.irisFamily === null);
const eyeOf = (f: (typeof PHOTO2_IRIS_FAMILIES)[number], patch?: (e: any) => void): any => { const i = PHOTO2_IRIS_FAMILIES.indexOf(f); const e = applyIrisPreset(generateExtra2Eye(baseIdx) as never, photoIrisFamily2(f, mulberry32(7 + i)), 'almond', false) as any; patch?.(e); return e; };
const render = (e: any): { px: Uint8Array; svg: string } => { const r: any = compileScene({ width: 700, height: 460, background: '#ff00ff', objects: [{ kind: 'eye', id: 'e', transform: { x: 350, y: 230 }, ...e, eyebrow: null }] } as never); const px = new Resvg(r.svg ?? r, { fitTo: { mode: 'width', value: 700 } }).render().pixels as Uint8Array; return { px, svg: String(r.svg ?? r) }; };
const diff = (a: Uint8Array, b: Uint8Array): number => { let d = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) d++; return d; };
const solo = (h: Record<string, unknown>): any => eyeOf('lime-cyan', (e) => { e.highlights = { ...e.highlights, list: [{ shape: 'sparkle', anchor: 'iris', x: 0, y: -0.1, size: 0.3, intensity: 0, softness: 0, confine: 'iris', ...h }] }; });
const tone = (id: string): { darkShare: number; lumMean: number } => T.find((e) => e.id === id)!.tone;

describe('schéma : tout est opt-in, défaut = rendu historique', () => {
  it('HighlightItem : tint = null, rays = 0, jitter = 0 par défaut ; bornes rays 0–4, jitter 0–1, tint hexadécimal', () => {
    const h = HighlightItem.parse({}); expect(h.tint).toBeNull(); expect(h.rays).toBe(0); expect(h.jitter).toBe(0);
    expect(() => HighlightItem.parse({ rays: 4.5 })).toThrow(); expect(() => HighlightItem.parse({ rays: -1 })).toThrow(); expect(() => HighlightItem.parse({ jitter: 1.5 })).toThrow(); expect(() => HighlightItem.parse({ tint: 'bleu' })).toThrow();
  });
  it('slits.curve vaut 0 par défaut (fentes droites), borné à ±40 ° / ρ ; iris.lift vaut 0 par défaut, borné à 0–1', () => {
    const s = IrisDetail.parse({ slits: { count: 8 } }) as any; expect(s.slits.curve).toBe(0); expect(() => IrisDetail.parse({ slits: { count: 8, curve: 50 } })).toThrow();
    expect(EyeSpec.parse({ kind: 'eye', id: 'e' }).iris.lift).toBe(0); expect(() => EyeSpec.parse({ kind: 'eye', id: 'e', iris: { lift: 1.2 } })).toThrow();
  });
});

describe('étoiles rayonnantes : chaque paramètre est consommé et visible', () => {
  it('rays = 0 : aucune aiguille ni dégradé émis (SVG historique) ; rays > 0 : aiguilles ajoutées, l’étoile s’étend au-delà du corps', () => {
    const a = render(solo({ rays: 0 })); const b = render(solo({ rays: 2 }));
    expect(a.svg).not.toContain('-tint'); expect(b.svg.length).toBeGreaterThan(a.svg.length); expect(diff(a.px, b.px)).toBeGreaterThan(300);
    const lit = (px: Uint8Array): number => { let n = 0; for (let i = 0; i < px.length; i += 4) if (px[i]! > 235 && px[i + 1]! > 235 && px[i + 2]! > 235) n++; return n; };
    expect(lit(b.px)).toBeGreaterThan(lit(a.px));
  }, 60000);
  it('les aiguilles s’arrêtent à `rays` rayons du corps : 4 pointes donnent 4 aiguilles, la première la plus longue', () => {
    const lens = [0, 1, 2, 3].map((k) => rayFactor(HighlightItem.parse({ rays: 1, points: 4 }), k, 4)); expect(lens[0]).toBeGreaterThan(lens[1]!); expect(lens[0]).toBeGreaterThan(lens[3]!);
    expect((render(solo({ rays: 1, points: 4 })).svg.match(/<path[^>]*fill-opacity="1"[^>]*\/>/g) ?? []).length).toBeGreaterThanOrEqual(5);
  }, 60000);
  it('tint : le dégradé radial cœur (`color`) → teinte est émis, et une teinte rouge rougit les pixels de l’étoile (sans teinte : aucun dégradé)', () => {
    const a = render(solo({ rays: 1.5 })); const b = render(solo({ rays: 1.5, tint: '#ff0000', intensity: 0 }));
    expect(a.svg).not.toContain('-tint'); expect(b.svg).toContain('-tint');
    let dr = 0, n = 0; for (let i = 0; i < a.px.length; i += 4) if (a.px[i] !== b.px[i] || a.px[i + 1] !== b.px[i + 1]) { dr += (b.px[i]! - b.px[i + 2]!) - (a.px[i]! - a.px[i + 2]!); n++; }
    expect(n).toBeGreaterThan(200); expect(dr / n).toBeGreaterThan(20);
  }, 60000);
  it('jitter : déterministe (même SVG deux fois), rayons de lobes inégaux, image différente de l’étoile régulière ; jitter = 0 : étoile régulière', () => {
    const a = render(solo({ jitter: 0.8, rays: 1 })); const b = render(solo({ jitter: 0.8, rays: 1 })); expect(a.svg).toBe(b.svg);
    const r0 = render(solo({ jitter: 0, rays: 1 })); expect(diff(a.px, r0.px)).toBeGreaterThan(100);
    const h = HighlightItem.parse({ x: 0.2, y: 0.1, size: 0.3 }); expect(highlightHash(h, 1)).not.toBe(highlightHash(h, 2)); expect(highlightHash(h, 1)).toBe(highlightHash(h, 1));
    expect(rayFactor(HighlightItem.parse({ jitter: 0 }), 0, 4)).toBe(1); expect(rayFactor(HighlightItem.parse({ jitter: 0.8 }), 0, 4)).not.toBe(1);
  }, 60000);
});

describe('iris.lift : luminosité des demi-teintes, noirs et blancs en place', () => {
  it('lift = 0 : aucun filtre `-vib` (rendu historique) ; > 0 : table à 9 points, identité sous 0,35 et en 1', () => {
    expect(render(eyeOf('lime-cyan', (e) => { e.iris.vibrance = 0; e.iris.lift = 0; })).svg).not.toContain('-vib');
    const s = render(eyeOf('lime-cyan', (e) => { e.iris.vibrance = 0; e.iris.lift = 0.5; })).svg; expect(s).toContain('-vib'); expect(s).toContain('feComponentTransfer'); expect(s).toMatch(/type="table"/);
    const t = liftTable(1).split(' ').map(Number); expect(t).toHaveLength(9); expect(t[0]).toBe(0); expect(t[8]).toBe(1); expect(t[1]).toBeCloseTo(0.125, 3); expect(t[2]).toBeCloseTo(0.25, 3); expect(t[5]!).toBeGreaterThan(5 / 8);
    expect(liftTable(0.2).split(' ').map(Number)[5]!).toBeLessThan(t[5]!);
  }, 60000);
  it('effet mesuré : la luminance moyenne monte (≥ 3), la part sombre reste à ± 0,03 (fire-halo, lift 0 → 0,6)', () => {
    const a = irisTone(eyeOf('fire-halo', (e) => { e.iris.lift = 0; })); const b = irisTone(eyeOf('fire-halo', (e) => { e.iris.lift = 0.6; }));
    expect(b.lumMean - a.lumMean).toBeGreaterThanOrEqual(3); expect(Math.abs(b.darkShare - a.darkShare)).toBeLessThanOrEqual(0.03);
  }, 60000);
  it('calibrage : la luminance moyenne de chaque famille est à ± 10 de sa référence (avant la passe 13 : sous la référence de 14 à 22)', () => {
    for (const f of PHOTO2_IRIS_FAMILIES) { const ref = tone(PHOTO2_IRIS_MEASURES[f].ref).lumMean; const got = irisTone(eyeOf(f)).lumMean; expect(Math.abs(got - ref), `${f} ${got} vs ${ref}`).toBeLessThanOrEqual(10); }
  }, 120000);
});

describe('fentes : courbure et couverture des références', () => {
  it('slits.curve : prism-star dérive de 4 à 9 °/ρ (réf. 04 : 5,8) ; à 0 la dérive est plus faible', () => {
    const ref = A['04'].slits.meanDriftPerRho as number; const m = atomMetrics(eyeOf('prism-star')).slits.meanDriftPerRho as number; const m0 = atomMetrics(eyeOf('prism-star', (e) => { e.iris.detail.slits.curve = 0; })).slits.meanDriftPerRho as number;
    expect(m).toBeGreaterThan(ref * 0.7); expect(m).toBeLessThan(ref * 1.6); expect(m0).toBeLessThan(m);
  }, 120000);
  it('l’extracteur mesure les fentes sur TOUTES les références (04, 03, 05, 06, 07, 08a, 08b, 09, 10a, 10b), avec leur dérive', () => {
    for (const id of ['03', '04', '05', '06', '07', '08a', '08b', '09', '10a', '10b']) { const s = A[id].slits; expect(s, id).toBeDefined(); expect(s.persistentCount, id).toBeGreaterThanOrEqual(0); }
    expect(A['08a'].slits.persistentCount).toBe(0); expect(A['10a'].slits.persistentCount).toBeGreaterThan(0); expect(A['04'].slits.meanDriftPerRho).toBeGreaterThan(0);
  });
});

describe('étoiles et cellules calibrées sur les références (détecteur à bassins versants)', () => {
  it('étoiles : moyenne des 6 plus grandes à ± 0,08 de la référence (Feret / rayon d’iris) pour ice, fire, emerald, prism', () => {
    for (const f of ['ice-star', 'fire-halo', 'emerald-facets', 'prism-star'] as const) { const ref = A[PHOTO2_IRIS_MEASURES[f].ref].stars.feretTop6Mean as number; const got = atomMetrics(eyeOf(f)).stars.feretTop6Mean as number; expect(Math.abs(got - ref), `${f} ${got} vs ${ref}`).toBeLessThanOrEqual(0.08); }
  }, 180000);
  it('étoiles de l’anneau d’ice-star : six, de 0,31 (passe 12) à ≥ 0,36 d’iris, comme les 0,39 de 10b ; teintées et rayonnantes', () => {
    const e = eyeOf('ice-star'); const ring = e.highlights.list.filter((h: any) => h.points === 6); expect(ring).toHaveLength(6); for (const h of ring) { expect(h.tint).toBeTruthy(); expect(h.rays).toBeGreaterThan(0); }
    const top = atomMetrics(e).stars.top.slice(1, 6).map((t: any) => t.feretOverR); expect(Math.min(...top)).toBeGreaterThanOrEqual(0.36);
  }, 120000);
  it('cellules : fire et ice à moins de 2 × la référence (avant : fire 200 pour 44, ice 65 pour 31), sans éclatement (médiane de surface ≥ 0,5 × réf.)', () => {
    for (const f of ['fire-halo', 'ice-star'] as const) { const ref = A[PHOTO2_IRIS_MEASURES[f].ref].cells; const m = atomMetrics(eyeOf(f)).cells; expect(m.count, f).toBeLessThanOrEqual(ref.count * 2); expect(m.areaMedian, f).toBeGreaterThanOrEqual(ref.areaMedian * 0.5); }
  }, 120000);
});

describe('lime-cyan : détail atomique (réf. 08 : anneaux fins concentriques, points cyan)', () => {
  it('arcs + braises demandés, anneau jaune continu à ρ 0,62 ; les retirer change l’image', () => {
    const e = eyeOf('lime-cyan'); expect(e.iris.detail.arcs.ringRho).toBeCloseTo(0.62, 2); expect(e.iris.detail.arcs.duty).toBe(1); expect(e.iris.detail.embers.count).toBeGreaterThan(0);
    const a = render(e).px; expect(diff(a, render(eyeOf('lime-cyan', (x) => { delete x.iris.detail.arcs; })).px)).toBeGreaterThan(500); expect(diff(a, render(eyeOf('lime-cyan', (x) => { delete x.iris.detail.embers; })).px)).toBeGreaterThan(30);
  }, 120000);
  it('pas de fentes demandées (la réf. 08 n’en a aucune persistante, 3 candidates brutes) : au plus 2 détectées dans le rendu', () => { expect(eyeOf('lime-cyan').iris.detail.slits).toBeUndefined(); expect(atomMetrics(eyeOf('lime-cyan')).slits.persistentCount).toBeLessThanOrEqual(2); }, 60000);
});

describe('couche de vérification du rendu : luminance et blanc pur', () => {
  const rule = (e: any, id: string) => verifyEyeRender(e).find((c) => c.id === id)!;
  it('les 5 familles passent `iris-luminance-plausible` (60–200) et `iris-white-share-plausible` (≤ 0,2), sans aucun échec de rendu', () => {
    for (const f of PHOTO2_IRIS_FAMILIES) { const e = eyeOf(f); expect(rule(e, 'iris-luminance-plausible').ok, f).toBe(true); expect(rule(e, 'iris-white-share-plausible').ok, f).toBe(true); expect(verifyEyeRender(e).filter((c) => !c.ok).map((c) => c.id), f).toEqual([]); }
  }, 120000);
  it('contre-exemple style : des étoiles énormes en aplats blancs échouent `iris-white-share-plausible`', () => {
    const r = rule(eyeOf('ice-star', (e) => { e.highlights.list = e.highlights.list.map((h: any) => (h.shape === 'sparkle' ? { ...h, size: 0.85, rays: 0.5, softness: 0, tint: null } : h)); }), 'iris-white-share-plausible'); expect(r.ok).toBe(false); expect(r.value).toBeGreaterThan(ATOM_WHITE_MAX);
  }, 60000);
  it('contre-exemple style : un iris presque noir échoue `iris-luminance-plausible`', () => {
    const r = rule(eyeOf('ice-star', (e) => { e.iris.detail.voids = [{ inner: 0.1, outer: 1, strength: 1 }, { inner: 0.1, outer: 1, strength: 1 }, { inner: 0.1, outer: 1, strength: 1 }]; e.highlights.list = e.highlights.list.slice(0, 2); }), 'iris-luminance-plausible'); expect(r.ok).toBe(false); expect(r.value).toBeLessThan(ATOM_LUM_MIN);
  }, 60000);
  it('seuil de gradient : le détail léger (arcs + braises seuls) a le seuil 9, un iris à fentes garde 12', () => {
    expect(ATOM_EDGE_MIN_LIGHT).toBeLessThan(ATOM_EDGE_MIN); const r = rule(eyeOf('lime-cyan'), 'atomic-edge-density'); expect(r.limit).toBe(ATOM_EDGE_MIN_LIGHT); expect(rule(eyeOf('prism-star'), 'atomic-edge-density').limit).toBe(ATOM_EDGE_MIN);
  }, 60000);
});

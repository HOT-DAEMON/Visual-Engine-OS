import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { compileScene } from '../src';
import { mulberry32 } from '../src/core/prng';
import { applyIrisPreset, extra2Recipes, generateExtra2Eye } from '../src/generation/eye-gallery-ext2';
import { PHOTO2_IRIS_FAMILIES, PHOTO2_IRIS_MEASURES, photoIrisFamily2 } from '../src/generation/eye-iris-families-photo2';
import { IrisDetail } from '../src/schema/eye-iris-pupil';
import { irisTone } from '../scripts/lib/eye-iris-tone';
import { ATOM_DARK_MAX, ATOM_EDGE_MIN } from '../scripts/lib/verify-eye-atoms';
import { verifyEyeRender } from '../scripts/lib/verify-eye-render';

/** Passe 12 : détail atomique d'iris. Chaque paramètre ajouté (`slits`, `arcs`, `embers`, `voids`, `facets.cut`) est PROUVÉ sur les pixels : le retirer ou le mettre à zéro change l'image, et la direction du changement est celle annoncée. */
const T = JSON.parse(readFileSync('references/eyes/measures-iris-photos.json', 'utf8')).eyes as { id: string; tone: { darkShare: number; lumMean: number } }[];
const A = JSON.parse(readFileSync('references/eyes/measures-iris-atoms.json', 'utf8')).eyes as Record<string, any>;
const tone = (id: string): { darkShare: number; lumMean: number } => T.find((e) => e.id === id)!.tone;
const baseIdx = extra2Recipes().findIndex((r) => r.style === 'almond' && r.irisFamily === null);
const eyeOf = (f: (typeof PHOTO2_IRIS_FAMILIES)[number], patch?: (e: any) => void): any => { const i = PHOTO2_IRIS_FAMILIES.indexOf(f); const e = applyIrisPreset(generateExtra2Eye(baseIdx) as never, photoIrisFamily2(f, mulberry32(7 + i)), 'almond', false) as any; patch?.(e); return e; };
const render = (e: any): { px: Uint8Array; svg: string } => { const r: any = compileScene({ width: 700, height: 460, background: '#ff00ff', objects: [{ kind: 'eye', id: 'e', transform: { x: 350, y: 230 }, ...e, eyebrow: null }] } as never); return { svg: r.svg as string, px: new Resvg(r.svg, { fitTo: { mode: 'width', value: 700 } }).render().pixels as unknown as Uint8Array }; };
const diff = (a: Uint8Array, b: Uint8Array): number => { let d = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) d++; return d; };
const without = (e: any, ...keys: string[]): void => { for (const k of keys) delete e.iris.detail[k]; };

describe('schéma : tout est opt-in, défaut = rendu historique', () => {
  it('un iris.detail sans les nouveaux champs ne les reçoit pas, et facets.cut vaut 0', () => {
    const d = IrisDetail.parse({ facets: { count: 10 } }); expect((d as any).slits).toBeUndefined(); expect((d as any).arcs).toBeUndefined(); expect((d as any).embers).toBeUndefined(); expect((d as any).voids).toBeUndefined(); expect(d.facets!.cut).toBe(0);
    expect(() => IrisDetail.parse({ slits: { count: 2 } })).toThrow(); expect(() => IrisDetail.parse({ voids: [{ inner: 0, outer: 1 }, { inner: 0, outer: 1 }, { inner: 0, outer: 1 }, { inner: 0, outer: 1 }] })).toThrow();
  });
  it('facets.cut = 0 explicite : image identique à l’absence du champ (couronnes régulières historiques)', () => {
    const a = eyeOf('prism-star', (e) => { e.iris.detail.facets.cut = 0; }); const b = eyeOf('prism-star', (e) => { delete e.iris.detail.facets.cut; });
    expect(render(a).svg).toBe(render(b).svg);
  });
});

describe('slits (réf. 04) : fentes radiales sombres', () => {
  it('retirées, l’image change ; depth 0 les rend invisibles (même image que sans) ; depth 1 les rend plus sombres que depth 0,3', () => {
    const on = render(eyeOf('prism-star')).px; const off = render(eyeOf('prism-star', (e) => without(e, 'slits'))).px;
    expect(diff(on, off)).toBeGreaterThan(3000);
    const d0 = render(eyeOf('prism-star', (e) => { e.iris.detail.slits.depth = 0; })).px; expect(diff(d0, off)).toBe(0);
    const lowD = irisTone(eyeOf('prism-star', (e) => { e.iris.detail.slits.depth = 0.3; })).darkShare; const hiD = irisTone(eyeOf('prism-star', (e) => { e.iris.detail.slits.depth = 1; })).darkShare;
    expect(hiD).toBeGreaterThan(lowD);
  }, 60000);
  it('count et widthDeg sont lus : plus de fentes / plus larges = plus de pixels sombres', () => {
    const dk = (patch: (s: any) => void): number => irisTone(eyeOf('prism-star', (e) => patch(e.iris.detail.slits))).darkShare;
    expect(dk((s) => { s.count = 8; s.long = 0; })).toBeLessThan(dk((s) => { s.count = 60; s.long = 0; })); expect(dk((s) => { s.widthDeg = 1; })).toBeLessThan(dk((s) => { s.widthDeg = 6; }));
  }, 60000);
  it('la graine de l’œil change les angles (deux œils ne partagent pas les mêmes fentes)', () => {
    const a = render(eyeOf('prism-star')).px; const b = render(eyeOf('prism-star', (e) => { e.seed = (e.seed ^ 0x5a5a5a5a) >>> 0; })).px; expect(diff(a, b)).toBeGreaterThan(2000);
  });
});

describe('facets.cut (réf. 07) : facettes taillées', () => {
  it('cut > 0 remplace les couronnes régulières ; plus de cut = cellules plus inégales (la graine de puissance change)', () => {
    const reg = render(eyeOf('emerald-facets', (e) => { e.iris.detail.facets.cut = 0; })).px; const cut = render(eyeOf('emerald-facets')).px; expect(diff(reg, cut)).toBeGreaterThan(3000);
    const lo = render(eyeOf('emerald-facets', (e) => { e.iris.detail.facets.cut = 0.1; })).px; expect(diff(lo, cut)).toBeGreaterThan(1500);
  }, 60000);
  it('dispersion > 0 colore les arêtes opposées à la lumière (le paramètre existant est lu aussi par les facettes taillées)', () => {
    const a = render(eyeOf('emerald-facets', (e) => { e.iris.detail.facets.dispersion = 0; })).px; const b = render(eyeOf('emerald-facets', (e) => { e.iris.detail.facets.dispersion = 1; })).px; expect(diff(a, b)).toBeGreaterThan(300);
  });
});

describe('arcs (réf. 10b) et embers (réf. 10a)', () => {
  it('arcs : retirer change l’image ; count et ringRho sont lus', () => {
    const on = render(eyeOf('ice-star')).px; expect(diff(on, render(eyeOf('ice-star', (e) => without(e, 'arcs'))).px)).toBeGreaterThan(2000);
    expect(diff(on, render(eyeOf('ice-star', (e) => { e.iris.detail.arcs.count = 5; })).px)).toBeGreaterThan(1000); expect(diff(on, render(eyeOf('ice-star', (e) => { e.iris.detail.arcs.ringRho = 0.55; })).px)).toBeGreaterThan(1500);
  }, 60000);
  it('embers : retirer change l’image ; opacity 0 = même image que sans ; plus de braises = plus de pixels changés', () => {
    const none = render(eyeOf('fire-halo', (e) => without(e, 'embers'))).px; const on = render(eyeOf('fire-halo')).px; expect(diff(on, none)).toBeGreaterThan(400);
    expect(diff(render(eyeOf('fire-halo', (e) => { e.iris.detail.embers.opacity = 0; })).px, none)).toBe(0);
    expect(diff(render(eyeOf('fire-halo', (e) => { e.iris.detail.embers.count = 10; })).px, none)).toBeLessThan(diff(on, none));
  }, 60000);
});

describe('voids : le noir est dessiné après les fibres', () => {
  it('strength 0 = même image que sans voids ; la part sombre croît avec strength', () => {
    const none = render(eyeOf('ice-star', (e) => without(e, 'voids'))).px; expect(diff(render(eyeOf('ice-star', (e) => { for (const v of e.iris.detail.voids) v.strength = 0; })).px, none)).toBe(0);
    const ds = (k: number): number => irisTone(eyeOf('ice-star', (e) => { for (const v of e.iris.detail.voids) v.strength *= k; })).darkShare; expect(ds(0.3)).toBeLessThan(ds(1));
  }, 60000);
});

describe('calibrage contre les références (mesures-iris-atoms.json / measures-iris-photos.json)', () => {
  it('part sombre (hors pupille et reflets) à ± 0,07 des 4 références : 04 / 07 / 10a / 10b', () => {
    const pairs: [(typeof PHOTO2_IRIS_FAMILIES)[number], string][] = [['prism-star', '04'], ['emerald-facets', '07'], ['fire-halo', '10a'], ['ice-star', '10b']];
    for (const [f, id] of pairs) { const got = irisTone(eyeOf(f)).darkShare; expect(Math.abs(got - tone(id).darkShare), `${f} ${got} vs ${tone(id).darkShare}`).toBeLessThanOrEqual(0.07); }
  }, 120000);
  it('luminance moyenne à ± 25 des références (inchangé depuis la passe 10) malgré le noir ajouté', () => {
    const pairs: [(typeof PHOTO2_IRIS_FAMILIES)[number], string][] = [['prism-star', '04'], ['emerald-facets', '07'], ['fire-halo', '10a'], ['ice-star', '10b']];
    for (const [f, id] of pairs) { const got = irisTone(eyeOf(f)).lumMean; expect(Math.abs(got - tone(id).lumMean), `${f} ${got} vs ${tone(id).lumMean}`).toBeLessThanOrEqual(25); }
  }, 120000);
  it('constantes de fentes de la famille prism-star = mesure de 04 : 33 fentes persistantes, 2,75° — le moteur en est à ± 25 %', () => {
    const m = A['04'].slits; expect(m.persistentCount).toBeGreaterThanOrEqual(30); const s = eyeOf('prism-star').iris.detail.slits; expect(s.count + s.long).toBeGreaterThanOrEqual(m.persistentCount * 0.75); expect(s.count + s.long).toBeLessThanOrEqual(m.persistentCount * 1.35);
    expect(s.widthDeg).toBeGreaterThanOrEqual(m.meanWidthDeg); expect(s.widthDeg).toBeLessThanOrEqual(m.meanWidthDeg * 1.6);   // largeur au PIED : la mesure est la largeur à mi-hauteur d'un fuseau effilé
  });
  it('étoiles de 10b : sur l’anneau mesuré (r ≈ 0,7), six, et plus grandes qu’en passe 11 (0,1 -> 0,2)', () => {
    const e = eyeOf('ice-star'); const stars = e.highlights.list.filter((h: any) => h.points === 6); expect(stars).toHaveLength(6); expect(stars[0].size).toBeGreaterThanOrEqual(0.2); expect(A['10b'].ring.ringRho).toBeGreaterThan(0.65);
    expect(e.iris.detail.arcs.ringRho).toBeCloseTo(A['10b'].ring.ringRho, 1);
  });
});

describe('couche de vérification du rendu (géométrie · anatomie · style)', () => {
  const ids = ['slits-radial', 'arcs-concentric', 'iris-dark-share-plausible', 'atomic-edge-density'];
  it('les 5 familles photo 2 passent toutes les règles atomiques ; chaque famille atomique déclenche au moins `iris-dark-share-plausible` et `atomic-edge-density`', () => {
    for (const f of PHOTO2_IRIS_FAMILIES) { const r = verifyEyeRender(eyeOf(f)); expect(r.filter((c) => !c.ok).map((c) => c.id), f).toEqual([]); if (f !== 'lime-cyan') expect(r.filter((c) => ids.includes(c.id)).map((c) => c.id), f).toEqual(expect.arrayContaining(['iris-dark-share-plausible', 'atomic-edge-density'])); }
    expect(verifyEyeRender(eyeOf('prism-star')).some((c) => c.id === 'slits-radial')).toBe(true); expect(verifyEyeRender(eyeOf('ice-star')).some((c) => c.id === 'arcs-concentric')).toBe(true);
  }, 120000);
  it('lime-cyan (détail atomique, passe 13 : anneau vert foncé continu à r = 0,62 + points cyan) : les règles atomiques sont évaluées ET passées ; sans arcs ni braises, aucune règle atomique (yeux historiques)', () => {
    const r = verifyEyeRender(eyeOf('lime-cyan')).filter((c) => ids.includes(c.id)); expect(r.length).toBeGreaterThan(0); expect(r.filter((c) => !c.ok).map((c) => c.id)).toEqual([]);
    const bare = eyeOf('lime-cyan', (e) => { delete e.iris.detail.arcs; delete e.iris.detail.embers; }); expect(verifyEyeRender(bare).filter((c) => ids.includes(c.id))).toEqual([]);
  }, 60000);
  // passe 13 : on ne garde que les 2 reflets principaux, car les étoiles d'anneau claires couvrent assez d'iris pour garder la part sombre à 0,4
  it('contre-exemple anatomie : des vides qui noircissent presque tout l’iris échouent `iris-dark-share-plausible`', () => {
    const r = verifyEyeRender(eyeOf('ice-star', (e) => { e.iris.detail.voids = [{ inner: 0.1, outer: 1, strength: 1 }, { inner: 0.1, outer: 1, strength: 1 }, { inner: 0.1, outer: 1, strength: 1 }]; e.highlights.list = e.highlights.list.slice(0, 2); })).find((c) => c.id === 'iris-dark-share-plausible')!;
    expect(r.ok).toBe(false); expect(r.value).toBeGreaterThan(ATOM_DARK_MAX);
  }, 60000);
  it('contre-exemple style : un détail atomique demandé mais invisible (profondeur 0, sans facettes ni reflets : gradient ≈ 6,6) échoue `atomic-edge-density`', () => {
    const r = verifyEyeRender(eyeOf('prism-star', (e) => { e.iris.layers = []; e.iris.fibers = 0; e.iris.detail = { ...e.iris.detail, density: 0, contrast: 0, crypts: 0, slits: { ...e.iris.detail.slits, depth: 0 } }; delete e.iris.detail.facets; delete e.iris.detail.rainbow; delete e.iris.detail.accent; e.iris.detail.sparkles = 0; e.highlights.list = []; })).find((c) => c.id === 'atomic-edge-density')!;
    expect(r.ok).toBe(false); expect(r.value).toBeLessThan(ATOM_EDGE_MIN);
  }, 60000);
  it('PHOTO2_IRIS_MEASURES et les références restent alignées (garde-fou de la passe 10)', () => { for (const f of PHOTO2_IRIS_FAMILIES) expect(A[PHOTO2_IRIS_MEASURES[f].ref]).toBeDefined(); });
});

import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { compileScene } from '../src';
import { mulberry32 } from '../src/core/prng';
import { applyIrisPreset, extra2Recipes, generateExtra2Eye } from '../src/generation/eye-gallery-ext2';
import { PHOTO2_IRIS_FAMILIES, photoIrisFamily2 } from '../src/generation/eye-iris-families-photo2';
import { IrisDetail } from '../src/schema/eye-iris-pupil';
import { irisTone } from '../scripts/lib/eye-iris-tone';

/**
 * Passe 16 : atomes nés des références 07 (éclats, poussière, bulles variées) et 10a (braises en losange, braises éparpillées). Chaque paramètre est PROUVÉ sur les pixels, et
 * tous sont opt-in : valeur par défaut = image identique à l'absence du champ (les yeux historiques ne bougent pas).
 */
const T = JSON.parse(readFileSync('references/eyes/measures-iris-photos.json', 'utf8')).eyes as { id: string; tone: { darkShare: number } }[];
const baseIdx = extra2Recipes().findIndex((r) => r.style === 'almond' && r.irisFamily === null);
const eyeOf = (f: (typeof PHOTO2_IRIS_FAMILIES)[number], patch?: (e: any) => void): any => { const i = PHOTO2_IRIS_FAMILIES.indexOf(f); const e = applyIrisPreset(generateExtra2Eye(baseIdx) as never, photoIrisFamily2(f, mulberry32(7 + i)), 'almond', false) as any; patch?.(e); return e; };
const render = (e: any): { px: Uint8Array; svg: string } => { const r: any = compileScene({ width: 700, height: 460, background: '#ff00ff', objects: [{ kind: 'eye', id: 'e', transform: { x: 350, y: 230 }, ...e, eyebrow: null }] } as never); if (!r.ok) throw new Error(r.issues.join('\n')); return { svg: r.svg as string, px: new Resvg(r.svg, { fitTo: { mode: 'width', value: 700 } }).render().pixels as unknown as Uint8Array }; };
const diff = (a: Uint8Array, b: Uint8Array): number => { let d = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) d++; return d; };
const elements = (svg: string): string[] => svg.match(/<(?:path|circle)[^>]*\/>/g) ?? [];
const emerald = (patch: (d: any) => void) => eyeOf('emerald-facets', (e) => patch(e.iris.detail));
const fire = (patch: (d: any) => void) => eyeOf('fire-halo', (e) => patch(e.iris.detail));

describe('schéma : tout est opt-in, défaut = rendu historique', () => {
  it('valeurs par défaut des nouveaux champs', () => {
    const d: any = IrisDetail.parse({ facets: { count: 10, cut: 0.5 }, bubbles: { count: 4 }, embers: { count: 10 } });
    expect(d.facets.shard).toBe(0); expect(d.facets.dust).toBe(0); expect(d.bubbles.sizeSpread).toBe(0); expect(d.bubbles.rim).toBe(1); expect(d.embers.shape).toBe('capsule'); expect(d.embers.scatter).toBe(0);
    expect(() => IrisDetail.parse({ embers: { count: 10, shape: 'star' } })).toThrow();
  });
  it('valeurs par défaut explicites : image IDENTIQUE à l\'absence du champ', () => {
    const off = (d: any): void => { d.facets.shard = 0; d.facets.dust = 0; d.bubbles.sizeSpread = 0; d.bubbles.rim = 1; };
    const gone = (d: any): void => { delete d.facets.shard; delete d.facets.dust; delete d.bubbles.sizeSpread; delete d.bubbles.rim; };
    expect(render(emerald(off)).svg).toBe(render(emerald(gone)).svg);
    expect(render(fire((d) => { d.embers.shape = 'capsule'; d.embers.scatter = 0; })).svg).toBe(render(fire((d) => { delete d.embers.shape; delete d.embers.scatter; })).svg);
  });
});

describe('facettes (réf. 07) : éclats et poussière', () => {
  const base = render(emerald((d) => { d.facets.shard = 0; d.facets.dust = 0; }));
  it('shard et dust changent des pixels, et plus de shard = plus d\'éclats', () => {
    expect(diff(base.px, render(emerald((d) => { d.facets.shard = 0.6; d.facets.dust = 0; })).px)).toBeGreaterThanOrEqual(80);
    expect(diff(base.px, render(emerald((d) => { d.facets.shard = 0; d.facets.dust = 1; })).px)).toBeGreaterThanOrEqual(30);
    const n = (s: number) => elements(render(emerald((d) => { d.facets.shard = s; d.facets.dust = 0; })).svg).length; expect(n(0.6)).toBeGreaterThan(n(0.2)); expect(n(0.2)).toBeGreaterThan(n(0));
  });
  it('les éclats ne déplacent AUCUN tirage des facettes de base : tous les éléments de l\'image sans éclats sont dans l\'image avec', () => {
    const withShards = new Set(elements(render(emerald((d) => { d.facets.shard = 0.8; d.facets.dust = 0; })).svg));
    const missing = elements(base.svg).filter((x) => !withShards.has(x));
    expect(missing.length).toBe(0);
  });
  it('sans `cut` (couronnes régulières historiques) shard et dust sont sans effet', () => {
    const a = render(emerald((d) => { d.facets.cut = 0; d.facets.shard = 0; d.facets.dust = 0; })).svg; const b = render(emerald((d) => { d.facets.cut = 0; d.facets.shard = 0.9; d.facets.dust = 1; })).svg;
    expect(b).toBe(a);
  });
});

describe('bulles (réf. 07) : tailles variées, parois discrètes', () => {
  const one = render(emerald(() => {}));
  it('sizeSpread change la répartition des tailles (rayons plus dispersés) et rim règle le contour sombre', () => {
    const radii = (svg: string): number[] => (svg.match(/<circle[^>]*\sr="([\d.]+)"[^>]*stroke="#[0-9a-f]{6}"[^>]*stroke-width="([\d.]+)"/g) ?? []).map((m) => Number(/\sr="([\d.]+)"/.exec(m)![1]));
    const sd = (v: number[]): number => { const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); };
    const flat = radii(render(emerald((d) => { d.bubbles.sizeSpread = 0; })).svg); const spread = radii(render(emerald((d) => { d.bubbles.sizeSpread = 1; })).svg);
    expect(flat.length).toBeGreaterThan(5); expect(spread.length).toBeGreaterThan(5); expect(sd(spread) / (spread.reduce((a, b) => a + b, 0) / spread.length)).toBeGreaterThan(sd(flat) / (flat.reduce((a, b) => a + b, 0) / flat.length));
    expect(diff(one.px, render(emerald((d) => { d.bubbles.sizeSpread = 1; })).px)).toBeGreaterThanOrEqual(100);
    expect(diff(render(emerald((d) => { d.bubbles.rim = 1; })).px, render(emerald((d) => { d.bubbles.rim = 0.2; })).px)).toBeGreaterThanOrEqual(100);
  });
  it('un contour plus discret éclaircit l\'iris (moins de noir)', () => {
    const lum = (rim: number): number => irisTone(eyeOf('emerald-facets', (e) => { e.iris.detail.bubbles.rim = rim; })).lumMean;
    expect(lum(0.2)).toBeGreaterThan(lum(1));
  });
});

describe('braises (réf. 10a) : losange pointu et braises éparpillées', () => {
  const caps = render(fire((d) => { d.embers.shape = 'capsule'; d.embers.scatter = 0; }));
  it('lance remplace la capsule ; scatter déplace des braises hors de l\'anneau', () => {
    expect(diff(caps.px, render(fire((d) => { d.embers.shape = 'lance'; d.embers.scatter = 0; })).px)).toBeGreaterThanOrEqual(60);
    expect(diff(caps.px, render(fire((d) => { d.embers.shape = 'capsule'; d.embers.scatter = 1; })).px)).toBeGreaterThanOrEqual(60);
  });
  it('lance trace des losanges (4 sommets + fermeture) et le blanc de leur cœur ; la capsule trace des segments', () => {
    const lance = render(fire((d) => { d.embers.shape = 'lance'; d.embers.scatter = 0; })).svg;
    expect((lance.match(/d="M[^"]+L[^"]+L[^"]+L[^"]+Z"/g) ?? []).length).toBeGreaterThanOrEqual(30);
    expect(elements(lance).filter((x) => x.includes('fill="#ffffff"')).length).toBeGreaterThan(elements(caps.svg).filter((x) => x.includes('fill="#ffffff"') && x.includes(' d=')).length);
  });
  it('famille feu : part sombre à ± 0,03 de la référence 10a (avant la passe : 0,057 d\'écart)', () => {
    const ref = T.find((e) => e.id === '10a')!.tone.darkShare; expect(Math.abs(irisTone(eyeOf('fire-halo')).darkShare - ref)).toBeLessThanOrEqual(0.03);
  });
});

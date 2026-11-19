import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/prng';
import { IRIS_FAMILIES } from '../src/generation/eye-iris-families';
import { PHOTO_IRIS_FAMILIES, PHOTO_IRIS_MEASURES, photoIrisFamily, pupilFor } from '../src/generation/eye-iris-families-photo';
import { applyPhotoIris } from '../src/generation/eye-gallery-ext2';
import { generateExtraEye } from '../src/generation/eye-gallery-ext';
import { effectivePupilSize, pupilContours } from '../src/geometry/eye/pupil-shape';
import { resolveEye } from '../src/render/eye/eye';
import { EyeSpec } from '../src/schema';
import { verifyEye } from '../src/verify/eye';
import { IRIS_TEXTURE_DETAIL_MIN, verifyEyeRender } from '../scripts/lib/verify-eye-render';

type Band = { r: number; dark: string; bright: string } | null;
interface M { id: string; limbe: { aspectHW: number }; pupille: { rOverIris: number; aspectHW: number }; radial: Band[]; reflets: { dx: number; dy: number; rOverIris: number }[] }
const J = (JSON.parse(readFileSync('references/eyes/measures-iris-photos.json', 'utf8')) as { eyes: M[] }).eyes;
const byRef = (ref: string): M => J.find((e) => e.id === ref) as M;
const band = (m: M, r: number): { dark: string; bright: string } => m.radial.find((b) => b !== null && Math.abs(b.r - r) < 0.01) as { dark: string; bright: string };
const base = generateExtraEye(3) as Record<string, any>;
const withFamily = (f: (typeof PHOTO_IRIS_FAMILIES)[number]): Record<string, any> => applyPhotoIris(base as never, f, 'almond', 11, false) as never;

describe('familles d’iris « photo » (réfs 03, 05, 06, 09) : constantes = mesures', () => {
  it('les 4 familles sont ADDITIVES : IRIS_FAMILIES garde ses 6 entrées d’origine', () => {
    expect([...IRIS_FAMILIES]).toEqual(['golden', 'teal-gem', 'prism', 'frost', 'ember', 'amber-radial']);
    expect(PHOTO_IRIS_FAMILIES).toHaveLength(4);
    for (const f of PHOTO_IRIS_FAMILIES) expect((IRIS_FAMILIES as readonly string[]).includes(f)).toBe(false);
  });
  it('pupille / iris, aspect du limbe, couleurs sombre / claire (centre 0,125 · milieu 0,458 · limbe 0,875) et reflet spéculaire = le JSON mesuré', () => {
    for (const f of PHOTO_IRIS_FAMILIES) {
      const K = PHOTO_IRIS_MEASURES[f]; const m = byRef(K.ref);
      expect(Math.abs(K.pupilOverIris - m.pupille.rOverIris)).toBeLessThan(0.002);
      if (K.pupilAspectHW !== null) expect(Math.abs(K.pupilAspectHW - m.pupille.aspectHW)).toBeLessThan(0.002);
      if (K.irisAspect !== null) expect(Math.abs(K.irisAspect - m.limbe.aspectHW)).toBeLessThan(0.002);
      [0.125, 0.458, 0.875].forEach((r, i) => { expect(K.dark[i]).toBe(band(m, r).dark); expect(K.bright[i]).toBe(band(m, r).bright); });
      expect(m.reflets.some((h) => Math.abs(h.dx - K.specular.dx) < 0.01 && Math.abs(h.dy - K.specular.dy) < 0.01 && Math.abs(h.rOverIris - K.specular.r) < 0.01)).toBe(true);
      expect(K.specular.dy).toBeLessThan(0);   // anatomie mesurée : reflet toujours dans la moitié haute de l’iris
    }
  });
  it('l’aspect de pupille MESURÉ est consommé : le contour rendu de la famille 03 a l’aspect hauteur / largeur de la réf. (1,471) ; sans `squash` il serait rond', () => {
    const aspect = (squash: number): number => {
      const e = resolveEye(EyeSpec.parse({ ...withFamily('slit-sunburst'), pupil: { ...withFamily('slit-sunburst').pupil, deform: { squash, skew: 0, irregularity: 0 } }, eyebrow: null }));
      const c = pupilContours(e.pupil, effectivePupilSize(e.pupil), 100, 100, 1).contours[0]!;
      const xs = c.map((p) => p.x), ys = c.map((p) => p.y); return (Math.max(...ys) - Math.min(...ys)) / (Math.max(...xs) - Math.min(...xs));
    };
    expect(Math.abs(aspect(pupilFor('slit-sunburst').squash) - 1.471)).toBeLessThan(0.05);
    expect(aspect(0)).toBeCloseTo(1, 2);
    expect(pupilFor('frost-fern').squash).toBe(0);   // aspect non fiable (trait de lumière) : non consommé
  });
});

describe('familles d’iris « photo » : rendu et vérification', () => {
  it('chaque famille donne un œil valide (verifyEye) dont le SVG est distinct des trois autres', () => {
    const svgs = PHOTO_IRIS_FAMILIES.map((f) => { const e = withFamily(f); expect(verifyEye(e as never).ok).toBe(true); return JSON.stringify(e.iris.layers) + JSON.stringify(e.iris.detail); });
    expect(new Set(svgs).size).toBe(4);
  });
  it('couches, détail, lueur, limbe et fibres de la famille se retrouvent dans l’œil ; deux graines donnent deux iris proches mais non identiques', () => {
    const f = 'ember-sky'; const p = photoIrisFamily(f, mulberry32(1)); const q = photoIrisFamily(f, mulberry32(2));
    const e = applyPhotoIris(base as never, f, 'almond', 1, false) as Record<string, any>;
    expect(e.iris.limbalRing).toBe(p.limbalRing); expect(e.iris.fibers).toBe(p.fibers); expect(e.iris.glow).toEqual(p.glow);
    expect(e.iris.layers).toHaveLength(p.layers.length); expect(JSON.stringify(p.highlights)).not.toBe(JSON.stringify(q.highlights));
  });
  it('règles d’iris sur les pixels : les 4 familles passent (0 échec, texture 12–22 contre 22–42 sur les références) ; un iris qui DEMANDE du détail mais n’en montre pas (voile gris, détail à 0) échoue `iris-texture`', () => {
    for (const f of PHOTO_IRIS_FAMILIES) { const cs = verifyEyeRender(withFamily(f) as never); expect(cs.filter((c) => !c.ok)).toEqual([]); expect(cs.find((c) => c.id === 'iris-texture')!.value).toBeGreaterThan(IRIS_TEXTURE_DETAIL_MIN); }
    const flatDetail = { density: 0, contrast: 0, collarette: null, innerZone: null, crypts: 0, accent: null, limbal: { width: 0.05, strength: 0 }, topShade: 0, bottomGlow: null, pupilHalo: 0, sparkles: 0 };
    const veil = { ...base, finish: 'shaded', iris: { ...base.iris, layers: [{ color: '#8a8f99', color2: '#8d9299', gradient: 'radial', opacity: 1 }], detail: flatDetail, fibers: 0, glow: null, limbalRing: 0, material: { base: { type: 'solid', color: '#8a8f99' }, roughness: 0.3, clearcoat: 0 } }, highlights: { list: [] } };
    const c = verifyEyeRender(veil as never).find((x) => x.id === 'iris-texture');
    expect(c?.ok).toBe(false); expect(c!.value).toBeLessThan(IRIS_TEXTURE_DETAIL_MIN);
  });
  it('`specular-in-upper-iris` : un reflet primaire ancré à l’iris placé dans la moitié basse échoue ; en haut il passe', () => {
    const mk = (y: number): Record<string, any> => ({ ...withFamily('gold-filigree'), highlights: { list: [{ kind: 'reflection', role: 'primary', anchor: 'iris', x: 0.2, y, size: 0.2, confine: 'iris' }] } });
    expect(verifyEyeRender(mk(0.5) as never).find((c) => c.id === 'specular-in-upper-iris')?.ok).toBe(false);
    expect(verifyEyeRender(mk(-0.3) as never).find((c) => c.id === 'specular-in-upper-iris')?.ok).toBe(true);
  });
});

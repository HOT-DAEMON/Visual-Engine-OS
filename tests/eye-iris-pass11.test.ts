import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { compileScene } from '../src';
import { mulberry32 } from '../src/core/prng';
import { placeHighlights } from '../src/geometry/eye';
import { applyIrisPreset, extra2Recipes, generateExtra2Eye } from '../src/generation/eye-gallery-ext2';
import { PHOTO2_IRIS_FAMILIES, PHOTO2_IRIS_MEASURES, photoIrisFamily2 } from '../src/generation/eye-iris-families-photo2';
import { HighlightItem } from '../src/schema/eye-highlights';
import { irisTone } from '../scripts/lib/eye-iris-tone';
import { IRIS_PEAK_SAT_MIN, verifyEyeRender } from '../scripts/lib/verify-eye-render';

/** Passe 11 : vibrance, arc-en-ciel (04), bulles nettes (07), étoiles à six pointes (10b) — chaque paramètre est PROUVÉ sur les pixels, pas seulement présent dans le schéma. */
const J = JSON.parse(readFileSync('references/eyes/measures-iris-photos.json', 'utf8')); const arr: any[] = Array.isArray(J) ? J : (J.eyes ?? Object.values(J));
const ref = (id: string): any => (Array.isArray(J) ? J.find((x: any) => x.id === id) : J[id] ?? arr.find((x) => x.id === id));
const baseIdx = extra2Recipes().findIndex((r) => r.style === 'almond' && r.irisFamily === null);
const eyeOf = (f: (typeof PHOTO2_IRIS_FAMILIES)[number], patch?: (e: any) => void): any => { const i = PHOTO2_IRIS_FAMILIES.indexOf(f); const e = applyIrisPreset(generateExtra2Eye(baseIdx) as never, photoIrisFamily2(f, mulberry32(7 + i)), 'almond', false) as any; patch?.(e); return e; };
const render = (e: any): { px: Uint8Array; svg: string } => { const r: any = compileScene({ width: 700, height: 460, background: '#ff00ff', objects: [{ kind: 'eye', id: 'e', transform: { x: 350, y: 230 }, ...e, eyebrow: null }] } as never); return { svg: r.svg as string, px: new Resvg(r.svg as string, { fitTo: { mode: 'width', value: 700 } }).render().pixels as unknown as Uint8Array }; };

describe('vibrance : saturation des pics d’iris (réfs 04 / 07 / 08 / 10)', () => {
  it('chaque famille photo 2 a une vibrance calibrée : pics saturés à ± 0,07 de la mesure (avant : 0,41–0,65 contre 0,72–0,79) ; sans vibrance ils sont plus bas', () => {
    for (const f of PHOTO2_IRIS_FAMILIES) {
      const want = ref(PHOTO2_IRIS_MEASURES[f].ref).tone.satPeaks as number; const got = irisTone(eyeOf(f)).satPeaks; const off = irisTone(eyeOf(f, (e) => { e.iris.vibrance = 0; })).satPeaks;
      expect(Math.abs(got - want), `${f} ${got} vs ${want}`).toBeLessThanOrEqual(0.07); expect(got - off, `${f} : effet`).toBeGreaterThanOrEqual(0.04);
    }
  }, 60000);
  it('vibrance = 0 : aucun filtre émis (rendu historique) ; > 0 : une matrice de saturation explicite (resvg borne type="saturate" à 1)', () => {
    expect(render(eyeOf('lime-cyan', (e) => { e.iris.vibrance = 0; e.iris.lift = 0; })).svg).not.toContain('-vib');   // passe 13 : le filtre `-vib` porte aussi `iris.lift` ; il disparaît quand les deux valent 0
    const s = render(eyeOf('lime-cyan', (e) => { e.iris.vibrance = 0.5; })).svg; expect(s).toContain('-vib'); expect(s).toMatch(/feColorMatrix type="matrix"/); expect(s).not.toMatch(/type="saturate"/);
  });
  it('règle pixel `iris-peak-saturation` : passe pour les 5 familles ; ÉCHOUE si on coupe la vibrance d’un iris qui en demande (contre-exemple : ice-star délavé ; fire-halo tire désormais sa saturation de l’anneau, passe 13)', () => {
    for (const f of PHOTO2_IRIS_FAMILIES) expect(verifyEyeRender(eyeOf(f)).filter((c) => !c.ok).map((c) => c.id), f).toEqual([]);
    const washed = eyeOf('ice-star', (e) => { e.iris.vibrance = 0.02; }); const r = verifyEyeRender(washed).find((c) => c.id === 'iris-peak-saturation'); expect(r?.ok).toBe(false); expect(r!.value).toBeLessThan(IRIS_PEAK_SAT_MIN);
  }, 60000);
});

describe('detail.rainbow (réf. 04) : le spectre est CONSOMMÉ', () => {
  const hues = (px: Uint8Array): number => { const bins = new Array(6).fill(0); let n = 0; for (let y = 170; y < 300; y++) for (let x = 290; x < 410; x++) { const i = (y * 700 + x) * 4; const R = px[i]!, G = px[i + 1]!, B = px[i + 2]!; const mx = Math.max(R, G, B), mn = Math.min(R, G, B); if (mx < 90 || (mx - mn) / mx < 0.45) continue; let h = mx === R ? ((G - B) / (mx - mn)) % 6 : mx === G ? (B - R) / (mx - mn) + 2 : (R - G) / (mx - mn) + 4; h = (h + 6) % 6; bins[Math.floor(h)]++; n++; } return bins.filter((b) => b > Math.max(12, 0.03 * n)).length; };
  it('avec l’arc-en-ciel, ≥ 5 des 6 secteurs de teinte sont représentés dans l’iris ; sans, moins', () => {
    const on = hues(render(eyeOf('prism-star')).px); const off = hues(render(eyeOf('prism-star', (e) => { delete e.iris.detail.rainbow; })).px);
    expect(on).toBeGreaterThanOrEqual(5); expect(off).toBeLessThan(on);
  });
  it('la teinte suit l’angle : rouge→violet, `hueFrom` / `hueTo` inversés inversent l’ordre (le paramètre est lu)', () => {
    const a = render(eyeOf('prism-star')).svg; const b = render(eyeOf('prism-star', (e) => { const r = e.iris.detail.rainbow; e.iris.detail.rainbow = { ...r, hueFrom: r.hueTo, hueTo: r.hueFrom }; })).svg; expect(a).not.toBe(b);
  });
});

describe('bubbles.crisp (réf. 07) : contour sombre net, zone basse seulement', () => {
  it('crisp > 0 modifie les pixels de la moitié BASSE de l’iris et laisse la moitié haute identique ; crisp = 0 : bulles historiques', () => {
    const on = render(eyeOf('emerald-facets')).px; const off = render(eyeOf('emerald-facets', (e) => { e.iris.detail.bubbles.crisp = 0; })).px; let up = 0, low = 0;
    for (let y = 150; y < 310; y++) for (let x = 280; x < 420; x++) { const i = (y * 700 + x) * 4; const d = Math.abs(on[i]! - off[i]!) + Math.abs(on[i + 1]! - off[i + 1]!) + Math.abs(on[i + 2]! - off[i + 2]!); if (y < 215) up += d; else low += d; }
    expect(low).toBeGreaterThan(5000); expect(up).toBeLessThan(low * 0.15);
  });
  it('le contour est plus SOMBRE que le fond de l’iris : part de pixels sombres de la moitié basse plus haute avec crisp', () => {
    const dark = (px: Uint8Array): number => { let n = 0; for (let y = 225; y < 300; y++) for (let x = 290; x < 410; x++) { const i = (y * 700 + x) * 4; if (0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]! < 85) n++; } return n; };
    expect(dark(render(eyeOf('emerald-facets')).px)).toBeGreaterThan(dark(render(eyeOf('emerald-facets', (e) => { e.iris.detail.bubbles.crisp = 0; })).px));
  });
});

describe('points (reflets star / sparkle) et étoile à six pointes (réf. 10b)', () => {
  const ctx = { c: { x: 0, y: 0 }, irisRx: 100, irisRy: 100, half: { x: 0, y: 0 }, bbox: { x: -200, y: -200, w: 400, h: 400 } };
  it('le contour a 2 × points sommets ; sans `points` : formes historiques (sparkle 4 pointes = 8 sommets, star 5 = chaikin)', () => {
    const n = (shape: 'sparkle' | 'star', points?: number): number => placeHighlights([HighlightItem.parse({ shape, anchor: 'iris', ...(points ? { points } : {}) })], ctx)[0]!.outline.length;
    expect(n('sparkle')).toBe(8); expect(n('sparkle', 6)).toBe(12); expect(n('sparkle', 3)).toBe(6); expect(n('star')).toBeGreaterThan(0);
    expect(() => HighlightItem.parse({ points: 2 })).toThrow(); expect(() => HighlightItem.parse({ points: 13 })).toThrow();
  });
  it('ice-star : six étoiles à six pointes en hexagone autour de la pupille, chacune VISIBLE sur l’image (la retirer seule change les pixels)', () => {
    const e = eyeOf('ice-star'); const stars = e.highlights.list.filter((h: any) => h.points === 6); expect(stars).toHaveLength(6);
    const angs = stars.map((h: any) => Math.round((Math.atan2(h.y / 0.8, h.x) * 180) / Math.PI)).sort((a: number, b: number) => a - b); expect(angs).toEqual([-150, -90, -30, 30, 90, 150]);
    for (const h of stars) expect(Math.hypot(h.x, h.y / 0.8)).toBeCloseTo(0.7, 2);   // passe 12 : 0,56 -> 0,70 (les étoiles de la réf. 10b sont sur l'anneau, rayon polaire mesuré 0,57–0,82, anneau 0,707)
    const on = render(e).px;   // chaque étoile, retirée seule, change l'image : aucune n'est cachée ni rognée à néant
    stars.forEach((_h: unknown, k: number) => {
      const off = render(eyeOf('ice-star', (x) => { let n = -1; x.highlights.list = x.highlights.list.filter((h: any) => h.points !== 6 || ++n !== k); })).px; let d = 0;
      for (let y = 150; y < 310; y++) for (let x = 280; x < 420; x++) { const i = (y * 700 + x) * 4; d += Math.abs(on[i]! - off[i]!) + Math.abs(on[i + 1]! - off[i + 1]!) + Math.abs(on[i + 2]! - off[i + 2]!); }
      expect(d, `étoile ${k}`).toBeGreaterThan(300);
    });
  });
  it('la liste de reflets accepte jusqu’à 12 entrées (6 avant)', () => { const e = eyeOf('ice-star'); expect(e.highlights.list.length).toBeGreaterThan(6); expect(e.highlights.list.length).toBeLessThanOrEqual(12); });
});

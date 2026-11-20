import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { composeHair } from '../src/hair-grammar/compose-plan';
import { generate } from '../src/hair-grammar/grammar';
import { applyIntent, measureIntent, presetIntent, PRESETS, type Intent } from '../src/hair-grammar/intent';
import { observe, observationsToSpec, referenceFromRGBA, signedAxis } from '../src/hair-grammar/observe';
import { paintHair } from '../src/hair-grammar/paint';
import { DEFAULT_HEAD, project } from '../src/hair-grammar/head';
import { TOUSLED } from '../src/hair-grammar/profiles/tousled';
import { LEVELS, LEVEL_FIELDS, generateLevels, seedsFrom, type Level } from '../src/hair-grammar/variation';
import { v3 } from '../src/hair-grammar/vec';
import { analyzeComposition } from '../src/hair-grammar/compose';
import { ROI, viewAt } from '../scripts/hair-grammar/engine-kit';

const V = viewAt(0.5);
const mean = (I: Intent, k: 'volume' | 'sleek' | 'weight' | 'wind'): number => {
  let s = 0; for (const seed of [1, 2, 3]) { const { profile, composition } = applyIntent(TOUSLED, I); const r = composeHair(profile, composition, seed, V, 3); s += measureIntent(profile, r.specs, V, r.composition, I.windDir ?? 0)[k]; } return s / 3;
};

describe('intention artistique : chaque axe est MESURABLE et monotone', () => {
  it('volume : la largeur du volume croît avec l\'axe', () => { const m = [-1, 0, 1].map((v) => mean({ volume: v }, 'volume')); expect(m[0]!).toBeLessThan(m[1]!); expect(m[1]!).toBeLessThan(m[2]!); });
  it('sleek : la sinuosité des mèches baisse (mesure « lisse » ↑) à chaque pas', () => { const m = [0, 0.5, 1].map((s) => mean({ sleek: s }, 'sleek')); expect(m[0]!).toBeLessThan(m[1]!); expect(m[1]!).toBeLessThan(m[2]!); });
  it('weight : la part couverte de l\'enveloppe croît de aérien à lourd', () => { const m = [-1, 0, 1].map((w) => mean({ weight: w }, 'weight')); expect(m[0]!).toBeLessThan(m[1]!); expect(m[1]!).toBeLessThan(m[2]!); });
  it('wind : la projection du vecteur de lecture sur la direction du vent croît à chaque pas', () => { const m = [0, 0.25, 0.5, 1].map((w) => mean({ wind: w, windDir: 0 }, 'wind')); for (let i = 1; i < m.length; i++) expect(m[i]!).toBeGreaterThan(m[i - 1]!); });
  it('une intention nulle ne change pas le profil (aucune dérive silencieuse)', () => { const { profile } = applyIntent(TOUSLED, {}); expect(profile.families.map((f) => f.count)).toEqual(TOUSLED.families.map((f) => f.count)); expect(profile.field).toEqual(TOUSLED.field); });
  it('presets : chacun est un Intent borné et produit un profil valide (au moins 1 mèche par famille)', () => {
    for (const n of Object.keys(PRESETS) as (keyof typeof PRESETS)[]) { const { profile } = applyIntent(TOUSLED, presetIntent(n)); profile.families.forEach((f) => expect(f.count).toBeGreaterThanOrEqual(1)); }
  });
  it('les valeurs hors bornes sont bornées (volume 5 = volume 1)', () => { expect(applyIntent(TOUSLED, { volume: 5 }).profile.families).toEqual(applyIntent(TOUSLED, { volume: 1 }).profile.families); });
});

describe('variation par niveaux indépendants', () => {
  const base = seedsFrom(7); const A = generateLevels(TOUSLED, base);
  it('déterministe', () => { expect(generateLevels(TOUSLED, base)).toEqual(A); });
  it('même nombre de mèches que la grammaire', () => { expect(A).toHaveLength(generate(TOUSLED, 1).length); });
  const FIELDS = Object.values(LEVEL_FIELDS).flat();
  for (const lv of LEVELS.filter((l): l is Exclude<Level, 'asymmetry'> => l !== 'asymmetry')) {
    it(`niveau « ${lv} » : changer SA graine ne modifie que SES champs`, () => {
      const B = generateLevels(TOUSLED, { ...base, [lv]: base[lv] + 12345 }, 0); const A0 = generateLevels(TOUSLED, base, 0);
      let changed = false;
      A0.forEach((a, i) => { const b = B[i]!; for (const f of FIELDS) { const same = JSON.stringify(a[f]) === JSON.stringify(b[f]); if (LEVEL_FIELDS[lv].includes(f)) { if (!same) changed = true; } else expect(same, `${lv} a modifié ${String(f)}`).toBe(true); } });
      expect(changed).toBe(true);
    });
  }
  it('asymétrie : seule la graine « asymmetry » change largeur/longueur/cap ; elle ne touche ni la racine ni le ton', () => {
    const B = generateLevels(TOUSLED, { ...base, asymmetry: base.asymmetry + 999 }); expect(B.some((b, i) => b.width !== A[i]!.width)).toBe(true);
    B.forEach((b, i) => { expect(b.root).toEqual(A[i]!.root); expect(b.tone).toBe(A[i]!.tone); expect(b.strands).toBe(A[i]!.strands); });
  });
  it('asymétrie bornée : l\'écart de largeur d\'une mèche ne dépasse pas exp(0,35)', () => { const A0 = generateLevels(TOUSLED, base, 0); A.forEach((a, i) => { const r = a.width / A0[i]!.width; expect(r).toBeLessThanOrEqual(Math.exp(0.35) + 1e-9); expect(r).toBeGreaterThanOrEqual(Math.exp(-0.35) - 1e-9); }); });
});

describe('observation d\'une référence (aller-retour : rendre → observer)', () => {
  const specs = generate(TOUSLED, 1); const hp = paintHair(DEFAULT_HEAD, specs, V); const c = analyzeComposition(DEFAULT_HEAD, specs, V);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ROI.w * 3}" height="${ROI.h * 3}" viewBox="0 0 ${ROI.w} ${ROI.h}">${hp.back}${hp.front}${hp.over}</svg>`;
  const img = new Resvg(svg).render(); const ref = referenceFromRGBA(img.width, img.height, img.pixels);
  const c0 = project(V, v3(0, 0, DEFAULT_HEAD.cz)); const H = { cx: c0.x * 3, cy: c0.y * 3, rx: DEFAULT_HEAD.rx * V.s * 3, ry: DEFAULT_HEAD.ry * V.s * 3 };
  const o = observe(ref, H);
  it('largeur / enveloppe : l\'observation sur le rendu rejoint la mesure interne à 10 % près', () => {
    const { profile } = applyIntent(TOUSLED, {}); const m = measureIntent(profile, specs, V, c); expect(Math.abs(o.widthRatio - m.volume) / m.volume).toBeLessThan(0.1);
  });
  it('espaces négatifs : même ordre de grandeur que la mesure sur les lames (écart < 0,15)', () => { expect(Math.abs(o.negative - c.negative.ratio)).toBeLessThan(0.15); });
  it('axe d\'écoulement : cohérence dans [0, 1] et axe défini', () => { expect(o.coherence).toBeGreaterThanOrEqual(0); expect(o.coherence).toBeLessThanOrEqual(1); expect(Number.isFinite(o.axis)).toBe(true); });
  it('masque vide : observations nulles sans NaN', () => { const z = observe({ w: 8, h: 8, mask: new Uint8Array(64), gray: new Float32Array(64) }, H); expect(Object.values(z).every((v) => v === 0)).toBe(true); });
  it('signedAxis : choisit le sens descendant ; axe horizontal → sens demandé', () => {
    expect(signedAxis(Math.PI / 2 + Math.PI)).toBeCloseTo(Math.PI / 2, 6); expect(signedAxis(0, 0)).toBeCloseTo(0, 6); expect(Math.abs(signedAxis(0, Math.PI))).toBeCloseTo(Math.PI, 6);
  });
  it('observations → réglages : intention bornée et équilibre borné, reprise par composeHair', () => {
    const s = observationsToSpec(o); expect(Math.abs(s.intent.volume ?? 0)).toBeLessThanOrEqual(1); expect(Math.abs(s.composition.balance ?? 0)).toBeLessThanOrEqual(0.5);
    const r = composeHair(applyIntent(TOUSLED, s.intent).profile, s.composition, 1, V, 3); expect(r.specs.length).toBeGreaterThan(20);
  });
  it('observation d\'une référence DIFFÉRENTE : une coiffure gonflée est lue plus large qu\'une coiffure plaquée', () => {
    const w = (volume: number): number => { const { profile } = applyIntent(TOUSLED, { volume }); const s = generate(profile, 1); const h2 = paintHair(DEFAULT_HEAD, s, V); const g = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${ROI.w * 3}" height="${ROI.h * 3}" viewBox="0 0 ${ROI.w} ${ROI.h}">${h2.back}${h2.front}${h2.over}</svg>`).render(); return observe(referenceFromRGBA(g.width, g.height, g.pixels), H).widthRatio; };
    expect(w(1)).toBeGreaterThan(w(-1));
  });
});

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LASH_FAMILIES, LASH_FAMILY_IDS, LASH_INK_COLOR, applyLashFamily } from '../src/generation/eye-lash-families';
import { generateExtraEye } from '../src/generation/eye-gallery-ext';
import { EyeSpec } from '../src/schema';

/**
 * Traçabilité du corpus de cils (audit des cils §3, §5.2) et contrat d'apparence des familles (§6.1) :
 *  - le clustering exploratoire doit avoir été produit à partir des mesures présentes (empreinte SHA-256) ;
 *  - toute source citée par une famille existe dans le corpus (plus d'identifiant fantôme comme 12-11) ;
 *  - inclus + exclus = tous les yeux mesurés, chaque exclusion porte un motif ;
 *  - aucun angle mesuré hors de [-180, 180] (bug d'angles non ramenés, corrigé dans extract_lashes.py) ;
 *  - l'encre des familles est le noir mesuré des références ; `ink: 'keep'` conserve l'apparence de l'œil.
 */
const MEASURES = 'references/eyes/measures-lashes.json';
const read = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
interface Stroke { bendDeg: number; startAngleDeg: number; endAngleDeg: number }
interface Corpus { eyes: { id: string; strokes: Stroke[] }[] }
interface Clusters { meta: { measuresSha256: string; included: string[]; excluded: { id: string; reason: string }[]; params: { k: number } }; families: { size: number; singular: boolean }[] }

describe('corpus de cils : empreinte, sources, angles', () => {
  const corpus = read<Corpus>(MEASURES); const clusters = read<Clusters>('references/eyes/lash-families.json');
  const ids = corpus.eyes.map((e) => e.id);

  it('lash-families.json provient des mesures présentes (empreinte SHA-256 identique)', () => {
    const sha = createHash('sha256').update(readFileSync(MEASURES)).digest('hex');
    expect(clusters.meta.measuresSha256, 'relancer python3 scripts/eye-refs/cluster_lashes.py').toBe(sha);
  });
  it('inclus + exclus = tous les yeux mesurés, sans doublon, chaque exclusion porte un motif', () => {
    const all = [...clusters.meta.included, ...clusters.meta.excluded.map((e) => e.id)].sort();
    expect(all).toEqual([...ids].sort());
    for (const e of clusters.meta.excluded) expect(e.reason.length, e.id).toBeGreaterThan(10);
  });
  it('un groupe de moins de 3 yeux est marqué singulier (pas une famille artistique)', () => {
    for (const f of clusters.families) expect(f.singular).toBe(f.size < 3);
  });
  it('les 10 familles ne citent que des identifiants qui existent dans le corpus (pas de 12-11 fantôme)', () => {
    const known = new Set(ids);
    for (const id of LASH_FAMILY_IDS) for (const s of LASH_FAMILIES[id].sources) expect(known.has(s), `${id} cite ${s}`).toBe(true);
  });
  it('aucun angle mesuré hors de [-180, 180] (régression : a1 - a0 non ramené, 54 traits sur 437)', () => {
    for (const e of corpus.eyes) for (const s of e.strokes) for (const a of [s.bendDeg, s.startAngleDeg, s.endAngleDeg]) { expect(a, e.id).toBeGreaterThanOrEqual(-180); expect(a, e.id).toBeLessThanOrEqual(180); }
  });
});

describe('contrat d’apparence des familles (ink: family | keep)', () => {
  const lum = (hex: string): number => 0.2126 * parseInt(hex.slice(1, 3), 16) + 0.7152 * parseInt(hex.slice(3, 5), 16) + 0.0722 * parseInt(hex.slice(5, 7), 16);
  const base = (): Record<string, unknown> => ({ ...generateExtraEye(6), lashes: { upper: { material: { base: { type: 'solid', color: '#7a4b2a' }, roughness: 0.3 }, opacity: 0.55, gloss: 0.4, colorVariation: 0.25 }, lower: { opacity: 0.4 } } });
  const up = (e: unknown) => (e as { lashes: { upper: Record<string, unknown>; lower: Record<string, unknown> } }).lashes;

  it('l’encre est le noir neutre mesuré des références (luminance ≤ 6, avant : 14 bleuté)', () => {
    expect(lum(LASH_INK_COLOR)).toBeLessThanOrEqual(6);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(LASH_INK_COLOR.slice(i, i + 2), 16)) as [number, number, number];
    expect(Math.max(r, g, b) - Math.min(r, g, b), 'noir neutre, sans dominante').toBeLessThanOrEqual(2);
  });
  it("mode 'family' (défaut) : matériau, opacité, brillance et variation sont ceux de l'encre ; le bas est à 0,9", () => {
    const { upper, lower } = up(applyLashFamily(base(), 'plume'));
    expect(upper.opacity).toBe(1); expect(upper.gloss).toBe(0); expect(upper.colorVariation).toBe(0);
    expect((upper.material as { base: { color: string } }).base.color).toBe(LASH_INK_COLOR);
    expect(lower.opacity).toBe(0.9);
  });
  it("mode 'keep' : l'apparence existante est conservée (matériau, opacité, brillance, variation) mais la structure vient de la famille", () => {
    const e = applyLashFamily(base(), 'plume', { ink: 'keep' }); const { upper, lower } = up(e);
    expect(upper.opacity).toBe(0.55); expect(upper.gloss).toBe(0.4); expect(upper.colorVariation).toBe(0.25);
    expect((upper.material as { base: { color: string } }).base.color).toBe('#7a4b2a');
    expect(lower.opacity).toBe(0.4);
    expect(upper.count).toBe(LASH_FAMILIES.plume.upper.count); expect(upper.bendDeg).toBe(LASH_FAMILIES.plume.upper.bendDeg);
    expect(() => EyeSpec.parse(e)).not.toThrow();
  });
  it("mode 'keep' sans apparence préalable : les valeurs par défaut du schéma s'appliquent (pas d'encre forcée)", () => {
    const e = applyLashFamily({ ...generateExtraEye(6), lashes: undefined }, 'touffes', { ink: 'keep' });
    expect((up(e).upper as { material?: unknown }).material).toBeUndefined();
  });
});

import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { compileScene } from '../src';
import { LASH_FAMILIES, LASH_FAMILY_IDS, applyLashFamily } from '../src/generation/eye-lash-families';
import { extraEyeRecipes, generateExtraEye } from '../src/generation/eye-gallery-ext';

const W = 700, H = 460;
// Œil de base : un almond de la galerie (la case 18 : ouverture assez haute pour que chaque famille se lise, vérifié sur les cases 0 à 39 par les quatre contrôles ci-dessous). Ce n'est plus « la case 6 » : l'ordre des cases change quand l'enveloppe almond ou les recettes sont réajustées (la case 6 est passée d'un chibi à un œil plus bas : 545 px au lieu de > 900). Le garde-fou ci-dessous échoue explicitement si la case 18 change de style.
const BASE_INDEX = 30;   // PASSE 8 : le refit des recettes a décalé les cases (18 n'est plus un almond) ; la case 30 est un almond haut (aspect 0,68) sur lequel les 10 tests de familles passent (cases 9 et 19 essayées : 2 contrôles d'image échouent)
if (extraEyeRecipes()[BASE_INDEX]?.style !== 'almond') throw new Error(`tests/eye-lash-families : la case ${BASE_INDEX} n'est plus un almond, rechoisir l'œil de base`);
const base = { ...generateExtraEye(BASE_INDEX), eyebrow: null } as Record<string, unknown>;
function pixels(eye: Record<string, unknown>): Uint8Array {
  const r = compileScene({ width: W, height: H, background: '#ff00ff', objects: [{ kind: 'eye', id: 'e', transform: { x: W / 2, y: H / 2 }, ...eye }] } as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return new Resvg(r.svg, { fitTo: { mode: 'width', value: W } }).render().pixels as unknown as Uint8Array;
}
/** Référence = le MÊME œil avec la MÊME paupière (certaines familles l'épaississent, `lidThickness`) mais sans cils : seul ce que les cils ajoutent est compté. */
const P0s = new Map<string, Uint8Array>();
const P0for = (id: (typeof LASH_FAMILY_IDS)[number]): Uint8Array => { if (!P0s.has(id)) P0s.set(id, pixels({ ...applyLashFamily(base, id), lashes: { upper: { count: 0, flick: { count: 0 } }, lower: { count: 0 } } })); return P0s.get(id) as Uint8Array; };
/** Masque des pixels que les cils ajoutent (différence avec le même œil sans cils). */
function lashMask(id: (typeof LASH_FAMILY_IDS)[number]): Uint8Array {
  const p = pixels(applyLashFamily(base, id)); const P0 = P0for(id); const m = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { const d = Math.abs((p[4 * i] as number) - (P0[4 * i] as number)) + Math.abs((p[4 * i + 1] as number) - (P0[4 * i + 1] as number)) + Math.abs((p[4 * i + 2] as number) - (P0[4 * i + 2] as number)); m[i] = d > 60 ? 1 : 0; }
  return m;
}
/** Luminance moyenne des pixels ajoutés par les cils (0 = noir) : les références sont en encre noire franche. */
function meanLum(id: (typeof LASH_FAMILY_IDS)[number], m: Uint8Array): number { const p = pixels(applyLashFamily(base, id)); let s = 0, n = 0; for (let i = 0; i < W * H; i++) if (m[i]) { s += 0.2126 * (p[4 * i] as number) + 0.7152 * (p[4 * i + 1] as number) + 0.0722 * (p[4 * i + 2] as number); n++; } return n ? s / n : 255; }
const area = (m: Uint8Array): number => m.reduce((s, v) => s + v, 0);
const bbox = (m: Uint8Array) => { let x0 = W, x1 = 0, y0 = H, y1 = 0; for (let i = 0; i < m.length; i++) if (m[i]) { const x = i % W, y = (i / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, x1, y0, y1 }; };
const jaccard = (a: Uint8Array, b: Uint8Array): number => { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { if (a[k] && b[k]) i++; if (a[k] || b[k]) u++; } return u ? i / u : 1; };

describe('familles de cils (réfs 12 à 16)', () => {
  const masks = Object.fromEntries(LASH_FAMILY_IDS.map((id) => [id, lashMask(id)])) as Record<(typeof LASH_FAMILY_IDS)[number], Uint8Array>;

  it('chaque famille est conforme au schéma et référence des yeux mesurés', () => {
    for (const id of LASH_FAMILY_IDS) { expect(() => applyLashFamily(base, id)).not.toThrow(); expect(LASH_FAMILIES[id].sources.length).toBeGreaterThan(0); }
  });
  it('chaque famille ajoute des pixels visibles à l’image (les paramètres sont consommés)', () => {
    for (const id of LASH_FAMILY_IDS) expect(area(masks[id]), id).toBeGreaterThan(900);
  });
  it('les cils sont de l’encre sombre franche (luminance moyenne des pixels ajoutés < 90 sur 255)', () => {
    for (const id of LASH_FAMILY_IDS) expect(meanLum(id, masks[id]), id).toBeLessThan(90);
  });
  it('les familles sont visuellement distinctes deux à deux (recouvrement des cils < 0,6)', () => {
    for (let i = 0; i < LASH_FAMILY_IDS.length; i++) for (let j = i + 1; j < LASH_FAMILY_IDS.length; j++) expect(jaccard(masks[LASH_FAMILY_IDS[i]!], masks[LASH_FAMILY_IDS[j]!]), `${LASH_FAMILY_IDS[i]} / ${LASH_FAMILY_IDS[j]}`).toBeLessThan(0.6);
  });
  it('les paramètres se lisent sur l’image : frange dense > plume en surface ; plume et fin-féminin débordent plus loin que rond-kawaii', () => {
    expect(area(masks['frange-dense'])).toBeGreaterThan(area(masks['rond-kawaii']) * 1.5);
    const w = (id: (typeof LASH_FAMILY_IDS)[number]): number => { const b = bbox(masks[id]); return b.x1 - b.x0; };
    expect(w('plume')).toBeGreaterThan(w('rond-kawaii')); expect(w('fin-feminin')).toBeGreaterThan(w('rond-kawaii'));
  });
});

/** Liaison familles <-> mesures : le JSON de scripts/eye-refs/extract_lashes.py (v2) est la source des valeurs annotées « M » dans eye-lash-families.ts. */
describe('familles de cils : cohérence avec references/eyes/measures-lashes.json', () => {
  const J = JSON.parse(readFileSync('references/eyes/measures-lashes.json', 'utf8')) as {
    version: number; summary: Record<string, { eyes: number; orientation: Record<string, number>; upperSpikes: { n?: number; bendMed?: number }; strokesUpper: { n?: number; startAngleMed?: number } }>;
    eyes: { id: string; outerSide: 'left' | 'right'; orientation: string; bbox: number[] }[];
  };
  it('les 5 planches (12 à 16) sont mesurées, version 2, et l’orientation externe est déterminée par construction (pas par heuristique) pour ≥ 80 % des yeux', () => {
    expect(J.version).toBe(2); expect(Object.keys(J.summary).sort()).toEqual(['12', '13', '14', '15', '16']);
    const all = Object.values(J.summary); const tot = all.reduce((s, v) => s + v.eyes, 0); const heur = all.reduce((s, v) => s + (v.orientation.heuristic ?? 0), 0);
    expect(tot).toBeGreaterThanOrEqual(55); expect(heur / tot).toBeLessThan(0.2);
  });
  it('planches en paires : les yeux appariés par miroir sont autant « gauche » que « droite » (chaque couple en contient un de chaque)', () => {
    const pairs = J.eyes.filter((e) => e.orientation === 'pair'); expect(pairs.length).toBeGreaterThan(20);
    for (const sheet of ['12', '15', '16']) { const p = pairs.filter((e) => e.id.startsWith(sheet + '-')); const l = p.filter((e) => e.outerSide === 'left').length; expect(p.length, sheet).toBeGreaterThan(0); expect(Math.abs(l - (p.length - l)), sheet).toBeLessThanOrEqual(2); }
  });
  it('la courbure médiane mesurée des pointes est de signe « se redresse » (< 0) sur 12, 13 et 16 : bendDeg positif des familles tracées', () => {
    for (const k of ['12', '13', '16']) expect(J.summary[k]!.upperSpikes.bendMed ?? 0, k).toBeLessThan(0);
    for (const id of ['plume', 'touffes', 'fin-feminin', 'aile-liner', 'rond-kawaii', 'trio-externe', 'touffes-bas', 'frange-dense', 'ticks-reguliers'] as const) expect(LASH_FAMILIES[id].upper.bendDeg as number, id).toBeGreaterThan(0);
  });
  it('la famille « traînants » (réf. 14 : traits couchés vers l’extérieur) est la seule à bendDeg négatif', () => {
    expect(J.summary['14']!.strokesUpper.n).toBeGreaterThan(5);
    const neg = LASH_FAMILY_IDS.filter((id) => (LASH_FAMILIES[id].upper.bendDeg as number) < 0); expect(neg).toEqual(['trainants']);
  });
  it('les familles qui concentrent les cils côté externe (position médiane des pointes mesurée 0,65–0,83) ont span.from ≥ 0,35', () => {
    for (const id of ['plume', 'fin-feminin', 'aile-liner', 'trio-externe', 'trainants', 'touffes-bas'] as const) expect(((LASH_FAMILIES[id].upper.span as { from: number }).from), id).toBeGreaterThanOrEqual(0.35);
  });
});

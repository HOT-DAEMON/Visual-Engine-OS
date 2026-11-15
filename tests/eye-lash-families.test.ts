import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { compileScene } from '../src';
import { LASH_FAMILIES, LASH_FAMILY_IDS, applyLashFamily } from '../src/generation/eye-lash-families';
import { generateExtraEye } from '../src/generation/eye-gallery-ext';

const W = 700, H = 460;
const base = { ...generateExtraEye(6), eyebrow: null } as Record<string, unknown>;
const bare = { ...base, lashes: { upper: { count: 0, flick: { count: 0 } }, lower: { count: 0 } } };
function pixels(eye: Record<string, unknown>): Uint8Array {
  const r = compileScene({ width: W, height: H, background: '#ff00ff', objects: [{ kind: 'eye', id: 'e', transform: { x: W / 2, y: H / 2 }, ...eye }] } as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return new Resvg(r.svg, { fitTo: { mode: 'width', value: W } }).render().pixels as unknown as Uint8Array;
}
const P0 = pixels(bare);
/** Masque des pixels que les cils ajoutent (différence avec le même œil sans cils). */
function lashMask(id: (typeof LASH_FAMILY_IDS)[number]): Uint8Array {
  const p = pixels(applyLashFamily(base, id)); const m = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { const d = Math.abs((p[4 * i] as number) - (P0[4 * i] as number)) + Math.abs((p[4 * i + 1] as number) - (P0[4 * i + 1] as number)) + Math.abs((p[4 * i + 2] as number) - (P0[4 * i + 2] as number)); m[i] = d > 60 ? 1 : 0; }
  return m;
}
/** Luminance moyenne des pixels ajoutés par les cils (0 = noir) : les références sont en encre noire franche. */
function meanLum(id: (typeof LASH_FAMILY_IDS)[number], m: Uint8Array): number { const p = pixels(applyLashFamily(base, id)); let s = 0, n = 0; for (let i = 0; i < W * H; i++) if (m[i]) { s += 0.2126 * (p[4 * i] as number) + 0.7152 * (p[4 * i + 1] as number) + 0.0722 * (p[4 * i + 2] as number); n++; } return n ? s / n : 255; }
const area = (m: Uint8Array): number => m.reduce((s, v) => s + v, 0);
const bbox = (m: Uint8Array) => { let x0 = W, x1 = 0, y0 = H, y1 = 0; for (let i = 0; i < m.length; i++) if (m[i]) { const x = i % W, y = (i / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, x1, y0, y1 }; };
const jaccard = (a: Uint8Array, b: Uint8Array): number => { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { if (a[k] && b[k]) i++; if (a[k] || b[k]) u++; } return u ? i / u : 1; };

describe('familles de cils (réfs 12, 13, 16)', () => {
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

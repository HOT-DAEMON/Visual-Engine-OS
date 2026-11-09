import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { faceLandmarks, hairGeometry, type HairGeometry } from '../src/face';
import { checkFringeTufts, isTuft, tipJag, tuftStats, TUFT_LIMITS } from '../src/verify/hair-fringe-tufts';
import { hairFaceSpec, type CleanStyle } from '../scripts/lib/hair-faces';

const STYLES: CleanStyle[] = ['short', 'spiky', 'curly', 'afro', 'bob', 'long', 'ponytail', 'bun', 'braids'];
const blades = (st: CleanStyle, k: number) => {
  const sp = hairFaceSpec(st, k, { engine: 'v2', seed: 61000 + k * 31 + STYLES.indexOf(st) * 7, hair: { fringeEngine: { mode: 'blades', gap: 0.25 + 0.55 * ((k * 37) % 10) / 10, count: 0, side: k % 2 ? 1 : -1, cheekLocks: false } } });
  const f = generateRandomFace(sp.seed, sp.opts), lm = faceLandmarks(f.params, f.width, f.height);
  return { f, lm, g: hairGeometry(f.params, lm) as HairGeometry };
};

describe('forme des touffes de frange (docs/HAIR-BLADES.md)', () => {
  it('positif : 9 coiffures × 10 visages à lames, aucun contrôle en échec', () => {
    let n = 0;
    for (const st of STYLES) for (let k = 0; k < 10; k++) {
      const { f, lm, g } = blades(st, k);
      if (f.params.hair.fringeEngine.mode !== 'blades') continue;
      const bad = checkFringeTufts(g, 'blades', lm.W, lm.H).filter((c) => !c.ok && c.severity === 'error');
      expect(bad.map((c) => `${st}${k}:${c.id}`)).toEqual([]);
      n++;
    }
    expect(n).toBeGreaterThan(60);
  });

  it('la mise en page est continue : peu de touffes trapues, aucune lame géante', () => {
    const { lm, g } = blades('afro', 3), s = tuftStats(g, lm.W)!;
    expect(s.n).toBeGreaterThanOrEqual(10);
    expect(s.maxW).toBeLessThan(TUFT_LIMITS.maxW);
    expect(s.squat).toBeLessThan(TUFT_LIMITS.squat);
  });

  it('fringe-tuft-width : une lame géante est refusée', () => {
    const { lm, g } = blades('long', 3), t = g.locks.find(isTuft)!;
    expect(checkFringeTufts(g, 'blades', lm.W, lm.H).find((c) => c.id === 'fringe-tuft-width')!.ok).toBe(true);
    const big = { ...g, locks: g.locks.map((l) => (l === t ? { ...l, w0: 0.4 * lm.W } : l)) } as HairGeometry;
    expect(checkFringeTufts(big, 'blades', lm.W, lm.H).find((c) => c.id === 'fringe-tuft-width')!.ok).toBe(false);
  });

  it('fringe-tuft-continuous : des touffes écartées (trous entre racines) sont refusées', () => {
    const { lm, g } = blades('long', 3);
    const ts = g.locks.filter(isTuft).sort((a, b) => (a.spine as { x: number }[])[0]!.x - (b.spine as { x: number }[])[0]!.x);
    expect(ts.length).toBeGreaterThanOrEqual(6);
    // Écarte les touffes d'un pas fixe de 0,08 W, largeur de base réduite : des trous de peau entre chaque racine.
    const apart = { ...g, locks: g.locks.map((l) => { const i = ts.indexOf(l); if (i < 0) return l; const dx = -0.4 * lm.W + i * 0.08 * lm.W - (l.spine as { x: number }[])[0]!.x; return { ...l, w0: 0.02 * lm.W, spine: (l.spine as { x: number; y: number }[]).map((q) => ({ x: q.x + dx, y: q.y })) }; }) } as HairGeometry;
    expect(checkFringeTufts(g, 'blades', lm.W, lm.H).find((c) => c.id === 'fringe-tuft-continuous')!.ok).toBe(true);
    expect(checkFringeTufts(apart, 'blades', lm.W, lm.H).find((c) => c.id === 'fringe-tuft-continuous')!.ok).toBe(false);
  });

  it('fringe-tuft-slender : des triangles trapus (ligne médiane plus courte que la base) sont refusés', () => {
    const { lm, g } = blades('long', 3);
    const squat = { ...g, locks: g.locks.map((l) => (isTuft(l) ? { ...l, w0: 0.2 * lm.W } : l)) } as HairGeometry;
    expect(checkFringeTufts(g, 'blades', lm.W, lm.H).find((c) => c.id === 'fringe-tuft-slender')!.ok).toBe(true);
    expect(checkFringeTufts(squat, 'blades', lm.W, lm.H).find((c) => c.id === 'fringe-tuft-slender')!.ok).toBe(false);
  });

  it('fringe-tip-jag : un bord en scie (pointes longue / courte alternées) est signalé, un bord doux ne l\'est pas', () => {
    const { lm, g } = blades('long', 3);
    const ts = g.locks.filter((l) => l.kind === 'fringe' && l.spine).sort((a, b) => (a.spine as { x: number }[])[0]!.x - (b.spine as { x: number }[])[0]!.x);
    const saw = { ...g, locks: g.locks.map((l) => { const i = ts.indexOf(l); if (i < 0) return l; const sp = (l.spine as { x: number; y: number }[]).map((q, j, a) => (j === a.length - 1 ? { x: q.x, y: q.y + (i % 2 ? 0.05 : -0.05) * lm.H } : q)); return { ...l, spine: sp }; }) } as HairGeometry;
    expect(tipJag(g, lm.H)!).toBeLessThan(TUFT_LIMITS.jag);
    expect(tipJag(saw, lm.H)!).toBeGreaterThan(TUFT_LIMITS.jag);
    expect(checkFringeTufts(saw, 'blades', lm.W, lm.H).find((c) => c.id === 'fringe-tip-jag')!.ok).toBe(false);
  });

  it('les autres modes ne sont pas jugés sur la continuité (le front reste ouvert par conception)', () => {
    const { lm, g } = blades('long', 3);
    const ids = checkFringeTufts(g, 'asym_brow', lm.W, lm.H).map((c) => c.id);
    expect(ids).not.toContain('fringe-tuft-continuous');
    expect(ids).not.toContain('fringe-tuft-width');
  });
});

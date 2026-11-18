import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Resvg } from '@resvg/resvg-js';
import { compileScene } from '../src';
import { extraEyeRecipes, generateExtraEye } from '../src/generation/eye-gallery-ext';
import { INK_COLOR, INK_13_IRIS_BODY } from '../src/generation/eye-ref-looks';
import { EyeSpec } from '../src/schema';
import { resolveEye } from '../src/render/eye/eye';
import { eyeToneShare } from '../scripts/lib/verify-eye-render';

const MEAS = JSON.parse(readFileSync('references/eyes/measures-ink.json', 'utf8')).refs as Record<string, { ink: string; toneShare: number }>;
const inkIdx = (): number[] => extraEyeRecipes().filter((r) => r.ref && !r.ref.startsWith('15-')).map((r) => r.index);
const png = (eye: Record<string, unknown>): Uint8Array => { const r = compileScene({ width: 400, height: 280, background: '#ffffff', objects: [{ kind: 'eye', id: 'e', transform: { x: 200, y: 140 }, shape: { width: 240, height: 130 }, ...eye, eyebrow: null }] } as never); if (!r.ok) throw new Error(r.issues.join('\n')); return new Resvg(r.svg).render().pixels as unknown as Uint8Array; };

describe('fini flat (aplats francs) — look encre des réfs 12 / 13 / 17', () => {
  it('les teintes d’encre du moteur sont celles de measures-ink.json', () => { expect(INK_COLOR['17']).toBe(MEAS['17']!.ink); expect(INK_COLOR['13']).toBe(MEAS['13']!.ink); });
  it('les références 12 et 17 sont des aplats (toneShare 0), la 13 a un iris en dégradé vectoriel', () => { expect(MEAS['12']!.toneShare).toBe(0); expect(MEAS['17']!.toneShare).toBe(0); expect(MEAS['13']!.toneShare).toBeGreaterThan(0.05); });
  it('tous les yeux « encre » de la galerie sont flat et leur rendu a un toneShare <= 0,02 ; le même œil en fini `shaded` est > 0,10 (la règle distingue)', () => {
    const ids = inkIdx(); expect(ids.length).toBeGreaterThanOrEqual(15);
    for (const i of ids) {
      const e = generateExtraEye(i) as Record<string, unknown>; expect(e.finish).toBe('flat');
      expect(eyeToneShare(e)).toBeLessThanOrEqual(0.02);
    }
    const shaded = ids.map((i) => eyeToneShare({ ...(generateExtraEye(i) as Record<string, unknown>), finish: 'shaded' }));
    expect(shaded.filter((v) => v > 0.1).length).toBeGreaterThanOrEqual(Math.floor(ids.length * 0.8));
  });
  it('finish est CONSOMMÉ : même œil, `flat` retire fibres, anneau limbique, lueur, détail, ombre de paupière et vignettage (le SVG change et perd ses dégradés)', () => {
    const base = { shape: { width: 240, height: 130 }, iris: { detail: {}, fibers: 60 } } as Record<string, unknown>;
    const a = compileScene({ width: 400, height: 280, objects: [{ kind: 'eye', id: 'e', transform: { x: 200, y: 140 }, ...base, finish: 'shaded' }] } as never); const b = compileScene({ width: 400, height: 280, objects: [{ kind: 'eye', id: 'e', transform: { x: 200, y: 140 }, ...base, finish: 'flat' }] } as never);
    if (!a.ok || !b.ok) throw new Error('compile');
    const grads = (s: string): number => (s.match(/<(radial|linear)Gradient/g) ?? []).length;
    expect(grads(a.svg)).toBeGreaterThan(grads(b.svg) + 3); expect(b.svg.length).toBeLessThan(a.svg.length * 0.5);
  });
  it('resolveEye(flat) : fibres 0, limbe 0, lueur et détail nuls, bord de pupille net ; `shaded` inchangé', () => {
    const s = EyeSpec.parse({ kind: 'eye', id: 'e', finish: 'flat', iris: { fibers: 60, limbalRing: 0.9, detail: {} }, pupil: { edge: { softness: 0.8 } }, appearance: {}, microdetail: {} });
    const r = resolveEye(s); expect(r.iris.fibers).toBe(0); expect(r.iris.limbalRing).toBe(0); expect(r.iris.glow).toBeNull(); expect(r.iris.detail).toBeNull(); expect(r.pupil.edge.softness).toBe(0); expect(r.appearance).toBeNull(); expect(r.microdetail).toBeNull();
    const t = EyeSpec.parse({ kind: 'eye', id: 'e', iris: { fibers: 60 } }); expect(resolveEye(t).iris.fibers).toBe(60);
  });
  it('un œil flat n’a que des tons plats : les traits sont l’encre mesurée et l’iris 13 a un corps gris plat', () => {
    const rc = extraEyeRecipes(); const i17 = rc.find((r) => r.ref?.startsWith('17-'))!.index; const i13 = rc.find((r) => r.ref?.startsWith('13-'))!.index;
    const e17 = resolveEye(EyeSpec.parse(generateExtraEye(i17))); const e13 = resolveEye(EyeSpec.parse(generateExtraEye(i13)));
    expect((e17.lids.material.base as { color: string }).color).toBe(INK_COLOR['17']); expect((e13.lids.material.base as { color: string }).color).toBe(INK_COLOR['13']);
    expect((e13.iris.layers[0] as { color: string }).color).toBe(INK_13_IRIS_BODY); expect(e13.iris.layers.every((l) => l.gradient === 'none' && l.feather === 0)).toBe(true);
    expect(png(generateExtraEye(i17) as never).length).toBeGreaterThan(0);
  });
});

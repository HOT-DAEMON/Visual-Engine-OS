import { describe, expect, it } from 'vitest';
import { generateRandomFace, type RandomFace } from '../src/generation/random-face';
import { checkEyePair } from '../src/verify/eye-pair';
import { checkFaceEngine } from '../src/verify/face-engine';

const mutate = (f: RandomFace, side: 'eye-left' | 'eye-right', fn: (o: any) => void): RandomFace => {
  const c = JSON.parse(JSON.stringify(f)) as RandomFace; fn((c.objects as any[]).find((o) => o.id.endsWith(side))); return c;
};
const failing = (f: RandomFace): string[] => checkEyePair(f).filter((c) => !c.ok).map((c) => c.id);

describe('vérification de la paire d’yeux (géométrie, anatomie, style)', () => {
  it('les visages générés (galerie, étendue, œil tiré) passent les 9 contrôles', () => {
    for (const src of ['gallery', 'extended', 'random'] as const) for (let s = 1; s <= 60; s++) expect(failing(generateRandomFace(s, { eyeSource: src })), `${src} ${s}`).toEqual([]);
  });
  it('couche rattachée à checkFaceEngine : 9 contrôles (6 + fini, présence et force des microdétails), trois couches représentées', () => {
    const f = generateRandomFace(3, { eyeSource: 'extended' }); const ids = checkFaceEngine(f).filter((c) => c.id.startsWith('eyes-'));
    expect(ids).toHaveLength(9); expect(new Set(ids.map((c) => c.layer))).toEqual(new Set(['geometry', 'anatomy', 'style']));
  });
  it('détecte : deux coins externes du même côté, taille asymétrique, hauteurs différentes, identités différentes, roulis différent', () => {
    const f = generateRandomFace(9, { eyeSource: 'extended' });
    expect(failing(mutate(f, 'eye-right', (o) => { o.shape.outerSide = o.shape.outerSide === 'left' ? 'right' : 'left'; }))).toContain('eyes-outer-corners-opposite');
    expect(failing(mutate(f, 'eye-right', (o) => { o.transform.scale *= 1.5; }))).toContain('eyes-scale-asymmetry');
    expect(failing(mutate(f, 'eye-right', (o) => { o.transform.y += 0.3 * o.shape.width * o.transform.scale; }))).toContain('eyes-same-height');
    expect(failing(mutate(f, 'eye-right', (o) => { o.iris.aspect = 1.6; }))).toContain('eyes-same-identity');
    expect(failing(mutate(f, 'eye-left', (o) => { o.transform.rotationDeg += 5; }))).toContain('eyes-share-roll');
  });
});

describe('PASSE 8 — appariement d’échelle des yeux bridés par le sourcil', () => {
  it('un sharp à hauteur respectée (graine 3, galerie) reste sous la borne anatomique 1/0,85 grâce au plafond de paire ; sans plafond l’écart est de 1,22', async () => {
    const { PAIR_SCALE_MAX } = await import('../src/face');
    const f = generateRandomFace(3, { eyeSource: 'gallery' }); const sc = (s: string): number => (f.objects.find((o) => o.id.endsWith(s)) as any).transform.scale;
    const r = Math.max(sc('eye-left') / sc('eye-right'), sc('eye-right') / sc('eye-left'));
    expect(r).toBeLessThanOrEqual(PAIR_SCALE_MAX + 1e-9); expect(r).toBeLessThan(1 / 0.85);
    const raw = Math.max(f.fits.left.scale / f.fits.right.scale, f.fits.right.scale / f.fits.left.scale); expect(raw).toBeLessThanOrEqual(PAIR_SCALE_MAX + 1e-9);
  });
  it('passe 17 — détecte : fini différent (error), microdétails sur un seul œil ou de force trop différente (warn)', () => {
    const f = generateRandomFace(9, { eyeSource: 'extended' });
    expect(failing(mutate(f, 'eye-right', (o) => { (o as { finish?: string }).finish = 'flat'; }))).toContain('eyes-same-finish');
    const md = (outer: number) => ({ canthusLines: { outer, inner: 0.4 }, edge: { irregularity: 0.5 } });
    const one = mutate(f, 'eye-right', (o) => { (o as { microdetail?: unknown }).microdetail = md(0.5); });
    expect(failing(one)).toContain('eyes-micro-presence');
    const both = mutate(mutate(f, 'eye-right', (o) => { (o as { microdetail?: unknown }).microdetail = md(0.9); }), 'eye-left', (o) => { (o as { microdetail?: unknown }).microdetail = md(0.2); });
    expect(failing(both)).toContain('eyes-micro-strength-match'); expect(failing(both)).not.toContain('eyes-micro-presence');
    const ok = mutate(mutate(f, 'eye-right', (o) => { (o as { microdetail?: unknown }).microdetail = md(0.5); }), 'eye-left', (o) => { (o as { microdetail?: unknown }).microdetail = md(0.5); });
    expect(failing(ok)).toEqual([]);
  });
});

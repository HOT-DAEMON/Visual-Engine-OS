import { describe, expect, it } from 'vitest';
import { generateRandomFace, type RandomFace } from '../src/generation/random-face';
import { checkEyePair } from '../src/verify/eye-pair';
import { checkFaceEngine } from '../src/verify/face-engine';

const mutate = (f: RandomFace, side: 'eye-left' | 'eye-right', fn: (o: any) => void): RandomFace => {
  const c = JSON.parse(JSON.stringify(f)) as RandomFace; fn((c.objects as any[]).find((o) => o.id.endsWith(side))); return c;
};
const failing = (f: RandomFace): string[] => checkEyePair(f).filter((c) => !c.ok).map((c) => c.id);

describe('vérification de la paire d’yeux (géométrie, anatomie, style)', () => {
  it('les visages générés (galerie, étendue, œil tiré) passent les 6 contrôles', () => {
    for (const src of ['gallery', 'extended', 'random'] as const) for (let s = 1; s <= 60; s++) expect(failing(generateRandomFace(s, { eyeSource: src })), `${src} ${s}`).toEqual([]);
  });
  it('couche rattachée à checkFaceEngine : 6 contrôles, trois couches représentées', () => {
    const f = generateRandomFace(3, { eyeSource: 'extended' }); const ids = checkFaceEngine(f).filter((c) => c.id.startsWith('eyes-'));
    expect(ids).toHaveLength(6); expect(new Set(ids.map((c) => c.layer))).toEqual(new Set(['geometry', 'anatomy', 'style']));
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

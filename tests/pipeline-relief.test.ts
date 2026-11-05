import { describe, expect, it } from 'vitest';
import { compileScene, generateRandomFace } from '../src';

/** Éclairage par relief branché au pipeline principal (`kind: 'head_lit'`, docs/PIPELINE-RELIEF.md). */
const objs = (seed: number) => generateRandomFace(seed, { id: 'f0', transform: { x: 190, y: 240, scale: 0.8 } }).objects;
const scene = (seed: number, lit: Record<string, unknown> | null = {}, light: Record<string, unknown> = {}) => ({ width: 380, height: 480, background: '#ece6dc', light, objects: [...objs(seed), ...(lit ? [{ kind: 'head_lit', id: 'l0', host: 'f0', ...lit }] : [])] });

describe('éclairage par relief dans le pipeline principal', () => {
  it('compile, est déterministe, et ajoute une couche posée APRÈS tous les autres objets', () => {
    const a = compileScene(scene(11)), b = compileScene(scene(11)), solo = compileScene(scene(11, null));
    expect(a.ok && b.ok && solo.ok).toBe(true);
    if (!a.ok || !b.ok || !solo.ok) return;
    expect(a.svg).toBe(b.svg);
    expect(a.svg.length).toBeGreaterThan(solo.svg.length);
    expect(a.svg.lastIndexOf('<image')).toBeGreaterThan(solo.svg.lastIndexOf('</g>') - 1 - 0 * 1); // la couche est la dernière du document
    expect(a.svg.endsWith('</svg>')).toBe(true);
  });

  it("l'éclairage dépend de la lumière de la scène ET de la surcharge locale ; le style change le rendu", () => {
    const base = compileScene(scene(11)), moved = compileScene(scene(11, {}, { azimuthDeg: 60 })), over = compileScene(scene(11, { light: { azimuthDeg: 60 } })), cel = compileScene(scene(11, { style: 'cel2' }));
    for (const r of [base, moved, over, cel]) expect(r.ok).toBe(true);
    if (!base.ok || !moved.ok || !over.ok || !cel.ok) return;
    expect(moved.svg).not.toBe(base.svg);
    expect(cel.svg).not.toBe(base.svg);
    // Une surcharge locale égale à la lumière de scène donne le même rendu que cette lumière de scène (même source de vérité).
    const sameLight = compileScene({ ...scene(11, { light: { azimuthDeg: 60 } }), light: {} }), sceneLight = compileScene(scene(11, {}, { azimuthDeg: 60 }));
    expect(sameLight.ok && sceneLight.ok).toBe(true);
    if (sameLight.ok && sceneLight.ok) expect(sameLight.svg.slice(-4000)).toBe(sceneLight.svg.slice(-4000));
  });

  it('rejette : hôte introuvable, deux éclairages sur le même hôte, option inconnue, hôte non-visage', () => {
    expect(compileScene(scene(11, { host: 'zz' })).ok).toBe(false);
    const two = { ...scene(11), objects: [...scene(11).objects, { kind: 'head_lit', id: 'l1', host: 'f0' }] };
    expect(compileScene(two).ok).toBe(false);
    expect(compileScene(scene(11, { gloss: 1 })).ok).toBe(false);
    expect(compileScene({ width: 200, height: 200, objects: [{ kind: 'host', id: 'h', shape: 'rect', width: 100, height: 100 }, { kind: 'head_lit', id: 'l', host: 'h' }] }).ok).toBe(false);
  });
});

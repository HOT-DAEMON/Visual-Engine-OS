import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { compileScene, generateRandomFace } from '../src';
import { dedupeDefs, duplicateIds, leadingId } from '../src/core/defs';

const clip = (id: string, d = 'M0 0H10V10H0Z'): string => `<clipPath id="${id}"><path d="${d}"/></clipPath>`;

describe('dedupeDefs', () => {
  it('supprime une définition strictement identique, garde le premier exemplaire et l’ordre', () => {
    const r = dedupeDefs([clip('a'), '<linearGradient id="g"><stop offset="0"/></linearGradient>', clip('a'), clip('b')]);
    expect(r.defs).toEqual([clip('a'), '<linearGradient id="g"><stop offset="0"/></linearGradient>', clip('b')]);
    expect(r.removed).toBe(1); expect(r.conflicts).toEqual([]);
  });
  it('un même id de contenu DIFFÉRENT est conservé et signalé (jamais masqué)', () => {
    const r = dedupeDefs([clip('a'), clip('a', 'M0 0H99V99H0Z')]);
    expect(r.defs).toHaveLength(2); expect(r.conflicts).toEqual(['a']); expect(r.removed).toBe(0);
  });
  it('une définition sans id est toujours conservée ; leadingId lit l’id de tête', () => {
    expect(dedupeDefs(['<style/>', '<style/>']).defs).toHaveLength(2);
    expect(leadingId('<clipPath id="x-1">…')).toBe('x-1'); expect(leadingId('<g>')).toBeNull();
  });
  it('duplicateIds repère un id répété dans un SVG', () => {
    expect(duplicateIds('<svg><g id="a"/><g id="b"/><g id="a"/></svg>')).toEqual(['a']);
    expect(duplicateIds('<svg><g id="a"/><g id="b"/></svg>')).toEqual([]);
  });
  it('contrôle négatif de rendu : deux clipPath identiques ou un seul → mêmes pixels', () => {
    const wrap = (defs: string): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40"><defs>${defs}</defs><g clip-path="url(#a)"><rect width="40" height="40" fill="#c33"/></g></svg>`;
    const px = (s: string): Uint8Array => new Resvg(s).render().pixels;
    expect(Buffer.from(px(wrap(clip('a') + clip('a')))).equals(Buffer.from(px(wrap(clip('a')))))).toBe(true);
  });
});

describe('scènes compilées : un seul élément par identifiant', () => {
  const scene = (seeds: number[], legs: boolean): unknown => ({ width: 900, height: 700, background: '#f4f1ec', objects: seeds.flatMap((seed, i) => {
    const f = generateRandomFace(seed, { id: `f${i}`, transform: { x: 150 + 300 * i, y: 200, scale: 0.5 } });
    return [...f.objects, { kind: 'body', id: `b${i}`, host: `f${i}`, body: { age: 25 + i, sex: i % 2, muscularity: 0.5 }, ...(legs ? { legs: {} } : {}) }];
  }) });
  it('60 visages seuls : 0 identifiant dupliqué (avant : 58 sur 60)', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const f = generateRandomFace(seed, { id: 'f0', transform: { x: 190, y: 200, scale: 0.5 } });
      const r = compileScene({ width: 380, height: 480, background: '#f4f1ec', objects: f.objects } as never);
      expect(r.ok).toBe(true); if (r.ok) expect(duplicateIds(r.svg), `graine ${seed}`).toEqual([]);
    }
  });
  it('scènes à 3 personnages (corps + jambes) : 0 dupliqué, pour plusieurs jeux de graines', () => {
    for (const seeds of [[3, 11, 42], [5, 8, 13], [21, 34, 55]]) {
      const r = compileScene(scene(seeds, true) as never);
      expect(r.ok).toBe(true); if (r.ok) expect(duplicateIds(r.svg), seeds.join()).toEqual([]);
    }
  });
});

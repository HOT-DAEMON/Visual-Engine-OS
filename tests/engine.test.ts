import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { compileScene, highlightOffsets, lightVector, SceneSpec } from '../src';

const load = (name: string): unknown => JSON.parse(readFileSync(new URL(`../examples/${name}.json`, import.meta.url), 'utf8'));

function svgOf(input: unknown): string {
  const r = compileScene(input);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
}

/** Chaque id est unique, et chaque url(#id) pointe vers un id existant. */
function assertReferencesResolve(svg: string): void {
  const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1] as string);
  expect(new Set(ids).size).toBe(ids.length);
  const refs = [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1] as string);
  for (const r of refs) expect(ids).toContain(r);
}

describe('déterminisme', () => {
  it('même entrée => même SVG, octet pour octet', () => {
    const a = svgOf(load('showcase'));
    const b = svgOf(JSON.parse(JSON.stringify(load('showcase'))));
    expect(a).toBe(b);
  });

  it('la seed change la géométrie des fibres, et seulement elle', () => {
    const base = (seed: number) => ({ objects: [{ kind: 'eye', id: 'e', seed }] });
    expect(svgOf(base(1))).not.toBe(svgOf(base(2)));
    expect(svgOf(base(5))).toBe(svgOf(base(5)));
  });

  it('empreinte de référence de first-eye (change si le rendu change : à relire, pas à ignorer)', () => {
    const hash = createHash('sha256').update(svgOf(load('first-eye'))).digest('hex');
    expect(hash).toMatchSnapshot();
  });
});

describe('SVG produit', () => {
  for (const name of [
    'first-eye',
    'showcase',
    'robots',
    'anatomy',
    'face',
    'hosts',
    'expressions',
    'gallery',
    'coordination',
    'eye-styles',
    'archetypes',
    'new-kinds',
    'pupil-richness',
    'head-turn-demo',
    'new-expressions',
  ]) {
    it(`${name} : références résolues, rendu resvg OK, dimensions exactes`, () => {
      const svg = svgOf(load(name));
      assertReferencesResolve(svg);
      const scene = SceneSpec.parse(load(name));
      const img = new Resvg(svg).render();
      expect(img.width).toBe(scene.width);
      expect(img.height).toBe(scene.height);
    });
  }

  it('n\'émet aucun élément actif, même avec un label hostile', () => {
    const svg = svgOf({ label: '"><script>alert(1)</script>', objects: [{ kind: 'eye', id: 'e' }] });
    expect(svg).not.toMatch(/<script/i);
    expect(svg).not.toMatch(/<foreignObject/i);
    expect(svg).not.toMatch(/\son\w+=/i);
    expect(svg).toContain('&lt;script&gt;');
  });

  it('un openness minimal ne produit ni NaN ni Infinity', () => {
    const svg = svgOf({ objects: [{ kind: 'eye', id: 'e', shape: { openness: 0.05 } }] });
    expect(svg).not.toMatch(/NaN|Infinity/);
  });
});

describe('lumière cohérente entre objets', () => {
  it('reflets « anime » : même direction dans le monde quel que soit la rotation de l\'œil', () => {
    const world = lightVector(SceneSpec.parse({ light: { azimuthDeg: 300, elevationDeg: 50 }, objects: [{ kind: 'eye', id: 'e' }] }).light);
    const worldOffset = (rotationDeg: number) => {
      const s = SceneSpec.parse({
        objects: [{ kind: 'eye', id: 'e', iris: { aspect: 1 }, transform: { rotationDeg } }],
      });
      const e = s.objects[0];
      if (e?.kind !== 'eye') throw new Error('œil attendu');
      const o = highlightOffsets(e, world).primary;
      const a = (rotationDeg * Math.PI) / 180;
      // repère local -> monde : rotation SVG horaire
      return { x: o.x * Math.cos(a) - o.y * Math.sin(a), y: o.x * Math.sin(a) + o.y * Math.cos(a) };
    };
    const ref = worldOffset(0);
    for (const rot of [37, 90, -120, 180]) {
      const w = worldOffset(rot);
      expect(w.x).toBeCloseTo(ref.x, 6);
      expect(w.y).toBeCloseTo(ref.y, 6);
    }
    // lumière en haut à gauche => reflet en haut à gauche du centre de l'iris
    expect(ref.x).toBeLessThan(0);
    expect(ref.y).toBeLessThan(0);
  });

  it('changer la lumière change le rendu de l\'œil ET du panneau', () => {
    const objs = [
      { kind: 'eye', id: 'e' },
      { kind: 'panel', id: 'p', material: { preset: 'waxed_metal', color: '#c9d1d9' } },
    ];
    const a = svgOf({ light: { azimuthDeg: 330 }, objects: objs });
    const b = svgOf({ light: { azimuthDeg: 120 }, objects: objs });
    expect(a).not.toBe(b);
  });
});

describe('généricité du système de matériaux', () => {
  const panel = (material: unknown) => svgOf({ objects: [{ kind: 'panel', id: 'p', material }] });
  const irisWith = (material: unknown) => svgOf({ objects: [{ kind: 'eye', id: 'e', iris: { material } }] });

  it('le même preset métal produit la rampe d\'environnement sur un panneau ET sur un iris', () => {
    const metal = { preset: 'polished_metal', color: '#c9d1d9' };
    expect(panel(metal)).toContain('id="p-surface-env"');
    expect(irisWith(metal)).toContain('id="e-iris-env"');
  });

  it('un matériau mat n\'en produit pas', () => {
    const matte = { preset: 'matte', color: '#c9d1d9' };
    expect(panel(matte)).not.toContain('-env"');
  });

  it('poli et ciré donnent des rendus différents ; l\'émission ajoute un halo', () => {
    const c = '#c9d1d9';
    expect(panel({ preset: 'polished_metal', color: c })).not.toBe(panel({ preset: 'waxed_metal', color: c }));
    expect(panel({ preset: 'emissive', color: c })).toContain('id="p-surface-halo"');
    expect(panel({ preset: 'matte', color: c })).not.toContain('-halo"');
  });

  it('l\'opacité du matériau est appliquée', () => {
    const m = { base: { type: 'solid', color: '#ffffff' }, opacity: 0.4 };
    expect(panel(m)).toContain('opacity="0.4"');
  });
});

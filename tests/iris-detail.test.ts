import { describe, expect, it } from 'vitest';
import { compileScene, EyeSpec } from '../src';
import { irisPalette, irisFrame } from '../src/render/eye/iris-strands';

const svgOf = (over: Record<string, unknown> = {}) => {
  const r = compileScene({ objects: [{ kind: 'eye', id: 'e', ...over }] });
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
};
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const detail = (d: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => svgOf({ iris: { detail: d }, ...extra });

describe('iris.detail : schéma', () => {
  it('null par défaut ; {} accepté avec ses valeurs par défaut ; clés inconnues et valeurs hors bornes refusées', () => {
    expect(EyeSpec.parse({ id: 'e', kind: 'eye' }).iris.detail).toBeNull();
    const d = EyeSpec.parse({ id: 'e', kind: 'eye', iris: { detail: {} } }).iris.detail!;
    expect(d.accent).toBeNull();
    expect(d.collarette).not.toBeNull();
    expect(d.sparkles).toBe(0);
    for (const bad of [{ detail: { couche: 1 } }, { detail: { density: 2 } }, { detail: { crypts: 99 } }, { detail: { accent: {} } }, { detail: { accent: { color: '#fff' } } }]) {
      expect(EyeSpec.safeParse({ id: 'e', kind: 'eye', iris: bad }).success).toBe(false);
    }
  });
});

describe('iris.detail : rendu', () => {
  it('opt-in strict : sans `detail` (ou detail: null), aucune trace du moteur de détail dans le SVG', () => {
    const plain = svgOf();
    expect(plain).not.toContain('e-idetail-clip');
    expect(svgOf({ iris: { detail: null } })).toBe(plain);
  });

  it("avec `detail` : l'iris est découpé dans son ellipse et les couches par défaut sont présentes", () => {
    const s = detail();
    expect(s).toContain('id="e-idetail-clip"');
    for (const id of ['e-iz', 'e-bg', 'e-lm', 'e-ts', 'e-ph']) expect(s).toContain(`id="${id}"`);
    expect(s).not.toContain('id="e-fl1"'); // pas d'accent => pas de flammes
  });

  it('chaque couche se désactive indépendamment', () => {
    const off = detail({ innerZone: null, bottomGlow: null, topShade: 0, pupilHalo: 0, limbal: { strength: 0 }, collarette: null, crypts: 0 });
    for (const id of ['e-iz', 'e-bg', 'e-lm', 'e-ts', 'e-ph']) expect(off).not.toContain(`id="${id}"`);
  });

  it('`accent` ajoute deux couronnes de flammes (une langue par pointe, par couronne)', () => {
    const a = detail({ crypts: 0 });
    const b = detail({ crypts: 0, accent: { color: '#ffb347', spikes: 20 } });
    expect(b).toContain('id="e-fl1"');
    expect(b).toContain('id="e-fl2"');
    expect(count(b, /<path /g) - count(a, /<path /g)).toBe(40);
  });

  it('`sparkles` ajoute exactement ce nombre de petits cercles ; `crypts` ce nombre de fuseaux', () => {
    expect(count(detail({ sparkles: 7 }), /<circle /g) - count(detail({ sparkles: 0 }), /<circle /g)).toBe(7);
    expect(count(detail({ crypts: 12 }), /<path /g) - count(detail({ crypts: 0 }), /<path /g)).toBe(12);
  });

  it('`density` règle le nombre de fibres', () => {
    expect(count(detail({ density: 1 }), /<path /g)).toBeGreaterThan(count(detail({ density: 0 }), /<path /g) + 100);
  });

  it('déterministe (même seed → même SVG), et la seed change le motif', () => {
    expect(detail({ sparkles: 5 }, { seed: 3 })).toBe(detail({ sparkles: 5 }, { seed: 3 }));
    expect(detail({ sparkles: 5 }, { seed: 3 })).not.toBe(detail({ sparkles: 5 }, { seed: 4 }));
  });

  it("la pupille est toujours dessinée PAR-DESSUS les couches de détail", () => {
    const s = detail();
    const body = s.slice(s.indexOf('</defs>'));
    const detailAt = body.indexOf('clip-path="url(#e-idetail-clip)"');
    expect(detailAt).toBeGreaterThan(-1);
    // la pupille (ellipse pleine, couleur par défaut de `pupil.fill`) vient APRÈS le groupe de détail
    const pupilColor = EyeSpec.parse({ id: 'e', kind: 'eye' }).pupil.fill;
    expect(pupilColor.type).toBe('solid');
    const pupilAt = body.indexOf(`fill="${(pupilColor as { color: string }).color}"`, detailAt);
    expect(pupilAt).toBeGreaterThan(detailAt);
  });

  it('ne casse ni les pupilles en fente, ni un regard/une tête tournés, ni les valeurs extrêmes', () => {
    const extreme = { density: 1, contrast: 1, crypts: 24, sparkles: 16, accent: { color: '#ff00aa', reach: 1, spikes: 48, opacity: 1 }, collarette: { radius: 0.85, irregularity: 1, opacity: 1 }, limbal: { width: 0.5, strength: 1 }, topShade: 1, pupilHalo: 1 };
    for (const pupil of [{ shape: 'round', size: 0.7 }, { shape: 'slit_vertical' }, { shape: 'slit_horizontal' }, { shape: 'round', size: 0.12, visible: false }]) {
      for (const iris of [{ radius: 0.15, aspect: 0.7 }, { radius: 0.7, aspect: 1.8 }]) {
        const s = svgOf({ iris: { ...iris, detail: extreme }, pupil, gaze: { yawDeg: 35, pitchDeg: -20 }, headTurn: { yawDeg: 40, pitchDeg: 15 }, shape: { style: 'circle' } });
        expect(s).not.toMatch(/NaN|Infinity/);
      }
    }
  });

  it('taille de sortie raisonnable (< 600 Ko) même au maximum de densité', () => {
    expect(detail({ density: 1, crypts: 24, sparkles: 16, accent: { color: '#ff00aa', spikes: 48 } }).length).toBeLessThan(600_000);
  });
});

describe('identifiants SVG', () => {
  it("tous les `id` d'une scène utilisant liner, cils longs, mèches et iris détaillé sont UNIQUES", () => {
    const s = svgOf({
      shape: { style: 'diamond_v2' },
      lids: { liner: { color: '#0b1b33', tipColor: '#2f6fd0', lowerReach: 0.3 } },
      lashes: { upper: { clump: 0.6, outerLift: 0.5, flick: { count: 3 } } },
      iris: { detail: { accent: { color: '#ffb347' }, sparkles: 4 } },
    });
    const ids = [...s.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]!);
    expect(ids.length).toBeGreaterThan(20);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('iris.detail : palette et repère polaire', () => {
  it('palette : centre / milieu / bord lus dans le matériau (uni ou dégradé)', () => {
    expect(irisPalette({ type: 'solid', color: '#336699' })).toMatchObject({ center: '#336699', mid: '#336699', edge: '#336699' });
    const p = irisPalette({ type: 'radial', stops: [{ offset: 0, color: '#ffffff', opacity: 1 }, { offset: 0.5, color: '#00ff00', opacity: 1 }, { offset: 1, color: '#000000', opacity: 1 }] });
    expect(p.center).toBe('#ffffff');
    expect(p.mid).toBe('#00ff00');
    expect(p.edge).toBe('#000000');
  });
  it('repère polaire : ρ=0 est le centre, ρ=1 le bord de l\'ellipse', () => {
    const f = irisFrame({ x: 10, y: 20 }, 30, 40);
    expect(f.at(0, 1.2)).toEqual({ x: 10, y: 20 });
    expect(f.at(1, 0).x).toBeCloseTo(40, 9);
    expect(f.at(1, Math.PI / 2).y).toBeCloseTo(60, 9);
  });
});

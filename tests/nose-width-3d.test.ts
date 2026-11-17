import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { head3dSubject } from '../src/render/head-3d';
import { alaOf, alaPull } from '../src/head-turntable/parts';
import { frontWidthRatio } from '../src/head-turntable/nose-contour';
import { engineSpec } from '../src/head-turntable/engines/spec-engine';
import { hostOf } from '../scripts/nose-refs/alar-overflow';

const types = [undefined, 'pyramide', 'cloche-ailes', 'plat-trapeze'] as const;
const specs = types.flatMap((a) => [11, 77, 1203, 537].map((sd) => ({ a, spec: head3dSubject(hostOf(sd, a), {} as never).spec })));
const shifted = (s: (typeof specs)[number]['spec']) => { const a = alaOf(s, 1); return { ...a, c: { ...a.c, x: a.c.x + a.ex } }; };

describe('largeur de face du nez 3D (docs/NOSE-WIDTH-3D.md)', () => {
  it('la 3D ne dépasse plus la silhouette 2D : rapport ≤ 1,05 sur 4 types × 4 graines (avant : 1,50–1,54)', () => {
    for (const { a, spec } of specs) { const r = frontWidthRatio(spec, alaOf(spec, 1)); expect(r, String(a)).toBeGreaterThanOrEqual(1 - 1e-6); expect(r, String(a)).toBeLessThanOrEqual(1.05); }
  });
  it('sensibilité : l\'ancien comportement (centre de l\'aile sur la crête) est détecté, > 1,25', () => {
    for (const { a, spec } of specs.filter((x) => x.a !== 'plat-trapeze')) expect(frontWidthRatio(spec, shifted(spec)), String(a)).toBeGreaterThan(1.4);
    for (const { spec } of specs.filter((x) => x.a === 'plat-trapeze')) expect(frontWidthRatio(spec, shifted(spec))).toBeGreaterThan(1.25);
  });
  it('contre la planche de rotation : la largeur de face du nez 3D de la tête de la planche tombe dans la fourchette MESURÉE sur les pixels (seuils 10–18, 14–17 px sur 150 px par tête)', () => {
    const m = JSON.parse(readFileSync('references/nez/measures-planche-rotation-nose-width.json', 'utf8')) as { seuils: Record<string, { w_U: number }> };
    const us = Object.values(m.seuils).map((x) => x.w_U), lo = Math.min(...us), hi = Math.max(...us);
    const pl = engineSpec(undefined, head3dSubject(hostOf(11), {} as never).spec);
    const w2d = 2 * Math.max(...pl.nose.knots.map((q) => q[2])), w3d = w2d * frontWidthRatio(pl, alaOf(pl, 1));
    expect(w2d).toBeGreaterThanOrEqual(lo - 0.01); expect(w2d).toBeLessThanOrEqual(hi + 0.01);   // la silhouette 2D est déjà dans la fourchette
    expect(w3d).toBeGreaterThanOrEqual(lo - 0.01); expect(w3d).toBeLessThanOrEqual(hi + 0.01);   // la 3D l'est maintenant aussi (avant : 0,155 U)
  });
  it('l\'ancrage supprime la saturation du plat-trapèze : aucune graine saturée, rappel ≤ 20 % (avant : 4 sur 40 saturées, 72,5 % rappelées)', () => {
    const pl = specs.filter((x) => x.a === 'plat-trapeze').map((x) => x.spec);
    for (const s of pl) expect(alaPull(s)).toBeLessThan(0.6 * s.nose.alaX - 1e-6);
  });
});

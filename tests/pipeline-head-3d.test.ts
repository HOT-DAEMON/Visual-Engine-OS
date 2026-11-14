import { describe, expect, it } from 'vitest';
import { compileScene, generateRandomFace, SceneSpec } from '../src';
import { irisOf, head3dSubject } from '../src/render/head-3d';
import { placedEyesByHost } from '../src/anatomy/placed';
import { verifyPipeline } from '../src/verify';
import type { HostSpec } from '../src/schema';

/** Tête 3D (tête + cou tournants) branchée au pipeline principal (`kind: 'head_3d'`, docs/PIPELINE-HEAD-3D.md). */
const faceObjs = (seed: number, hair?: Record<string, unknown>) => generateRandomFace(seed, { id: 'f0', transform: { x: 150, y: 220, scale: 0.8 }, ...(hair ? { hairEngine: 'classic', hair } : {}) } as never).objects;
const head = (extra: Record<string, unknown> = {}) => ({ kind: 'head_3d', id: 't0', host: 'f0', resolution: 1, transform: { x: 380, y: 30, scale: 0.8 }, ...extra });
const scene = (seed: number, heads: Record<string, unknown>[] = [head()]) => ({ width: 700, height: 460, background: '#ece6dc', objects: [...faceObjs(seed), ...heads] });
const hostOf = (seed: number): HostSpec => SceneSpec.parse(scene(seed, [])).objects.find((o) => o.kind === 'host') as HostSpec;
/** Le SVG sans les images PNG encodées en base64 : une chaîne aléatoire de base64 peut contenir « NaN » par hasard (faux positif dépendant des pixels). */
const noImage = (svg: string): string => svg.replace(/base64,[A-Za-z0-9+/=]+/g, 'base64,');
const svgOf = (sc: unknown): string => { const r = compileScene(sc); if (!r.ok) throw new Error(r.issues.join(' ; ')); return r.svg; };

describe('tête 3D dans le pipeline principal', () => {
  it('compile, est déterministe, ajoute une image de tête, sans valeur invalide', () => {
    const a = svgOf(scene(11)), b = svgOf(scene(11)), solo = svgOf(scene(11, []));
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(solo.length + 3000);
    expect(noImage(a)).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('le lacet et le tangage changent réellement le rendu ; plusieurs angles du même hôte sont permis', () => {
    const at = (yaw: number, pitch = 0) => svgOf(scene(11, [head({ yaw, pitch })]));
    expect(new Set([0, 45, 90, 180].map((y) => at(y))).size).toBe(4);
    expect(at(45, 0)).not.toBe(at(45, 25));
    expect(compileScene(scene(11, [head({ id: 'a', yaw: 0 }), head({ id: 'b', yaw: 90 })])).ok).toBe(true);
  });

  it('la tête tourne des deux côtés : −yaw et +yaw donnent deux rendus différents et valides', () => {
    const a = svgOf(scene(11, [head({ yaw: 60 })])), b = svgOf(scene(11, [head({ yaw: -60 })]));
    expect(a).not.toBe(b);
    expect(noImage(b)).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('c\'est la même personne que l\'hôte : iris, peau, cheveux et crâne viennent de l\'hôte', () => {
    for (const seed of [3, 7, 42]) {
      const sc = SceneSpec.parse(scene(seed)), host = sc.objects.find((o) => o.kind === 'host') as HostSpec;
      const iris = irisOf(placedEyesByHost(sc).get('f0') ?? []);
      expect(iris).toMatch(/^#[0-9a-f]{6}$/i);
      const { spec, lengthH } = head3dSubject(host, { skull: {}, variation: { ci: 0, axes: {} }, hair: undefined, hairline: 'host' }, iris);
      expect(spec.palette.iris.toLowerCase()).toBe(iris!.toLowerCase());
      expect(lengthH).toBeGreaterThan(0.7); expect(lengthH).toBeLessThan(0.95);
      expect(spec.engine).toBeDefined();
    }
  });

  it('le crâne dérivé varie avec le visage de l\'hôte (pas la même tête pour tous)', () => {
    const lens = [3, 7, 11, 19, 42].map((s) => head3dSubject(hostOf(s), { skull: {}, variation: { ci: 0, axes: {} }, hair: undefined, hairline: 'host' }).lengthH.toFixed(3));
    expect(new Set(lens).size).toBeGreaterThan(2);
  });

  it('cheveux : la lisière vient de la coiffure de l\'hôte ; chauve reste chauve ; `short` diffère de `host`', () => {
    const sub = (hairline: 'host' | 'short', hair: Record<string, unknown>) => {
      const sc = SceneSpec.parse({ width: 700, height: 460, objects: [...faceObjs(21, hair), head({ hairline })] });
      return head3dSubject(sc.objects.find((o) => o.kind === 'host') as HostSpec, { skull: {}, variation: { ci: 0, axes: {} }, hair: undefined, hairline }).spec.hairline;
    };
    const long = { style: 'long', seed: 4 }, bald = { style: 'bald', seed: 4 };
    expect(sub('host', long).region).toBeDefined();
    expect(sub('short', long).region).toBeUndefined();
    expect(sub('host', bald).knots.every(([, y]) => y < 0)).toBe(true);
    expect(sub('short', bald).knots.every(([, y]) => y < 0)).toBe(true);
  });

  it('rejette : hôte introuvable, hôte non-visage, angle hors bornes, champ inconnu', () => {
    expect(compileScene(scene(11, [head({ host: 'nope' })])).ok).toBe(false);
    expect(compileScene(scene(11, [head({ yaw: 200 })])).ok).toBe(false);
    expect(compileScene(scene(11, [head({ pitch: 90 })])).ok).toBe(false);
    expect(compileScene(scene(11, [head({ depth: 3 })])).ok).toBe(false);
    const robot = { kind: 'host', id: 'h1', shape: 'rect', width: 100, height: 100 };
    expect(compileScene({ width: 300, height: 300, objects: [robot, head({ host: 'h1' })] }).ok).toBe(false);
  });

  it('vérification du pipeline : 3 couches de la tête 3D présentes, aucun contrôle bloquant en échec', () => {
    const r = verifyPipeline(scene(11)), mine = r.checks.filter((c) => c.id.startsWith('head3d.t0.'));
    expect(new Set(mine.map((c) => c.layer))).toEqual(new Set(['geometry', 'anatomy', 'style']));
    expect(mine.length).toBeGreaterThan(40);
    expect(mine.filter((c) => !c.ok && c.severity === 'error').map((c) => c.id)).toEqual([]);
    expect(r.failures.filter((c) => c.id.startsWith('head3d.')).length).toBe(0);
  }, 120_000);
});

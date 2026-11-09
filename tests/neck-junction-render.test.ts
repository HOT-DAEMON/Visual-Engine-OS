import { describe, expect, it } from 'vitest';
import { compileScene, generateRandomFace, SceneSpec } from '../src';
import { hostFace } from '../src/render/face';
import { decodePng, type Raster } from '../src/regression/png';
import type { HostSpec } from '../src/schema';
import { checkNeckJunctionRender } from '../src/verify/neck-junction';
import { rasterPng } from '../scripts/lib/raster';

/**
 * VÉRIFICATION DU RENDU FINAL du raccord cou ↔ corps (géométrie · anatomie · style), mesurée sur l'IMAGE de la scène complète.
 * Les seuils (14° de teinte, 12/255 de luminance) sont des choix de l'atelier, pas des mesures de perception : ils sont posés après mesure sur 20 combinaisons
 * (écart de teinte 0,7–4,5°, marche 0–8,1) et leur pouvoir de détection est prouvé par deux contrôles NÉGATIFS (visage seul ; couleur du corps altérée).
 */
const BG: [number, number, number] = [0xf4, 0xf1, 0xec];
const NECKS: Record<string, Record<string, unknown>> = {
  défaut: {},
  évasé: { flare: 0.6 },
  cône: { length: 0.6, system: { profile: { taper: 0.9 } } },
  massif: { width: 0.5, system: { modifiers: { mass: 0.85 }, musculature: { trapezius: 1 } } },
  compression: { system: { pose: { compression: 0.8 } } },
};
const build = (seed: number, neck: Record<string, unknown>, withBody: boolean) => {
  const f = generateRandomFace(seed, { id: 'f0', transform: { x: 320, y: 330, scale: 1 }, neck: { visible: true, ...neck } } as never);
  const scene = { width: 640, height: 900, background: '#f4f1ec', objects: [...f.objects, ...(withBody ? [{ kind: 'body', id: 'b0', host: 'f0', body: { age: 28, sex: 1, muscularity: 0.6 } }] : [])] };
  const r = compileScene(scene as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  const host = SceneSpec.parse(scene).objects.find((o) => o.kind === 'host') as HostSpec;
  return { host, img: decodePng(rasterPng(r.svg, { fitWidth: 640 })) };
};

describe('vérification du rendu final du raccord cou ↔ corps', () => {
  it('aucun contrôle error (3 couches) sur 4 graines × 5 cous ; marche de luminance sous la limite', () => {
    for (const seed of [3, 11, 42, 77]) for (const [name, neck] of Object.entries(NECKS)) {
      const { host, img } = build(seed, neck, true), cs = checkNeckJunctionRender(host, img, { background: BG });
      expect(new Set(cs.map((c) => c.layer)), 'les trois couches sont mesurées').toEqual(new Set(['geometry', 'anatomy', 'style']));
      expect(cs.filter((c) => !c.ok && c.severity === 'error').map((c) => `${c.id}: ${c.message}`), `graine ${seed}, cou « ${name} »`).toEqual([]);
      expect(cs.find((c) => c.id === 'neck.render.seam-luminance-step')!.ok, `graine ${seed}, cou « ${name} » : couture de luminance`).toBe(true);
    }
  });

  it('contrôle négatif (anatomie) : sans corps, la colonne médiane est trouée sous la base du cou', () => {
    const { host, img } = build(3, {}, false), c = checkNeckJunctionRender(host, img, { background: BG }).find((q) => q.id === 'neck.render.midline-continuous')!;
    expect(c.ok).toBe(false);
    expect(c.value).toBeGreaterThan(0);
  });

  it('contrôle négatif (style) : un corps d\'une autre couleur de peau est détecté (écart de teinte)', () => {
    const { host, img } = build(3, {}, true), { lm } = hostFace(host), row = Math.round(host.transform.y + host.transform.scale * lm.neck.bottomY);
    const bad: Raster = { width: img.width, height: img.height, data: new Uint8Array(img.data) };
    for (let y = row + 1; y < bad.height; y++) for (let x = 0; x < bad.width; x++) { const k = (y * bad.width + x) * 4, r = bad.data[k]!; bad.data[k] = bad.data[k + 2]!; bad.data[k + 2] = r; }
    const c = checkNeckJunctionRender(host, bad, { background: BG }).find((q) => q.id === 'neck.render.skin-hue-continuity')!;
    expect(c.ok).toBe(false);
    expect(c.value).toBeGreaterThan(14);
  });
});

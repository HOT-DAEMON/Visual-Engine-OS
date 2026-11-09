import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compileScene, generateRandomFace, renderScene, SceneSpec } from '../src';
import { anchorFromLandmarks, bodyGeometry, bodyMarkup, composeFigure } from '../src/body';
import { neckModelFor } from '../src/neck';
import { neckAnchor } from '../src/render/body';
import { hostFace } from '../src/render/face';
import { neckPath } from '../src/render/neck';
import { silhouetteRing } from '../src/render/neck/path';
import { dominantColor } from '../src/materials';
import { decodePng } from '../src/regression/png';
import type { HostSpec } from '../src/schema';
import { rasterPng } from '../scripts/lib/raster';

/**
 * RACCORD COU ↔ CORPS. Trois garanties, chacune mesurée (jamais déclarée) :
 *  1. UNE SEULE ancre de cou : celle de la scène (`neckAnchor`) est la dernière section du moteur de cou, y compris quand le cou est un cône, massif ou comprimé ;
 *  2. UN SEUL jeu de muscles du cou : le torse ne dessine plus de SCM, le moteur de cou en est propriétaire ;
 *  3. le fondu de la base du cou ne dépasse pas du cou sur le fond (contrôle négatif : sans `neckContour`, il dépasse).
 */
const NECKS: Record<string, Record<string, unknown>> = {
  défaut: {},
  'évasé (flare 0,6)': { flare: 0.6 },
  'cône (taper 0,9)': { length: 0.6, system: { profile: { taper: 0.9 } } },
  'massif + trapèzes': { width: 0.5, system: { modifiers: { mass: 0.85 }, musculature: { trapezius: 1 } } },
  compression: { system: { pose: { compression: 0.8 } } },
};
const hostOf = (seed: number, neck: Record<string, unknown>) => {
  const f = generateRandomFace(seed, { id: 'f0', transform: { x: 320, y: 330, scale: 1 }, neck: { visible: true, ...neck } } as never);
  const scene = { width: 640, height: 900, background: '#f4f1ec', objects: [...f.objects] };
  const host = SceneSpec.parse(scene).objects.find((o) => o.kind === 'host') as HostSpec;
  return { scene, host };
};

describe('raccord cou ↔ corps', () => {
  it('ancre unique : la base du torse = dernière section du moteur de cou, pour tous les cous testés', () => {
    for (const [name, neck] of Object.entries(NECKS)) {
      const { host } = hostOf(3, neck), { params, lm } = hostFace(host), last = neckModelFor(params, lm).stations.at(-1)!;
      expect(neckAnchor(host).baseHalf, name).toBeCloseTo((last.aL + last.aR) / 2, 6);
    }
    const code = readFileSync('src/render/body.ts', 'utf8');
    expect(code, 'formule d\'ancre recopiée dans render/body.ts').not.toMatch(/\*\s*\(1\s*\+\s*params\.neck\.flare\)/);
  });

  it('un seul jeu de muscles du cou : aucun atome neck.scm dans le torse, et le moteur de cou calcule bien la visibilité des SCM', () => {
    const { host } = hostOf(3, {}), { params, lm } = hostFace(host);
    const geo = bodyGeometry({ age: 28, sex: 1, muscularity: 0.8 } as never, anchorFromLandmarks(params, lm));
    expect(geo.atoms.filter((a) => a.id.startsWith('neck.scm'))).toHaveLength(0);
    const lean = hostOf(3, { system: { modifiers: { mass: 0.1 }, musculature: { tension: 1 } } }).host, hp = hostFace(lean);
    const scm = neckModelFor(hp.params, hp.lm).composition.structures.find((q) => q.id === 'scm');
    expect(scm, 'le moteur de cou doit porter les SCM').toBeDefined();
    expect(scm!.visibility, 'SCM d\'un cou maigre et tendu : visibilité calculée > 0').toBeGreaterThan(0.03);
  });

  it('le fondu de la base du cou ne dépasse pas du cou (3 graines × 5 cous) ; sans bornage il dépasse (contrôle négatif)', () => {
    let negativeControl = 0;
    for (const seed of [3, 11, 42]) for (const [name, neck] of Object.entries(NECKS)) {
      const { scene, host } = hostOf(seed, neck), { params, lm } = hostFace(host), anchor = anchorFromLandmarks(params, lm);
      const base = { skin: dominantColor(host.material.base), level: 3 as const, mode: 'skin' as const, uid: 'b0' };
      const bp = { age: 28, sex: 1, muscularity: 0.6 };
      const sceneSvg = renderScene(SceneSpec.parse(scene));
      const raster = (svg: string) => decodePng(rasterPng(svg, { fitWidth: 640 }));
      const bounded = bodyMarkup(bp, anchor, { ...base, neckContour: neckPath(params, lm) }), free = bodyMarkup(bp, anchor, base);
      const none = raster(composeFigure(sceneSvg, { back: bounded.back, front: '' }));
      const ring = silhouetteRing(neckModelFor(params, lm));
      // Bande au-dessus du haut du torse (base − 0,05 H) : seul le cou peut s'y trouver ; hors du contour du cou, le fondu ne doit rien changer.
      // Le visage porte un roulis aléatoire : on projette le contour dans le repère IMAGE (translation, rotation, échelle de l'hôte) avant de balayer.
      const T = host.transform, th = (T.rotationDeg * Math.PI) / 180, px = ring.map((p) => ({ x: T.x + T.scale * (p.x * Math.cos(th) - p.y * Math.sin(th)), y: T.y + T.scale * (p.x * Math.sin(th) + p.y * Math.cos(th)) }));
      const y0 = Math.round(T.y + T.scale * (lm.neck.bottomY - 0.09 * lm.H)), y1 = Math.round(T.y + T.scale * (lm.neck.bottomY - 0.055 * lm.H));
      const offenders = (m: { back: string; front: string }): number => {
        const img = raster(composeFigure(sceneSvg, m));
        let n = 0;
        for (let y = y0; y <= y1; y++) {
          const xs: number[] = [];
          for (let i = 0; i < px.length; i++) { const p = px[i]!, q = px[(i + 1) % px.length]!; if ((p.y <= y) !== (q.y <= y)) xs.push(p.x + ((y - p.y) / (q.y - p.y)) * (q.x - p.x)); }
          if (xs.length < 2) continue;
          const lo = Math.min(...xs) - 2, hi = Math.max(...xs) + 2;
          for (let x = 0; x < img.width; x++) {
            if (x >= lo && x <= hi) continue;
            const k = (y * img.width + x) * 4;
            if (Math.abs(img.data[k]! - none.data[k]!) + Math.abs(img.data[k + 1]! - none.data[k + 1]!) + Math.abs(img.data[k + 2]! - none.data[k + 2]!) > 6) n++;
          }
        }
        return n;
      };
      expect(offenders(bounded), `graine ${seed}, cou « ${name} » : pixels du fondu hors du cou`).toBe(0);
      negativeControl += offenders(free);
    }
    expect(negativeControl, 'sans bornage, le fondu doit déborder quelque part (sinon ce test ne prouve rien)').toBeGreaterThan(0);
  });

  it('la scène complète (compileScene) ne produit aucune erreur avec chacun des cous', () => {
    for (const [name, neck] of Object.entries(NECKS)) {
      const { scene } = hostOf(11, neck);
      const r = compileScene({ ...scene, objects: [...scene.objects, { kind: 'body', id: 'b0', host: 'f0', body: { age: 28, sex: 1, muscularity: 0.6 } }] } as never);
      expect(r.ok, name).toBe(true);
    }
  });
});

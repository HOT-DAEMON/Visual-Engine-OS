import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { cullOffCanvas } from '../src/core/offcanvas';
import { ARCHETYPES, type BodyInput } from '../src/body';
import { bodyVolumes } from '../src/body/volume';
import { lightModelOf, litFigure } from '../src/relief';
import type { Raster } from '../src/regression/png';
import { figureEquivalence } from '../src/verify/figure-equivalence';
import { bodyHost } from '../scripts/lib/body-host';

/**
 * `headCastScale: 2` (ombre portée de la tête sur grille 2× plus grossière) est une APPROXIMATION : sa qualité est prouvée par la couche de vérification
 * géométrie / anatomie / style (`figureEquivalence`, bornes de `render-equivalence.ts` inchangées + tolérances d'éclairage de zone fixées avant la mesure) sur
 * 9 configurations. Contrôles négatifs : une lumière tournée de 40° et une image décalée de 3 px doivent ÉCHOUER (les bornes ne sont pas vacuement larges).
 * `headCastScale: 4` n'est PAS revendiqué : il dépasse la borne des traits sombres dans 1 cas sur 9 (docs/PERF-4.md).
 */
const ras = (svg: string): Raster => { const r = new Resvg(cullOffCanvas(svg).svg, { font: { loadSystemFonts: false }, fitTo: { mode: 'width', value: 560 } }).render(); return { width: r.width, height: r.height, data: new Uint8Array(r.pixels) }; };
const shift = (r: Raster, dx: number): Raster => { const d = new Uint8Array(r.data.length); for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) { const sx = Math.min(r.width - 1, Math.max(0, x - dx)); d.set(r.data.subarray((y * r.width + sx) * 4, (y * r.width + sx) * 4 + 4), (y * r.width + x) * 4); } return { ...r, data: d }; };
const PEOPLE = [[11, 'veryMuscular'], [5, 'adultFemale'], [23, 'obese']] as const;
const LIGHTS = [[305, 38, 0.5], [60, 25, 0.9], [200, 60, 0.2]] as const;

describe('headCastScale 2 : qualité prouvée par la vérification géométrie / anatomie / style', () => {
  for (const [seed, arch] of PEOPLE) it(`personne ${seed} (${arch}) : 3 lumières, toutes les vérifications passent`, () => {
    const BH = bodyHost(seed), set = bodyVolumes(ARCHETYPES[arch] as BodyInput, BH.a, {});
    for (const [az, el, hard] of LIGHTS) {
      const m = lightModelOf({ azimuthDeg: az, elevationDeg: el, shadowHardness: hard, sourceSize: 0.4 }, { style: 'soft' });
      const ref = litFigure(BH.svg, BH.o, BH.skin, set, m, { heightPx: 700 }), opt = litFigure(BH.svg, BH.o, BH.skin, set, m, { heightPx: 700, headCastScale: 2 });
      const r = figureEquivalence(ref, opt, ras(ref.svg), ras(opt.svg));
      expect(r.checks.filter((c) => !c.ok).map((c) => `${c.layer}/${c.id}=${c.value}`), `az${az} él${el} dur${hard}`).toEqual([]);
      expect(opt.head.cast).not.toEqual(ref.head.cast); // le paramètre est bien CONSOMMÉ : l'ombre change réellement
    }
  }, 120000);
  it('contrôle négatif : une lumière tournée de 40° ÉCHOUE à la vérification', () => {
    const BH = bodyHost(11), set = bodyVolumes(ARCHETYPES.veryMuscular as BodyInput, BH.a, {}), mk = (az: number) => lightModelOf({ azimuthDeg: az, elevationDeg: 38, shadowHardness: 0.5, sourceSize: 0.4 }, { style: 'soft' });
    const ref = litFigure(BH.svg, BH.o, BH.skin, set, mk(305), { heightPx: 700 }), bad = litFigure(BH.svg, BH.o, BH.skin, set, mk(345), { heightPx: 700 });
    expect(figureEquivalence(ref, bad, ras(ref.svg), ras(bad.svg)).checks.some((c) => !c.ok)).toBe(true);
  }, 60000);
  it('contrôle négatif : une image décalée de 3 px ÉCHOUE à la vérification', () => {
    const BH = bodyHost(11), set = bodyVolumes(ARCHETYPES.veryMuscular as BodyInput, BH.a, {}), m = lightModelOf({ azimuthDeg: 305, elevationDeg: 38 }, { style: 'soft' });
    const ref = litFigure(BH.svg, BH.o, BH.skin, set, m, { heightPx: 700 }), R = ras(ref.svg);
    expect(figureEquivalence(ref, ref, R, shift(R, 3)).checks.some((c) => !c.ok)).toBe(true);
  }, 60000);
});

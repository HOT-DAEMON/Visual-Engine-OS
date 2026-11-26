/**
 * Figures TÊTE + HAUT DU CORPS de face (itération 08) : la tête vient du moteur de visage (litFigure), le corps du moteur de volumes. Le script n'utilise que des API présentes AVANT et APRÈS
 * l'itération 08, ce qui permet de le lancer à l'identique sur les deux arbres pour produire les images « avant » et « après ». Usage : tsx scripts/artefacts-body-08-figure.ts <dossier de sortie>.
 * Limite connue : le moteur de visage est 2D ; il ne dessine pas l'arrière de la tête, donc les vues de dos et de trois-quarts arrière montrent le corps seul.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { ARCHETYPES, type BodyInput } from '../src/body';
import { bodyVolumes } from '../src/body/volume';
import { lightModelOf, litFigure } from '../src/relief';
import { BG, bodyHost } from './lib/body-host';
import { rasterPng } from './lib/raster';

const OUT = process.argv[2] ?? 'artefacts/body-08-figures';
mkdirSync(OUT, { recursive: true });
const BH = bodyHost(), model = lightModelOf({ azimuthDeg: 305, elevationDeg: 38, shadowHardness: 0.5, sourceSize: 0.4 }, { style: 'soft' });
const crop = (svg: string, y1: number): string => svg.replace(/viewBox="[^"]*" width="[^"]*" height="[^"]*"/, `viewBox="0 -75 380 ${y1 + 75}" width="380" height="${y1 + 75}"`).replace(/(<svg [^>]*>)/, `$1<rect x="0" y="-75" width="380" height="${y1 + 75}" fill="${BG}"/>`);
for (const n of ['veryMuscular', 'adultMale', 'adultFemale', 'thin', 'obese'] as const) {
  const set = bodyVolumes(ARCHETYPES[n] as BodyInput, BH.a, {}), f = litFigure(BH.svg, BH.o, BH.skin, set, model, { heightPx: 1000, uid: 'f' + n });
  writeFileSync(`${OUT}/figure-${n}.png`, rasterPng(crop(f.svg, 330), { fitWidth: 760 }));
  console.log('ok', n);
}

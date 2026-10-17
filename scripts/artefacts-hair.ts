import { copyFileSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import type { SceneInput } from '../src';
import { skinColor } from '../src/generation/random-axes';
import { BEARDS, HAIR_STYLES, HAIR_TEXTURES, MUSTACHES, SIDEBURNS } from '../src/schema';
import { layout, proofOverlay, render } from './lib/proof';
import { measureHair } from './lib/metrics-hair';

/**
 * Preuves visuelles de la tâche « cheveux complets + pilosité + axes indépendants » : `artefacts/cheveux-pilosite/`.
 * Même visage de base (seed 321, identité d'yeux 3) : seules les propriétés testées changent.
 */
const DIR = 'artefacts/cheveux-pilosite';
mkdirSync(DIR, { recursive: true });
const png = (name: string, buf: Buffer): void => {
  writeFileSync(`${DIR}/${name}`, buf);
  console.log(`${DIR}/${name}`);
};
const BASE = 321;
const NOFH = { mustache: 'none', beard: 'none' } as const;
const styles = HAIR_STYLES.filter((s) => s !== 'bald');
const TIE = { height: 0.95, side: 0, tail: 0.7, thickness: 0.6, double: false };

// 01 — coiffures (colonnes) × textures (lignes) : deux axes indépendants.
let L = layout(styles.length * HAIR_TEXTURES.length, styles.length, 230, 400, 0.5, (i) => ({ seed: BASE, opts: { identity: 3, hair: { style: styles[i % styles.length] as never, texture: HAIR_TEXTURES[Math.floor(i / styles.length)] as never, fringe: 'none', color: '#5a3a22', seed: 4, curl: 0.6, volume: 0.7, tie: TIE }, facialHair: NOFH } }));
png('01-coiffures-x-textures.png', render(L.objects, styles.length * 230, HAIR_TEXTURES.length * 400));

// 02 — queue, chignon, tresses : hauteur, côté, couettes, nombre de tresses.
const ties: Record<string, unknown>[] = [
  { style: 'ponytail', tie: { ...TIE, height: 1 } }, { style: 'ponytail', tie: { ...TIE, height: 0.55, side: 0.9 }, texture: 'wavy' }, { style: 'ponytail', tie: { ...TIE, height: 0.6, side: 0.9, double: true }, texture: 'curly' }, { style: 'ponytail', tie: { ...TIE, height: 0.2 } },
  { style: 'bun', tie: { ...TIE, thickness: 0.3 } }, { style: 'bun', tie: { ...TIE, thickness: 0.9 }, texture: 'curly' }, { style: 'bun', tie: { ...TIE, height: 0.6, side: 0.9, double: true } }, { style: 'bun', tie: { ...TIE, height: 0.6 }, texture: 'coily' },
  { style: 'braids', braids: { count: 1, thickness: 0.5 } }, { style: 'braids', braids: { count: 2, thickness: 0.7 } }, { style: 'braids', braids: { count: 4, thickness: 0.5 }, texture: 'wavy' }, { style: 'braids', braids: { count: 6, thickness: 0.4 }, texture: 'braided' },
];
L = layout(12, 4, 300, 560, 0.62, (i) => ({ seed: BASE + 1, opts: { identity: 3, hair: { fringe: i % 2 ? 'sweep' : 'none', color: '#3a2415', seed: 8 + i, volume: 0.5, ...ties[i] } as never, facialHair: NOFH } }));
png('02-queue-chignon-tresses.png', render(L.objects, 1200, 3 * 560));

// 03 — implantation : formes (lignes) × recul des tempes (colonnes) ; ligne du bas : irrégularité et éclaircissement.
const shapes = ['round', 'straight', 'widow', 'receding'] as const;
const rec = [0, 0.5, 1];
L = layout(12, 4, 300, 480, 0.62, (i) => {
  const shape = shapes[i % 4] as (typeof shapes)[number];
  const row = Math.floor(i / 4);
  return { seed: BASE + 2, opts: { identity: 3, hair: { style: 'short', fringe: 'none', texture: 'straight', color: '#2b1d14', seed: 5, hairline: 0.6, part: 0, hairlineShape: shape, recession: row < 2 ? (rec[row] as number) : 0.2, irregularity: row === 2 ? 0.9 : 0.1, thinning: row === 2 ? (i % 4) * 0.3 : 0, density: 0.7 } as never, facialHair: NOFH } };
});
png('03-implantation-tempes-eclaircissement.png', render(L.objects, 1200, 3 * 480));

// 04 — mèches : variance de longueur, densité, raie (cuir chevelu visible), mèches fines vs principales.
const lock: Record<string, unknown>[] = [
  { style: 'bob', lengthVariance: 0, density: 0.9, partWidth: 0.1 }, { style: 'bob', lengthVariance: 0.9, density: 0.9, partWidth: 0.1 }, { style: 'bob', lengthVariance: 0.5, density: 0.3, partWidth: 0.8 }, { style: 'bob', lengthVariance: 0.5, density: 0.5, partWidth: 0.9, densityVariance: 1 },
  { style: 'short', lengthVariance: 0.2, density: 0.4, highlight: 0.1 }, { style: 'short', lengthVariance: 0.7, density: 1, highlight: 0.8 }, { style: 'spiky', lengthVariance: 0.9, density: 0.8 }, { style: 'long', lengthVariance: 0.8, density: 0.6, texture: 'wavy' },
];
L = layout(8, 4, 300, 560, 0.62, (i) => ({ seed: BASE + 3, opts: { identity: 3, hair: { fringe: 'none', color: '#6b4426', seed: 14 + i, ...lock[i] } as never, facialHair: NOFH } }));
png('04-meches-longueur-densite-raie.png', render(L.objects, 1200, 2 * 560));

// 05 — pilosité : barbes (colonnes) × moustaches (lignes), puis favoris, transitions, zones clairsemées.
const beards = BEARDS;
L = layout(beards.length * MUSTACHES.length, beards.length, 220, 430, 0.5, (i) => ({ seed: BASE, opts: { identity: 3, hair: { style: 'short', fringe: 'straight', color: '#2b1d14', seed: 2 }, facialHair: { mustache: MUSTACHES[Math.floor(i / beards.length)] as never, beard: beards[i % beards.length] as never, length: 0.7, density: 0.9, transition: 0.4 } } }));
png('05-pilosite-barbes-x-moustaches.png', render(L.objects, beards.length * 220, MUSTACHES.length * 430));
const fx: Record<string, unknown>[] = [...SIDEBURNS.map((s) => ({ sideburns: s, beard: 'none', mustache: 'none' })), { beard: 'full', mustache: 'full', transition: 0 }, { beard: 'full', mustache: 'full', transition: 1 }, { beard: 'long', mustache: 'handlebar', patchiness: 0.7, transition: 0.8 }, { beard: 'stubble', mustache: 'thin', patchiness: 0.5, transition: 1 }];
L = layout(8, 4, 300, 560, 0.62, (i) => ({ seed: BASE, opts: { identity: 3, hair: { style: 'short', fringe: 'straight', color: '#2b1d14', seed: 2 }, facialHair: { length: 0.8, density: 0.9, ...fx[i] } as never } }));
png('06-favoris-transitions-zones-clairsemees.png', render(L.objects, 1200, 2 * 560));

// 07 — axes indépendants : clarté de peau (lignes) × sous-ton rosé→olive→doré (colonnes), même visage, mêmes yeux, textures variées.
const clar = [0.95, 0.75, 0.5, 0.3, 0.12];
const under = [0, 0.33, 0.66, 1];
L = layout(20, 4, 300, 460, 0.55, (i) => ({ seed: BASE, opts: { identity: 3, hair: { style: 'curly', texture: HAIR_TEXTURES[i % 5] as never, fringe: 'none', color: i % 3 === 0 ? '#d9b36a' : '#2b1d14', seed: 6, curl: 0.7, volume: 0.6 }, facialHair: NOFH } }));
const skinned = L.objects.map((o, k) => {
  if (o.kind !== 'host') return o;
  const i = L.objects.slice(0, k).filter((q) => q.kind === 'host').length;
  return { ...o, material: { preset: 'matte' as const, color: skinColor(clar[Math.floor(i / 4)] as number, under[i % 4] as number) } };
}) as SceneInput['objects'];
png('07-axes-independants-peau-sous-ton-texture.png', render(skinned, 1200, 5 * 460));

// 08 — sourcils et cils distincts de la chevelure (mêmes cheveux, systèmes pileux différents).
L = layout(8, 4, 300, 460, 0.62, (i) => ({ seed: 700 + i * 9, opts: { identity: 3 + i, hair: { style: 'short', color: i % 2 ? '#d9b36a' : '#1d140d', seed: 3, fringe: 'none' }, facialHair: NOFH } }));
png('08-sourcils-cils-systemes-distincts.png', render(L.objects, 1200, 2 * 460));

// 09 — 24 visages aléatoires complets avec preuve de placement des enfants (croix = canthi, cadres = empreintes d'yeux).
L = layout(24, 6, 220, 330, 0.55, (i) => ({ seed: 500 + i * 7, opts: {} }));
png('09-visages-aleatoires-et-placement.png', render(L.objects, 1320, 4 * 330, L.cells.map(proofOverlay).join('')));

// 10 — galerie des 48 visages (régénérée).
const gal = JSON.parse(readFileSync('examples/gallery-faces.json', 'utf8')) as SceneInput;
png('10-galerie-48-visages.png', render(gal.objects, gal.width ?? 1840, gal.height ?? 2700, '', gal.background ?? '#3b4157', 1840));
copyFileSync('examples/gallery-faces.json', `${DIR}/galerie-48-visages.json`);

const m = measureHair(1500);
writeFileSync(`${DIR}/metrics.json`, JSON.stringify(m, null, 2));
console.log(JSON.stringify(m));

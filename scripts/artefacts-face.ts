import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { GALLERY_IDENTITIES } from '../src';
import { HAIR_FRINGES, HAIR_STYLES, MUSTACHES, BEARDS, type SceneInput } from '../src/schema';
import { layout, proofOverlay, render } from './lib/proof';
import { measure } from './lib/metrics';

/**
 * Artefacts visuels (preuves) de la tâche « visage complet » : images PNG + metrics.json dans `artefacts/`.
 * Même visage de base partout (seed 321) : seules les propriétés testées changent.
 */
mkdirSync('artefacts', { recursive: true });
const BASE = 321;
const png = (name: string, buf: Buffer): void => {
  writeFileSync(`artefacts/${name}`, buf);
  console.log(`artefacts/${name}`);
};

// 01 — galerie : les 48 identités d'yeux sur 48 visages complets.
const gal = JSON.parse(readFileSync('examples/gallery-faces.json', 'utf8')) as SceneInput;
png('01-galerie-48-visages.png', render(gal.objects, gal.width ?? 1840, gal.height ?? 2700, '', gal.background ?? '#3b4157', 1840));

// 02 — styles de cheveux × franges (visage identique).
const styles = HAIR_STYLES.filter((s) => s !== 'bald');
let L = layout(styles.length * HAIR_FRINGES.length, styles.length, 230, 450, 0.5, (i) => ({ seed: BASE, opts: { identity: 3, hair: { style: styles[i % styles.length] as never, fringe: HAIR_FRINGES[Math.floor(i / styles.length)] as never, color: '#5a3a22', seed: 4 }, facialHair: { mustache: 'none', beard: 'none' } } }));
png('02-styles-cheveux-x-franges.png', render(L.objects, styles.length * 230, HAIR_FRINGES.length * 450));

// 03 — pilosité : moustaches (lignes) × barbes (colonnes).
L = layout(16, 4, 300, 560, 0.62, (i) => ({ seed: BASE, opts: { identity: 3, hair: { style: 'short', fringe: 'straight', color: '#2b1d14', seed: 2 }, facialHair: { mustache: MUSTACHES[Math.floor(i / 4)] as never, beard: BEARDS[i % 4] as never, length: 0.6, density: 0.9 } } }));
png('03-pilosite-moustaches-x-barbes.png', render(L.objects, 1200, 4 * 560));

// 04 — cou : largeurs et longueurs (borné entre menton et mâchoire par le visage).
L = layout(8, 4, 300, 640, 0.62, (i) => ({ seed: BASE, opts: { identity: 3, hair: { style: 'bald' }, facialHair: { mustache: 'none', beard: 'none' }, neck: { visible: true, width: [0.3, 0.4, 0.5, 0.6][i % 4] as number, length: i < 4 ? 0.12 : 0.28, flare: i < 4 ? 0.1 : 0.4 } } }));
png('04-cous.png', render(L.objects, 1200, 2 * 640));

// 05 — asymétrie : rangée du haut symétrique, rangée du bas asymétrique (même visage, mêmes yeux) + axes.
const zero = { eyeScale: 0, eyeOpenness: 0, eyeRollDeg: 0, eyeDy: 0, mouthTiltDeg: 0 };
const asym = { eyeScale: 0.06, eyeOpenness: 0.12, eyeRollDeg: 2.2, eyeDy: 0.007, mouthTiltDeg: 2.5 };
L = layout(8, 4, 300, 520, 0.7, (i) => ({ seed: BASE + (i % 4) * 11, opts: { identity: 5 + (i % 4), hair: { style: 'short', fringe: 'sweep', seed: 1 }, facialHair: { mustache: 'none', beard: 'none' }, asymmetry: i < 4 ? zero : asym } }));
png('05-asymetrie-symetrique-vs-legere.png', render(L.objects, 1200, 2 * 520, L.cells.map(proofOverlay).join('')));

// 06 — preuve de placement : tailles d'yeux de 0,5 à 1,6 → mêmes canthi (croix rouges), empreintes dans l'orbite.
L = layout(8, 4, 300, 560, 0.62, (i) => ({ seed: BASE + 5, opts: { identity: (i * 6) % GALLERY_IDENTITIES, eyeSize: [0.5, 0.8, 1, 1.6][i % 4] as number, hair: { style: (['short', 'long', 'afro', 'spiky'] as const)[i % 4], fringe: 'straight', seed: i }, facialHair: { mustache: i < 4 ? 'none' : 'full', beard: i < 4 ? 'none' : 'full' } } }));
png('06-preuve-placement-enfants.png', render(L.objects, 1200, 2 * 560, L.cells.map(proofOverlay).join('')));

// metrics.json + README
const m = measure(1500);
writeFileSync('artefacts/metrics.json', JSON.stringify(m, null, 2));
console.log(JSON.stringify(m));

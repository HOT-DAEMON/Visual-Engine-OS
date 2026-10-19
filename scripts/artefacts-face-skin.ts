import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { generateRandomFace } from '../src';
import { direction2D, lightVector } from '../src/lighting/light';
import { skinRegions } from '../src/face';
import { verifyFace } from '../src/verify';
import { board, cell, type CellMeta, type CellSpec } from './lib/board';

/**
 * Preuves visuelles du matériau de peau, de l'éclairage, des ombres de contact, des lumières de contour et de la vérification :
 * `artefacts/face-anatomy/`. Même visage de base que `artefacts-face-nose-jaw.ts` ; seul le paramètre testé change.
 * Usage : `npx tsx scripts/artefacts-face-skin.ts [groupe…]` (groupes : light rough geom contact rim zones gallery verify).
 */
const DIR = 'artefacts/face-anatomy';
mkdirSync(DIR, { recursive: true });
const want = new Set(process.argv.slice(2));
const on = (g: string): boolean => want.size === 0 || want.has(g);

function make(group: string, file: string, title: string, specs: CellSpec[], cols: number, w: number, h: number): void {
  if (!on(group)) return;
  writeFileSync(`${DIR}/${file}`, board(title, specs.map((s) => ({ ...cell(s, w, h), label: s.label })), cols, w, h));
  console.log(`${DIR}/${file}`);
}

/** Flèche « vers la lumière » dessinée depuis la direction 2D RÉELLE du vecteur de lumière. */
const arrow = (az: number, el = 50): ((m: CellMeta) => string) => () => {
  const d = direction2D(lightVector({ azimuthDeg: az, elevationDeg: el, color: '#ffffff', intensity: 1 }));
  const x = 34;
  const y = 34;
  return `<circle cx="${x}" cy="${y}" r="22" fill="#1b1f2e" fill-opacity="0.8"/><path d="M${x} ${y}L${x + d.x * 14} ${y + d.y * 14}" stroke="#ffe14a" stroke-width="3"/><circle cx="${x + d.x * 14}" cy="${y + d.y * 14}" r="4" fill="#ffe14a"/>`;
};

make('light', '08-peau-8-eclairages-meme-visage.png', 'Peau : même visage, même matériau, 8 directions de lumière (flèche jaune = vers la source)', [0, 45, 90, 135, 180, 225, 270, 315].map((az): CellSpec => ({ label: `azimut ${az}°`, light: { azimuthDeg: az, elevationDeg: 50 }, overlay: arrow(az) })), 4, 300, 380);

const ROUGH = (v: number) => ({ forehead: v, nose: v, cheeks: v, temples: v, chin: v, upperLip: v, neck: v });
/** Surcouche : régions de la peau teintées par leur rugosité (bleu = lisse, rouge = rugueux). */
const roughMap = (m: CellMeta): string => {
  const r = skinRegions(m.lm, m.nose);
  const rough = m.params.skinMaterial.roughness;
  const col = (v: number): string => `rgb(${Math.round(255 * v)},${Math.round(90 + 60 * (1 - Math.abs(v - 0.5) * 2))},${Math.round(255 * (1 - v))})`;
  return (Object.keys(rough) as (keyof typeof rough)[]).flatMap((k) => r[k].map((e) => { const [cx, cy] = m.px(e.cx, e.cy); return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(e.rx * m.s).toFixed(1)}" ry="${(e.ry * m.s).toFixed(1)}" fill="${col(rough[k])}" fill-opacity="0.45" stroke="#fff" stroke-width="1"/><text x="${(cx - 14).toFixed(1)}" y="${(cy + 4).toFixed(1)}" fill="#fff" font-size="11" font-family="DejaVu Sans">${rough[k].toFixed(2)}</text>`; })).join('');
};
make('rough', '09-peau-rugosite-par-region.png', 'Rugosité : uniforme lisse, uniforme rugueuse, variable par région, et carte des régions (bleu = lisse, rouge = rugueux)', [
  { label: 'uniforme 0,2 (reflets petits, forts)', patch: { skinMaterial: { roughness: ROUGH(0.2) } } },
  { label: 'uniforme 0,9 (reflets larges, faibles)', patch: { skinMaterial: { roughness: ROUGH(0.9) } } },
  { label: 'variable par région', patch: { skinMaterial: { roughness: { forehead: 0.35, nose: 0.25, cheeks: 0.75, temples: 0.65, chin: 0.45, upperLip: 0.55, neck: 0.8 } } } },
  { label: 'carte des régions (variable)', patch: { skinMaterial: { roughness: { forehead: 0.35, nose: 0.25, cheeks: 0.75, temples: 0.65, chin: 0.45, upperLip: 0.55, neck: 0.8 } } }, overlay: roughMap },
], 4, 300, 380);

const MAT = { skinMaterial: { roughness: { forehead: 0.3, nose: 0.25, cheeks: 0.7, temples: 0.6, chin: 0.45, upperLip: 0.5, neck: 0.75 }, specular: { strength: 0.6, broadness: 0.7 }, oiliness: 0.4 } };
make('geom', '10-peau-meme-materiau-geometries-et-styles.png', 'Rendu = f(géométrie, matériau, éclairage, caméra) : même matériau sur 3 géométries ; même géométrie en 4 styles', [
  { label: 'géométrie A (seed 321)', seed: 321, patch: MAT }, { label: 'géométrie B (seed 4242)', seed: 4242, patch: MAT }, { label: 'géométrie C (seed 99)', seed: 99, patch: MAT },
  { label: 'même géométrie : lisse (défaut)', patch: MAT },
  { label: 'même géométrie : cel (bords nets)', opts: { anatomy: { style: 'cel' } }, patch: MAT },
  { label: 'même géométrie : lumière chaude 3000 K', patch: MAT, light: { temperatureK: 3000 } },
  { label: 'même géométrie : lumière froide 9500 K, source dure', patch: MAT, light: { temperatureK: 9500, sourceSize: 0.1, shadowHardness: 0.9 } },
], 4, 300, 380);

const NOCT = { lighting: { contacts: { master: 0 } } };
make('contact', '11-ombres-de-contact-avec-sans.png', 'Ombres de contact : sans (l\'objet flotte), avec (réglage par défaut) — nez, mâchoire/cou, orbites', [
  { label: 'nez sans ombre de contact', focus: 'nose', patch: NOCT }, { label: 'nez avec ombre de contact', focus: 'nose' },
  { label: 'menton/cou sans', focus: 'lower', patch: NOCT }, { label: 'menton/cou avec (ombre portée sous la mâchoire)', focus: 'lower' },
  { label: 'orbites sans', focus: 'eyes', patch: NOCT }, { label: 'orbites avec (creux sous l\'arcade)', focus: 'eyes' },
], 2, 420, 300);

const NORIM = { lighting: { rims: Object.fromEntries(['head', 'nose', 'tip', 'alae', 'ears', 'chin', 'mouth', 'neck'].map((k) => [k, { intensity: 0 }])) } };
const rimAll = (o: object) => ({ lighting: { rims: Object.fromEntries(['head', 'nose', 'tip', 'alae', 'ears', 'chin', 'mouth', 'neck'].map((k) => [k, o])) } });
make('rim', '12-lumieres-de-contour-par-composant.png', 'Lumières de contour : couleur, intensité, largeur, côté éclairé, influence parent / enfants / frères', [
  { label: 'aucune', patch: NORIM },
  { label: 'défaut (discret)' },
  { label: 'bleu froid, intensité 0,8, large', patch: rimAll({ color: '#7fc8ff', intensity: 0.8, width: 0.7 }) },
  { label: 'orange, côté gauche seulement', patch: rimAll({ color: '#ffb066', intensity: 0.8, width: 0.5, side: 'left' }) },
  { label: 'côté droit seulement', patch: rimAll({ color: '#ffb066', intensity: 0.8, width: 0.5, side: 'right' }) },
  { label: 'nez seul, influence enfants/frères 1', patch: { lighting: { rims: { ...NORIM.lighting.rims, nose: { color: '#ff7ad9', intensity: 0.9, width: 0.5, influence: { parent: 0.5, children: 1, siblings: 1 } } } } } },
], 3, 300, 380);

const ZONES0 = { lighting: { zones: { forehead: { intensity: 0 }, nose: { intensity: 0 }, cheeks: { intensity: 0 }, shoulders: { intensity: 0 } } } };
make('zones', '13-zones-lumineuses-et-temperature.png', 'Zones lumineuses (front, nez, joues, épaules) et position / taille / température de la source', [
  { label: 'zones éteintes', patch: ZONES0 }, { label: 'zones par défaut' },
  { label: 'zones fortes, très directionnelles', patch: { lighting: { zones: { forehead: { intensity: 1 }, nose: { intensity: 1 }, cheeks: { intensity: 1 }, shoulders: { intensity: 1 }, directionality: 1 } } } },
  { label: 'source proche (distance 1,5) : dégradé', light: { distance: 1.5, sourceSize: 0.7 } },
  { label: 'source très petite, dure', light: { sourceSize: 0, shadowHardness: 1 } },
  { label: 'source énorme, très douce', light: { sourceSize: 1, shadowHardness: 0 } },
], 3, 300, 380);

if (on('gallery')) {
  const none = { hair: undefined, facialHair: undefined, neck: undefined, identity: undefined, expression: undefined } as never;
  const specs: CellSpec[] = Array.from({ length: 12 }, (_, i) => ({ seed: 1000 + i * 37, opts: none, label: `seed ${1000 + i * 37}` }));
  writeFileSync(`${DIR}/14-galerie-12-visages-aleatoires.png`, board('12 visages aléatoires avec les nouveaux moteurs (nez, menton, mâchoire, peau, ombres, contours)', specs.map((s) => ({ ...cell(s, 280, 400), label: s.label })), 4, 280, 400));
  console.log('gallery');
}

if (on('verify')) {
  // Rapport chiffré de la couche de vérification sur 120 visages : une ligne par contrôle (type), nombre d'échecs, plages de valeurs.
  const stats = new Map<string, { layer: string; n: number; fail: number; warn: number; min: number; max: number; limit: number }>();
  for (let s = 1; s <= 120; s++) {
    for (const c of verifyFace(generateRandomFace(s * 977)).checks) {
      const id = c.id.replace(/:.*$/, '');
      const e = stats.get(id) ?? { layer: c.layer, n: 0, fail: 0, warn: 0, min: Infinity, max: -Infinity, limit: c.limit };
      e.n++;
      if (!c.ok) c.severity === 'error' ? e.fail++ : e.warn++;
      e.min = Math.min(e.min, c.value);
      e.max = Math.max(e.max, c.value);
      stats.set(id, e);
    }
  }
  const rows = [...stats.entries()].sort((a, b) => a[1].layer.localeCompare(b[1].layer) || a[0].localeCompare(b[0]));
  writeFileSync(`${DIR}/verification-report.json`, JSON.stringify({ faces: 120, checks: Object.fromEntries(rows) }, null, 2));
  const line = (i: number, id: string, e: (typeof rows)[number][1]): string => `<text x="12" y="${60 + i * 20}" fill="${e.fail ? '#ff6a6a' : e.warn ? '#ffd24a' : '#7dffb0'}" font-size="13" font-family="DejaVu Sans Mono">${e.layer.padEnd(9)} ${id.padEnd(34)} n=${String(e.n).padStart(4)} échecs=${e.fail} alertes=${e.warn}  min=${e.min.toFixed(3)} max=${e.max.toFixed(3)} limite=${e.limit.toFixed(3)}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="${80 + rows.length * 20}"><rect width="100%" height="100%" fill="#1b1f2e"/><text x="12" y="30" fill="#fff" font-size="20" font-weight="bold" font-family="DejaVu Sans">Vérification du rendu : 120 visages, trois couches (géométrie · anatomie · style)</text>${rows.map(([id, e], i) => line(i, id, e)).join('')}</svg>`;
  writeFileSync(`${DIR}/15-verification-120-visages.png`, new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng());
  console.log('verify');
}

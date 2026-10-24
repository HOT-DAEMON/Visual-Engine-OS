import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { generateRandomFace } from '../src';
import { faceLandmarks, hairGeometry } from '../src/face';
import { HAIR_ARCHETYPES } from '../src/schema';
import { verifyFace } from '../src/verify';
import { hairSimStats } from '../src/verify/hair-sim';
import { rasterHair } from './lib/hair-raster';
import { layout, render } from './lib/proof';

/**
 * Preuves visuelles des cheveux simulés (Verlet) : `artefacts/hair-sim/`. Même visage partout (seed 321, yeux d'identité 3,
 * sans pilosité) ; seuls l'archétype et les réglages de simulation changent. Les références (12 coiffures) sont extraites de
 * `artefacts/visual-inspiration-01.jpg` par `/tmp/ref` (voir docs/HAIR-SIM-REFERENCES.md).
 */
const DIR = 'artefacts/hair-sim';
mkdirSync(`${DIR}/refs`, { recursive: true });
const CEL = { shading: { mode: 'cel', bands: 3, highlightBand: 0.6, castShadow: 0.8 } };
const NOFH = { mustache: 'none', beard: 'none' } as const;
const hairOf = (sim: Record<string, unknown>, color = '#23232b') => ({ style: 'short', texture: 'straight', fringe: 'none', color, seed: 5, volume: 0.5, density: 0.85, part: 0.2, appearance: CEL, sim: { enabled: true, ...sim } }) as never;
const CW = 420; const CH = 560; const S = 0.7;
const png = (name: string, buf: Buffer): void => { writeFileSync(`${DIR}/${name}`, buf); console.log(`${DIR}/${name}`); };
const grid = (name: string, sims: Record<string, unknown>[], cols: number, color = '#23232b'): Buffer => {
  const L = layout(sims.length, cols, CW, CH, S, (i) => ({ seed: 321, opts: { identity: 3, hairEngine: 'classic', hair: hairOf(sims[i]!, color), facialHair: NOFH } as never }));
  const b = render(L.objects, cols * CW, Math.ceil(sims.length / cols) * CH, '', '#f4f1ea');
  png(name, b);
  return b;
};

// 00 — références : 12 cellules extraites de la planche d'inspiration (copie des découpes).
for (let i = 1; i <= 12; i++) copyFileSync(`/tmp/ref/h${String(i).padStart(2, '0')}.png`, `${DIR}/refs/h${String(i).padStart(2, '0')}.png`);

// 01 — les 15 archétypes simulés.
const ARCH = HAIR_ARCHETYPES.filter((a) => a !== 'none');
const t0 = Date.now();
grid('01-archetypes.png', ARCH.map((a) => ({ archetype: a })), 4);
const simMs = Date.now() - t0;

// 02/03 — référence (haut) contre moteur (bas) pour les 12 coiffures de la planche.
const MAP = ['tousled', 'side_sweep', 'swept_back', 'bun_undercut', 'messy_bangs', 'wavy_swept', 'quiff_undercut', 'braid_updo', 'fluffy_messy', 'messy_long_bangs', 'pompadour_strand', 'cornrows_side'];
const compare = (name: string, from: number): void => {
  const idx = [0, 1, 2, 3, 4, 5].map((k) => from + k);
  const L = layout(6, 6, 280, 380, 0.5, (i) => ({ seed: 321, opts: { identity: 3, hairEngine: 'classic', hair: hairOf({ archetype: MAP[idx[i]!] }), facialHair: NOFH } as never }));
  const mine = render(L.objects, 6 * 280, 380, '', '#ffffff');
  const refs = idx.map((k) => readFileSync(`/tmp/ref/h${String(k + 1).padStart(2, '0')}.png`).toString('base64'));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1680" height="760"><rect width="100%" height="100%" fill="#fff"/>${refs.map((b, i) => `<image x="${i * 280 + 10}" y="0" width="260" height="360" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${b}"/>`).join('')}<image x="0" y="380" width="1680" height="380" href="data:image/png;base64,${mine.toString('base64')}"/>${idx.map((k, i) => `<text x="${i * 280 + 140}" y="372" text-anchor="middle" font-size="14" fill="#333">${String(k + 1).padStart(2, '0')} → ${MAP[k]}</text>`).join('')}</svg>`;
  png(name, new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng());
};
compare('02-references-01-06-vs-moteur.png', 0);
compare('03-references-07-12-vs-moteur.png', 6);

// 04 — détecteur « électrocuté » : gravité normale / vent / anti-gravité volontaire (stats mesurées sur la vraie géométrie).
const tests = [{ label: 'gravité', sim: { archetype: 'messy_bangs' } }, { label: 'vent', sim: { archetype: 'messy_bangs', wind: 0.8 } }, { label: 'anti-gravité volontaire', sim: { archetype: 'messy_bangs', float: 1, stiffness: 1 } }];
grid('04-detecteur-electrocute.png', tests.map((t) => t.sim), 3);
const electro = tests.map((t) => { const f = generateRandomFace(321, { identity: 3, hairEngine: 'classic', hair: hairOf(t.sim), facialHair: NOFH } as never); const g = hairGeometry(f.params, faceLandmarks(f.params, f.width, f.height))!; return { label: t.label, ...hairSimStats(f, g) }; });

// 05 — ombres portées sur la peau : sans / avec.
grid('05-ombres-portees-peau.png', [{ archetype: 'side_sweep', skinShadow: 0 }, { archetype: 'side_sweep', skinShadow: 0.6 }, { archetype: 'messy_long_bangs', skinShadow: 0 }, { archetype: 'messy_long_bangs', skinShadow: 0.6 }], 4);

// 06 — vérification : trois couches + mesures sur le raster pour chaque archétype.
const rows = ARCH.map((a) => {
  const mk = (hair: unknown) => generateRandomFace(321, { transform: { x: 271, y: 250, scale: 1 }, identity: 3, hairEngine: 'classic', hair, facialHair: NOFH } as never);
  const f = mk(hairOf({ archetype: a }));
  const bald = mk({ style: 'bald' });
  const g = hairGeometry(f.params, faceLandmarks(f.params, f.width, f.height))!;
  const st = hairSimStats(f, g);
  const r = verifyFace(f);
  const rh = rasterHair(f, f.objects, bald.objects, 200);
  const { mask: _m, ...rest } = rh;
  return { archetype: a, geometry: { ...st }, raster: rest, verify: { ok: r.ok, failures: r.failures.map((c) => c.id), warnings: r.warnings.map((c) => c.id) } };
});
// 07 — temps : moteur dessiné à la main (classique) contre cheveux simulés, 12 visages, géométrie + SVG + PNG.
const bench = (sim: boolean): number => {
  const t = Date.now();
  const L = layout(12, 4, CW, CH, S, (i) => ({ seed: 321, opts: { identity: 3, hairEngine: 'classic', hair: sim ? hairOf({ archetype: MAP[i] }) : ({ style: 'short', texture: 'straight', color: '#23232b', seed: 5 + i, volume: 0.5, density: 0.85 } as never), facialHair: NOFH } as never }));
  render(L.objects, 4 * CW, 3 * CH, '', '#f4f1ea');
  return Date.now() - t;
};
const timing = { classicMs: bench(false), simMs: bench(true), simArchetypesSheetMs: simMs, faces: 12 };
writeFileSync(`${DIR}/metrics.json`, JSON.stringify({ electro, rows, timing }, null, 2));
console.log(JSON.stringify(timing));

import { mkdirSync, writeFileSync } from 'node:fs';
import { generateRandomFace } from '../src';
import { faceLandmarks, hairGeometry } from '../src/face';
import { paletteStats, verifyFace } from '../src/verify';
import { layout, render, toWorld, type Cell } from './lib/proof';

/**
 * Preuves visuelles du moteur de cheveux v2 : `artefacts/hair-v2/`. Même visage de base (seed 321, yeux d'identité 3,
 * sans pilosité) ; seules les propriétés testées changent. Les images 03 et 08 portent une surcouche de PREUVE
 * (zones d'oreille, empreintes d'yeux, recouvrement mesuré) calculée sur la vraie géométrie.
 */
const DIR = 'artefacts/hair-v2';
mkdirSync(DIR, { recursive: true });
const png = (name: string, buf: Buffer): void => {
  writeFileSync(`${DIR}/${name}`, buf);
  console.log(`${DIR}/${name}`);
};
const NOFH = { mustache: 'none', beard: 'none' } as const;
const BASE = { style: 'short', texture: 'wavy', fringe: 'none', color: '#3a6df0', seed: 5, volume: 0.65, density: 0.85, recession: 0, thinning: 0, part: 0.2 };
const CW = 420;
const CH = 620;
const S = 0.76;
/** Grille de visages : `hairs[i]` = surcharges des cheveux de la cellule i (même visage partout). */
function grid(name: string, hairs: Record<string, unknown>[], cols: number, overlay?: (c: Cell) => string): Cell[] {
  const L = layout(hairs.length, cols, CW, CH, S, (i) => ({ seed: 321, opts: { identity: 3, hairEngine: 'classic', hair: { ...BASE, ...hairs[i] } as never, facialHair: NOFH } }));
  const rows = Math.ceil(hairs.length / cols);
  png(name, render(L.objects, cols * CW, rows * CH, overlay ? L.cells.map(overlay).join('') : ''));
  return L.cells;
}
const CEL = { shading: { mode: 'cel', bands: 3, highlightBand: 0.6, castShadow: 0.8 } };
const TIPS = { irregular: 0.7, flick: 0.5, fade: 0.5, edgeFade: 0.4 };

// 01 — formes : mèches en S flottantes, cônes rigides, volutes libres, tout ensemble.
grid('01-formes-mechesS-cones-volutes.png', [
  { color: '#e0457b', flow: { mode: 'ribbons', ribbons: 8, sWave: 0.8, span: 0.6, float: 0.95, wisps: 0 }, appearance: CEL, tips: TIPS },
  { color: '#f2a93b', flow: { mode: 'cones', cones: 9, coneSharp: 0.95, wisps: 0 }, silhouette: { lift: 0.7 }, appearance: CEL },
  { color: '#2fb59a', flow: { mode: 'classic', wisps: 16, span: 0.7 }, tips: TIPS, appearance: CEL },
  { color: '#7a4bd6', flow: { mode: 'mixed', ribbons: 6, cones: 5, wisps: 10, span: 0.6 }, silhouette: { puff: 0.5, asymmetry: 0.8, bias: 1 }, appearance: CEL, tips: TIPS },
  { color: '#3a6df0', flow: { mode: 'ribbons', ribbons: 5, sWave: 1, span: 0.5, float: 1, wisps: 8 }, appearance: { shading: { mode: 'smooth', castShadow: 0.5 } }, tips: TIPS },
  { color: '#222a44', flow: { mode: 'cones', cones: 7, coneSharp: 0.6 }, appearance: { shading: { mode: 'smooth', castShadow: 0.6 } } },
], 3);

// 02 — moteurs de frange : fils individuels, grandes mèches triangulaires, fines étagées, asymétrique jusqu'au sourcil.
grid('02-franges-sheer-blades-wispy-asym.png', [
  { color: '#c93a5a', fringeEngine: { mode: 'sheer', gap: 0.7 }, strands: { hairline: 0.6, fine: 1 } },
  { color: '#2fb59a', fringeEngine: { mode: 'sheer', gap: 0.3 }, strands: { hairline: 0.6, fine: 1 } },
  { color: '#7a4bd6', fringeEngine: { mode: 'blades', gap: 0.55, side: 1, cheekLocks: true }, appearance: CEL },
  { color: '#e0457b', fringeEngine: { mode: 'blades', gap: 0.3, side: -1 }, appearance: CEL, tips: TIPS },
  { color: '#3a6df0', fringeEngine: { mode: 'wispy' }, tips: TIPS },
  { color: '#f2a93b', fringeEngine: { mode: 'asym_brow', side: 1, cheekLocks: true }, appearance: CEL },
], 3);

// 03 — côtés indépendants : oreille gauche cachée / droite dégagée, mèches rangées, mèches de joue (zones d'oreille tracées).
const earOverlay = (c: Cell): string => {
  const g = hairGeometry(c.face.params, c.lm);
  if (!g) return '';
  const path = (z: { x: number; y: number }[]): string => `M${z.map((q) => toWorld(c, q.x, q.y).map((v) => v.toFixed(1)).join(' ')).join('L')}Z`;
  return (['left', 'right'] as const).map((s) => `<path d="${path(g.sides[s].earZone)}" fill="none" stroke="${g.sides[s].ear === 'covered' ? '#ff5a5a' : g.sides[s].ear === 'free' ? '#7dffb0' : '#ffd24a'}" stroke-width="2" stroke-dasharray="5 3"/>`).join('');
};
grid('03-cotes-asymetriques-oreilles.png', [
  { style: 'long', color: '#7a4bd6', sides: { left: { ear: 'covered', cheek: 'long' }, right: { ear: 'free', cheek: 'none' } }, appearance: CEL },
  { style: 'bob', color: '#e0457b', sides: { left: { ear: 'free', cheek: 'none' }, right: { ear: 'covered', cheek: 'short' } }, appearance: CEL },
  { style: 'short', color: '#2fb59a', sides: { left: { ear: 'tucked', cheek: 'short' }, right: { ear: 'free', cheek: 'long' } }, fringeEngine: { mode: 'blades', cheekLocks: true }, appearance: CEL },
], 3, earOverlay);

// 04 — ombrage cel vs lisse, avec ombres teintées entre mèches, bandes de reflet blanches à contour dur.
grid('04-ombrage-cel-vs-lisse.png', [
  { color: '#3a6df0', flow: { mode: 'ribbons', ribbons: 7, span: 0.45 }, appearance: { shading: { mode: 'smooth', castShadow: 0 } } },
  { color: '#3a6df0', flow: { mode: 'ribbons', ribbons: 7, span: 0.45 }, appearance: { shading: { mode: 'cel', bands: 2, highlightBand: 0.5, castShadow: 0.6 } } },
  { color: '#3a6df0', flow: { mode: 'ribbons', ribbons: 7, span: 0.45 }, appearance: { shading: { mode: 'cel', bands: 3, highlightBand: 0.8, castShadow: 1 } } },
], 3);

// 05 — couleurs vives, dégradés racine → pointe (2, 3 couleurs), reflets colorés propres à chaque couleur.
const vivid = ['#e0457b', '#9a4bff', '#2a6df0', '#19b8c9', '#2fbf5c', '#f2d13b', '#f08a2b', '#d93a3a'];
grid('05-couleurs-vives-degrades.png', vivid.map((c, i) => ({ color: c, flow: { mode: 'ribbons', ribbons: 5, span: 0.4, wisps: 6 }, appearance: CEL, tips: { fade: 0.4, edgeFade: 0.3, irregular: 0.5, flick: 0.3 }, look: { tipColor: ['#ffd1f0', '#4be3ff', '#ff7ad9', '#a8ff7a', '#ffe66b', '#ff5a5a', '#fff0a8', '#ff9a3b'][i], midColor: i % 2 ? vivid[(i + 3) % vivid.length] : null, tipReach: 0.65 } })), 4);

// 06 — volume gonflé pour raide / ondulé (pas seulement afro) + silhouettes fortement asymétriques.
grid('06-volume-gonfle-silhouettes.png', [
  { texture: 'straight', color: '#c93a5a', silhouette: { puff: 0 } },
  { texture: 'straight', color: '#c93a5a', silhouette: { puff: 0.8 } },
  { texture: 'wavy', color: '#2fb59a', silhouette: { puff: 0.8, lift: 0.5 } },
  { texture: 'straight', color: '#7a4bd6', silhouette: { puff: 0.6, asymmetry: 1, bias: 1 }, flow: { mode: 'ribbons', ribbons: 6, span: 0.5 } },
  { texture: 'wavy', color: '#f2a93b', silhouette: { puff: 0.7, asymmetry: 1, bias: -1 }, flow: { mode: 'mixed', ribbons: 4, cones: 4 } },
  { texture: 'coily', color: '#222a44', silhouette: { puff: 0.4, asymmetry: 0.8, bias: 1 } },
], 3);

// 07 — racines relevées à la raie, longueurs étagées avec sous-couches visibles, textures mélangées.
grid('07-racines-etages-textures-melangees.png', [
  { color: '#c93a5a', part: 0, rootLift: { amount: 0, width: 0.4, fall: 0.5 } },
  { color: '#c93a5a', part: 0, rootLift: { amount: 0.9, width: 0.45, fall: 0.3 } },
  { color: '#c93a5a', part: 0, rootLift: { amount: 0.9, width: 0.45, fall: 0.9 } },
  { style: 'long', color: '#7a4bd6', tiers: { count: 3, step: 0.3, underTone: -0.4, underHue: 25, underVisible: 0.85 }, appearance: CEL },
  { style: 'curly', texture: 'wavy', color: '#2fb59a', tiers: { count: 4, step: 0.2, underVisible: 0.8 }, textureMix: [{ texture: 'wavy', weight: 1 }, { texture: 'curly', weight: 1 }, { texture: 'coily', weight: 0.6 }] },
  { color: '#f2a93b', strands: { mass: 0.8, fine: 1, hairline: 0.9 }, tips: TIPS },
], 3);

// 08 — occlusions : mèches devant le visage, recouvrement demandé vs mesuré (surcouche : empreintes d'yeux).
const occOverlay = (c: Cell): string => {
  const g = hairGeometry(c.face.params, c.lm);
  const box = (b: { minX: number; maxX: number; minY: number; maxY: number }): string => `M${[[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY]].map(([x, y]) => toWorld(c, x as number, y as number).map((v) => v.toFixed(1)).join(' ')).join('L')}Z`;
  return (g?.occlusions ?? []).map((o) => `<path d="${box(o.box)}" fill="none" stroke="#ffd24a" stroke-width="1.6" stroke-dasharray="4 3"/><text x="${toWorld(c, o.box.minX, o.box.minY - 4)[0]}" y="${toWorld(c, o.box.minX, o.box.minY - 4)[1]}" fill="#ffd24a" font-size="13" font-family="sans-serif">${o.target} ${o.requested.toFixed(2)} → ${o.measured.toFixed(2)}</text>`).join('');
};
grid('08-occlusions-devant-le-visage.png', [0.25, 0.5, 0.75, 1].map((a) => ({ color: '#222a44', fringeEngine: { mode: 'wispy' }, appearance: CEL, occlusion: { eyeLeft: a } })).concat([{ color: '#e0457b', occlusion: { eyeRight: 0.5, brows: 0.4 }, appearance: CEL } as never, { color: '#2fb59a', occlusion: { mouth: 0.5, nose: 0.3 }, appearance: CEL } as never]), 3, occOverlay);

// 09 — moteur d'apparence : ombre / lumière / contour indépendants, effets (glow, bloom, réfraction, grain).
const A0 = { flow: { mode: 'ribbons', ribbons: 6, span: 0.45, wisps: 6 }, color: '#e0457b' };
grid('09-moteur-apparence-teintes-effets.png', [
  { ...A0, appearance: { ...CEL, light: { shadow: null, light: null, rim: null } } },
  { ...A0, appearance: { ...CEL, light: { shadow: '#2a1060', light: '#ffe8a0', rim: '#00ffff' } } },
  { ...A0, appearance: { ...CEL, light: { shadow: '#0a3a40', light: '#fff0f8', rim: '#ff9a3b' }, contrast: 0.3, saturation: 0.3 } },
  { ...A0, appearance: { shading: { mode: 'smooth' }, glow: { color: '#ff5ad1', intensity: 0.5, radius: 0.5 }, bloom: { intensity: 0.5, radius: 0.5, threshold: 0.6 } } },
  { ...A0, appearance: { shading: { mode: 'smooth' }, texture: { kind: 'strands', scale: 0.5, intensity: 0.7 }, refraction: { strength: 0.5, scale: 0.5 } } },
  { ...A0, appearance: { shading: { mode: 'smooth' }, gradient: [{ offset: 0, color: '#2a1060' }, { offset: 0.35, color: '#e0457b' }, { offset: 0.7, color: '#ffb36b' }, { offset: 1, color: '#ffffff', opacity: 0.35 }], emission: { color: '#ff7a3b', intensity: 0.4 } } },
], 3);

// 10 — galerie aléatoire v2 (48 visages) + rapport de vérification sur 300 seeds.
const N = 48;
const gal = layout(N, 8, 250, 380, 0.46, (i) => ({ seed: 9000 + i * 17 }));
png('10-galerie-aleatoire-v2.png', render(gal.objects, 8 * 250, 6 * 380));
const seeds = Array.from({ length: 300 }, (_, i) => 71000 + i * 11);
const v2 = seeds.map((s) => generateRandomFace(s));
const v1 = seeds.map((s) => generateRandomFace(s, { hairEngine: 'classic' }));
const rep = v2.map(verifyFace);
const byCheck: Record<string, { total: number; failed: number }> = {};
for (const r of rep) for (const c of r.checks) (byCheck[`${c.layer}/${c.id}`] ??= { total: 0, failed: 0 }), (byCheck[`${c.layer}/${c.id}`] as { total: number }).total++, c.ok || ((byCheck[`${c.layer}/${c.id}`] as { failed: number }).failed++);
const faceMeta = v2.map((f) => {
  const lm = faceLandmarks(f.params, f.width, f.height);
  return { geo: hairGeometry(f.params, lm), h: f.params.hair };
});
const metrics = {
  seeds: seeds.length,
  facesAllLayersOk: rep.filter((r) => r.ok).length,
  errorFailures: rep.reduce((a, r) => a + r.failures.length, 0),
  warnings: rep.reduce((a, r) => a + r.warnings.length, 0),
  palette: { v1: paletteStats(v1), v2: paletteStats(v2) },
  coverage: {
    flowModes: Object.fromEntries(['classic', 'ribbons', 'cones', 'mixed'].map((m) => [m, v2.filter((f) => f.params.hair.flow.mode === m).length])),
    fringeEngines: Object.fromEntries(['off', 'sheer', 'blades', 'wispy', 'asym_brow'].map((m) => [m, v2.filter((f) => f.params.hair.fringeEngine.mode === m).length])),
    celShare: v2.filter((f) => f.params.hair.appearance.shading.mode === 'cel').length / seeds.length,
    asymmetricSides: v2.filter((f) => f.params.hair.sides.left.ear !== f.params.hair.sides.right.ear).length / seeds.length,
    withWisps: faceMeta.filter((m) => m.geo?.locks.some((l) => l.kind === 'wisp')).length / seeds.length,
    withMixedTextures: v2.filter((f) => f.params.hair.textureMix.length > 0).length / seeds.length,
  },
  checks: byCheck,
};
writeFileSync(`${DIR}/metrics.json`, `${JSON.stringify(metrics, null, 2)}\n`);
console.log(`${DIR}/metrics.json — ${metrics.facesAllLayersOk}/${seeds.length} visages passent les 3 couches ; vives v1 ${(metrics.palette.v1.vivid * 100).toFixed(0)} % → v2 ${(metrics.palette.v2.vivid * 100).toFixed(0)} %`);

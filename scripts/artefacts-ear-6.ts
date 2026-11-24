import { mkdirSync, writeFileSync } from 'node:fs';
import { composeEar } from '../src/face';
import { headShot } from './ear-audit/lib';
import { earCell, saveBoard } from './ear-audit/sheets';
import { rasterPng } from './lib/raster';
import { head3dPng } from './ear-audit/head3d';

/**
 * Preuves visuelles de la passe « moteur d'oreille 6 » : `OUT=<dossier> npx tsx scripts/artefacts-ear-6.ts [axes|cmp|diversite|tetes …]`.
 * Toute image est un rendu RÉEL du moteur, jamais retouché.
 */
const OUT = process.env.OUT ?? 'artefacts/oreille-passe-6';
mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
const run = (k: string): boolean => only.length === 0 || only.includes(k);
const HW = 300, HH = 380;
const headPng = (seed: number, edit: Record<string, unknown> = {}, ears?: object): Buffer => rasterPng(headShot(seed, edit, ears ? { ears } : {}).svg, { fitWidth: HW });
const V = [-0.9, 0, 0.9];

if (run('axes')) {
  const AXES: { id: string; title: string; edit: (v: number) => object; views: ('face' | 'three-quarter' | 'close-up')[] }[] = [
    { id: '04-scapha-curvature', title: 'scapha.curvature −0,9 / 0 / +0,9 (gros plan)', edit: (v) => ({ style: { detail: 0.9 }, morph: { scapha: { curvature: v } } }), views: ['close-up'] },
    { id: '04-scapha-gradient', title: 'scapha.gradient −0,9 / 0 / +0,9 (gros plan)', edit: (v) => ({ style: { detail: 0.9 }, morph: { scapha: { gradient: v } } }), views: ['close-up'] },
    { id: '05-helix-continuity', title: 'helix.continuity −0,9 / 0 / +0,9 (entaille / continu / régulier)', edit: (v) => ({ style: { detail: 0.9 }, morph: { helix: { continuity: v } } }), views: ['close-up'] },
    { id: '06-antihelix-upperBend', title: 'antihelix.upperBend −0,9 / 0 / +0,9 (02B)', edit: (v) => ({ style: { detail: 0.9 }, morph: { antihelix: { upperBend: v } } }), views: ['close-up', 'three-quarter'] },
    { id: '07-antihelix-lowerBend', title: 'antihelix.lowerBend −0,9 / 0 / +0,9 (02C)', edit: (v) => ({ style: { detail: 0.9 }, morph: { antihelix: { lowerBend: v } } }), views: ['close-up', 'three-quarter'] },
    { id: '08-concha-floor', title: 'concha.floor −0,9 / 0 / +0,9 (05E : plateau / neutre / cuvette)', edit: (v) => ({ style: { detail: 0.9 }, morph: { concha: { floor: v } } }), views: ['close-up', 'three-quarter'] },
    { id: '09-helix-darwinSite', title: 'helix.darwinSite −0,9 / 0 / +0,9 (Darwin à 0,8)', edit: (v) => ({ style: { detail: 0.9 }, morph: { helix: { darwin: 0.8, darwinSite: v } } }), views: ['close-up'] },
  ];
  for (const a of AXES) for (const view of a.views) saveBoard(OUT, `${a.id}-${view}`, a.title + ` — ${view}`, V.map((x) => ({ png: earCell(a.edit(x) as never, view, 260, 360), label: `${x}` })), 3, 260, 360);
}
if (run('tetes')) {
  saveBoard(OUT, '01-tetes-entieres', 'Têtes entières (graines 11–18, oreilles « natural »)', Array.from({ length: 8 }, (_, i) => ({ png: headPng(11 + i, {}, composeEar(5000 + i, { character: 'natural' })), label: `tête ${11 + i}` })), 4, HW, HH);
}
if (run('cmp')) {
  saveBoard(OUT, '02-oreille-defaut-4-vues', 'Oreille par défaut (graine 11) : de face, trois-quarts, profil, gros plan', (['face', 'three-quarter', 'profile', 'close-up'] as const).map((v) => ({ png: earCell({}, v, 260, 360), label: v })), 4, 260, 360);
  saveBoard(OUT, '03-oreilles-natural-gros-plan', '24 oreilles composées « natural » (graines 5000–5023), gros plan', Array.from({ length: 24 }, (_, i) => ({ png: earCell(composeEar(5000 + i, { character: 'natural' }) as never, 'close-up', 220, 300), label: `natural ${5000 + i}` })), 6, 220, 300);
}
if (run('tete3d')) {
  // Tête 3D tournante (kind head_3d) avec des oreilles COMPOSÉES : même modèle que les vues 2D (`earModel` + `placeEarPoint`).
  const cells: { png: Buffer; label: string }[] = [];
  for (let i = 0; i < 6; i++) for (const yaw of [90, 55]) cells.push({ png: head3dPng(11 + i, composeEar(5000 + i, { character: 'natural' }), yaw, { width: 300 }), label: `tête ${11 + i} · lacet ${yaw}°` });
  saveBoard(OUT, '10-tete-3d-oreilles-composees', 'Tête 3D tournante, oreilles composées « natural » (graines 5000–5005) : profil 90° et trois-quarts 55°', cells, 4, 300, 300);
}
void writeFileSync;

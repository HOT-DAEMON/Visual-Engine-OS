import { mkdirSync } from 'node:fs';
import { composeEar } from '../src/face';
import { headShot, type Shot } from './ear-audit/lib';
import { earCell, saveBoard, merge, type Edit } from './ear-audit/sheets';
import { rasterPng } from './lib/raster';

/**
 * Preuves visuelles de la session « moteur d'oreille 3 » : `npx tsx scripts/artefacts-ear-3.ts [planche …]`.
 * Toute image est un rendu RÉEL du moteur (jamais retouché) : tête entière (de face, crâne chauve pour que l'oreille soit lisible), ou oreille en gros plan / trois-quarts / profil.
 */
const OUT = 'artefacts/oreille-composeur';
mkdirSync(OUT, { recursive: true });
const HW = 300, HH = 380;
const headPng = (s: Shot): Buffer => rasterPng(s.svg, { fitWidth: HW });
/** Cellule « tête entière » recadrée sur la moitié utile du cadre (visage + oreilles) : la tête reste ENTIÈRE, le fond blanc autour est conservé. */
const head = (seed: number, edit: Record<string, unknown> = {}, ears?: object) => headPng(headShot(seed, edit, ears ? { ears } : {}));
const only = process.argv.slice(2);
const BOARDS: Record<string, () => void> = {
  '01-tete-entiere-axes-corriges': () => {
    const cases: [string, Record<string, unknown>][] = [
      ['défaut', {}], ['scapha.width −0,8', { 'morph.scapha.width': -0.8 }], ['scapha.width +0,8', { 'morph.scapha.width': 0.8 }],
      ['fidelity 0,05', { 'style.fidelity': 0.05 }], ['fidelity 1,0', { 'style.fidelity': 1 }], ['softness 0,05', { 'style.softness': 0.05 }],
      ['softness 0,95', { 'style.softness': 0.95 }], ['detail 0,05', { 'style.detail': 0.05 }], ['detail 0,95', { 'style.detail': 0.95 }],
      ['attach.scale 0,8', { 'attach.scale': 0.8 }], ['attach.scale 1,0', {}], ['attach.scale 1,3', { 'attach.scale': 1.3 }],
    ];
    saveBoard(OUT, '01-tete-entiere-axes-corriges', 'Paramètres qui ne faisaient rien avant (mesurés à 0 px) : tête entière, graine 11', cases.map(([l, e]) => ({ png: head(11, e), label: l })), 6, HW, HH);
  },
  '02-tete-entiere-nouveaux-axes': () => {
    const ax: [string, string, number][] = [['helix', 'darwin', 0.9], ['helix', 'fold', 0.9], ['lobule', 'cleft', 0.9], ['lobule', 'stretch', 0.9], ['concha', 'wall', 0.9], ['fossa', 'depth', 0.9], ['crus', 'angle', 0.9], ['tragus', 'tip', 0.9], ['antihelix', 'curvature', 0.9]];
    const cells = [{ png: head(77, {}), label: 'défaut' }, ...ax.map(([g, k, v]) => ({ png: head(77, { [`morph.${g}.${k}`]: v }), label: `${g}.${k} = ${v}` }))];
    saveBoard(OUT, '02-tete-entiere-nouveaux-axes', 'Nouveaux axes anatomiques — tête entière, graine 77 (0 = absent par défaut)', cells, 5, HW, HH);
  },
  '03-nouveaux-axes-vues': () => {
    const ax: [string, string, number][] = [['helix', 'darwin', 0.9], ['helix', 'fold', 0.9], ['lobule', 'cleft', 0.9], ['lobule', 'stretch', 0.9], ['concha', 'wall', 0.9], ['fossa', 'depth', 0.9], ['crus', 'angle', 0.9], ['tragus', 'tip', 0.9], ['antihelix', 'curvature', 0.9]];
    const cells: { png: Buffer; label: string }[] = [];
    for (const [g, k, v] of ax) for (const view of ['face', 'three-quarter', 'profile'] as const) cells.push({ png: earCell({ morph: { [g]: { [k]: v } } }, view, 200, 280), label: `${g}.${k} — ${view}` });
    saveBoard(OUT, '03-nouveaux-axes-vues', 'Nouveaux axes : le même modèle dans trois vues (face, trois-quarts, profil)', cells, 6, 200, 280);
  },
  '04-matiere-et-surface': () => {
    const E = (e: Edit): Edit => merge({ style: { detail: 0.9 } }, e);
    const cases: [string, Edit][] = [
      ['translucidité 0,05', { material: { translucency: 0.05 } }], ['défaut', {}], ['translucidité 0,95', { material: { translucency: 0.95 } }],
      ['glow 0,9 (peau)', { material: { glow: 0.9 } }], ['glow 0,9 cristal', { material: { kind: 'crystal', glow: 0.9 } }], ['glow 0,9 écailles', { material: { kind: 'scaly', glow: 0.9 } }],
      ['pigmentation 0,9', E({ surface: { pigmentation: 0.9 } })], ['plis 0,9', E({ surface: { folds: 0.9 } })], ['pores 0,9', E({ surface: { pores: 0.9 } })],
      ['vaisseaux 0,9', E({ surface: { vessels: 0.9 } })], ['pilosité 0,9', E({ surface: { hair: 0.9 } })], ['tout 0,7', E({ surface: { pigmentation: 0.7, folds: 0.7, pores: 0.5, vessels: 0.6, hair: 0.6 } })],
    ];
    saveBoard(OUT, '04-matiere-et-surface', 'Transmission, émission et détails de surface SURF-05 (gros plan éclairé)', cases.map(([l, e]) => ({ png: earCell(e, 'close-up', 240, 330), label: l })), 6, 240, 330);
  },
  '05-composeur-tetes-entieres': () => {
    const cells: { png: Buffer; label: string }[] = [];
    for (const ch of ['natural', 'caricature', 'fantasy'] as const) for (let i = 0; i < 8; i++) { const seed = 2000 + i * 7; cells.push({ png: head(11 + i, {}, composeEar(seed, { character: ch })), label: `${ch} #${seed}` }); }
    saveBoard(OUT, '05-composeur-tetes-entieres', 'Oreilles composées sur des têtes entières : natural (haut), caricature (milieu), fantasy (bas)', cells, 8, 200, 254);
  },
  '06-composeur-trois-quarts': () => {
    const cells: { png: Buffer; label: string }[] = [];
    for (const ch of ['natural', 'caricature', 'fantasy'] as const) for (let i = 0; i < 8; i++) cells.push({ png: earCell(composeEar(3000 + i, { character: ch }) as never, 'three-quarter', 200, 280), label: `${ch} #${3000 + i}` });
    saveBoard(OUT, '06-composeur-trois-quarts', 'Oreilles composées en trois-quarts : même grammaire, trois dosages', cells, 8, 200, 280);
  },
};
for (const [name, run] of Object.entries(BOARDS)) if (!only.length || only.some((o) => name.startsWith(o))) run();

import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { composeEar } from '../src/face';
import { headShot } from './ear-audit/lib';
import { earCell, saveBoard } from './ear-audit/sheets';
import { rasterPng } from './lib/raster';

/**
 * Preuves visuelles de la passe « moteur d'oreille 4 » : `OUT=<dossier> npx tsx scripts/artefacts-ear-4.ts [cmp|axes|verif …]`.
 *  - `cmp`  : planches COMPARABLES (existent à l'identique avant/après) → à lancer sur le commit f6b5e36 (OUT=/tmp/avant) ET sur la passe 4 pour le face-à-face ;
 *  - `axes` : planches des 11 nouveaux axes (n'existent qu'après) ;
 *  - `verif`: rapport de la vérification du rendu (verify/ear-render) sur 24 têtes.
 * Toute image est un rendu RÉEL du moteur, jamais retouché.
 */
const OUT = process.env.OUT ?? 'artefacts/oreille-passe-4';
mkdirSync(OUT, { recursive: true });
const HW = 300, HH = 380;
const only = process.argv.slice(2);
const run = (k: string): boolean => only.length === 0 || only.includes(k);
const headPng = (seed: number, edit: Record<string, unknown> = {}, ears?: object): Buffer => rasterPng(headShot(seed, edit, ears ? { ears } : {}).svg, { fitWidth: HW });
const natural = (i: number): object => composeEar(5000 + i, { character: 'natural' });

/** Recadrage de la région de l'oreille droite d'une tête entière (même rendu que la tête, viewBox resserrée). */
function earCrop(seed: number, ears: object): Buffer {
  const sh = headShot(seed, {}, { ears });
  const b = sh.boxes[1]!, pad = 70;
  const x0 = b.x0 - pad * 1.6, y0 = b.y0 - pad, w = b.x1 - b.x0 + pad * 2.4, h = b.y1 - b.y0 + pad * 2;
  const svg = sh.svg.replace(/viewBox="[^"]*"/, `viewBox="${x0} ${y0} ${w} ${h}"`).replace(/width="[^"]*"/, `width="${w}"`).replace(/height="[^"]*"/, `height="${h}"`);
  return Buffer.from(new Resvg(svg, { fitTo: { mode: 'height', value: 420 } }).render().asPng());
}

if (run('cmp')) {
  saveBoard(OUT, '01-tetes-entieres', 'Têtes entières (graines 11–18, oreilles « natural »)', Array.from({ length: 8 }, (_, i) => ({ png: headPng(11 + i, {}, natural(i)), label: `tête ${11 + i}` })), 4, HW, HH);
  saveBoard(OUT, '02-oreille-defaut-4-vues', 'Oreille par défaut (graine 11) : de face, trois-quarts, profil, gros plan', (['face', 'three-quarter', 'profile', 'close-up'] as const).map((v) => ({ png: earCell({}, v, 260, 360), label: v })), 4, 260, 360);
  saveBoard(OUT, '03-oreilles-natural-gros-plan', '24 oreilles composées « natural » (graines 5000–5023), gros plan', Array.from({ length: 24 }, (_, i) => ({ png: earCell(composeEar(5000 + i, { character: 'natural' }) as never, 'close-up', 220, 300), label: `natural ${5000 + i}` })), 6, 220, 300);
  for (const s of [11, 15, 18, 22]) writeFileSync(`${OUT}/crop-attache-${s}.png`, earCrop(s, composeEar(5000 + s, { character: 'natural' })));
}

if (run('axes')) {
  const AX: [string, string][] = [['helix', 'torsion'], ['helix', 'continuity'], ['scapha', 'curvature'], ['scapha', 'gradient'], ['fossa', 'tilt'], ['fossa', 'curvature'], ['concha', 'volume'], ['concha', 'tilt'], ['concha', 'transition'], ['tragus', 'thickness'], ['lobule', 'volume']];
  for (const view of ['close-up', 'three-quarter'] as const) {
    const cells = AX.flatMap(([g, k]) => [-0.9, 0, 0.9].map((v) => ({ png: earCell({ style: { detail: 0.9 }, morph: { [g]: { [k]: v } } } as never, view, 240, 320), label: `${g}.${k} ${v}` })));
    saveBoard(OUT, `04-axes-${view}`, `11 nouveaux axes −0,9 / 0 / +0,9 (${view})`, cells, 6, 240, 320);
  }
  const hc = AX.flatMap(([g, k]) => [-0.9, 0.9].map((v) => ({ png: headPng(77, { [`morph.${g}.${k}`]: v }), label: `${g}.${k} ${v}` })));
  saveBoard(OUT, '05-axes-tete-entiere', 'Mêmes axes sur la tête entière (graine 77) : ce qui se lit vraiment à l\'échelle de la tête', hc, 6, HW, HH);
}

if (run('verif')) {
  void import('../src/verify/ear-render').then(({ earRenderChecks }) => {
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < 24; i++) {
      const e = composeEar(5000 + i, { character: 'natural' }) as { style: { exaggeration: number; look: 'realistic' | 'anime' } };
      const w = headShot(11 + i, {}, { ears: e }), wo = headShot(11 + i, {}, { ears: e, noEars: true });
      const boxes = w.boxes.map((b) => ({ ...b, side: ((b.x0 + b.x1) / 2 < w.w / 2 ? -1 : 1) as -1 | 1 }));
      const cs = earRenderChecks({ withEars: w, without: wo, boxes, headCx: w.w / 2, expected: [], exaggeration: e.style.exaggeration, look: e.style.look });
      rows.push({ tete: 11 + i, oreille: 5000 + i, echecs: cs.filter((c) => !c.ok).map((c) => `${c.severity}:${c.id}=${c.value.toFixed(3)}`), controles: cs.length });
    }
    writeFileSync(`${OUT}/verification-rendu.json`, JSON.stringify(rows, null, 1));
    console.log(`verification-rendu.json : ${rows.filter((r) => (r.echecs as string[]).length === 0).length}/24 têtes sans aucun échec (erreur ni avertissement)`);
  });
}

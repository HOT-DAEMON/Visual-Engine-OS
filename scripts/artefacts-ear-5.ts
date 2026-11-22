import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { composeEar } from '../src/face';
import { headShot } from './ear-audit/lib';
import { earCell, saveBoard } from './ear-audit/sheets';
import { rasterPng } from './lib/raster';

/**
 * Preuves visuelles de la passe « moteur d'oreille 5 » : `OUT=<dossier> npx tsx scripts/artefacts-ear-5.ts [cmp|axes|diversite|verif …]`.
 *  - `cmp`      : planches COMPARABLES (existent à l'identique avant/après) → lancer sur le commit ddbbad4 (OUT=/tmp/avant5) ET sur la passe 5 ;
 *  - `axes`     : scapha.curvature (axe renforcé), de face / trois-quarts / gros plan, et à l'échelle de la tête ;
 *  - `diversite`: 12 têtes entières × 3 caractères d'oreille (même grammaire) : « jamais deux oreilles pareilles » se juge à l'œil ;
 *  - `verif`    : vérification du rendu (verify/ear-render) sur 24 têtes + vérification géométrique/anatomique/style sur 90 oreilles composées.
 * Toute image est un rendu RÉEL du moteur, jamais retouché.
 */
const OUT = process.env.OUT ?? 'artefacts/oreille-passe-5';
mkdirSync(OUT, { recursive: true });
const HW = 300, HH = 380;
const only = process.argv.slice(2);
const run = (k: string): boolean => only.length === 0 || only.includes(k);
const headPng = (seed: number, edit: Record<string, unknown> = {}, ears?: object): Buffer => rasterPng(headShot(seed, edit, ears ? { ears } : {}).svg, { fitWidth: HW });
const natural = (i: number): object => composeEar(5000 + i, { character: 'natural' });

/** Recadrage de la région de l'oreille d'une tête entière (même rendu que la tête, viewBox resserrée) ; `side` 1 = oreille droite du rendu. */
function earCrop(seed: number, ears: object, side = 1): Buffer {
  const sh = headShot(seed, {}, { ears });
  const b = sh.boxes[side]!, pad = 70;
  const x0 = b.x0 - pad * 1.6, y0 = b.y0 - pad, w = b.x1 - b.x0 + pad * 3.2, h = b.y1 - b.y0 + pad * 2;
  const svg = sh.svg.replace(/viewBox="[^"]*"/, `viewBox="${x0} ${y0} ${w} ${h}"`).replace(/width="[^"]*"/, `width="${w}"`).replace(/height="[^"]*"/, `height="${h}"`);
  return Buffer.from(new Resvg(svg, { fitTo: { mode: 'height', value: 420 } }).render().asPng());
}

if (run('cmp')) {
  saveBoard(OUT, '01-tetes-entieres', 'Têtes entières (graines 11–18, oreilles « natural »)', Array.from({ length: 8 }, (_, i) => ({ png: headPng(11 + i, {}, natural(i)), label: `tête ${11 + i}` })), 4, HW, HH);
  saveBoard(OUT, '02-oreille-defaut-4-vues', 'Oreille par défaut (graine 11) : de face, trois-quarts, profil, gros plan', (['face', 'three-quarter', 'profile', 'close-up'] as const).map((v) => ({ png: earCell({}, v, 260, 360), label: v })), 4, 260, 360);
  saveBoard(OUT, '03-oreilles-natural-gros-plan', '24 oreilles composées « natural » (graines 5000–5023), gros plan', Array.from({ length: 24 }, (_, i) => ({ png: earCell(composeEar(5000 + i, { character: 'natural' }) as never, 'close-up', 220, 300), label: `natural ${5000 + i}` })), 6, 220, 300);
  for (const s of [11, 15, 18, 22]) writeFileSync(`${OUT}/crop-attache-${s}.png`, earCrop(s, natural(s)));
}

if (run('axes')) {
  const v = [-0.9, 0, 0.9];
  for (const view of ['face', 'three-quarter', 'close-up'] as const) saveBoard(OUT, `04-scapha-curvature-${view}`, `scapha.curvature −0,9 / 0 / +0,9 (${view})`, v.map((x) => ({ png: earCell({ style: { detail: 0.9 }, morph: { scapha: { curvature: x } } } as never, view, 260, 360), label: `curvature ${x}` })), 3, 260, 360);
  saveBoard(OUT, '04-scapha-curvature-tete', 'scapha.curvature sur la tête entière (graine 77)', v.map((x) => ({ png: headPng(77, { 'morph.scapha.curvature': x }), label: `curvature ${x}` })), 3, HW, HH);
}

if (run('diversite')) {
  for (const ch of ['natural', 'caricature', 'fantasy'] as const) saveBoard(OUT, `05-diversite-${ch}`, `12 têtes entières, oreilles « ${ch} » (graines 6000–6011) : chaque oreille est singulière`, Array.from({ length: 12 }, (_, i) => ({ png: headPng(30 + i, {}, composeEar(6000 + i, { character: ch })), label: `${ch} ${6000 + i}` })), 6, HW, HH);
}

if (run('verif')) {
  void Promise.all([import('../src/verify/ear-render'), import('../src/verify/ear'), import('../src/face'), import('../src/schema')]).then(([{ earRenderChecks }, { checkEars }, face, { FaceParams }]) => {
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
    const model: Record<string, { n: number; fail: number; ids: string[] }> = {};
    for (const ch of ['natural', 'caricature', 'fantasy'] as const) {
      const r = { n: 0, fail: 0, ids: [] as string[] };
      for (let i = 0; i < 30; i++) {
        const p = FaceParams.parse({ anatomyEngine: 'structured', ears: composeEar(700 + i, { character: ch }) });
        const cs = checkEars(p, face.faceLandmarks(p, 300, 400), '#b98a62');
        r.n += cs.length; const bad = cs.filter((c) => !c.ok); r.fail += bad.length; r.ids.push(...new Set(bad.map((c) => `${c.severity}:${c.id.replace(/-[LR]$/, '')}`)));
      }
      r.ids = [...new Set(r.ids)];
      model[ch] = r;
    }
    writeFileSync(`${OUT}/verification-modele.json`, JSON.stringify(model, null, 1));
    console.log('verification-modele.json', JSON.stringify(model));
  });
}

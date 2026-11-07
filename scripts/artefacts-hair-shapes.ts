import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { generateRandomFace } from '../src';
import { faceLandmarks } from '../src/face';
import { buildBoundary } from '../src/face/hair/boundary';
import { defaultFrame, headSpecFromFace, refView, renderHead } from '../src/head-turntable';
import { HAIR_STYLES } from '../src/schema';
import { checkHairShape, checkHeadHair, verifyFace } from '../src/verify';
import { rasterPng } from './lib/raster';
import { layout, render } from './lib/proof';

/**
 * Preuves des FORMES DE CHEVEUX face au crâne (`docs/HAIR-SHAPES.md`) : `npx tsx scripts/artefacts-hair-shapes.ts`.
 * Les images « avant » (`artefacts/hair-shapes/avant/`) ont été produites par le moteur d'origine (commit 327f2b9 + lisière) avec la MÊME configuration
 * (graine 700 + 13·i, identité i mod 8, graine de coiffure 5 + i, frange alternée).
 */
const OUT = 'artefacts/hair-shapes';
mkdirSync(OUT, { recursive: true });
const STY = HAIR_STYLES.filter((s) => s !== 'bald');
const FONT = 'Inter, DejaVu Sans, sans-serif';
const txt = (x: number, y: number, s: string, size = 14, fill = '#222', anchor = 'start'): string => `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
const sheet = (name: string, w: number, h: number, body: string): void => {
  const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#f4f1ea"/>${body}</svg>`;
  writeFileSync(`${OUT}/${name}.png`, rasterPng(full, { fonts: true, fitWidth: Math.min(2000, w) }));
  console.log(`${OUT}/${name}.png`);
};
const b64 = (b: Buffer | string): string => (typeof b === 'string' ? readFileSync(b) : b).toString('base64');
const img = (x: number, y: number, w: number, h: number, data: string): string => `<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${data}"/>`;
const NOFH = { mustache: 'none', beard: 'none' } as const;

// ---- 01 : avant / après, 10 coiffures, moteur classique et v2 ----------------------------------------------------------------------------
const grid = (engine: 'classic' | 'v2'): Buffer => {
  const C = 5, CW = 420, CH = 520;
  const L = layout(STY.length, C, CW, CH, 0.7, (i) => ({ seed: 700 + i * 13, opts: { identity: i % 8, ...(engine === 'classic' ? { hairEngine: 'classic' as const } : {}), hair: { style: STY[i], texture: 'auto', fringe: i % 2 ? 'sweep' : 'none', seed: 5 + i } as never, facialHair: NOFH } as never }));
  return render(L.objects, C * CW, 2 * CH, '', '#f4f1ea');
};
for (const engine of ['classic', 'v2'] as const) {
  const after = grid(engine), W = 2100, H = 1040;
  sheet(`01-avant-apres-${engine}`, W, 2 * H + 150, txt(20, 40, `AVANT (moteur d'origine) — ${engine}`, 28) + img(0, 60, W, H, b64(`${OUT}/avant/${engine}-10-coiffures.png`)) + txt(20, H + 130, `APRÈS (ce travail) — ${engine}`, 28) + img(0, H + 150, W, H, b64(after)));
}

// ---- 02 : tête COMPLÈTE en rotation avec la lisière du visage (pont lisière → tête tournante) ---------------------------------------------
{
  const rows: { style: string; seed: number; id: number }[] = [{ style: 'short', seed: 700, id: 3 }, { style: 'bob', seed: 778, id: 6 }, { style: 'long', seed: 791, id: 7 }, { style: 'ponytail', seed: 804, id: 0 }, { style: 'afro', seed: 752, id: 4 }, { style: 'spiky', seed: 726, id: 2 }];
  const yaws = [0, 45, 90, 135, 180], S = 380;
  let body = '';
  rows.forEach((r, ri) => {
    const f = generateRandomFace(r.seed, { identity: r.id, hairEngine: 'classic', hair: { style: r.style, texture: 'auto', seed: 5 } as never, facialHair: NOFH } as never);
    const lm = faceLandmarks(f.params, f.width, f.height);
    const spec = headSpecFromFace(f.params, buildBoundary(f.params, lm), (f.objects[0] as { material: { color: string } }).material.color);
    body += txt(10, 40 + ri * S + 20, r.style, 20);
    yaws.forEach((yaw, ci) => {
      const t = renderHead(refView(yaw), spec, { frame: defaultFrame(S), ss: 2 });
      body += img(110 + ci * S, 20 + ri * S, S, S, t.svg.match(/base64,([^"]+)"/)![1]!);
    });
  });
  sheet('02-tete-complete-en-rotation', 110 + yaws.length * S, rows.length * S + 40, body);
}

// ---- 03 : vent (−1, 0, +1) sur 6 coiffures ------------------------------------------------------------------------------------------------
{
  const styles = ['short', 'spiky', 'bob', 'long', 'ponytail', 'curly'], winds = [-1, 0, 1], CW = 420, CH = 520;
  const L = layout(styles.length * winds.length, winds.length, CW, CH, 0.7, (i) => ({ seed: 791, opts: { identity: 7, hairEngine: 'classic' as const, hair: { style: styles[Math.floor(i / 3)], texture: 'auto', fringe: 'sweep', seed: 12, wind: { x: winds[i % 3], y: i % 3 === 1 ? 0 : 0.25, flex: 1 } } as never, facialHair: NOFH } as never }));
  sheet('03-vent', winds.length * CW, styles.length * CH + 60, txt(20, 36, 'vent x = −1 | aucun | x = +1  (flex = 1, soulèvement 0,25)', 22) + img(0, 60, winds.length * CW, styles.length * CH, b64(render(L.objects, winds.length * CW, styles.length * CH, '', '#f4f1ea'))));
}

// ---- 04 : vérification 3 couches, 11 coiffures × 24 graines -------------------------------------------------------------------------------
{
  const rowsOut: Record<string, unknown>[] = [];
  let body = txt(20, 36, 'Vérification du rendu : erreurs / avertissements par coiffure (24 graines, moteur classique)', 22);
  body += ['coiffure', 'géométrie', 'anatomie', 'style', 'tête tournante', 'verifyFace'].map((h, i) => txt(20 + i * 190, 80, h, 16, '#555')).join('');
  STY.forEach((style, si) => {
    const tally: { geometry: number[]; anatomy: number[]; style: number[]; turn: number[]; full: number } = { geometry: [0, 0], anatomy: [0, 0], style: [0, 0], turn: [0, 0], full: 0 };
    for (let k = 0; k < 24; k++) {
      const f = generateRandomFace(4000 + k * 19, { identity: k % 8, hairEngine: 'classic', hair: { style, texture: 'auto', fringe: k % 2 ? 'sweep' : 'none', seed: k } as never } as never);
      for (const c of checkHairShape(f)) if (!c.ok) tally[c.layer][c.severity === 'error' ? 0 : 1]!++;
      for (const c of checkHeadHair(f)) if (!c.ok) tally.turn[c.severity === 'error' ? 0 : 1]!++;
      if (k < 4 && !verifyFace(f).ok) tally.full++;
    }
    rowsOut.push({ coiffure: style, ...tally });
    const y = 120 + si * 34, cell = (a: number[]) => `${a[0]} err · ${a[1]} warn`;
    body += txt(20, y, style, 16) + txt(210, y, cell(tally.geometry), 15, tally.geometry[0] ? '#c00' : '#1a7f37') + txt(400, y, cell(tally.anatomy), 15, tally.anatomy[0] ? '#c00' : '#1a7f37') + txt(590, y, cell(tally.style), 15, tally.style[0] ? '#c00' : '#1a7f37') + txt(780, y, cell(tally.turn), 15, tally.turn[0] ? '#c00' : '#1a7f37') + txt(970, y, `${tally.full}/4 rapports en échec`, 15, tally.full ? '#c00' : '#1a7f37');
  });
  writeFileSync(`${OUT}/verification.json`, JSON.stringify(rowsOut, null, 2));
  sheet('04-verification-3-couches', 1200, 120 + STY.length * 34 + 20, body);
}

import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileScene, generateRandomFace } from '../src';
import { applyNeckPreset, NECK_PRESETS } from '../src/neck';
import { rasterPng } from './lib/raster';

/**
 * Preuves visuelles de la passe « reste du cou » (docs/NECK-REMAINING.md). `npx tsx scripts/artefacts-neck-remaining.ts` écrit dans artefacts/neck-remaining/ ;
 * `AVANT_DIR=/tmp/avant` + `MODE=avant` rend seulement les cas « avant » (à lancer sur un checkout de l'ancien commit) pour les planches avant/après.
 */
const OUT = process.env.MODE === 'avant' ? (process.env.AVANT_DIR ?? '/tmp/avant') : join('artefacts', 'neck-remaining');
const AVANT = process.env.AVANT_DIR ?? '/tmp/avant';
mkdirSync(OUT, { recursive: true });
const W = 640, H = 900;
type Json = Record<string, unknown>;
function scene(seed: number, neck: Json, body: Json | null, extra: Json = {}): string {
  const f = generateRandomFace(seed, { id: 'f0', transform: { x: 320, y: 330, scale: 1 }, neck: { visible: true, ...neck }, ...extra } as never);
  const r = compileScene({ width: W, height: H, background: '#f4f1ec', objects: [...f.objects, ...(body ? [{ kind: 'body', id: 'b0', host: 'f0', body }] : [])] } as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
}
const png = (svg: string, fit: number): string => rasterPng(svg, { fitWidth: fit }).toString('base64');
/** Découpe (x,y,w,h) du rendu `svg`, rendue en `px` de large. */
function crop(svg: string, x: number, y: number, w: number, h: number, px: number): string {
  const full = png(svg, W * 2);
  return rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}"><image x="0" y="0" width="${W}" height="${H}" href="data:image/png;base64,${full}"/></svg>`, { fitWidth: px }).toString('base64');
}
interface Cell { readonly b64: string; readonly label: string; readonly w: number; readonly h: number }
function board(cells: Cell[], cols: number, file: string, title: string): void {
  const cw = Math.max(...cells.map((c) => c.w)), ch = Math.max(...cells.map((c) => c.h)), pad = 10, head = 36, lab = 22, rows = Math.ceil(cells.length / cols);
  const Wb = cols * (cw + pad) + pad, Hb = head + rows * (ch + lab + pad) + pad;
  const body = cells.map((c, i) => { const x = pad + (i % cols) * (cw + pad), y = head + Math.floor(i / cols) * (ch + lab + pad); return `<image x="${x}" y="${y}" width="${c.w}" height="${c.h}" href="data:image/png;base64,${c.b64}"/><text x="${x + 2}" y="${y + c.h + 15}" font-family="sans-serif" font-size="13" fill="#222">${c.label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`; }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Wb}" height="${Hb}" viewBox="0 0 ${Wb} ${Hb}"><rect width="100%" height="100%" fill="#fff"/><text x="${pad}" y="24" font-family="sans-serif" font-size="17" font-weight="bold" fill="#111">${title}</text>${body}</svg>`;
  writeFileSync(join(OUT, file), rasterPng(svg, { fonts: true, fitWidth: Wb }));
}
const BODY = { age: 28, sex: 1, muscularity: 0.6 };
const NECKLINE = [90, 280, 460, 360] as const; // x, y, w, h : menton, cou, épaules

// ── cas partagés « avant/après » ─────────────────────────────────────────────
const CASES: Record<string, { label: string; neck: Json; body: Json; seed: number }> = {
  compression: { label: 'cou comprimé (compression 0,8)', neck: { system: { pose: { compression: 0.8 } } }, body: BODY, seed: 3 },
  massif: { label: 'cou massif (trapèzes 1, masse 0,85)', neck: { width: 0.5, system: { modifiers: { mass: 0.85 }, musculature: { trapezius: 1 } } }, body: BODY, seed: 3 },
  defaut: { label: 'cou par défaut avec corps', neck: {}, body: BODY, seed: 3 },
};
if (process.env.MODE === 'avant') {
  for (const [k, c] of Object.entries(CASES)) writeFileSync(join(OUT, `${k}.png`), Buffer.from(crop(scene(c.seed, c.neck, c.body, { neckVariety: 0 }), ...NECKLINE, 460), 'base64'));
  console.log('avant écrit dans', OUT);
  process.exit(0);
}

// 01 — avant / après : plis, trapèzes en volumes, haut du torse, lumière de contour
{
  const cells: Cell[] = [];
  for (const [k, c] of Object.entries(CASES)) {
    const a = join(AVANT, `${k}.png`);
    if (existsSync(a)) cells.push({ b64: readFileSync(a).toString('base64'), label: `AVANT — ${c.label}`, w: 460, h: 360 });
    cells.push({ b64: crop(scene(c.seed, c.neck, c.body, { neckVariety: 0 }), ...NECKLINE, 460), label: `APRÈS — ${c.label}`, w: 460, h: 360 });
  }
  board(cells, 2, '01-avant-apres-plis-trapezes-torse.png', 'Défauts §F : ligne sombre du cou comprimé, haut plat du torse, trapèzes en traits droits');
}
// 02 — dimorphisme du larynx par body.sex
{
  const cells: Cell[] = [];
  for (const [sx, lab] of [[-1, 'body.sex = −1 (féminin)'], [0, 'body.sex = 0'], [1, 'body.sex = +1 (masculin)']] as const)
    cells.push({ b64: crop(scene(3, { muscles: 0.3, width: 0.34, system: { modifiers: { mass: 0.1 } } }, { age: 28, sex: sx, muscularity: 0.5 }, { neckVariety: 0 }), 150, 330, 340, 270, 340), label: lab, w: 340, h: 270 });
  board(cells, 3, '02-larynx-dimorphisme-sexe.png', 'Larynx : même cou, même visage — seul body.sex change');
}
// 03 — presets (tête, cou, épaules)
{
  const cells = NECK_PRESETS.map((p) => ({ b64: crop(scene(3, applyNeckPreset(p.id) as unknown as Json, BODY, { neckVariety: 0 }), 60, 20, 520, 760, 260), label: `${p.family} — ${p.label}`, w: 260, h: 380 }));
  board(cells, 5, '03-presets-cou.png', `Presets du cou (${NECK_PRESETS.length}) — même visage, même corps, seul le preset change`);
}
// 04 — accessoire / mâchoire
{
  const collar = (at: number): Json => ({ system: { attachments: [{ kind: 'collar', at, size: 0.5, count: 1, color: '#884422' }] } });
  const cells: Cell[] = [
    { b64: crop(scene(3, collar(0.9), BODY, { neckVariety: 0 }), ...NECKLINE, 460), label: 'collier à 0,9 : sous le menton (aucune correction)', w: 460, h: 360 },
    { b64: crop(scene(3, collar(0.0), BODY, { neckVariety: 0 }), ...NECKLINE, 460), label: 'collier demandé à 0,0 : ramené SOUS la mâchoire (attachment-jaw)', w: 460, h: 360 },
  ];
  board(cells, 2, '04-accessoire-machoire.png', 'Non-collision accessoire / mâchoire');
}
// 05 — générateur aléatoire : neckVariety 0 (avant) vs 1
{
  const cells: Cell[] = [];
  for (const seed of [3, 7, 11, 19, 23, 31]) {
    cells.push({ b64: crop(scene(seed, {}, BODY, { neckVariety: 0 }), 90, 300, 460, 340, 230), label: `graine ${seed} — neckVariety 0`, w: 230, h: 170 });
    cells.push({ b64: crop(scene(seed, {}, BODY), 90, 300, 460, 340, 230), label: `graine ${seed} — neckVariety 1`, w: 230, h: 170 });
  }
  board(cells, 4, '05-generateur-aleatoire.png', 'Générateur aléatoire : le visage ne bouge pas, le système de cou varie');
}
// 06 — têtes complètes (preuve que la tête entière reste cohérente)
{
  const cells = ['human-slender', 'human-athletic', 'human-elderly', 'stylized-bull'].map((id) => ({ b64: crop(scene(7, applyNeckPreset(id) as unknown as Json, BODY, { neckVariety: 0 }), 0, 0, W, H, 300), label: `tête complète — ${id}`, w: 300, h: 422 }));
  board(cells, 4, '06-tetes-completes.png', 'Têtes complètes avec cou, épaules et torse');
}
console.log('artefacts écrits dans', OUT);

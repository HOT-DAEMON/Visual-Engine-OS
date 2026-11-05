import { mkdirSync, writeFileSync } from 'node:fs';
import { compileScene, generateRandomFace } from '../src';
import { verifyPipeline } from '../src/verify';
import { rasterPng } from './lib/raster';

/**
 * Preuves visuelles du BRANCHEMENT au pipeline principal (`compileScene`) : figure complète (bassin + jambes), profil, éclairage par relief.
 * Tout est rendu par `compileScene` ; la vérification affichée est celle de `verifyPipeline` sur la MÊME scène.
 */
const OUT = 'artefacts/pipeline-wiring';
mkdirSync(OUT, { recursive: true });
const BG = '#2b3042';
const inner = (svg: string): string => svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'));
const txt = (x: number, y: number, s: string, size = 13, fill = '#e8ecf6', anchor = 'start'): string => `<text x="${x}" y="${y}" font-family="Inter, DejaVu Sans, sans-serif" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
const sheet = (name: string, w: number, h: number, body: string): void => {
  const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${BG}"/>${body}</svg>`;
  // Les images PNG intégrées (éclairage par relief) sont en base64 : « NaN » peut y apparaître par hasard ; on teste le SVG sans elles.
  if (/NaN|undefined|Infinity/.test(full.replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, ''))) throw new Error(`${name} : valeur non finie`);
  writeFileSync(`${OUT}/${name}.png`, rasterPng(full, { fonts: true, fitWidth: Math.min(2000, w) }));
};
const summary = (input: unknown): { text: string; ok: boolean } => {
  const r = verifyPipeline(input), by = (l: string) => r.checks.filter((k) => k.layer === l);
  return { text: ['geometry', 'anatomy', 'style'].map((l) => `${l} ${by(l).filter((k) => k.ok).length}/${by(l).length}`).join(' · '), ok: r.ok };
};
const headH = (seed: number): number => generateRandomFace(seed, { id: 'p', transform: { x: 0, y: 0, scale: 1 } }).height;

// ---- 01 : figures complètes (bassin + jambes) à côté du buste ------------------------------------------------------------------
{
  const CW = 330, CH = 880;
  const cases = [
    { seed: 11, label: 'adulte · sex +1 · musculature 0,6', body: { age: 28, sex: 1, muscularity: 0.6, adiposity: 0.25 } },
    { seed: 42, label: 'adulte · sex −0,8 · adiposité 0,45', body: { age: 34, sex: -0.8, muscularity: 0.25, adiposity: 0.45 } },
    { seed: 3, label: 'enfant 8 ans', body: { age: 8, sex: 0, muscularity: 0.1, adiposity: 0.2 } },
    { seed: 19, label: 'adulte · mince · très musclé', body: { age: 30, sex: 1, muscularity: 1, adiposity: 0.05 } },
  ];
  const parts = cases.map((c, i) => {
    const s = 92 / headH(c.seed);
    const f = generateRandomFace(c.seed, { id: `f${i}`, transform: { x: CW / 2, y: 70 + 46, scale: s } });
    // Identifiants uniques PAR CELLULE : les <defs> (clipPath, dégradés) sont globaux dans une planche assemblée ; deux cellules en `b0` se découperaient mutuellement.
    const input = { width: CW, height: CH - 70, background: null, objects: [...f.objects, { kind: 'body', id: `b${i}`, host: `f${i}`, body: c.body, legs: {} }] };
    const r = compileScene(input);
    if (!r.ok) throw new Error(r.issues.join('\n'));
    const v = summary(input);
    return `<g transform="translate(${i * CW} 0)"><svg x="0" y="0" width="${CW}" height="${CH - 70}" viewBox="0 0 ${CW} ${CH - 70}">${inner(r.svg)}</svg>${txt(CW / 2, CH - 46, c.label, 13, '#e8ecf6', 'middle')}${txt(CW / 2, CH - 26, `verifyPipeline : ${v.text}${v.ok ? '  ✔' : '  ✘'}`, 11, v.ok ? '#9fe3b0' : '#ff9a9a', 'middle')}</g>`;
  });
  sheet('01-figure-complete-bassin-jambes', CW * cases.length, CH, txt(12, 24, 'Figure complète par compileScene : tête + tronc + bras + bassin + jambes (kind body, legs: {})', 15, '#ffffff') + `<g transform="translate(0 0)">${parts.join('')}</g>`);
}

// ---- 02 : le même visage de face, de profil (crâne dérivé), et éclairé par relief ---------------------------------------------
{
  const CW = 760, CH = 560;
  const seeds = [11, 42, 7];
  const rows = seeds.map((seed, i) => {
    const s = 330 / headH(seed);
    const f = generateRandomFace(seed, { id: `f${i}`, transform: { x: 180, y: 290, scale: s } });
    const base = [...f.objects, { kind: 'head_profile', id: `p${i}`, host: `f${i}`, transform: { x: 500, y: 60, scale: 0.8 } }];
    const plain = compileScene({ width: CW, height: CH, background: '#ece6dc', objects: base });
    const lit = compileScene({ width: CW, height: CH, background: '#ece6dc', light: { azimuthDeg: 320, elevationDeg: 50 }, objects: [...base, { kind: 'head_lit', id: `l${i}`, host: `f${i}` }] });
    const litCel = compileScene({ width: CW, height: CH, background: '#ece6dc', light: { azimuthDeg: 320, elevationDeg: 50 }, objects: [...base, { kind: 'head_lit', id: `m${i}`, host: `f${i}`, style: 'cel2' }] });
    if (!plain.ok || !lit.ok || !litCel.ok) throw new Error('compile');
    const v = summary({ width: CW, height: CH, objects: base });
    const cell = (svg: string, x: number) => `<g transform="translate(${x} ${i * (CH + 30)})"><svg width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}">${inner(svg)}</svg></g>`;
    return cell(plain.svg, 0) + cell(lit.svg, CW) + cell(litCel.svg, 2 * CW) + txt(8, i * (CH + 30) + CH + 20, `graine ${seed} — verifyPipeline (face + profil) : ${v.text}${v.ok ? '  ✔' : '  ✘'}`, 12, v.ok ? '#9fe3b0' : '#ff9a9a');
  });
  const w = 3 * CW, h = 50 + seeds.length * (CH + 30);
  sheet('02-face-profil-relief', w, h, txt(12, 22, 'Visage de face + tête de profil dérivée (head_profile)  |  + éclairage par relief doux (head_lit)  |  + relief cel 2 tons', 15, '#ffffff') + `<g transform="translate(0 40)">${rows.join('')}</g>`);
}
console.log('planches écrites dans', OUT);

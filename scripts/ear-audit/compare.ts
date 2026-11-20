import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { rasterPng } from '../lib/raster';

/**
 * Fusionne les parties de l'audit courant, les compare à l'audit de départ (même méthode, même bibliothèque, code d'origine) et produit
 * `comparaison.md` + `audit-avant-apres.png`. Verdicts : ≥ 150 px visible · 50–149 FAIBLE · < 50 INVISIBLE (pixels moyens sur 3 graines, tête entière).
 *   npx tsx scripts/ear-audit/compare.ts
 */
const DIR = 'artefacts/oreille-audit-visibilite';
interface Row { param: string; px: number; strong: number; perSeed: number[] }
const load = (f: string): Row[] => (JSON.parse(readFileSync(f, 'utf8')) as { rows: Row[] }).rows;
const now = readdirSync(DIR).filter((f) => /^part-\d+-\d+\.json$/.test(f)).flatMap((f) => load(`${DIR}/${f}`));
const before = load(`${DIR}/avant/audit-avant-0-48.json`);
writeFileSync(`${DIR}/audit.json`, JSON.stringify({ rows: now }, null, 1));
const verdict = (px: number): string => (px >= 150 ? 'visible' : px >= 50 ? 'FAIBLE' : 'INVISIBLE');
const bMap = new Map(before.map((r) => [r.param, r]));
now.sort((a, b) => a.px - b.px);
const lines = ['| paramètre | avant (px) | après (px) | francs après | verdict avant → après |', '|---|---:|---:|---:|---|'];
for (const r of now) { const b = bMap.get(r.param); lines.push(`| ${r.param} | ${b ? b.px : '— (nouvel axe)'} | ${r.px} | ${r.strong} | ${b ? `${verdict(b.px)} → ` : ''}${verdict(r.px)} |`); }
const cnt = (rows: Row[], v: string): number => rows.filter((r) => verdict(r.px) === v).length;
const sum = `Avant : ${before.length} paramètres — ${cnt(before, 'visible')} visibles, ${cnt(before, 'FAIBLE')} faibles, ${cnt(before, 'INVISIBLE')} invisibles. Après : ${now.length} paramètres — ${cnt(now, 'visible')} visibles, ${cnt(now, 'FAIBLE')} faibles, ${cnt(now, 'INVISIBLE')} invisibles.`;
writeFileSync(`${DIR}/comparaison.md`, `${sum}\n\n${lines.join('\n')}\n`);
console.log(sum);
// Graphique : barres horizontales (échelle racine), avant en gris, après en couleur de verdict.
const rows = [...now].sort((a, b) => a.px - b.px);
const bw = 560, rh = 17, top = 40, left = 250, W = left + bw + 80, H = top + rows.length * rh + 24;
const max = Math.max(...rows.map((r) => r.px), ...before.map((r) => r.px));
const sc = (v: number): number => (Math.sqrt(v) / Math.sqrt(max)) * bw;
const col = (v: number): string => (v >= 150 ? '#4cc38a' : v >= 50 ? '#f2b84b' : '#e5534b');
let g = '';
rows.forEach((r, i) => { const y = top + i * rh; const b = bMap.get(r.param); g += `<text x="${left - 8}" y="${y + 12}" text-anchor="end" font-size="11" fill="#d7dcec">${r.param}</text>`; if (b) g += `<rect x="${left}" y="${y + 1}" width="${sc(b.px).toFixed(1)}" height="6" fill="#7d849c"/>`; g += `<rect x="${left}" y="${y + (b ? 8 : 4)}" width="${Math.max(1, sc(r.px)).toFixed(1)}" height="${b ? 6 : 9}" fill="${col(r.px)}"/><text x="${left + Math.max(sc(r.px), b ? sc(b.px) : 0) + 6}" y="${y + 12}" font-size="10" fill="#aab1c9">${b ? b.px + ' → ' : ''}${r.px}</text>`; });
const ref = (v: number): string => `<line x1="${left + sc(v)}" x2="${left + sc(v)}" y1="${top - 6}" y2="${H - 22}" stroke="#555d78" stroke-dasharray="3 3"/><text x="${left + sc(v)}" y="${top - 10}" text-anchor="middle" font-size="10" fill="#8890aa">${v}</text>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#1b1f2e"/><text x="12" y="22" font-size="15" font-weight="bold" fill="#fff">Visibilité des paramètres de l’oreille sur une tête entière — avant (gris) / après (couleur), pixels changés, échelle en racine</text>${ref(50)}${ref(150)}${g}</svg>`;
writeFileSync(`${DIR}/audit-avant-apres.png`, rasterPng(svg, { fonts: true }));

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

/** Fusionne les parties de l'audit (part-a-b.json) en audit.json et imprime le tableau Markdown trié par visibilité. Verdicts : ≥ 150 px visible · 50–149 FAIBLE · < 50 INVISIBLE. */
const DIR = process.argv[2] ?? 'artefacts/oreille-audit-visibilite';
const parts = readdirSync(DIR).filter((f) => /^part-\d+-\d+\.json$/.test(f));
const rows = parts.flatMap((f) => (JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')) as { rows: { param: string; px: number; strong: number; share: number; perSeed: number[] }[] }).rows);
const verdict = (px: number): string => (px >= 150 ? 'visible' : px >= 50 ? 'FAIBLE' : 'INVISIBLE');
rows.sort((a, b) => a.px - b.px);
if (parts.length) writeFileSync(`${DIR}/audit.json`, JSON.stringify({ rows }, null, 1));
console.log('| paramètre | px (moy. 3 graines) | px francs | par graine | verdict |\n|---|---:|---:|---|---|');
for (const r of rows) console.log(`| ${r.param} | ${r.px} | ${r.strong} | ${r.perSeed.join(' / ')} | ${verdict(r.px)} |`);

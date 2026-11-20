import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

/** Fusionne `views-a-b.json` en `views.json` et écrit `vues.md` : pixels changés par vue (cadre 300 × 420), verdict par la MEILLEURE vue (≥ 0,3 % du cadre = 378 px). */
const DIR = 'artefacts/oreille-audit-visibilite';
interface R { param: string; face: number; 'three-quarter': number; profile: number; 'close-up': number }
const rows = readdirSync(DIR).filter((f) => /^views-\d+-\d+\.json$/.test(f)).flatMap((f) => (JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')) as { rows: R[] }).rows);
writeFileSync(`${DIR}/views.json`, JSON.stringify({ rows }, null, 1));
const best = (r: R): number => Math.max(r.face, r['three-quarter'], r.profile, r['close-up']);
rows.sort((a, b) => best(a) - best(b));
const out = ['| paramètre | face | trois-quarts | profil | gros plan | meilleure vue |', '|---|---:|---:|---:|---:|---|'];
for (const r of rows) out.push(`| ${r.param} | ${r.face} | ${r['three-quarter']} | ${r.profile} | ${r['close-up']} | ${best(r) >= 378 ? 'lisible' : 'FAIBLE'} |`);
writeFileSync(`${DIR}/vues.md`, out.join('\n') + '\n');
console.log(out.slice(0, 22).join('\n'));
console.log(rows.length, 'paramètres ;', rows.filter((r) => best(r) < 378).length, 'faibles dans toutes les vues');

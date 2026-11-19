import { readFileSync, writeFileSync } from 'node:fs';

/** Fusionne audit-structured.json (face, px sur une tête de 600 px) et audit-3d.jsonl (45°/90°, cadre 420 px) en tableau Markdown classé. */
const dir = 'artefacts/nez-audit-visibilite';
const face = JSON.parse(readFileSync(`${dir}/audit-structured.json`, 'utf8')).rows as { param: string; zonePixels: number }[];
const d3 = new Map(readFileSync(`${dir}/audit-3d.jsonl`, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as { param: string; px45: number; px90: number }).map((r) => [r.param, r]));
const cls = (f: number, a: number, b: number): string => (f >= 150 ? 'visible de face' : Math.max(a, b) >= 100 ? 'visible en 3D seulement' : f >= 50 || Math.max(a, b) >= 30 ? 'FAIBLE' : 'INVISIBLE');
const rows = face.map((r) => { const t = d3.get(r.param) ?? { px45: 0, px90: 0 }; return { ...r, ...t, c: cls(r.zonePixels, t.px45, t.px90) }; });
const order = ['INVISIBLE', 'FAIBLE', 'visible en 3D seulement', 'visible de face'];
rows.sort((a, b) => order.indexOf(a.c) - order.indexOf(b.c) || a.zonePixels - b.zonePixels);
const md = ['| paramètre | face (px) | 3D 45° (px) | 3D 90° (px) | verdict |', '|---|---:|---:|---:|---|', ...rows.map((r) => `| ${r.param} | ${r.zonePixels} | ${r.px45} | ${r.px90} | ${r.c} |`)].join('\n');
writeFileSync(`${dir}/tableau.md`, md + '\n');
console.log(md);

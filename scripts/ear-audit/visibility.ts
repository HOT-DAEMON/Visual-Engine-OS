import { mkdirSync, writeFileSync } from 'node:fs';
import { diffShots, headShot } from './lib';
import { PARAMS } from './params';

/**
 * Audit de visibilité des paramètres de l'oreille : un paramètre à la fois, bas → haut, 3 graines, tête complète (peau seule, crâne chauve).
 *   npx tsx scripts/ear-audit/visibility.ts [label,label…]    → artefacts/oreille-audit-visibilite/audit.json (+ tableau console) ; `all a-b` : tranche de PARAMS (parties part-a-b.json, fusionnées par table.ts)
 */
const SEEDS = [11, 77, 1203];
const only = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : undefined;
const range = process.argv[3]?.split('-').map(Number) as [number, number] | undefined; // tranche [a, b[ de PARAMS (exécution en parallèle)
const rows: Record<string, unknown>[] = [];
for (const [path, lo, hi, extra] of PARAMS.filter((q, i) => (!only || only.includes(q[0])) && (!range || (i >= range[0] && i < range[1])))) {
  const fixed = Object.fromEntries(Object.entries(extra ?? {}));
  const per = SEEDS.map((sd) => diffShots(headShot(sd, { ...fixed, [path]: lo }), headShot(sd, { ...fixed, [path]: hi })));
  const avg = (k: 'px' | 'strong' | 'share' | 'meanDelta' | 'outside') => per.reduce((t, d) => t + d[k], 0) / per.length;
  const label = ['family', 'material.kind', 'style.look'].includes(path) ? `${path}(${String(lo)}→${String(hi)})` : path;
  rows.push({ param: label, px: Math.round(avg('px')), strong: Math.round(avg('strong')), share: +avg('share').toFixed(4), meanDelta: +avg('meanDelta').toFixed(2), outside: +avg('outside').toFixed(3), perSeed: per.map((d) => d.px) });
  console.log(label.padEnd(40), String(Math.round(avg('px'))).padStart(6), 'px  franc', String(Math.round(avg('strong'))).padStart(5), ' hors-boîte', avg('outside').toFixed(2), ' par graine', per.map((d) => d.px).join('/'));
}
if (!only) { mkdirSync('artefacts/oreille-audit-visibilite', { recursive: true }); writeFileSync(`artefacts/oreille-audit-visibilite/${range ? `part-${range[0]}-${range[1]}` : 'audit'}.json`, JSON.stringify({ seeds: SEEDS, rows }, null, 1)); }

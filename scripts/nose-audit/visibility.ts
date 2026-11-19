import { writeFileSync } from 'node:fs';
import { diffShots, headShot, type Engine } from './visibility-lib';

/**
 * Audit de visibilité : un paramètre à la fois, bas → haut de sa plage, 3 graines, sur tête complète (peau seule).
 *   npx tsx scripts/nose-audit/visibility.ts [engine]   (engine = structured par défaut ; classic pour comparer)
 * Sortie : artefacts/nez-audit-visibilite/audit-<engine>.json + tableau console.
 */
import { PARAMS } from './params';
const engine = (process.argv[2] ?? 'structured') as Engine;
const SEEDS = [11, 77, 1203];
const base = new Map(SEEDS.map((sd) => [sd, headShot(sd, engine)]));
const rows: Record<string, unknown>[] = [];
const only = process.argv[3]?.split(',');
for (const [path, lo, hi, extra] of PARAMS.filter((q) => !only || only.includes(q[0]))) {
  const per = SEEDS.map((sd) => {
    const fixed = Object.fromEntries(Object.entries(extra ?? {}));
    const a = headShot(sd, engine, { ...fixed, [path]: lo }), b = headShot(sd, engine, { ...fixed, [path]: hi });
    return diffShots(a, b);
  });
  const avg = (k: 'share' | 'strong' | 'meanDelta' | 'maxDelta' | 'outside' | 'zoneShare' | 'zonePixels') => per.reduce((t, d) => t + d[k], 0) / per.length;
  const label = path === 'dorsum.shape' ? `dorsum.shape(${String(lo)}→${String(hi)})` : path;
  rows.push({ param: label, share: +avg('share').toFixed(4), strong: +avg('strong').toFixed(4), meanDelta: +avg('meanDelta').toFixed(2), maxDelta: +avg('maxDelta').toFixed(0), outside: +avg('outside').toFixed(3), zoneShare: +avg('zoneShare').toFixed(4), zonePixels: +avg('zonePixels').toFixed(0), perSeed: per.map((d) => +d.share.toFixed(4)) });
  console.log(label.padEnd(30), (avg('share') * 100).toFixed(2).padStart(7), '%  strong', (avg('strong') * 100).toFixed(2).padStart(6), '%  Δmoy', avg('meanDelta').toFixed(2), ' zone', (avg('zoneShare') * 100).toFixed(2), '%', avg('zonePixels').toFixed(0), 'px');
}
void base;
if (!only) writeFileSync(`artefacts/nez-audit-visibilite/audit-${engine}.json`, JSON.stringify({ engine, seeds: SEEDS, rows }, null, 1));

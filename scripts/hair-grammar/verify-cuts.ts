import { generate, type HairProfile } from '../../src/hair-grammar/grammar';
import { DOUBLE_BUNS, TOP_BUN } from '../../src/hair-grammar/profiles/buns';
import { PONYTAIL } from '../../src/hair-grammar/profiles/ponytail';
import { TWIN_BRAIDS } from '../../src/hair-grammar/profiles/braids';
import { BOB } from '../../src/hair-grammar/profiles/bob';
import { HIME } from '../../src/hair-grammar/profiles/hime';
import { PIXIE } from '../../src/hair-grammar/profiles/pixie';
import { SHAG } from '../../src/hair-grammar/profiles/shag';
import { repaired } from './lib-cuts';
import { viewAt } from './engine-kit';

/** Verdict G/A/S rapide : `npx tsx scripts/hair-grammar/verify-cuts.ts [lacets, ex. 0,30,-30] [nb graines] [coupes, ex. top_bun,ponytail]` — liste, par coupe, les contrôles qui échouent après réparation. */
const ALL: Record<string, HairProfile> = { double_buns: DOUBLE_BUNS, top_bun: TOP_BUN, ponytail: PONYTAIL, twin_braids: TWIN_BRAIDS, hime: HIME, pixie: PIXIE, bob: BOB, shag: SHAG };
const yaws = (process.argv[2] ?? '0').split(',').map(Number); const nSeeds = Number(process.argv[3] ?? 8); const only = process.argv[4]?.split(',') ?? ['double_buns', 'top_bun', 'ponytail', 'twin_braids'];
for (const [n, P] of Object.entries(ALL)) {
  if (!only.includes(n)) continue;
  const fail = new Map<string, number>(); let ok = 0; let tot = 0;
  for (const yaw of yaws) for (let seed = 1; seed <= nSeeds; seed++) { const r = repaired(P, seed, viewAt(yaw)); tot++; if (r.verdict.ok) ok++; for (const q of r.verdict.reports) for (const c of q.checks) if (!c.ok) fail.set(`${q.layer}:${c.name} (${c.value.toFixed(2)})`, (fail.get(`${q.layer}:${c.name} (${c.value.toFixed(2)})`) ?? 0) + 1); }
  console.log(`${n}: ${ok}/${tot} valides · ${generate(P, 1).length} mèches`); for (const [k, v] of [...fail].sort((a, b) => b[1] - a[1]).slice(0, 6)) console.log(`   ${v}× ${k}`);
}

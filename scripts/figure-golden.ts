/** `npx tsx scripts/figure-golden.ts` — (ré)écrit tests/fixtures/figure-golden.json. À lancer SEULEMENT sur un code dont le rendu est la référence voulue (docs/PERF-4.md). */
import { writeFileSync } from 'node:fs';
import { FIGURE_CASES, digestOf } from '../tests/helpers/figure-cases';

const out: Record<string, unknown> = {};
for (const c of FIGURE_CASES) { const t0 = performance.now(); out[c.id] = digestOf(c); console.log(c.id.padEnd(34), `${(performance.now() - t0).toFixed(0)} ms`); }
writeFileSync('tests/fixtures/figure-golden.json', `${JSON.stringify(out, null, 2)}\n`);
console.log('écrit : tests/fixtures/figure-golden.json');

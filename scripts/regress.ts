/** `npx tsx scripts/regress.ts check|update` — voir docs/REGRESSION.md. */
import { ALL_CASES } from '../src/regression/cases';
import { checkCase, updateRefs } from './lib/regress';

const mode = process.argv[2] ?? 'check';
if (mode === 'update') { updateRefs(); console.log(`${ALL_CASES.length} références écrites dans references/visual/`); }
else {
  const res = ALL_CASES.map(checkCase);
  for (const r of res) console.log(r.verdict.padEnd(8), r.id, r.stats ? `rms=${r.stats.rms.toFixed(2)} >8:${(r.stats.fracOver8 * 100).toFixed(2)}%` : '');
  if (res.some((r) => r.verdict === 'changed' || r.verdict === 'missing')) process.exit(1);
}

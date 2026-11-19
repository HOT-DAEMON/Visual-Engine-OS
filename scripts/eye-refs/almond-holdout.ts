/**
 * Validation HORS ÉCHANTILLON de l'enveloppe almond (passe 9) : `npx tsx scripts/eye-refs/almond-holdout.ts`.
 * `fit-almond.ts` ajuste ALMOND_REF sur 3 yeux de face (04, 07, 11). Les réfs 03 et 05 (tracées en passe 9, `extract.py`) ne servent PAS à l'ajustement :
 * elles mesurent si l'almond généralise. Même évaluation que `fit-almond.ts` (l'œil est évalué avec SES aspect / fraction haute / inclinaison, erreurs en unités de largeur).
 */
import { readFileSync } from 'node:fs';
import { ALMOND_REF, canthusChordAngles } from '../../src/geometry/eye';
import { evalEye } from './fit-almond';

type Ref = { aspect: number; upperFraction: number; tiltDeg: number; upperPeakAt: number; lowerPeakAt: number; upperProfile: number[]; lowerProfile: number[] };
const M = JSON.parse(readFileSync('references/eyes/measures.json', 'utf8')).eyes as Record<string, Ref>;
const rms = (a: readonly number[], b: readonly number[]): number => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]!) ** 2, 0) / a.length);
const argmax = (v: readonly number[]): number => v.indexOf(Math.max(...v)) / (v.length - 1);
export function holdout(ids: readonly string[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const k of ids) {
    const r = M[k]!; const p = evalEye(r, ALMOND_REF); const ch = canthusChordAngles(p.upper, p.lower); const rc = canthusChordAngles(r.upperProfile, r.lowerProfile);
    out[k] = { rmsUp: +rms(p.upper, r.upperProfile).toFixed(4), rmsLo: +rms(p.lower, r.lowerProfile).toFixed(4), dAspect: +(p.aspect - r.aspect).toFixed(4), dUpperFraction: +(p.upperFraction - r.upperFraction).toFixed(4),
      upperPeakEngine: +argmax(p.upper).toFixed(2), upperPeakRef: +argmax(r.upperProfile).toFixed(2), lowerPeakEngine: +argmax(p.lower).toFixed(2), lowerPeakRef: +argmax(r.lowerProfile).toFixed(2),
      chordInnerEngine: +ch.inner.toFixed(1), chordInnerRef: +rc.inner.toFixed(1), chordOuterEngine: +ch.outer.toFixed(1), chordOuterRef: +rc.outer.toFixed(1) };
  }
  return out;
}
if (process.argv[1]?.endsWith('almond-holdout.ts')) console.log(JSON.stringify(holdout(['04', '07', '11', '03', '05']), null, 1));

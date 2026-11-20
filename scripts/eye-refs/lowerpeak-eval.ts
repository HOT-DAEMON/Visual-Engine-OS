/**
 * Effet de `shape.lowerPeak` sur les références (passe 10) : `npx tsx scripts/eye-refs/lowerpeak-eval.ts`.
 * Pour chaque œil tracé (04, 07, 11 de face = échantillon d'ajustement d'ALMOND_REF ; 03, 05 = hors échantillon), l'almond est évalué avec SES aspect / fraction haute / inclinaison,
 * sans puis avec `lowerPeak` = position du creux MESURÉE (argmax du profil bas de measures.json). Rien n'est ajusté : la valeur est lue, pas optimisée.
 */
import { readFileSync } from 'node:fs';
import { openingGeometry, openingProfile } from '../../src/geometry/eye';
import { Shape } from '../../src/schema/eye-shape';
import { Canthi } from '../../src/schema/eye-canthi-fold';

type Ref = { aspect: number; upperFraction: number; tiltDeg: number; upperProfile: number[]; lowerProfile: number[] };
const M = JSON.parse(readFileSync('references/eyes/measures.json', 'utf8')).eyes as Record<string, Ref>;
const rms = (a: readonly number[], b: readonly number[]): number => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]!) ** 2, 0) / a.length);
const argmax = (v: readonly number[]): number => v.indexOf(Math.max(...v)) / (v.length - 1);
export function evalLowerPeak(ids: readonly string[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const k of ids) {
    const r = M[k]!; const peak = argmax(r.lowerProfile);
    const mk = (lowerPeak?: number) => openingProfile(openingGeometry(Shape.parse({ style: 'almond', width: 1000, height: r.aspect * 1000, upperFraction: r.upperFraction, tiltDeg: r.tiltDeg, ...(lowerPeak === undefined ? {} : { lowerPeak }) }), Canthi.parse({})));
    const a = mk(); const b = mk(peak);
    out[k] = { peakRef: +peak.toFixed(2), peakSans: +argmax(a.lower).toFixed(2), peakAvec: +argmax(b.lower).toFixed(2), rmsLoSans: +rms(a.lower, r.lowerProfile).toFixed(4), rmsLoAvec: +rms(b.lower, r.lowerProfile).toFixed(4),
      rmsUpSans: +rms(a.upper, r.upperProfile).toFixed(4), rmsUpAvec: +rms(b.upper, r.upperProfile).toFixed(4), dAspectSans: +(a.aspect - r.aspect).toFixed(4), dAspectAvec: +(b.aspect - r.aspect).toFixed(4), dUpFAvec: +(b.upperFraction - r.upperFraction).toFixed(4) };
  }
  return out;
}
if (process.argv[1]?.endsWith('lowerpeak-eval.ts')) console.log(JSON.stringify(evalLowerPeak(['04', '07', '11', '03', '05']), null, 1));

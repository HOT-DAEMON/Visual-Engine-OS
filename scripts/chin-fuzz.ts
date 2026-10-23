import { generateRandomFace } from '../src/generation/random-face';
import { faceLandmarks } from '../src/face';
import { jawSilhouetteMetrics, JAW_LIMITS } from '../src/verify/jaw-continuity';
const N = Number(process.argv[2] ?? 500);
const bad: string[] = [];
for (let s = 1; s <= N; s++) { const f = generateRandomFace(s, { structure: true }); const lm = faceLandmarks(f.params, f.width, f.height); const m = jawSilhouetteMetrics(lm);
  if (m.concavityDeg > JAW_LIMITS.concavityDeg || m.teardrop < JAW_LIMITS.teardropMin || m.tipRadius < JAW_LIMITS.tipRadiusMin) bad.push(`#${s} c=${m.concavityDeg.toFixed(1)} t=${m.teardrop.toFixed(2)} r=${m.tipRadius.toFixed(3)} chord=${m.chordDeg.toFixed(0)} sym=${f.params.chin.symphysis} half=${lm.outline.chinHalf.toFixed(0)}/${lm.outline.chinHalfRequested.toFixed(0)}`); }
console.log(N, 'violations', bad.length); bad.slice(0, 15).forEach((b) => console.log(b));

import { defaultFrame, REF_SPEC, refView, renderHead } from '../../src/head-turntable';
import { jawContourStats } from '../../src/head-turntable/verify-contour';

/** Audit pixel du contour mâchoire/menton/joues sur les 9 lacets de la planche. Usage : tsx audit-contour.ts [hauteurPx]. */
const H = Number(process.argv[2] ?? 700);
const YAWS = [0, 20, 45, 70, 90, 110, 135, 160, 180];
console.log('yaw | longU rMin infl concav lowY  lowX | ink gap');
for (const yaw of YAWS) {
  const r = renderHead(refView(yaw), REF_SPEC, { frame: defaultFrame(H), ss: 2 });
  const s = jawContourStats(r, { yMinU: 0.80, yMaxU: 1.25 });
  console.log(`${String(yaw).padStart(3)} | ${s.lengthU.toFixed(2)} ${s.minRadiusU.toFixed(3)} ${String(s.inflections).padStart(3)} ${s.concavityU.toFixed(3)} ${s.lowest.y.toFixed(3)} ${s.lowest.x.toFixed(3)} | ${s.inkFrac.toFixed(2)} ${s.inkGapPx}`);
}

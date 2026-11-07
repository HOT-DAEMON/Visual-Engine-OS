import { defaultFrame, refView, renderHead } from '../../src/head-turntable';
import { variedHead } from '../../src/head-turntable/engines/from-face';
import { jawContourStats } from '../../src/head-turntable/verify-contour';

/** Audit pixel de la mâchoire sur une galerie de graines. Usage : tsx audit-gallery.ts [graines séparées par des virgules] [hauteurPx]. */
const seeds = (process.argv[2] ?? '1,2,3,4,5,6,7,8,9,10,11,12').split(',').map(Number), H = Number(process.argv[3] ?? 420);
console.log('seed | yaw: rMin/infl/concav (jaw band)');
for (const s of seeds) {
  const v = variedHead(s), cells: string[] = [];
  for (const yaw of [0, 45, 90, 135, 180]) {
    const r = renderHead(refView(yaw), v.spec, { frame: defaultFrame(H), ss: 2 });
    const st = jawContourStats(r, { yMinU: 0.8, yMaxU: 1.25 });
    cells.push(`${yaw}:${st.minRadiusU.toFixed(3)}/${st.inflections}/${st.concavityU.toFixed(3)}`);
  }
  console.log(String(s).padStart(4), '|', cells.join('  '));
}

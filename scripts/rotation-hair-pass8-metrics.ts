import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { faceLandmarks } from '../src/face';
import { hairGeometry } from '../src/face/hair';
import { posedFace, poseHair } from '../src/face/pose';
import { WIDTH_SLACK, widthBounds } from '../src/verify/hair-pose';
import { faceCoverage, stackDepth } from '../src/verify/hair-pose-overlap';
import { FaceParams } from '../src/schema';
import { hairFace, type CleanStyle } from './lib/hair-faces';

/**
 * Métriques des mèches sous pose (passe 8), SANS dépendre des règles ajoutées : le même script tourne sur l'ancien commit (worktree) et sur le code corrigé, ce qui donne un avant/après honnête.
 * `npx tsx scripts/rotation-hair-pass8-metrics.ts <sortie.json>`. Corpus : 7 coiffures × 3 graines × lacets ±30 / ±45°.
 *  - écart max (px) entre la ligne médiane posée de chaque mèche et la projection exacte de sa ligne médiane de face (0 = la mèche épouse le crâne) ;
 *  - couverture du visage par des mèches, posée − de face (points de pourcentage) ;
 *  - empilement : p95 du nombre de mèches par cellule, posé / de face ;
 *  - facteur de largeur par rangée (min / max sur les mèches).
 */
const OUT = process.argv[2] ?? 'metrics.json';
const styles: CleanStyle[] = ['short', 'spiky', 'curly', 'afro', 'bob', 'long', 'braids'];
const cases: Record<string, unknown>[] = [];
for (const style of styles) for (const seed of [9001, 9002, 9004]) {
  const f = hairFace(style, 1, { seed }), host = f.objects[0] as unknown as { face: Record<string, unknown>; width: number; height: number };
  const params = FaceParams.parse(host.face), lm = faceLandmarks(params, host.width, host.height), g0 = hairGeometry(params, lm)!;
  const vis = (g: typeof g0) => g.locks.filter((l) => l.layer !== 'back').map((l) => l.poly);
  const yBot = lm.chinY - 0.02 * lm.H;
  const cover = (g: typeof g0, yaw: number, halfAt: (y: number, yaw: number) => number) => faceCoverage(vis(g), lm.W, lm.browLimitY, yBot, (y) => halfAt(Math.min(lm.chinY - 1, Math.max(-lm.H / 2, y)), yaw), 0.8);
  const P0 = posedFace(lm, 0), c0 = cover(g0, 0, (y, yw) => P0.skull.halfAt(y, yw)), d0 = stackDepth(vis(g0), lm.W, lm.H);
  for (const yaw of [-45, -30, 30, 45]) {
    const P = posedFace(lm, yaw), g = poseHair(g0, P.skull, yaw, lm.W);
    let gap = 0, hi = 0, lo = Infinity;
    g0.locks.forEach((l, i) => {
      if (l.part === 'tail' || l.part === 'bun') return;
      const q = g.locks[i]!;
      l.spine?.forEach((s, k) => { gap = Math.max(gap, Math.abs((q.spine as { x: number }[])[k]!.x - P.skull.projectX(s.x, s.y, yaw))); });
      const wb = widthBounds(l.poly, q.poly, 0.006 * lm.W, WIDTH_SLACK * lm.W);
      if (wb.n) { hi = Math.max(hi, wb.hi); lo = Math.min(lo, wb.lo); }
    });
    cases.push({ style, seed, yaw, W: +lm.W.toFixed(1), gapPx: +gap.toFixed(2), gapW: +(gap / lm.W).toFixed(4), faceCoverDelta: +(cover(g, yaw, (y, yw) => P.skull.halfAt(y, yw)) - c0).toFixed(4), stackRatio: +(stackDepth(vis(g), lm.W, lm.H) / Math.max(1, d0)).toFixed(3), widthMax: +hi.toFixed(2), widthMin: +lo.toFixed(2) });
  }
}
const stat = (k: string) => { const v = cases.map((c) => c[k] as number).sort((a, b) => a - b); const at = (p: number) => v[Math.min(v.length - 1, Math.floor(p * v.length))] as number; return { p50: at(0.5), p90: at(0.9), p99: at(0.99), max: v[v.length - 1] }; };
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ corpus: '7 coiffures x 3 graines (9001, 9002, 9004) x lacets -45/-30/30/45', n: cases.length, summary: { gapPx: stat('gapPx'), gapW: stat('gapW'), faceCoverDelta: stat('faceCoverDelta'), stackRatio: stat('stackRatio'), widthMax: stat('widthMax'), widthMin: stat('widthMin') }, cases }, null, 1));
console.log(`écrit ${OUT} : ${cases.length} cas`);

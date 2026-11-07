import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Audit de la planche (9 lacets) : courbure du contour de la mâchoire (verify-contour) ET écart SIGNÉ à la silhouette mesurée de la planche en bande mâchoire (t = 0,80 → 1,00).
 * Exécutable dans n'importe quel arbre du dépôt (le sien = process.cwd()) : sert à comparer l'état d'origine et l'état corrigé avec les MÊMES outils.
 * Usage : tsx audit-planche.ts <dossier de sortie> [hauteurPx des images, défaut 1000]
 */
const out = process.argv[2] ?? '/tmp/audit', H = Number(process.argv[3] ?? 1000), root = process.cwd();
const load = async (p: string): Promise<any> => import(join(root, p));
const { encodePngRgba } = await load('src/core/png'), T = await load('src/head-turntable'), S = await load('src/head-turntable/silhouette'), C = await load('src/head-turntable/verify-contour');
const m = JSON.parse(readFileSync(join(root, 'references/face/rotation_head.measures.json'), 'utf8')), ts = Array.from({ length: 9 }, (_, i) => 0.8 + i * 0.025);
mkdirSync(out, { recursive: true });
const rows: Record<string, number>[] = [];
for (const yaw of [0, 20, 45, 70, 90, 110, 135, 160, 180]) {
  const big = T.renderHead(T.refView(yaw), T.REF_SPEC, { frame: T.defaultFrame(H), ss: 2 });
  writeFileSync(join(out, `yaw_${yaw}.png`), encodePngRgba(big.w, big.h, big.rgba));
  const st = C.jawContourStats(T.renderHead(T.refView(yaw), T.REF_SPEC, { frame: T.defaultFrame(600), ss: 2 }), { yMinU: 0.8, yMaxU: 1.25 });
  const pr = S.silhouetteProfile(T.renderHead(T.refView(yaw), T.REF_SPEC, { frame: T.defaultFrame(500), ss: 1 }), ts), ms = m.views[String(yaw)].silhouette;
  let e = 0, c = 0, sl = 0, sr = 0, mx = 0;
  for (const p of pr) { const q = ms.find((x: any) => Math.abs(x.t - p.t) < 1e-6); if (!q || q.left === null) continue; e += Math.abs(p.left - q.left) + Math.abs(p.right - q.right); c += 2; sl += p.left - q.left; sr += p.right - q.right; mx = Math.max(mx, Math.abs(p.left - q.left), Math.abs(p.right - q.right)); }
  rows.push({ yaw, minRadiusU: +st.minRadiusU.toFixed(4), inflections: st.inflections, concavityU: +st.concavityU.toFixed(4), jawBandErrU: +(e / c).toFixed(4), jawBandMaxU: +mx.toFixed(4), signedLeftU: +(sl / pr.length).toFixed(4), signedRightU: +(sr / pr.length).toFixed(4) });
}
writeFileSync(join(out, 'metrics.json'), JSON.stringify(rows, null, 1));
console.log(rows.map((r) => `${r.yaw}: rMin ${r.minRadiusU} infl ${r.inflections} concav ${r.concavityU} err ${r.jawBandErrU} max ${r.jawBandMaxU} sgnL ${r.signedLeftU}`).join('\n'));

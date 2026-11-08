import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultFrame, REF_SPEC, refView, renderHead } from '../../src/head-turntable';
import { silhouetteProfile } from '../../src/head-turntable/silhouette';

/**
 * Menton et mâchoire : RECALAGE VERTICAL par vue. Le « pic de 0,2 U au menton à 70° » de `HEAD-TURNTABLE-REMAINING.md` est le maximum, sur la bande mâchoire (t = 0,80 → 1,00), de l'écart
 * entre la silhouette rendue et la silhouette MESURÉE. Hypothèse testée ici : ce pic est un décalage VERTICAL entre le dessin (la planche est faite à la main : sa hauteur de menton varie
 * d'une vue à l'autre) et le rendu rigide, pas un défaut de forme. Méthode : pour chaque lacet, on cherche le décalage dt (U, ± 0,06) du profil rendu qui minimise l'écart moyen,
 * puis on rapporte l'écart et le maximum AVANT et APRÈS recalage. Un maximum qui ne tombe pas avec le recalage resterait un défaut de forme.
 * Usage : tsx audit-chin-registration.ts <dossier de sortie> — écrit chin-registration.json.
 */
const out = process.argv[2] ?? '/tmp/chin-reg';
const m = JSON.parse(readFileSync('references/face/rotation_head.measures.json', 'utf8'));
const ts = Array.from({ length: 9 }, (_, i) => 0.8 + i * 0.025);
mkdirSync(out, { recursive: true });
const rows: Record<string, number>[] = [];
for (const yaw of [0, 20, 45, 70, 90, 110, 135, 160, 180]) {
  const r = renderHead(refView(yaw), REF_SPEC, { frame: defaultFrame(700), ss: 1 }), ms = m.views[String(yaw)].silhouette as { t: number; left: number | null; right: number | null }[];
  const err = (dt: number): { mean: number; max: number; n: number } => {
    const pr = silhouetteProfile(r, ts.map((t) => t + dt)); let e = 0, n = 0, mx = 0;
    for (const p of pr) { const q = ms.find((x) => Math.abs(x.t - (p.t - dt)) < 1e-6); if (!q || q.left === null || q.right === null) continue; const a = Math.abs(p.left - q.left), b = Math.abs(p.right - q.right); e += a + b; n += 2; mx = Math.max(mx, a, b); }
    return { mean: n ? e / n : Infinity, max: mx, n };
  };
  const e0 = err(0); let best = { dt: 0, ...e0 };
  for (let dt = -0.06; dt <= 0.06 + 1e-9; dt += 0.0025) { const e = err(dt); if (e.n >= 10 && e.mean < best.mean) best = { dt, ...e }; }
  rows.push({ yaw, dtU: +best.dt.toFixed(4), meanAvant: +e0.mean.toFixed(4), maxAvant: +e0.max.toFixed(4), meanApres: +best.mean.toFixed(4), maxApres: +best.max.toFixed(4) });
}
writeFileSync(join(out, 'chin-registration.json'), JSON.stringify(rows, null, 1));
console.log(rows.map((r) => `${r.yaw}: dt ${r.dtU}  moyenne ${r.meanAvant} → ${r.meanApres}  max ${r.maxAvant} → ${r.maxApres}`).join('\n'));

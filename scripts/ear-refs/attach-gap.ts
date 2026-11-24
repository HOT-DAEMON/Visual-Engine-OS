import { writeFileSync } from 'node:fs';
import { composeEar, earGeometry, faceLandmarks } from '../../src/face';
import { FaceParams } from '../../src/schema';
import { generateRandomFace } from '../../src';
import { projectEar } from '../../src/face/ear/project';

/**
 * Écart d'attache oreille ↔ tête sur N têtes aléatoires (graines de tête 11…) : bord antérieur (max) ET bas du lobule (écart du point le plus bas à la tête, de face), en fraction de H d'oreille ;
 * `lean` = angle (°) de l'axe de l'oreille de face (sommet → bas) par rapport à la verticale. `OUT=<json> npx tsx scripts/ear-refs/attach-gap.ts [N]`.
 */
const N = Number(process.argv[2] ?? 50);
const rows: Record<string, number>[] = [];
for (let i = 0; i < N; i++) {
  const seed = 11 + i;
  const probe = generateRandomFace(seed, { id: 'f0', hairEngine: 'classic' });
  const p = FaceParams.parse({ ...(probe.params as object), anatomyEngine: 'structured', ears: composeEar(5000 + i, { character: 'natural' }) });
  const lm = faceLandmarks(p, probe.width, probe.height);
  for (const e of earGeometry(p, lm)) {
    const m = e.model!, pl = e.placement!, f = projectEar(m, pl, 0, 'face');
    const ant = m.segments.filter((s) => ['C06', 'C05', 'C04'].includes(s.id));
    let gapAnt = 0;
    for (const sg of ant) for (let k = sg.from; k <= sg.to; k++) { const q = f.plate[k % m.outline.length]!; gapAnt = Math.max(gapAnt, Math.abs(q.x) - pl.headX!(q.y)); }
    const lb = f.landmarks.lobuleBottom!, top = f.landmarks.top!;
    rows.push({ tete: seed, cote: pl.side, gapAnt: gapAnt / pl.hPx, gapLobe: (Math.abs(lb.x) - pl.headX!(lb.y)) / pl.hPx, lean: (Math.atan2(Math.abs(lb.x) - Math.abs(top.x), lb.y - top.y) * 180) / Math.PI });
  }
}
const q = (k: string, fr: number): number => { const a = rows.map((r) => r[k]!).sort((x, y) => x - y); return +a[Math.min(a.length - 1, Math.floor(fr * a.length))]!.toFixed(3); };
const out = Object.fromEntries(['gapAnt', 'gapLobe', 'lean'].map((k) => [k, { min: q(k, 0), median: q(k, 0.5), p90: q(k, 0.9), max: q(k, 1) }]));
console.log(JSON.stringify(out));
const worst = [...rows].sort((a, b) => b.gapLobe! - a.gapLobe!).slice(0, 4).map((r) => `${r.tete}:${r.gapLobe!.toFixed(2)}`);
console.log('pires lobules (tête:écart/H)', worst.join(' '));
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify({ oreilles: rows.length, ...out, pires: worst }, null, 1));

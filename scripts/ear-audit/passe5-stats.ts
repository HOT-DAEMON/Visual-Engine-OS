import { writeFileSync } from 'node:fs';
import { composeEar, earGeometry, faceLandmarks, inPoly, polyArea } from '../../src/face';
import { FaceParams } from '../../src/schema';
import { projectEar } from '../../src/face/ear/project';

/**
 * Mesures de la passe 5, comparables AVANT / APRÈS (même script lancé sur le commit précédent et sur la passe) : `OUT=<fichier.json> npx tsx scripts/ear-audit/passe5-stats.ts`.
 *  - conque : part (cavum + cymba) de l'aire du pavillon ; peau lisse : part de l'aire sans aucune structure ;
 *  - frontal : largeur de face / hauteur d'oreille (une oreille « en trait » est sous 0,25) ;
 *  - attache : écart max du bord antérieur à la tête (fraction de la hauteur) — mesuré sur la plaque projetée de face.
 */
const N = 150;
const rows: Record<string, number>[] = [];
for (let i = 0; i < N; i++) {
  const p = FaceParams.parse({ anatomyEngine: 'structured', ears: composeEar(9000 + i, { character: 'natural' }) });
  const lm = faceLandmarks(p, 300, 400);
  for (const e of earGeometry(p, lm)) {
    const m = e.model!, pl = e.placement!;
    const area = Math.abs(polyArea(m.outline));
    const st = (id: string): number => { const x = m.structures.find((q) => q.id === id); return x ? Math.abs(polyArea(x.poly)) : 0; };
    const covers = m.structures.filter((x) => x.kind !== 'ext' && x.id !== 'lobule' && !String(x.id).startsWith('scapha:'));
    const xs = m.outline.map((q) => q.x), ys = m.outline.map((q) => q.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    let inside = 0, bare = 0;
    for (let a = 0; a < 40; a++) for (let b = 0; b < 60; b++) { const qx = x0 + ((a + 0.5) / 40) * (x1 - x0), qy = y0 + ((b + 0.5) / 60) * (y1 - y0); if (!inPoly(m.outline, qx, qy)) continue; inside++; if (!covers.some((c) => inPoly(c.poly, qx, qy))) bare++; }
    const front = projectEar(m, pl, 0, 'face');
    const ant = m.segments.filter((sg) => ['C06', 'C05', 'C04'].includes(sg.id));
    let gap = 0;
    for (const sg of ant) for (let k = sg.from; k <= sg.to; k++) { const q = front.plate[k % m.outline.length]!; gap = Math.max(gap, Math.abs(q.x) - pl.headX!(q.y)); }
    rows.push({ conque: (st('cavum') + st('cymba')) / area, lisse: bare / inside, frontal: (front.bbox.x1 - front.bbox.x0) / pl.hPx, ecartAttache: gap / pl.hPx, ouverture: pl.openingDeg });
  }
}
const q = (k: string, f: number): number => { const a = rows.map((r) => r[k]!).sort((x, y) => x - y); return +a[Math.min(a.length - 1, Math.floor(f * a.length))]!.toFixed(3); };
const out = Object.fromEntries(['conque', 'lisse', 'frontal', 'ecartAttache', 'ouverture'].map((k) => [k, { min: q(k, 0), p10: q(k, 0.1), median: q(k, 0.5), p90: q(k, 0.9), max: q(k, 1) }]));
console.log(JSON.stringify(out));
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify({ oreilles: rows.length, ...out }, null, 1));

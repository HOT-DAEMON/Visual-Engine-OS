import { writeFileSync } from 'node:fs';
import { composeEar, earGeometry, faceLandmarks, inPoly } from '../../src/face';
import { FaceParams } from '../../src/schema';

/**
 * Mesure, sur le MODÈLE du moteur (repère du plan de l'oreille), les mêmes grandeurs que `extract-ref01.py` mesure sur la référence 01 :
 * parts d'aire (rose = hélix+crus+lobule, bleu = anthélix+antitragus, vert = tragus, gris = tout le reste du pavillon), ordonnée du bas de l'anthélix,
 * hauteur relative du lobule (sous le bas de l'anthélix), ratio largeur/hauteur. `OUT=<fichier.json> npx tsx scripts/ear-refs/engine-measures.ts [N] [character]`.
 * Chaque pixel du pavillon est classé par la structure VISIBLE au-dessus des autres (priorité : tragus > anthélix/antitragus > hélix/crus/lobule > reste).
 */
const N = Number(process.argv[2] ?? 150), CH = (process.argv[3] ?? 'natural') as 'natural' | 'caricature' | 'fantasy';
const rows: Record<string, number>[] = [];
const isBlue = (id: string): boolean => id.startsWith('antihelix:') || id === 'antitragus';
const isPink = (id: string): boolean => id === 'helix' || id === 'crus' || id === 'lobule';
for (let i = 0; i < N; i++) {
  const p = FaceParams.parse({ anatomyEngine: 'structured', ears: composeEar(9000 + i, { character: CH }) });
  for (const e of earGeometry(p, faceLandmarks(p, 300, 400))) {
    const m = e.model!;
    const xs = m.outline.map((q) => q.x), ys = m.outline.map((q) => q.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), h = y1 - y0, w = x1 - x0;
    const cnt = { pink: 0, blue: 0, green: 0, gray: 0, concha: 0, cav: 0, bare: 0 };
    let blueBottom = y0, grayTop = y1, grayBottom = y0;
    const NX = 60, NY = 90;
    for (let a = 0; a < NX; a++) for (let b = 0; b < NY; b++) {
      const qx = x0 + ((a + 0.5) / NX) * w, qy = y0 + ((b + 0.5) / NY) * h;
      if (!inPoly(m.outline, qx, qy)) continue;
      const hit = (f: (id: string) => boolean): boolean => m.structures.some((s) => s.kind !== 'ext' && f(String(s.id)) && !String(s.id).includes(':shade') && inPoly(s.poly, qx, qy));
      if (hit((id) => id === 'tragus')) cnt.green++;
      else if (hit(isBlue)) { cnt.blue++; blueBottom = Math.max(blueBottom, qy); }
      else if (hit(isPink)) cnt.pink++;
      else {
        cnt.gray++; grayTop = Math.min(grayTop, qy); grayBottom = Math.max(grayBottom, qy);
        if (hit((id) => id === 'cavum' || id === 'cymba')) cnt.concha++; else if (m.structures.some((s) => s.kind === 'cavity' && inPoly(s.poly, qx, qy))) cnt.cav++; else cnt.bare++;
      }
    }
    const tot = cnt.pink + cnt.blue + cnt.green + cnt.gray;
    rows.push({ ratioWH: w / h, pink: cnt.pink / tot, blue: cnt.blue / tot, green: cnt.green / tot, gray: cnt.gray / tot, blueBottom: (blueBottom - y0) / h, lobuleH: 1 - (blueBottom - y0) / h, grayTop: (grayTop - y0) / h, grayBottom: (grayBottom - y0) / h, concha: cnt.concha / tot, cav: cnt.cav / tot, bare: cnt.bare / tot });
  }
}
const q = (k: string, f: number): number => { const a = rows.map((r) => r[k]!).sort((x, y) => x - y); return +a[Math.min(a.length - 1, Math.floor(f * a.length))]!.toFixed(3); };
const keys = ['ratioWH', 'pink', 'blue', 'green', 'gray', 'blueBottom', 'lobuleH', 'grayTop', 'grayBottom', 'concha', 'cav', 'bare'];
const out = Object.fromEntries(keys.map((k) => [k, { min: q(k, 0), p10: q(k, 0.1), median: q(k, 0.5), p90: q(k, 0.9), max: q(k, 1) }]));
console.log(JSON.stringify(Object.fromEntries(keys.map((k) => [k, (out[k] as { median: number }).median]))));
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify({ source: 'modèle du moteur (plan)', personnage: CH, oreilles: rows.length, ...out }, null, 1));

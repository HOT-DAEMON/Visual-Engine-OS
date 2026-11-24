import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { composeEar, earGeometry, faceLandmarks } from '../../src/face';
import { FaceParams } from '../../src/schema';

/**
 * Carte des STRUCTURES du modèle dans le code couleur de la référence 01 (rose = hélix/crus/lobule, bleu = anthélix/antitragus, vert = tragus, gris = creux), repère du plan.
 * `OUT=<dossier> npx tsx scripts/ear-refs/structure-map.ts [graine…]` → `structure-map.png` (une oreille par graine).
 */
const seeds = process.argv.slice(2).map(Number); if (!seeds.length) seeds.push(9000, 9001, 9002);
const col = (id: string): string => (id === 'tragus' ? '#3cc83c' : id.startsWith('antihelix:') || id === 'antitragus' ? '#1e90ff' : id === 'helix' || id === 'crus' || id === 'lobule' ? '#ff69b4' : '#aaaaaa');
const W = 300, H = 440; let body = '';
seeds.forEach((s, k) => {
  const p = FaceParams.parse({ anatomyEngine: 'structured', ears: composeEar(s, { character: 'natural' }) });
  const m = earGeometry(p, faceLandmarks(p, 300, 400))[0]!.model!;
  const xs = m.outline.map((q) => q.x), ys = m.outline.map((q) => q.y), x0 = Math.min(...xs), y0 = Math.min(...ys), sc = (H - 40) / (Math.max(...ys) - y0);
  const T = (q: { x: number; y: number }): string => `${((q.x - x0) * sc + 20 + k * W).toFixed(1)},${((q.y - y0) * sc + 20).toFixed(1)}`;
  const poly = (pl: { x: number; y: number }[]): string => pl.map(T).join(' ');
  body += `<polygon points="${poly(m.outline as never)}" fill="#e8e8e8" stroke="#000" stroke-width="3"/>`;
  const order = ['scapha', 'fossa', 'cymba', 'cavum', 'helix', 'crus', 'lobule', 'antihelix', 'antitragus', 'tragus'];
  for (const o of order) for (const st of m.structures) if (st.kind !== 'ext' && String(st.id).startsWith(o) && !String(st.id).includes(':shade')) body += `<polygon points="${poly(st.poly as never)}" fill="${col(String(st.id))}" fill-opacity="${st.kind === 'cavity' ? 0.55 : 0.95}" stroke="#222" stroke-width="0.8"/>`;
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * seeds.length}" height="${H}"><rect width="100%" height="100%" fill="#fff"/>${body}</svg>`;
const out = process.env.OUT ?? '/tmp'; mkdirSync(out, { recursive: true });
writeFileSync(`${out}/structure-map.png`, new Resvg(svg).render().asPng());
console.log(`${out}/structure-map.png`);

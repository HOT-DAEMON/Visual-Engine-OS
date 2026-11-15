import { readFileSync, writeFileSync } from 'node:fs';
import { faceLandmarks, noseGeometry, widthProfile25 } from '../src/face';
import { FaceParams } from '../src/schema';

/**
 * Silhouettes de face du moteur (jeu v1 et jeu v2 des archétypes) normalisées dans la boîte de chaque forme de `references/nez/06.png`,
 * pour `scripts/nose-refs/compose-06-overlay.py` (superposition sur la planche réelle). Sortie : artefacts/nez-aspect-plafond/silhouettes.json
 *   npx tsx scripts/artefacts-nose-aspect.ts
 */
const v1 = JSON.parse(readFileSync('references/nez/fit-06-v1.json', 'utf8')), v2 = JSON.parse(readFileSync('references/nez/fit-06.json', 'utf8'));
const shapes = JSON.parse(readFileSync('references/nez/measures-06.json', 'utf8')).shapes as { index: number; bboxPx: number[] }[];
const NAMES = ['pyramide', 'ellipse-large', 'cloche-ailes', 'plat-trapeze', 'losange-petit'];
const sil = (flat: Record<string, number>) => {
  const patch: Record<string, any> = { anatomyEngine: 'structured' };
  for (const [path, v] of Object.entries(flat)) { const ks = path.split('.'); let c = patch; for (const k of ks.slice(0, -1)) c = (c[k] ??= {}); c[ks[ks.length - 1]!] = v; }
  const p = FaceParams.parse(patch), g = noseGeometry(p, faceLandmarks(p, 300, 380)), m = widthProfile25(g.silhouette);
  const xs = g.silhouette.map((q) => q.x), ys = g.silhouette.map((q) => q.y), x0 = Math.min(...xs), y0 = Math.min(...ys);
  return { aspect: m.aspect, pts: g.silhouette.map((q) => [(q.x - x0) / m.width, (q.y - y0) / m.height]) };
};
const out = shapes.map((s) => ({ name: NAMES[s.index], bbox: s.bboxPx, v1: sil(v1[NAMES[s.index]!].params), v2: sil(v2[NAMES[s.index]!].params), v1Residual: v1[NAMES[s.index]!].residual, v2Residual: v2[NAMES[s.index]!].residual }));
writeFileSync('artefacts/nez-aspect-plafond/silhouettes.json', JSON.stringify(out));
console.log(out.map((o) => `${o.name} v1 ${o.v1.aspect.toFixed(3)} v2 ${o.v2.aspect.toFixed(3)}`).join('\n'));

// ── Artefacts images : têtes complètes avec les archétypes v1 / v2 + courbe du plafond ─────────────────────────────────────────────────────────────
import { compileScene, generateRandomFace } from '../src';
import { rasterPng } from './lib/raster';
const T = (x: number, y: number, s: string, fs = 12, fill = '#fff'): string => `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${fs}" fill="${fill}">${s}</text>`;
const nest = (flat: Record<string, number>): Record<string, any> => { const o: Record<string, any> = {}; for (const [path, v] of Object.entries(flat)) { const ks = path.split('.'); let c = o; for (const k of ks.slice(0, -1)) c = (c[k] ??= {}); c[ks[ks.length - 1]!] = v; } return o; };
const merge = (a: any, b: any): any => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a?.[k] ?? {}, v) : v; return o; };
const head = (seed: number, flat: Record<string, number> | null): string => {
  const F: any = generateRandomFace(seed, { id: 'f0', transform: { x: 150, y: 215, scale: 0.72 } } as never);
  if (flat) { const h = F.objects[0]; h.face = merge(h.face, { anatomyEngine: 'structured', nose: nest(flat).nose }); }
  const r = compileScene({ width: 300, height: 380, background: '#ece6dc', objects: F.objects } as never);
  if (!r.ok) throw new Error(r.issues.join(';'));
  return rasterPng(r.svg).toString('base64');
};
const parts: string[] = [];
[11, 77].forEach((seed, k) => {
  const cols: [string, Record<string, number> | null][] = [['structured, nez tel que généré', {}], ['pyramide (v2)', v2.pyramide.params], ['cloche-ailes v1 (L/H 0,82)', v1['cloche-ailes'].params], ['cloche-ailes v2 (L/H 0,98)', v2['cloche-ailes'].params]];
  cols.forEach(([lab, flat], j) => parts.push(`<image x="${j * 300}" y="${60 + k * 410}" width="300" height="380" href="data:image/png;base64,${head(seed, flat)}"/>${T(j * 300 + 6, 52 + k * 410, `graine ${seed} · ${lab}`, 12, '#222')}`));
});
writeFileSync('artefacts/nez-aspect-plafond/01-tetes-archetypes.png', rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="880"><rect width="100%" height="100%" fill="#ece6dc"/>${T(8, 24, 'Têtes complètes : archétypes de nez avant (v1) et après (v2) libération des axes root.height / length ≥ plancher / width ≤ 0,3 — moteur de visage « structured »', 14, '#222')}${parts.join('')}</svg>`, { fonts: true }));
// Courbe du plafond : L/H maximal en fonction de la hauteur de racine, pour l'évasement 0 et 1 (largeur 0,3, longueur au plancher)
const asp = (rh: number, fl: number): number => { const p = FaceParams.parse({ anatomyEngine: 'structured', nose: { width: 0.3, length: 0.17, root: { height: rh }, alae: { flare: fl } } }); return widthProfile25(noseGeometry(p, faceLandmarks(p, 300, 380)).silhouette).aspect; };
const xs = [0, 0.25, 0.5, 0.75, 1], X = (r: number) => 60 + r * 420, Y = (a: number) => 330 - (a - 0.6) * 300;
const line = (fl: number, col: string) => `<polyline fill="none" stroke="${col}" stroke-width="3" points="${xs.map((r) => `${X(r)},${Y(asp(r, fl))}`).join(' ')}"/>`;
const refs = [['pyramide', 0.73], ['cloche', 0.977], ['plat-trapèze', 1.228], ['losange', 1.52], ['ellipse large', 1.597]].map(([n, a]) => `<line x1="60" x2="480" y1="${Y(a as number)}" y2="${Y(a as number)}" stroke="#aaa" stroke-dasharray="4 4"/>${T(486, Y(a as number) + 4, `${n} ${a}`, 11, '#555')}`).join('');
writeFileSync('artefacts/nez-aspect-plafond/02-plafond-LH.png', rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="100%" height="100%" fill="#fff"/>${refs}${line(0, '#c0392b')}${line(1, '#16a085')}${T(10, 20, 'L/H maximal de la silhouette de face vs nose.root.height (largeur 0,3, longueur 0,17)', 13, '#222')}${T(70, 360, 'rouge : évasement 0 · vert : évasement 1 · pointillés : formes de la planche 06 (plafond = 1,40)', 11, '#222')}${[0, 0.5, 1].map((r) => T(X(r) - 6, 378, String(r), 11, '#222')).join('')}</svg>`, { fonts: true }));
console.log('artefacts images écrits');

/**
 * Artefacts de preuve : périmètres d'occupation du visage, coupe du cou (avant / après), caméra en perspective, vérification.
 * Usage : `npx tsx scripts/artefacts-face-perimeters.ts <dossier> [avant=/tmp/before] [apres=/tmp/after]`
 * `avant` / `apres` : dossiers de `scripts/artefacts-head3d-light-v2.ts` (mêmes graines) lancés sur l'ancien et le nouveau code ; absents → seules les planches calculées ici sont écrites.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { compileScene, generateRandomFace } from '../src';
import { browGapPerEye, eyeBands, facePerimeters, faceLandmarks, BROW_GAP, PERIMETER_LIMITS, type PerimeterId } from '../src/face';
import { checkPerimeters } from '../src/verify/perimeters';
import { rasterPng } from './lib/raster';

const out = process.argv[2] ?? 'artefacts/face-perimeters-perspective', avant = process.argv[3] ?? '/tmp/before', apres = process.argv[4] ?? '/tmp/after';
mkdirSync(out, { recursive: true });
const uri = (b: Buffer): string => `data:image/png;base64,${b.toString('base64')}`;
const COL: Record<PerimeterId, string> = { forehead: '#c9a227', brows: '#8e44ad', browGap: '#e67e22', eyes: '#2980b9', interocular: '#16a085', nose: '#c0392b', philtrum: '#d35400', mouth: '#e84393', chin: '#27ae60' };

/** 01 : visages de face, périmètres superposés (bande = hauteur ; largeur = largeur occupée). */
const SEEDS = [11, 42, 77, 5], CW = 420, CH = 600;
let cells = '';
SEEDS.forEach((seed, i) => {
  const f = generateRandomFace(seed, { id: 'f0', structure: true, transform: { x: CW / 2, y: 300, scale: 1 } } as never);
  const r = compileScene({ width: CW, height: CH, background: '#ece6dc', objects: f.objects } as never) as { ok: boolean; svg: string };
  const lm = faceLandmarks(f.params, f.width, f.height), P = facePerimeters(f.params, lm, (['left', 'right'] as const).map((s) => eyeBands(s, f.fits[s], lm)));
  const bands = P.list.map((q) => `<rect x="${CW / 2 - q.halfPx}" y="${300 + q.topY}" width="${2 * q.halfPx}" height="${Math.max(1, q.heightPx)}" fill="${COL[q.id]}" fill-opacity="0.22" stroke="${COL[q.id]}" stroke-width="1.2"/>`).join('');
  cells += `<g transform="translate(${i * CW},0)"><image width="${CW}" height="${CH}" href="${uri(rasterPng(r.svg))}"/>${bands}<text x="6" y="14" font-size="12" font-family="DejaVu Sans" fill="#222">graine ${seed} · écart sourcil/paupière ${(P.byId.browGap.heightShare * 100).toFixed(1)} % de H</text></g>`;
});
const legend = (Object.keys(COL) as PerimeterId[]).map((id, k) => `<rect x="${8 + k * 150}" y="${CH + 6}" width="12" height="12" fill="${COL[id]}" fill-opacity="0.5"/><text x="${26 + k * 150}" y="${CH + 17}" font-size="11" font-family="DejaVu Sans">${id}</text>`).join('');
writeFileSync(`${out}/01-perimetres-visage.png`, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${CW * SEEDS.length}" height="${CH + 26}"><rect width="100%" height="100%" fill="#ece6dc"/>${cells}${legend}</svg>`));

/** 02 / 04 : avant / après (grille lacet × tangage ; ligne tangage +30° pour le cou). */
for (const seed of [11, 77]) {
  const a = `${avant}/grille-lacet-tangage-graine-${seed}.png`, b = `${apres}/grille-lacet-tangage-graine-${seed}.png`;
  if (!existsSync(a) || !existsSync(b)) continue;
  const A = uri(readFileSync(a)), B = uri(readFileSync(b));
  writeFileSync(`${out}/02-avant-apres-tete-3d-graine-${seed}.png`, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="930"><rect width="100%" height="100%" fill="#ece6dc"/><image width="960" height="900" href="${A}"/><image x="960" width="960" height="900" href="${B}"/><text x="10" y="920" font-size="16" font-family="DejaVu Sans">AVANT : coupe du cou en plan, « seau » à tangage +30°</text><text x="970" y="920" font-size="16" font-family="DejaVu Sans">APRÈS : cou prolongé, coupé par le cadre</text></svg>`));
  writeFileSync(`${out}/04-cou-tangage-plus30-graine-${seed}.png`, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="330"><rect width="100%" height="100%" fill="#ece6dc"/><svg width="960" height="300" viewBox="0 600 960 300"><image width="960" height="900" href="${A}"/></svg><svg x="960" width="960" height="300" viewBox="0 600 960 300"><image width="960" height="900" href="${B}"/></svg><text x="10" y="322" font-size="16" font-family="DejaVu Sans">avant</text><text x="970" y="322" font-size="16" font-family="DejaVu Sans">après</text></svg>`));
}

/** 03 : caméra orthographique vs perspective (têtes entières, tangage 35 / 0 / −35). */
const U = 240, S = 0.62, PW = Math.round(1.5 * U * S), PH = Math.round(1.75 * U * S);
const head = (seed: number, yaw: number, pitch: number, persp?: number): string => {
  const f = generateRandomFace(seed, { id: 'f0', structure: true, transform: { x: PW - 6, y: PH - 8, scale: 0.05 } } as never).objects;
  const r = compileScene({ width: PW, height: PH, background: '#ece6dc', objects: [...f, { kind: 'head_3d', id: 't0', host: 'f0', resolution: 3, yaw, pitch, ...(persp ? { perspective: persp } : {}), transform: { x: 0.75 * U * S, y: 0.2 * U * S, scale: S } }] } as never) as { ok: boolean; svg: string; issues?: string[] };
  if (!r.ok) throw new Error(String(r.issues));
  return uri(rasterPng(r.svg));
};
for (const seed of [11, 42]) {
  let g = '';
  ([['orthographique', undefined], ['perspective 3,5 U', 3.5]] as const).forEach(([lab, p], ri) => [35, 0, -35].forEach((pi, i) => [0, 50].forEach((ya, j) => {
    const x = (i * 2 + j) * PW, y = ri * (PH + 4);
    g += `<image x="${x}" y="${y}" width="${PW}" height="${PH}" href="${head(seed, ya, pi, p)}"/><text x="${x + 4}" y="${y + 13}" font-size="11" font-family="DejaVu Sans" fill="#222">${lab} · tangage ${pi}° · lacet ${ya}°</text>`;
  })));
  writeFileSync(`${out}/03-perspective-graine-${seed}.png`, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${PW * 6}" height="${PH * 2 + 4}"><rect width="100%" height="100%" fill="#ece6dc"/>${g}</svg>`));
}

/** 06 : rapport de vérification sur 200 visages structurés (mêmes contrôles que `verifyFace`). */
let nChecks = 0, nFail = 0, nWarn = 0; const warnIds: Record<string, number> = {}, gaps: number[] = [];
for (let seed = 1; seed <= 200; seed++) {
  const f = generateRandomFace(seed, { structure: true } as never), lm = faceLandmarks(f.params, f.width, f.height), eb = (['left', 'right'] as const).map((s) => eyeBands(s, f.fits[s], lm));
  for (const g of browGapPerEye(eb)) gaps.push(g / lm.H);
  const cs = checkPerimeters(f as never); nChecks += cs.length;
  for (const c of cs) if (!c.ok) { if (c.severity === 'error') nFail++; else { nWarn++; warnIds[c.id] = (warnIds[c.id] ?? 0) + 1; } }
}
gaps.sort((a, b) => a - b);
const q = (p: number): string => gaps[Math.min(gaps.length - 1, Math.floor(p * gaps.length))]!.toFixed(4);
writeFileSync(`${out}/06-verification-perimetres.md`, `# Vérification des périmètres — 200 visages structurés (graines 1 à 200)\n\n- Contrôles évalués : ${nChecks} (3 couches : géométrie, anatomie, style)\n- Échecs durs : **${nFail}** · avertissements : **${nWarn}** ${JSON.stringify(warnIds)}\n- Écart sourcil / paupière (par œil, fraction de H) : min ${q(0)} · 5 % ${q(0.05)} · médiane ${q(0.5)} · 95 % ${q(0.95)} · max ${q(1)} (bornes ${BROW_GAP.min} – ${BROW_GAP.max})\n- Bornes : ${(Object.keys(PERIMETER_LIMITS) as PerimeterId[]).map((id) => `${id} h ${PERIMETER_LIMITS[id].height.min}–${PERIMETER_LIMITS[id].height.max}`).join(' · ')}\n`);
console.log('ok', out, { nChecks, nFail, nWarn });

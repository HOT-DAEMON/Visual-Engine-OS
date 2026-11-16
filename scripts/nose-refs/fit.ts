import { readFileSync, writeFileSync } from 'node:fs';
import { faceLandmarks, noseGeometry } from '../../src/face';
import { FaceParams } from '../../src/schema';
import { widthProfile25 } from '../../src/face/nose/measure';
import { ZONE_LIMITS } from '../../src/face/zones-limits';

/**
 * AJUSTEMENT PAR SYNTHÈSE des archétypes de nez sur les silhouettes MESURÉES de `references/nez/06.png` (`measures-06.json`) — v3 (docs/NOSE-PLATE06-GLOBAL.md).
 * Même fonction de coût et mêmes bornes que la v2 (`fit-06-v2.json`) ; changements : (1) optimiseur = Nelder–Mead borné à redémarrages (v2 : 600 tirages + descente par coordonnée) ;
 * (2) deux axes ajoutés dont la silhouette dépend (balayage de sensibilité : `nose.tip.rotation` 0,085, `nose.alae.attachment` 0,026) ; (3) deux axes sans effet sur la silhouette retirés
 * (`nose.alae.volume`, `nose.dorsum.width` : effet 0,000) — ils restent à la valeur par défaut du schéma au lieu d'une valeur arbitraire tirée au hasard.
 *   npx tsx scripts/nose-refs/fit.ts <redémarrages> <indice 0..4>   → references/nez/fit-06-shape-<i>.json (graine propre à chaque forme : reproductible isolément)
 *   npx tsx scripts/nose-refs/fit.ts emit                           → fusionne les 5 formes : references/nez/fit-06.json + src/face/nose/archetypes.generated.ts
 */
export const W = 300, H = 380, UPPER = 18;
export const AXES: [string, number, number][] = [['nose.width', 0.1, 0.3], ['nose.length', ZONE_LIMITS.nose.min, 0.26], ['nose.tip.width', 0, 1], ['nose.alae.flare', 0, 1], ['nose.base.width', -1, 1], ['nose.root.width', 0, 1], ['nose.sidewall.slope', 0, 1], ['nose.tip.roundness', 0, 1], ['nose.root.height', 0, 1], ['nose.tip.rotation', 0, 1], ['nose.alae.attachment', 0, 1]];
export const NAMES = ['pyramide', 'ellipse-large', 'cloche-ailes', 'plat-trapeze', 'losange-petit'] as const;
export const build = (v: number[], axes = AXES): Record<string, unknown> => {
  const patch: Record<string, any> = { anatomyEngine: 'structured' };
  axes.forEach(([path], i) => { const ks = path.split('.'); let c = patch; for (const k of ks.slice(0, -1)) c = (c[k] ??= {}); c[ks[ks.length - 1]!] = v[i]; });
  return patch;
};
export const measure = (v: number[], axes = AXES) => { const p = FaceParams.parse(build(v, axes)); return widthProfile25(noseGeometry(p, faceLandmarks(p, W, H)).silhouette); };
export const cost = (v: number[], ref: { aspectWoverH: number; widthProfile25: number[] }, axes = AXES): number => {
  const m = measure(v, axes); let e = 0;
  for (let i = 0; i < UPPER; i++) e += (m.profile[i]! - ref.widthProfile25[i]!) ** 2;
  return Math.sqrt(e / UPPER) + 0.25 * Math.abs(Math.log(m.aspect / ref.aspectWoverH));
};
/** Nelder–Mead borné (projection des sommets dans la boîte). */
export function nelderMead(f: (v: number[]) => number, x0: number[], lo: number[], hi: number[], iters: number, scale = 0.15): { x: number[]; fx: number } {
  const n = x0.length, clip = (v: number[]): number[] => v.map((a, i) => Math.min(hi[i]!, Math.max(lo[i]!, a)));
  let S = [clip(x0), ...x0.map((_, i) => { const v = [...x0]; v[i] = v[i]! + scale * (hi[i]! - lo[i]!) * (v[i]! + scale * (hi[i]! - lo[i]!) > hi[i]! ? -1 : 1); return clip(v); })].map((v) => ({ v, f: f(v) }));
  for (let it = 0; it < iters; it++) {
    S.sort((a, b) => a.f - b.f);
    const c = Array.from({ length: n }, (_, i) => S.slice(0, n).reduce((s, p) => s + p.v[i]!, 0) / n), worst = S[n]!;
    const along = (t: number): number[] => clip(c.map((a, i) => a + t * (worst.v[i]! - a)));
    const r = along(-1), fr = f(r);
    if (fr < S[0]!.f) { const e = along(-2), fe = f(e); S[n] = fe < fr ? { v: e, f: fe } : { v: r, f: fr }; }
    else if (fr < S[n - 1]!.f) S[n] = { v: r, f: fr };
    else { const k = along(fr < worst.f ? -0.5 : 0.5), fk = f(k); if (fk < Math.min(fr, worst.f)) S[n] = { v: k, f: fk }; else { const b = S[0]!; S = S.map((p, i) => { if (i === 0) return p; const v = clip(p.v.map((a, j) => b.v[j]! + 0.5 * (a - b.v[j]!))); return { v, f: f(v) }; }); } }
  }
  S.sort((a, b) => a.f - b.f);
  return { x: S[0]!.v, fx: S[0]!.f };
}
if (process.argv[1]?.endsWith('fit.ts')) {
  const refs = JSON.parse(readFileSync('references/nez/measures-06.json', 'utf8')).shapes as { index: number; aspectWoverH: number; widthProfile25: number[] }[];
  if (process.argv[2] === 'emit') {
    const result: Record<string, unknown> = {};
    for (const r of refs) { const j = JSON.parse(readFileSync(`references/nez/fit-06-shape-${r.index}.json`, 'utf8')); result[NAMES[r.index]!] = { params: j.params, residual: j.residual, aspect: j.aspect, refAspect: j.refAspect }; }
    writeFileSync('references/nez/fit-06.json', JSON.stringify(result, null, 1));
    const body = Object.entries(result).map(([k, v]: [string, any]) => `  '${k}': { residual: ${v.residual}, aspect: ${v.aspect}, refAspect: ${v.refAspect}, params: ${JSON.stringify(v.params)} },`).join('\n');
    writeFileSync('src/face/nose/archetypes.generated.ts', `// FICHIER GÉNÉRÉ par scripts/nose-refs/fit.ts (emit) à partir de references/nez/measures-06.json — ne pas éditer à la main.\nexport const NOSE_FIT = {\n${body}\n} as const;\n`);
    console.log('émis'); process.exit(0);
  }
  const restarts = Number(process.argv[2] ?? 30), idx = Number(process.argv[3]);
  const r = refs.find((x) => x.index === idx)!;
  let seed = 20261115 + 7919 * idx; const rnd = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const lo = AXES.map((a) => a[1]), hi = AXES.map((a) => a[2]);
  let best = { x: [] as number[], fx: Infinity }; const trace: number[] = [];
  for (let k = 0; k < restarts; k++) {
    const x0 = AXES.map(([, a, b]) => a + (b - a) * rnd());
    let cur = nelderMead((v) => cost(v, r), x0, lo, hi, 250, 0.2);
    cur = nelderMead((v) => cost(v, r), cur.x, lo, hi, 250, 0.05);
    trace.push(+cur.fx.toFixed(4)); if (cur.fx < best.fx) best = cur;
  }
  const m = measure(best.x), params: Record<string, number> = {}; AXES.forEach(([path], i) => { params[path] = Math.round(best.x[i]! * 1e4) / 1e4; });
  // résidu recalculé sur les paramètres ARRONDIS (ce que le moteur lira)
  const rounded = AXES.map(([path]) => params[path]!), res = cost(rounded, r), mr = measure(rounded);
  writeFileSync(`references/nez/fit-06-shape-${idx}.json`, JSON.stringify({ name: NAMES[idx], restarts, residual: Math.round(res * 1e4) / 1e4, aspect: Math.round(mr.aspect * 1e3) / 1e3, refAspect: r.aspectWoverH, bestOfRestarts: trace.sort((a, b) => a - b).slice(0, 8), params }, null, 1));
  console.log(NAMES[idx]!.padEnd(14), 'résidu (arrondi)', res.toFixed(4), 'L/H', mr.aspect.toFixed(3), 'réf', r.aspectWoverH, '| non arrondi', best.fx.toFixed(4), m.aspect.toFixed(3));
}

import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { compileScene } from '../../src';
import { generateExtra3Eye } from '../../src/generation/eye-gallery-ext3';
import { generateExtra4Eye } from '../../src/generation/eye-gallery-ext4';
import { svgFeatures } from '../../src/verify/eye-cost';

/**
 * `npx tsx scripts/eye-refs/calibrate-svg-cost.ts` — passe 15 : le seuil `svg-weight` (140 ko) était un mauvais proxy du coût (corrélation 0,39 avec le temps de rastérisation,
 * 0,69 avec le nombre de filtres). On MESURE le temps de rastérisation (médiane de 3, après un tir d'échauffement) de 120 yeux des galeries 3 et 4 et on ajuste
 * par moindres carrés un modèle linéaire sur les deux grandeurs que resvg paie réellement : applications de filtre et ko (le nombre de tracés est mesuré mais colinéaire avec les ko).
 * Sortie : `references/eyes/measures-svg-cost.json` (coefficients, R², corrélations par grandeur). Les constantes retenues sont dans `src/verify/eye-cost.ts` (testées contre ce JSON).
 */
const N = Number(process.argv[2] ?? 60);
const sceneOf = (e: unknown): string => { const r: any = compileScene({ width: 700, height: 460, background: '#ffffff', objects: [{ kind: 'eye', id: 'e', transform: { x: 350, y: 230 }, ...(e as object), eyebrow: null }] } as never); if (!r.ok) throw new Error(r.issues.join('\n')); return r.svg as string; };
const timeOf = (svg: string): number => {
  new Resvg(svg, { font: { loadSystemFonts: false }, fitTo: { mode: 'width', value: 700 } }).render();
  const ts: number[] = [];
  for (let k = 0; k < 3; k++) { const t0 = performance.now(); new Resvg(svg, { font: { loadSystemFonts: false }, fitTo: { mode: 'width', value: 700 } }).render(); ts.push(performance.now() - t0); }
  return ts.sort((a, b) => a - b)[1] as number;
};
const rows: { id: string; ms: number; f: ReturnType<typeof svgFeatures> }[] = [];
for (let i = 0; i < N; i++) for (const [name, gen] of [['g3', generateExtra3Eye], ['g4', generateExtra4Eye]] as const) {
  const svg = sceneOf(gen(i)); rows.push({ id: `${name}-${i}`, ms: timeOf(svg), f: svgFeatures(svg) });
}
const corr = (xs: number[], ys: number[]): number => { const n = xs.length; const mx = xs.reduce((a, b) => a + b, 0) / n; const my = ys.reduce((a, b) => a + b, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (xs[i]! - mx) * (ys[i]! - my); sxx += (xs[i]! - mx) ** 2; syy += (ys[i]! - my) ** 2; } return sxy / Math.sqrt(sxx * syy); };
const ys = rows.map((r) => r.ms);
// `nodes` est retiré du modèle : colinéaire avec les ko (coefficient négatif au premier ajustement, sans sens physique) ; sa corrélation reste publiée.
const feats = ['filterApps', 'kb'] as const;
const K = feats.length + 1;
// Moindres carrés avec ordonnée à l'origine : résolution des équations normales 4×4 (élimination de Gauss).
const X = rows.map((r) => [1, ...feats.map((k) => r.f[k])]);
const A = Array.from({ length: K }, (_, i) => Array.from({ length: K }, (_, j) => X.reduce((s, x) => s + x[i]! * x[j]!, 0)));
const b = Array.from({ length: K }, (_, i) => X.reduce((s, x, n) => s + x[i]! * ys[n]!, 0));
for (let i = 0; i < K; i++) { let p = i; for (let r = i + 1; r < K; r++) if (Math.abs(A[r]![i]!) > Math.abs(A[p]![i]!)) p = r; [A[i], A[p]] = [A[p]!, A[i]!]; [b[i], b[p]] = [b[p]!, b[i]!]; for (let r = i + 1; r < K; r++) { const f = A[r]![i]! / A[i]![i]!; for (let c = i; c < K; c++) A[r]![c]! -= f * A[i]![c]!; b[r]! -= f * b[i]!; } }
const w = new Array<number>(K).fill(0); for (let i = K - 1; i >= 0; i--) { let s = b[i]!; for (let j = i + 1; j < K; j++) s -= A[i]![j]! * w[j]!; w[i] = s / A[i]![i]!; }
const pred = X.map((x) => x.reduce((s, v, i) => s + v * w[i]!, 0));
const my = ys.reduce((a, c) => a + c, 0) / ys.length;
const r2 = 1 - ys.reduce((s, y, i) => s + (y - pred[i]!) ** 2, 0) / ys.reduce((s, y) => s + (y - my) ** 2, 0);
const sorted = [...ys].sort((a, c) => a - c); const q = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] as number;
const out = {
  yeux: rows.length, ms: { median: +q(0.5).toFixed(1), p90: +q(0.9).toFixed(1), max: +sorted[sorted.length - 1]!.toFixed(1) },
  correlations: Object.fromEntries((['filterApps', 'nodes', 'kb'] as const).map((k) => [k, +corr(rows.map((r) => r.f[k]), ys).toFixed(3)])),
  modele: { intercept: +w[0]!.toFixed(3), filterApps: +w[1]!.toFixed(3), kb: +w[2]!.toFixed(3) }, r2: +r2.toFixed(3),
};
writeFileSync('references/eyes/measures-svg-cost.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));

import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { composeEar, faceLandmarks, type EarCharacter } from '../../src/face';
import { earViewSvg } from '../../src/render/face/ear/sheet';
import { checkEars } from '../../src/verify/ear';
import { FaceParams } from '../../src/schema';
import { earCell, saveBoard, SKIN } from './sheets';

/**
 * MESURE DE LA DIVERSITÉ du compositeur d'oreilles : N graines consécutives par caractère, rendu réel (face), puis distance VISIBLE entre toutes les paires
 * (part des pixels dont la somme RGB change de plus de 24, dans un cadre de 130 × 180 centré sur l'oreille). Une paire est « distincte » si ≥ 1 % du cadre change.
 *   npx tsx scripts/ear-audit/diversity.ts [N=120] → artefacts/oreille-composeur/diversite.json (+ planches si N ≤ 120)
 */
const N = Number(process.argv[2] ?? 120);
const W = 130, H = 180, JND = 0.01 * W * H;
const OUT = 'artefacts/oreille-composeur';
mkdirSync(OUT, { recursive: true });
const raster = (ear: object): Uint8Array => {
  const p = FaceParams.parse({ anatomyEngine: 'structured', ears: ear });
  return new Resvg(earViewSvg(p, faceLandmarks(p, 300, 400), { view: 'face', width: W, height: H, skin: SKIN }), { fitTo: { mode: 'width', value: W } }).render().pixels;
};
const result: Record<string, unknown> = { N, jndPixels: JND, frame: [W, H] };
for (const ch of ['natural', 'caricature', 'fantasy'] as EarCharacter[]) {
  const ears = Array.from({ length: N }, (_, i) => composeEar(1000 + i, { character: ch }));
  const imgs = ears.map((e) => raster(e));
  const d = (a: Uint8Array, b: Uint8Array): number => { let n = 0; for (let q = 0; q < a.length; q += 4) if (Math.abs(a[q]! - b[q]!) + Math.abs(a[q + 1]! - b[q + 1]!) + Math.abs(a[q + 2]! - b[q + 2]!) > 24) n++; return n; };
  const dists: number[] = []; const nearest = Array(N).fill(Infinity) as number[];
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const v = d(imgs[i]!, imgs[j]!); dists.push(v); nearest[i] = Math.min(nearest[i]!, v); nearest[j] = Math.min(nearest[j]!, v); }
  dists.sort((a, b) => a - b);
  const q = (p: number): number => dists[Math.floor(p * (dists.length - 1))]!;
  // Empilement glouton : combien d'oreilles de la série sont deux à deux distinctes (≥ JND) ?
  const kept: number[] = [];
  for (let i = 0; i < N; i++) if (kept.every((k) => d(imgs[i]!, imgs[k]!) >= JND)) kept.push(i);
  // Cohérence : vérification de l'oreille (trois couches) sur chaque oreille composée.
  let errs = 0, warns = 0;
  const failed = new Map<string, number>();
  for (const e of ears) { const p = FaceParams.parse({ anatomyEngine: 'structured', ears: e }); for (const c of checkEars(p, faceLandmarks(p, 300, 400), SKIN)) if (!c.ok) { (c.severity === 'warn' ? warns++ : errs++); const k = c.id.replace(/-[LR]$/, ''); failed.set(k, (failed.get(k) ?? 0) + 1); } }
  result[`${ch}_checks`] = Object.fromEntries(failed);
  result[ch] = { pairs: dists.length, minPx: dists[0], p05: q(0.05), median: q(0.5), p95: q(0.95), share: +(dists.filter((v) => v >= JND).length / dists.length).toFixed(4), nearestMedian: [...nearest].sort((a, b) => a - b)[Math.floor(N / 2)], greedyDistinct: kept.length, verifyErrors: errs, verifyWarnings: warns };
  console.log(ch, JSON.stringify(result[ch]));
  if (N <= 120) saveBoard(OUT, `planche-${ch}`, `Oreilles composées — ${ch} (graines 1000–${999 + N}), vue de face, rendu réel`, ears.map((e, i) => ({ png: earCell(e as never, 'face', 130, 180), label: `#${1000 + i}` })), 12, 130, 180);
}
writeFileSync(`${OUT}/diversite.json`, JSON.stringify(result, null, 1));

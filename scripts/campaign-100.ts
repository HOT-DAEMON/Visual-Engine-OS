/**
 * Campagne de 100 visages (graines 1…100, moteur de structure) : rendu, vérification par contrats sur les trois couches,
 * statistiques de corrections du résolveur, planches. Sortie : artefacts/campagne-100/ (planches PNG + rapport.json).
 * Le temps de rendu est aussi consigné : c'est le test de la promesse de performance (une galerie de 100 visages).
 * Usage : npx tsx scripts/campaign-100.ts [premier=1] [dernier=100]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { generateRandomFace } from '../src/generation/random-face';
import { verifyFace } from '../src/verify';
import { faceLandmarks } from '../src/face';
import { board, cell } from './lib/board';

const from = Number(process.argv[2] ?? 1); const to = Number(process.argv[3] ?? 100);
const OUT = 'artefacts/campagne-100'; mkdirSync(OUT, { recursive: true });
const now = (): number => Number(process.hrtime.bigint()) / 1e6;
const W = 170; const H = 210;
const rows: Record<string, unknown>[] = [];
const cells: { png: Buffer; label: string }[] = [];
const t0 = now();
const corr: Record<string, number> = {};
const warn: Record<string, number> = {};
for (let seed = from; seed <= to; seed++) {
  const t = now();
  const face = generateRandomFace(seed, { structure: true });
  const rep = verifyFace(face);
  const lm = faceLandmarks(face.params, face.width, face.height);
  const c = cell({ seed, opts: { structure: true } as never }, W, H);
  cells.push({ png: c.png, label: `#${seed}${rep.failures.length ? ' ✗' : rep.warnings.length ? ' !' : ''}` });
  for (const k of lm.corrections) corr[k.id] = (corr[k.id] ?? 0) + 1;
  for (const k of rep.warnings) warn[k.id] = (warn[k.id] ?? 0) + 1;
  rows.push({ seed, ok: rep.ok, failures: rep.failures.map((f) => f.id), warnings: rep.warnings.map((f) => f.id), corrections: lm.corrections.map((k) => k.id), ms: +(now() - t).toFixed(0) });
}
const total = now() - t0;
const per = 20;
for (let i = 0; i < cells.length; i += per) writeFileSync(`${OUT}/planche-${String(Math.floor(i / per) + 1).padStart(2, '0')}.png`, board(`Campagne : visages ${from + i}–${from + Math.min(cells.length, i + per) - 1} (✗ échec, ! avertissement)`, cells.slice(i, i + per), 5, W, H));
const summary = { faces: rows.length, ok: rows.filter((r) => r.ok).length, withWarnings: rows.filter((r) => (r.warnings as string[]).length).length, totalSeconds: +(total / 1000).toFixed(1), msPerFace: +(total / rows.length).toFixed(0), correctionsByConstraint: corr, warningsById: warn };
writeFileSync(`${OUT}/rapport.json`, JSON.stringify({ summary, rows }, null, 1));
console.log(JSON.stringify(summary, null, 1));

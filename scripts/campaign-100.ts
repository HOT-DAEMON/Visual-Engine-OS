/**
 * Campagne de 100 visages (graines 1…100, moteur de structure) : rendu, vérification par contrats sur les trois couches,
 * statistiques de corrections du résolveur, planches. Sortie : artefacts/campagne-100/ (planches PNG + rapport.json).
 * Le temps de rendu est aussi consigné : c'est le test de la promesse de performance (une galerie de 100 visages).
 * Usage : npx tsx scripts/campaign-100.ts [premier=1] [dernier=100]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { board } from './lib/board';
import { renderCampaign } from './lib/parallel';

const from = Number(process.argv[2] ?? 1); const to = Number(process.argv[3] ?? 100);
const JOBS = process.env.JOBS ? Number(process.env.JOBS) : undefined; // défaut : nombre de cœurs (plafonné à 8)
const OUT = process.env.OUT ?? 'artefacts/campagne-100'; mkdirSync(OUT, { recursive: true });
const now = (): number => Number(process.hrtime.bigint()) / 1e6;
const W = 170; const H = 210;
const t0 = now();
const seeds = Array.from({ length: to - from + 1 }, (_, i) => from + i);
const res = await renderCampaign(seeds, W, H, JOBS);
const rows = res.map((r) => r.row);
const cells = res.map((r) => ({ png: Buffer.from(r.png, 'base64'), label: r.label }));
const corr: Record<string, number> = {};
const warn: Record<string, number> = {};
for (const r of res) { for (const k of r.corrections) corr[k] = (corr[k] ?? 0) + 1; for (const k of r.warnings) warn[k] = (warn[k] ?? 0) + 1; }
const total = now() - t0;
const per = 20;
for (let i = 0; i < cells.length; i += per) writeFileSync(`${OUT}/planche-${String(Math.floor(i / per) + 1).padStart(2, '0')}.png`, board(`Campagne : visages ${from + i}–${from + Math.min(cells.length, i + per) - 1} (✗ échec, ! avertissement)`, cells.slice(i, i + per), 5, W, H));
const summary = { faces: rows.length, ok: rows.filter((r) => r.ok).length, withWarnings: rows.filter((r) => (r.warnings as string[]).length).length, totalSeconds: +(total / 1000).toFixed(1), msPerFace: +(total / rows.length).toFixed(0), correctionsByConstraint: corr, warningsById: warn };
writeFileSync(`${OUT}/rapport.json`, JSON.stringify({ summary, rows }, null, 1));
console.log(JSON.stringify(summary, null, 1));

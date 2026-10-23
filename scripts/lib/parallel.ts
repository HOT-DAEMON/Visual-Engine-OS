import { fork } from 'node:child_process';
import { cpus } from 'node:os';
import type { CampaignCell } from './campaign-worker';

/**
 * Rend les cellules d'une campagne sur `jobs` processus (défaut : nombre de cœurs, plafonné à 8). Les graines sont distribuées en tourniquet
 * (charge équilibrée), le résultat est RENDU DANS L'ORDRE des graines : identique au traitement série, octet pour octet (testé).
 * `jobs = 1` : un seul enfant, même chemin de code.
 */
export function renderCampaign(seeds: number[], W: number, H: number, jobs = Math.min(8, Math.max(1, cpus().length))): Promise<CampaignCell[]> {
  const n = Math.max(1, Math.min(jobs, seeds.length));
  const shards: number[][] = Array.from({ length: n }, () => []);
  seeds.forEach((s, i) => shards[i % n]!.push(s));
  const out = new Map<number, CampaignCell>();
  return new Promise((resolve, reject) => {
    let pending = n;
    for (const shard of shards) {
      const child = fork(new URL('./campaign-worker.ts', import.meta.url).pathname, [], { execArgv: ['--import', 'tsx'], env: { ...process.env } });
      child.on('message', (m: CampaignCell | 'done') => {
        if (m === 'done') { child.kill(); if (--pending === 0) resolve(seeds.map((s) => out.get(s) as CampaignCell)); } else out.set(m.seed, m);
      });
      child.on('error', reject);
      child.on('exit', (code) => { if (code && code !== 0 && code !== null && pending > 0) reject(new Error(`travailleur arrêté (code ${code})`)); });
      child.send({ seeds: shard, W, H });
    }
  });
}

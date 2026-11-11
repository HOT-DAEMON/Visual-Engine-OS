import { mkdirSync, writeFileSync } from 'node:fs';
import { generateRandomFace } from '../src';
import { checkHairBoundary, checkHairCoherence, checkHairEdge, checkHairForm, checkHairRound, checkHairShape, checkHairSkull, checkHairZones, checkHeadHair } from '../src/verify';
import type { Check } from '../src/verify/types';
import { HAIR_STYLES } from '../src/schema';

/**
 * Revue de CORPUS (et non de 3 visages) : toutes les couches de vérification des cheveux (géométrie, anatomie, style) sur N visages par coiffure.
 *   npx tsx scripts/hair-corpus.ts [N=40] [dossier=artefacts/hair-round]
 * Écrit `corpus.json` (comptes bruts) et `corpus.md` (tableau lisible : par coiffure, nombre de visages en échec / en avertissement par contrôle).
 */
const N = Number(process.argv[2] ?? 40);
const dir = process.argv[3] ?? 'artefacts/hair-round';
mkdirSync(dir, { recursive: true });
const checks = [checkHairBoundary, checkHairShape, checkHairSkull, checkHairForm, checkHairEdge, checkHairCoherence, checkHairRound, checkHairZones, checkHeadHair] as const;
type Row = { fail: number; warn: number; layer: string; worst: number; limit: number };
const out: Record<string, Record<string, Row>> = {};
for (const style of HAIR_STYLES.filter((s) => s !== 'bald')) {
  const rows: Record<string, Row> = (out[style] = {});
  for (let i = 0; i < N; i++) {
    const f = generateRandomFace(9000 + i * 71, { hair: { style } as never, hairEngine: 'v2' });
    for (const fn of checks) {
      for (const c of fn(f) as Check[]) {
        const r = (rows[c.id] ??= { fail: 0, warn: 0, layer: c.layer, worst: 0, limit: c.limit });
        if (!c.ok) { if (c.severity === 'error') r.fail++; else r.warn++; r.worst = Math.max(r.worst, c.value); }
      }
    }
  }
}
writeFileSync(`${dir}/corpus.json`, JSON.stringify({ n: N, seeds: '9000 + 71 k', styles: out }, null, 2));
const lines = [`# Revue de corpus : ${N} visages par coiffure (graines 9000 + 71 k)`, '', 'Contrôles en échec (E) ou en avertissement (A) ; `—` = aucun visage hors limite. Couches : géométrie, anatomie, style.', ''];
let total = 0, bad = 0;
for (const [style, rows] of Object.entries(out)) {
  const flagged = Object.entries(rows).filter(([, r]) => r.fail + r.warn > 0);
  total += Object.keys(rows).length;
  bad += flagged.length;
  lines.push(`## ${style}`, '');
  if (!flagged.length) { lines.push('Aucun contrôle hors limite.', ''); continue; }
  lines.push('| contrôle | couche | E | A | pire valeur | limite |', '|---|---|---:|---:|---:|---:|');
  for (const [id, r] of flagged.sort((a, b) => b[1].fail * 100 + b[1].warn - (a[1].fail * 100 + a[1].warn))) lines.push(`| ${id} | ${r.layer} | ${r.fail} | ${r.warn} | ${r.worst.toFixed(3)} | ${r.limit} |`);
  lines.push('');
}
lines.push(`Total : ${bad} contrôles hors limite sur ${total} (style × contrôle).`);
writeFileSync(`${dir}/corpus.md`, lines.join('\n') + '\n');
console.log(lines.join('\n'));

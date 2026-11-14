import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodePngRgba } from '../../src/core/png';
import { generateRandomProfile } from '../../src/generation/random-skull';
import { headSpecFromProfile } from '../../src/head-turntable/engines/from-face';
import { vaultRender, type VaultViewId } from '../../src/head-turntable/vault-lab';
import { vaultReport } from '../../src/head-turntable/verify-vault';
import { assessVault } from '../../src/skull/vault-constraints';

/** Richesse de variété : N têtes chauves dont la voûte est TIRÉE (`generateRandomProfile(seed, { vault })`, mesures indépendantes, tendances facultatives). Usage : tsx artefacts-vault-random.ts <dossier> [N, défaut 12] */
const out = process.argv[2] ?? '/tmp/vault', N = Number(process.argv[3] ?? 12), VIEWS: VaultViewId[] = ['face', 'trois_quarts_arriere', 'profil', 'dessus'];
const BALD = { knots: [[0, -1], [180, -1]] as [number, number][] }, rep: Record<string, unknown> = {};
mkdirSync(join(out, 'tiles', 'aleatoire'), { recursive: true }); mkdirSync(join(out, 'verification'), { recursive: true });
for (let seed = 1; seed <= N; seed++) {
  const p = generateRandomProfile(seed, { vault: { variety: 0.9, tendency: 0.5 } }), spec = headSpecFromProfile(p, undefined, BALD);
  for (const v of VIEWS) { const r = vaultRender(spec, v, 300); writeFileSync(join(out, 'tiles', 'aleatoire', `${seed}_${v}.png`), encodePngRgba(r.w, r.h, r.rgba)); }
  rep[seed] = { echecs: vaultReport(spec).flatMap((l) => l.checks.filter((c) => !c.ok).map((c) => c.id)), plausibilite: +assessVault(p.skull).plausibility.toFixed(3), corrections: assessVault(p.skull).corrections.length };
  console.log('graine', seed, JSON.stringify(rep[seed]));
}
writeFileSync(join(out, 'verification', 'aleatoire.json'), JSON.stringify(rep, null, 1));

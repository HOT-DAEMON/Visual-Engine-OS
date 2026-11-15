import { writeFileSync } from 'node:fs';
import { compileScene, generateRandomFace } from '../src';
import { verifyFace } from '../src/verify';
import { rasterPng } from './lib/raster';

/**
 * Preuve visuelle du branchement des archétypes de nez dans le générateur aléatoire : mêmes graines, même visage, SEUL le nez change.
 * 4 graines × 3 colonnes (nez tiré / pyramide / cloche-ailes), moteur par défaut (`classic`). Écrit aussi la synthèse de `verifyFace` sur 24 graines.
 *   npx tsx scripts/artefacts-nose-wiring.ts
 */
const T = (x: number, y: number, s: string, fs = 12, fill = '#222'): string => `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${fs}" fill="${fill}">${s}</text>`;
const head = (seed: number, a: 'pyramide' | 'cloche-ailes' | undefined): string => {
  const F = generateRandomFace(seed, { id: 'f0', noseArchetype: a, transform: { x: 150, y: 215, scale: 0.72 } });
  const r = compileScene({ width: 300, height: 380, background: '#ece6dc', objects: F.objects } as never);
  if (!r.ok) throw new Error(r.issues.join(';'));
  return rasterPng(r.svg).toString('base64');
};
const SEEDS = [11, 77, 405, 1203];
const COLS: [string, 'pyramide' | 'cloche-ailes' | undefined][] = [['nez tiré (comme avant)', undefined], ['pyramide (L/H réf. 0,73)', 'pyramide'], ['cloche-ailes (L/H réf. 0,98)', 'cloche-ailes']];
const parts: string[] = [];
SEEDS.forEach((seed, k) => COLS.forEach(([lab, a], j) => parts.push(`<image x="${j * 300}" y="${40 + k * 395}" width="300" height="380" href="data:image/png;base64,${head(seed, a)}"/>${T(j * 300 + 6, 34 + k * 395, `graine ${seed} · ${lab}`)}`)));
writeFileSync('artefacts/nez-archetypes-generateur/01-tetes-3-colonnes.png', rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${40 + SEEDS.length * 395}"><rect width="100%" height="100%" fill="#ece6dc"/>${T(8, 20, 'Option noseArchetype du générateur aléatoire : mêmes visages, seul le nez change', 14)}${parts.join('')}</svg>`, { fonts: true }));

// Synthèse de la vérification sur 24 graines (erreurs seulement)
const rows: Record<string, unknown>[] = [];
for (let i = 1; i <= 24; i++) {
  const seed = i * 7919;
  for (const a of [undefined, 'pyramide', 'cloche-ailes'] as const) {
    const rep: any = verifyFace(generateRandomFace(seed, { noseArchetype: a }));
    const fails = (rep.checks ?? []).filter((c: any) => !c.ok && c.severity === 'error').map((c: any) => c.id);
    rows.push({ seed, archetype: a ?? 'libre', errors: fails });
  }
}
const byA: Record<string, { faces: number; withErrors: number; ids: Record<string, number> }> = {};
for (const r of rows as any[]) { const b = (byA[r.archetype] ??= { faces: 0, withErrors: 0, ids: {} }); b.faces++; if (r.errors.length) b.withErrors++; for (const id of r.errors) b.ids[id] = (b.ids[id] ?? 0) + 1; }
writeFileSync('artefacts/nez-archetypes-generateur/verify-24-graines.json', JSON.stringify(byA, null, 1));
console.log(JSON.stringify(byA));

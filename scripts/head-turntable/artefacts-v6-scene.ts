import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { compileScene, generateRandomFace } from '../../src';
import { verifyPipeline } from '../../src/verify';

/**
 * Preuve du branchement au pipeline (`kind: 'head_3d'`) : une scène par graine = le visage de face de l'hôte + la MÊME personne en tête 3D à 0°, 45°, 90°, 135° (tangage 10°),
 * et le rapport des 3 couches de vérification de `verifyPipeline`. Usage : tsx artefacts-v6-scene.ts <dossier> [graines, défaut 3,7,42].
 */
const out = process.argv[2] ?? '/tmp/v6/scene', seeds = (process.argv[3] ?? '3,7,42').split(',').map(Number);
mkdirSync(out, { recursive: true });
const summary: Record<string, unknown> = {};
for (const seed of seeds) {
  const f = generateRandomFace(seed, { id: 'f0', transform: { x: 150, y: 215, scale: 0.62 } });
  const heads = [0, 45, 90, 135].map((yaw, i) => ({ kind: 'head_3d', id: `t${i}`, host: 'f0', yaw, pitch: 10, resolution: 2, transform: { x: 410 + i * 215, y: 55, scale: 0.8 } }));
  const sc = { width: 1300, height: 440, background: '#f3efe8', objects: [...f.objects, ...heads] };
  const r = compileScene(sc);
  if (!r.ok) throw new Error(r.issues.join(' ; '));
  writeFileSync(join(out, `scene-seed${seed}.png`), new Resvg(r.svg, { fitTo: { mode: 'width', value: 1300 } }).render().asPng());
  const v = verifyPipeline(sc), mine = v.checks.filter((c) => c.id.startsWith('head3d.t0.'));
  const by = (l: string) => mine.filter((c) => c.layer === l);
  summary[`seed${seed}`] = { ok: v.ok, head3d: { controles: mine.length, parCouche: { geometry: by('geometry').length, anatomy: by('anatomy').length, style: by('style').length }, echecsBloquants: mine.filter((c) => !c.ok && c.severity === 'error').map((c) => c.id), avertissements: mine.filter((c) => !c.ok && c.severity === 'warn').map((c) => ({ id: c.id, valeur: c.value, limite: c.limit })) } };
  console.log('seed', seed, 'ok', v.ok, 'contrôles', mine.length);
}
writeFileSync(join(out, 'verification.json'), JSON.stringify(summary, null, 2));

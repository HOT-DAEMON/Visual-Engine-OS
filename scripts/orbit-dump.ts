import { mkdirSync, writeFileSync } from 'node:fs';
import { compileScene, generateRandomFace } from '../src';

/** Écrit le rendu SVG d'un visage (sans corps) par graine : `tsx scripts/orbit-dump.ts <dossier> <graines,…>` — exécuté sur HEAD (avant) et sur l'arbre corrigé (après). */
const [dir = '/tmp/orbit', list = '1,20,35'] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });
for (const seed of list.split(',').map(Number)) {
  const probe = generateRandomFace(seed, { id: 'p', transform: { x: 0, y: 0, scale: 1 } }).height;
  const s = 400 / probe;
  const f = generateRandomFace(seed, { id: 'f0', transform: { x: 190, y: 235, scale: s } });
  const r = compileScene({ width: 380, height: 470, background: '#e9e4dc', objects: f.objects });
  if (!r.ok) throw new Error(r.issues.join('\n'));
  writeFileSync(`${dir}/${seed}.svg`, r.svg);
}

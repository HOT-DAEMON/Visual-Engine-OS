// Audit reproductible : quels modules du moteur sont ATTEINTS depuis le pipeline principal (src/compile.ts) ? Usage : node scripts/audit-wiring.mjs
import { build } from 'esbuild';
const r = await build({ entryPoints: ['src/compile.ts'], bundle: true, write: false, metafile: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const files = Object.keys(r.metafile.inputs).filter((f) => f.startsWith('src/'));
const dom = {};
for (const f of files) { const d = f.split('/').slice(1, 3).join('/'); const k = f.split('/')[1]; (dom[k] ??= []).push(f); }
console.log('fichiers src atteints depuis compile.ts :', files.length);
for (const k of Object.keys(dom).sort()) console.log(k.padEnd(14), dom[k].length);
const probe = ['src/body/', 'src/skull/', 'src/hair-grammar/', 'src/face/pose/', 'src/relief/', 'src/face/ear/', 'src/face/jaw/', 'src/face/nose/', 'src/face/mouth/', 'src/face/hair/', 'src/face/structure/', 'src/skin/', 'src/appearance/', 'src/contact/', 'src/face/contracts/'];
console.log('--- sondes');
for (const p of probe) console.log(p.padEnd(24), files.filter((f) => f.startsWith(p)).length);

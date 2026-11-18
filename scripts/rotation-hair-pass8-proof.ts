import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { compileScene, type SceneInput } from '../src';
import { hairFace, type CleanStyle } from './lib/hair-faces';

/** Planche de têtes entières posées : `npx tsx scripts/rotation-hair-pass8-proof.ts <dossier> <style:graine,...> <lacets,...>` */
const OUT = process.argv[2] ?? 'artefacts/rotation-hair-pass-8';
const specs = (process.argv[3] ?? 'long:9004').split(',').map((s) => { const [a, b] = s.split(':'); return [a as CleanStyle, Number(b)] as const; });
const yaws = (process.argv[4] ?? '-45,-30,0,30,45').split(',').map(Number);
const name = process.argv[5] ?? 'sheet.png';
mkdirSync(OUT, { recursive: true });
const CELL = 340, scale = 0.7;
const objects: unknown[] = [];
specs.forEach(([style, seed], r) => yaws.forEach((yaw, c) => {
  const f = hairFace(style, 1, { seed, id: `f${r}-${c}`, transform: { x: CELL * (c + 0.5), y: CELL * (r + 0.5) + 6, scale } });
  const host = f.objects[0] as unknown as { face: Record<string, unknown> };
  host.face = { ...host.face, headPose: { yawDeg: yaw } };
  objects.push(...f.objects);
}));
const r = compileScene({ width: CELL * yaws.length, height: CELL * specs.length, background: '#ffffff', objects } as unknown as SceneInput);
if (!r.ok) throw new Error(r.issues.join('\n'));
const labels = specs.flatMap(([s, seed], ri) => yaws.map((y, c) => `<text x="${CELL * c + 8}" y="${CELL * ri + 16}" font-size="13" font-family="monospace" fill="#333">${s} ${seed} · ${y}°</text>`)).join('');
writeFileSync(`${OUT}/${name}`, new Resvg(r.svg.replace('</svg>', `${labels}</svg>`), { fitTo: { mode: 'width', value: CELL * yaws.length * 1.4 }, background: '#ffffff' }).render().asPng() as Buffer);
console.log('ok', `${OUT}/${name}`);

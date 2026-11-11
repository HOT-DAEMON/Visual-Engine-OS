import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileScene, generateRandomFace, SceneSpec } from '../../src';
import { placedEyesByHost } from '../../src/anatomy/placed';
import { encodePngRgba } from '../../src/core/png';
import { head3dSubject, hostEyesOf } from '../../src/render/head-3d';
import { defaultFrame, renderHead } from '../../src/head-turntable';
import { variedHead } from '../../src/head-turntable/engines/from-face';
import { HeadRenders, verifyHeadSubject } from '../../src/head-turntable/verify-head';
import { rasterPng } from '../lib/raster';
import type { HostSpec } from '../../src/schema';

/**
 * Preuves visuelles v7 (sourcils de l'hôte, coupe oblique du cou) : vues BRUTES par arbre de code. Lancé dans l'arbre « avant » (commit 6d1411e) puis dans l'arbre courant ;
 * l'assemblage avant / après est fait par `compose-v7.py`. Usage : tsx artefacts-v7.ts <dossier> [graines d'hôte, défaut 42,77,3,11] [graines de têtes variées, défaut 3,5].
 * Le dessin de face de l'hôte (`face<graine>.png`) vient de `compileScene` : c'est ce que la tête 3D doit retrouver à 0°.
 */
const out = process.argv[2] ?? '/tmp/v7', hosts = (process.argv[3] ?? '42,77,3,11').split(',').map(Number), varied = (process.argv[4] ?? '3,5').split(',').map(Number), H = 520;
mkdirSync(out, { recursive: true });
const png = (name: string, r: { w: number; h: number; rgba: Uint8ClampedArray }): void => writeFileSync(join(out, name), encodePngRgba(r.w, r.h, r.rgba));
const report: Record<string, unknown> = {};
for (const seed of hosts) {
  const f = generateRandomFace(seed, { id: 'f0', transform: { x: 150, y: 220, scale: 0.8 } } as never);
  const sc = SceneSpec.parse({ width: 700, height: 460, objects: [...f.objects, { kind: 'head_3d', id: 't0', host: 'f0', resolution: 1 }] });
  const host = sc.objects.find((o) => o.kind === 'host') as HostSpec, eyes = hostEyesOf(host, placedEyesByHost(sc).get('f0') ?? []);
  const sub = head3dSubject(host, { skull: {}, variation: { ci: 0, axes: {} }, hair: undefined, hairline: 'host' }, undefined, eyes);
  for (const yaw of [0, 35, 70]) png(`h${seed}_y${yaw}.png`, renderHead({ yaw, pitch: 10 }, sub.spec, { frame: defaultFrame(H), ss: 2 }));
  const face = compileScene({ width: 700, height: 460, background: '#ffffff', objects: f.objects } as never) as { ok: boolean; svg: string };
  writeFileSync(join(out, `face${seed}.png`), rasterPng(face.svg, { fitWidth: 700 }));
  const rep = verifyHeadSubject({ id: `h${seed}`, spec: sub.spec, lengthH: sub.lengthH }), all = rep.layers.flatMap((l) => l.checks);
  report[`hote-${seed}`] = { pass: rep.pass, checks: all.length, hardFailures: rep.hardFailures.map((c) => ({ id: c.id, value: c.value })), brows: all.filter((c) => c.id.startsWith('head.host.brow')).map((c) => ({ id: c.id, value: c.value, ok: c.ok })), neckCut: all.filter((c) => c.id.includes('neck.cut')).map((c) => ({ id: c.id, value: c.value, ok: c.ok })) };
}
for (const seed of varied) {
  const h = variedHead(seed);
  for (const pitch of [-45, 0, 25, 45, 60]) for (const yaw of [0, 45, 90]) png(`v${seed}_p${pitch}_y${yaw}.png`, renderHead({ yaw, pitch }, h.spec, { frame: defaultFrame(H), ss: 2 }));
  const rep = verifyHeadSubject({ id: `v${seed}`, spec: h.spec, lengthH: h.profile.derivation.lengthH }, new HeadRenders(h.spec)), all = rep.layers.flatMap((l) => l.checks);
  report[`tete-${seed}`] = { pass: rep.pass, checks: all.length, hardFailures: rep.hardFailures.map((c) => ({ id: c.id, value: c.value })), neckCut: all.filter((c) => c.id.includes('neck.cut')).map((c) => ({ id: c.id, value: c.value, ok: c.ok })) };
}
writeFileSync(join(out, 'rapport.json'), JSON.stringify(report, null, 1));
console.log('ok', hosts.length, 'hôtes', varied.length, 'têtes');

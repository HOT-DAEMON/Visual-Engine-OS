import { writeFileSync, mkdirSync } from 'node:fs';
import { head3dSubject } from '../src/render/head-3d';
import { hostOf } from './nose-refs/alar-overflow';
import { defaultFrame, renderHead } from '../src/head-turntable';
import { lightModelOfSpec, patternById } from '../src/relief';
import { rasterPng } from './lib/raster';

/**
 * Preuves visuelles de la continuité du terminateur sur l'aile PROCHE (docs/NOSE-ALAR-SPOT-2.md). Pour l'état du code courant, écrit dans `<dossier>` :
 *  - `zoom-<étiquette>.png` : nez ×3, têtes rasées, 3 archétypes × 2 graines (lignes) × lacet 30 / 45 / 60° (colonnes) ;
 *  - `tete-<étiquette>.png` : têtes COMPLÈTES avec cheveux, 2 graines × lacet 0 / 30 / 45 / 60 / 70°.
 * Le « avant » se produit avant la modification de `src` (ou en stashant `nose-light.ts` et `paint.ts`). Usage : `npx tsx scripts/artefacts-nose-alar-spot2.ts artefacts/nez-aile-tache-2 avant|apres`.
 */
const q = patternById('three-quarter-right'), lit = { style: q.style, shadowHue: q.shadowHue, bias: q.bias, light: { azimuthDeg: q.azimuthDeg, elevationDeg: q.elevationDeg, shadowHardness: q.hardness, sourceSize: q.sourceSize } };
const light = lightModelOfSpec({} as never, lit as never), H = 420, frame = defaultFrame(H), W = frame.w;
const seeds = [11, 1203] as const, archs = ['pyramide', 'cloche-ailes', 'plat-trapeze'] as const, inner = (svg: string): string => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
const out = process.argv[2] ?? 'artefacts/nez-aile-tache-2', label = process.argv[3] ?? 'apres'; mkdirSync(out, { recursive: true });

function zoomBoard(yaws: readonly number[]): Buffer {
  const ZW = 150, ZH = 110, cells: string[] = [];
  archs.forEach((arch, a) => seeds.forEach((seed, i) => yaws.forEach((yaw, j) => {
    const sub = head3dSubject(hostOf(seed, arch), {} as never), spec = sub.spec as typeof sub.spec & { hairVolume?: unknown }, { hairVolume: _h, ...b } = spec, use = b as typeof sub.spec;
    const r = renderHead({ yaw, pitch: 0 }, use, { frame, ss: 2, background: '#ece6dc', light }), x = j * ZW, y = (a * seeds.length + i) * ZH;
    const kn = use.nose.knots, tip = kn.reduce((m, p) => (p[1] > m[1] ? p : m), kn[0]!), th = (yaw * Math.PI) / 180;
    const cx = r.originX - tip[1] * Math.sin(th) * r.ppu - ZW / 2, cy = r.originY + use.nose.baseY * r.ppu - ZH * 0.62;
    cells.push(`<svg x="${x}" y="${y}" width="${ZW}" height="${ZH}" viewBox="${cx} ${cy} ${ZW} ${ZH}">${inner(r.svg)}</svg>`);
  })));
  const w = ZW * yaws.length, h = ZH * seeds.length * archs.length;
  return rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#ece6dc"/>${cells.join('')}</svg>`, { fitWidth: w * 3 });
}
function headBoard(yaws: readonly number[]): Buffer {
  const cells: string[] = [];
  seeds.forEach((seed, i) => yaws.forEach((yaw, j) => {
    const sub = head3dSubject(hostOf(seed, 'pyramide'), {} as never), r = renderHead({ yaw, pitch: 0 }, sub.spec, { frame, ss: 2, background: '#ece6dc', light });
    cells.push(`<svg x="${j * W}" y="${i * H}" width="${W}" height="${H}">${inner(r.svg)}</svg>`);
  }));
  const w = W * yaws.length, h = H * seeds.length;
  return rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#ece6dc"/>${cells.join('')}</svg>`);
}
writeFileSync(`${out}/zoom-${label}.png`, zoomBoard([30, 45, 60]));
writeFileSync(`${out}/tete-${label}.png`, headBoard([0, 30, 45, 60, 70]));
console.log('écrit', out, label);

import { writeFileSync } from 'node:fs';
import { head3dSubject } from '../src/render/head-3d';
import { hostOf } from './nose-refs/alar-overflow';
import { defaultFrame, renderHead } from '../src/head-turntable';
import { ALA_CONTOUR_BOUNDS, ALA_TOL_45, type ContourBound } from '../src/head-turntable/nose-contour';
import { lightModelOfSpec, patternById } from '../src/relief';
import { rasterPng } from './lib/raster';

/**
 * Preuve visuelle de la borne du 45° (docs/NOSE-YAW45.md) : têtes 3D rasées éclairées (même lumière que les autres planches du nez), 3 nez × lacets 0° et 45°, AVANT (contrainte à 30° seule) / DÉFAUT (30° + 45° rappel plafonné 0,25) / PLEIN (45° rappel jusqu'à 0,6) ; colonnes : 0° avant, défaut, plein, puis 45° avant, défaut, plein.
 * Sorties : <dossier>/planche-tetes.png (grille) et <dossier>/planche-zoom.png (nez ×3.2). Usage : `npx tsx scripts/artefacts-nose-yaw45.ts artefacts/nez-45deg`
 */
const q = patternById('three-quarter-right'), lit = { style: q.style, shadowHue: q.shadowHue, bias: q.bias, light: { azimuthDeg: q.azimuthDeg, elevationDeg: q.elevationDeg, shadowHardness: q.hardness, sourceSize: q.sourceSize } };
const light = lightModelOfSpec({} as never, lit as never), H = 420, frame = defaultFrame(H);
const rows = [[77, 'plat-trapeze'], [11, 'pyramide'], [1203, 'cloche-ailes']] as const, yaws = [0, 45] as const, states = ['avant', 'defaut', 'plein'] as const;
const def = ALA_CONTOUR_BOUNDS.map((b) => ({ ...b })), only30: ContourBound[] = [def[0]!], plein: ContourBound[] = [def[0]!, { ...def[1]!, maxPull: 0.6 }];
const setBounds = (st: 'avant' | 'defaut' | 'plein'): void => { const arr = ALA_CONTOUR_BOUNDS as ContourBound[]; arr.length = 0; arr.push(...(st === 'avant' ? only30 : st === 'plein' ? plein : def)); };
const cells: string[] = [], zooms: string[] = [], W = frame.w, ZW = 150, ZH = 110;
rows.forEach(([seed, a], i) => yaws.forEach((yaw, j) => states.forEach((st, k) => {
  setBounds(st);
  const { spec } = head3dSubject(hostOf(seed, a), {} as never), { hairVolume: _h, ...bald } = spec as typeof spec & { hairVolume?: unknown };
  const r = renderHead({ yaw, pitch: 0 }, bald as typeof spec, { frame, ss: 2, background: '#ece6dc', light });
  const x = (j * 3 + k) * W, y = i * H, tip = { x: r.originX + (bald as typeof spec).nose.alaX * 0 , y: r.originY + (bald as typeof spec).nose.baseY * r.ppu };
  cells.push(`<svg x="${x}" y="${y}" width="${W}" height="${H}">${r.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg><rect x="${x}" y="${y}" width="${W}" height="${H}" fill="none" stroke="#999" stroke-width="0.5"/>`);
  const zx = (j * 3 + k) * ZW, cx = r.originX - (yaw ? 0.1 * r.ppu : 0) - ZW / 2 + (yaw ? 0 : 0), cy = tip.y - ZH * 0.62;
  zooms.push(`<svg x="${zx}" y="${i * ZH * 3.2 / 3.2}" width="${ZW}" height="${ZH}" viewBox="${cx} ${cy} ${ZW} ${ZH}">${r.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg>`);
  if (i === 0) console.log('ok', a, yaw, st);
})));
setBounds('defaut'); void ALA_TOL_45;
const out = process.argv[2] ?? 'artefacts/nez-45deg';
writeFileSync(`${out}/planche-tetes.png`, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${W * 6}" height="${H * 3}"><rect width="100%" height="100%" fill="#ece6dc"/>${cells.join('')}</svg>`));
writeFileSync(`${out}/planche-zoom.png`, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${ZW * 6}" height="${ZH * 3}"><rect width="100%" height="100%" fill="#ece6dc"/>${zooms.join('')}</svg>`, { fitWidth: ZW * 6 * 3 }));
console.log('écrit', out);

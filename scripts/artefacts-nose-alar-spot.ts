import { writeFileSync, mkdirSync } from 'node:fs';
import { head3dSubject } from '../src/render/head-3d';
import { hostOf } from './nose-refs/alar-overflow';
import { defaultFrame, renderHead } from '../src/head-turntable';
import { lightModelOfSpec, patternById } from '../src/relief';
import { rasterPng } from './lib/raster';

/**
 * Preuve visuelle de la tache claire de l'aile proche (docs/NOSE-ALAR-SPOT.md). Écrit, pour l'état du code courant, `<dossier>/zoom-<étiquette>.png` (nez ×3, têtes rasées, lacet 30/45/60°, 2 pyramides)
 * et `<dossier>/tete-<étiquette>.png` (têtes COMPLÈTES avec cheveux, lacet 0° et 45°, mêmes graines). Le « avant » se produit en stashant les deux fichiers de src : voir la doc. Usage : `npx tsx scripts/artefacts-nose-alar-spot.ts artefacts/nez-aile-tache avant|apres`.
 */
const q = patternById('three-quarter-right'), lit = { style: q.style, shadowHue: q.shadowHue, bias: q.bias, light: { azimuthDeg: q.azimuthDeg, elevationDeg: q.elevationDeg, shadowHardness: q.hardness, sourceSize: q.sourceSize } };
const light = lightModelOfSpec({} as never, lit as never), H = 420, frame = defaultFrame(H), W = frame.w;
const seeds = [11, 1203] as const, inner = (svg: string): string => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
const out = process.argv[2] ?? 'artefacts/nez-aile-tache', label = process.argv[3] ?? 'apres'; mkdirSync(out, { recursive: true });

function board(zoom: boolean, yaws: readonly number[]): Buffer {
  const ZW = 150, ZH = 110, cw = zoom ? ZW : W, ch = zoom ? ZH : H, cells: string[] = [];
  seeds.forEach((seed, i) => yaws.forEach((yaw, j) => {
    const sub = head3dSubject(hostOf(seed, 'pyramide'), {} as never), spec = sub.spec as typeof sub.spec & { hairVolume?: unknown }, { hairVolume: _h, ...b } = spec, use = (zoom ? b : spec) as typeof sub.spec;
    const r = renderHead({ yaw, pitch: 0 }, use, { frame, ss: 2, background: '#ece6dc', light }), x = j * cw, y = i * ch;
    if (!zoom) { cells.push(`<svg x="${x}" y="${y}" width="${W}" height="${H}">${inner(r.svg)}</svg>`); return; }
    const kn = use.nose.knots, tip = kn.reduce((m, p) => (p[1] > m[1] ? p : m), kn[0]!), th = (yaw * Math.PI) / 180;
    const cx = r.originX - tip[1] * Math.sin(th) * r.ppu - ZW / 2, cy = r.originY + use.nose.baseY * r.ppu - ZH * 0.62;
    cells.push(`<svg x="${x}" y="${y}" width="${ZW}" height="${ZH}" viewBox="${cx} ${cy} ${ZW} ${ZH}">${inner(r.svg)}</svg>`);
  }));
  const w = cw * yaws.length, h = ch * seeds.length;
  return rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#ece6dc"/>${cells.join('')}</svg>`, zoom ? { fitWidth: w * 3 } : undefined);
}
writeFileSync(`${out}/zoom-${label}.png`, board(true, [30, 45, 60]));
writeFileSync(`${out}/tete-${label}.png`, board(false, [0, 45]));
console.log('écrit', out, label);

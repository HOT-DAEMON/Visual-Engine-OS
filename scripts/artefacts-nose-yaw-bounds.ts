import { writeFileSync, mkdirSync } from 'node:fs';
import { head3dSubject } from '../src/render/head-3d';
import { hostOf } from './nose-refs/alar-overflow';
import { defaultFrame, renderHead } from '../src/head-turntable';
import { alaOf, alaSeat } from '../src/head-turntable/parts';
import { ALA_CONTOUR_BOUNDS, alaOverflow, type ContourBound } from '../src/head-turntable/nose-contour';
import { lightModelOfSpec, patternById } from '../src/relief';
import { rasterPng } from './lib/raster';

/**
 * Preuve visuelle des bornes 45°/60°/70° et du levier d'enfoncement (docs/NOSE-YAW-BOUNDS.md). Têtes 3D éclairées (même lumière que les autres planches du nez), 3 nez ; pour chaque lacet 0/45/60/70° : AVANT (commit f5d0ce2 : 30° + 45° rappel ≤ 0,25) puis ACTUEL.
 * Sorties : <dossier>/planche-tetes.png (têtes rasées), planche-zoom.png (nez ×3, débordement calculé écrit sous chaque case), tete-complete.png (têtes AVEC cheveux). Usage : `npx tsx scripts/artefacts-nose-yaw-bounds.ts artefacts/nez-bornes-60-70 [tetes|zoom|complete]`
 */
const q = patternById('three-quarter-right'), lit = { style: q.style, shadowHue: q.shadowHue, bias: q.bias, light: { azimuthDeg: q.azimuthDeg, elevationDeg: q.elevationDeg, shadowHardness: q.hardness, sourceSize: q.sourceSize } };
const light = lightModelOfSpec({} as never, lit as never), H = 420, frame = defaultFrame(H), W = frame.w;
const rows = [[77, 'plat-trapeze'], [11, 'pyramide'], [1203, 'cloche-ailes']] as const, yaws = [0, 45, 60, 70] as const, states = ['avant', 'actuel'] as const;
const bounds = ALA_CONTOUR_BOUNDS as ContourBound[], DEF = bounds.map((b) => ({ ...b })), setState = (st: 'avant' | 'actuel'): void => { bounds.length = 0; bounds.push(...(st === 'avant' ? [DEF[0]!, { ...DEF[1]!, maxEmbed: 0 }] : DEF)); };
const inner = (svg: string): string => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
const fmt = (x: number): string => x.toFixed(3).replace('.', ',');
const out = process.argv[2] ?? 'artefacts/nez-bornes-60-70'; mkdirSync(out, { recursive: true });

function board(bald: boolean, zoom: boolean, list: ReadonlyArray<readonly [number, string]>): Buffer {
  const ZW = 150, ZH = 110, cw = zoom ? ZW : W, ch = zoom ? ZH + 14 : H, cells: string[] = [];
  list.forEach(([seed, a], i) => yaws.forEach((yaw, j) => states.forEach((st, k) => {
    setState(st);
    const sub = head3dSubject(hostOf(seed, a), {} as never), spec = sub.spec as typeof sub.spec & { hairVolume?: unknown };
    const { hairVolume: _h, ...b } = spec, use = (bald ? b : spec) as typeof sub.spec;
    const r = renderHead({ yaw, pitch: 0 }, use, { frame, ss: 2, background: '#ece6dc', light }), x = (j * 2 + k) * cw, y = i * ch;
    if (!zoom) { cells.push(`<svg x="${x}" y="${y}" width="${W}" height="${H}">${inner(r.svg)}</svg><rect x="${x}" y="${y}" width="${W}" height="${H}" fill="none" stroke="#999" stroke-width="0.5"/>`); return; }
    const kn = use.nose.knots, tipZ = kn.reduce((m, p) => (p[1] > m[1] ? p : m), kn[0]!), th = (yaw * Math.PI) / 180;
    const cx = r.originX + (-tipZ[1] * Math.sin(th)) * r.ppu - ZW / 2, cy = r.originY + use.nose.baseY * r.ppu - ZH * 0.62, ov = alaOverflow(use, alaOf(use, -1), yaw), s = alaSeat(use);
    cells.push(`<svg x="${x}" y="${y}" width="${ZW}" height="${ZH}" viewBox="${cx} ${cy} ${ZW} ${ZH}">${inner(r.svg)}</svg><text x="${x + 4}" y="${y + ZH + 10}" font-family="monospace" font-size="8" fill="#333">${yaw}° ${st} déb ${fmt(ov)} · enf ${s.embed.toFixed(2)}</text>`);
  })));
  setState('actuel');
  const w = cw * 8, h = ch * list.length;
  return rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#ece6dc"/>${cells.join('')}</svg>`, zoom ? { fitWidth: w * 3 } : undefined);
}
const which = process.argv[3] ?? 'tout';   // tetes | zoom | complete | tout (une planche par appel si la machine est lente)
if (which === 'tetes' || which === 'tout') writeFileSync(`${out}/planche-tetes.png`, board(true, false, rows));
if (which === 'zoom' || which === 'tout') writeFileSync(`${out}/planche-zoom.png`, board(true, true, rows));
if (which === 'complete' || which === 'tout') writeFileSync(`${out}/tete-complete.png`, board(false, false, [rows[0]!, rows[1]!]));
console.log('écrit', out);

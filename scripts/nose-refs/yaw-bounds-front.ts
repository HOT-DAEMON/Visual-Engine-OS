import { writeFileSync } from 'node:fs';
import { head3dSubject } from '../../src/render/head-3d';
import { hostOf } from './alar-overflow';
import { buildParts, defaultFrame } from '../../src/head-turntable';
import { rasterize } from '../../src/head-turntable/raster';
import { ALA_CONTOUR_BOUNDS, type ContourBound } from '../../src/head-turntable/nose-contour';

/** Coût de l'enfoncement sur la vue de FACE (lacet 0) : part des pixels de la bande du nez dont l'identifiant de pièce ou la profondeur (> 0,002 U) change entre AVANT (45° sans enfoncement, rien à 60°/70°) et ACTUEL.
 * Usage : `npx tsx scripts/nose-refs/yaw-bounds-front.ts` → artefacts/nez-bornes-60-70/face-cout.json */
const bounds = ALA_CONTOUR_BOUNDS as ContourBound[], DEF = bounds.map((b) => ({ ...b })), F = defaultFrame(300), out: Record<string, unknown> = {};
for (const t of [undefined, 'pyramide', 'cloche-ailes', 'plat-trapeze'] as const) {
  const fr: number[] = [], idc: number[] = [];
  for (let k = 0; k < 8; k++) {
    const s = head3dSubject(hostOf(500 + k * 37, t), {} as never).spec, mk = (st: 'a' | 'b') => { bounds.length = 0; bounds.push(...(st === 'a' ? [DEF[0]!, { ...DEF[1]!, maxEmbed: 0 }] : DEF)); return rasterize(buildParts(s), { yaw: 0, pitch: 0 }, F); };
    const a = mk('a'), b = mk('b'), ys = s.nose.knots.map((q) => q[0]), j0 = Math.round(F.oy + Math.min(...ys) * F.ppu), j1 = Math.round(F.oy + Math.max(...ys) * F.ppu);
    let n = 0, d = 0, di = 0; for (let j = j0; j <= j1; j++) for (let i = 0; i < F.w; i++) { const p = j * F.w + i; if (!a.id[p] && !b.id[p]) continue; n++; if (a.id[p] !== b.id[p]) di++; if (Math.abs((a.depth[p]! - b.depth[p]!) / F.ppu) > 0.002) d++; }
    fr.push(d / n); idc.push(di / n);
  }
  bounds.length = 0; bounds.push(...DEF);
  const m = (x: number[]): number => +(x.reduce((u, v) => u + v, 0) / x.length).toFixed(4);
  out[t ?? 'libre'] = { part_profondeur_changee_moy: m(fr), max: +Math.max(...fr).toFixed(4), part_identifiants_changes_moy: m(idc) }; console.log(t ?? 'libre', JSON.stringify(out[t ?? 'libre']));
}
writeFileSync('artefacts/nez-bornes-60-70/face-cout.json', JSON.stringify(out, null, 1));

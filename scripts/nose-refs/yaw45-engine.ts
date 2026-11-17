import { writeFileSync } from 'node:fs';
import { head3dSubject } from '../../src/render/head-3d';
import { hostOf } from './alar-overflow';
import { defaultFrame, renderHead, refView } from '../../src/head-turntable';
import type { HeadTurnSpec } from '../../src/head-turntable';

/**
 * Saillie du nez au contour lointain à 45° CÔTÉ MOTEUR, mesurée avec le MÊME estimateur que la planche (`scripts/nose-refs/yaw45-ref.py`) :
 * contour gauche du tampon d'identifiants (tête RASÉE : `hairVolume` retiré), vue de la planche (`refView` : lacet + tangage ajusté 17,73°), 1 U = ppu px,
 * t = (rangée − sommet) / ppu, corde entre deux ancres (ta ∈ {0,50 ; 0,54 ; 0,58}, tb ∈ {0,70 ; 0,72 ; 0,74}), saillie = max de l'écart contour/corde sur ]ta, tb[.
 * `exact` = même tête avec le nez réduit à un fil (différence de rendus, comme `alar-overflow.ts`) : donne le biais de l'estimateur.
 * Reproduire : `npx tsx scripts/nose-refs/yaw45-engine.ts` → artefacts/nez-45deg/engine.json
 */
const TAS = [0.5, 0.54, 0.58], TBS = [0.7, 0.72, 0.74], PPU_H = 300;
const bare = (s: HeadTurnSpec): HeadTurnSpec => ({ ...s, nose: { ...s.nose, knots: s.nose.knots.map(([y, z]) => [y, z, 0.0005] as const), alaX: 0.0001 } });
const nohair = (s: HeadTurnSpec): HeadTurnSpec => { const { hairVolume: _h, ...r } = s as HeadTurnSpec & { hairVolume?: unknown }; return r as HeadTurnSpec; };
type R = ReturnType<typeof renderHead>;
const leftContour = (r: R): (number | undefined)[] => { const L: (number | undefined)[] = []; for (let j = 0; j < r.h; j++) { for (let i = 0; i < r.w; i++) if (r.ids[j * r.w + i]) { L[j] = i; break; } } return L; };
const topRow = (L: (number | undefined)[]): number => L.findIndex((v) => v !== undefined);
function chordBump(L: (number | undefined)[], ppu: number, ta: number, tb: number): number {
  const top = topRow(L), ya = top + ta * ppu, yb = top + tb * ppu, at = (y: number): number => { const j = Math.round(y); return L[j] ?? NaN; };
  const xa = at(ya), xb = at(yb); let best = 0;
  for (let y = Math.round(ya) + 1; y < Math.round(yb); y++) { const x = L[y]; if (x === undefined) continue; best = Math.max(best, (xa + ((xb - xa) * (y - ya)) / (yb - ya) - x) / ppu); }
  return best;
}
export function bumps(spec: HeadTurnSpec, yaw: number): { chord: number[]; exact: number } {
  const frame = defaultFrame(Math.round(1.75 * PPU_H)), v = refView(yaw), s = nohair(spec);
  const a = renderHead(v, s, { frame, ss: 1 }), b = renderHead(v, nohair(bare(spec)), { frame, ss: 1 });
  const La = leftContour(a), Lb = leftContour(b); let exact = 0;
  for (let j = 0; j < a.h; j++) if (La[j] !== undefined && Lb[j] !== undefined) exact = Math.max(exact, (Lb[j]! - La[j]!) / a.ppu);
  return { chord: TAS.flatMap((ta) => TBS.map((tb) => chordBump(La, a.ppu, ta, tb))), exact };
}
const q = (xs: number[], p: number): number => [...xs].sort((x, y) => x - y)[Math.min(xs.length - 1, Math.floor(p * xs.length))]!, r4 = (x: number): number => +x.toFixed(4);
if (process.argv[1]?.endsWith('yaw45-engine.ts')) {
  const N = Number(process.env.N ?? 40), out: Record<string, unknown> = {};
  for (const a of [undefined, 'pyramide', 'cloche-ailes', 'plat-trapeze'] as const) {
    const rows = Array.from({ length: N }, (_, k) => bumps(head3dSubject(hostOf(500 + k * 37, a), {} as never).spec, 45));
    const med = rows.map((x) => q(x.chord, 0.5)), ex = rows.map((x) => x.exact);
    const row = { corde: { min: r4(Math.min(...med)), med: r4(q(med, 0.5)), max: r4(Math.max(...med)) }, exact: { min: r4(Math.min(...ex)), med: r4(q(ex, 0.5)), max: r4(Math.max(...ex)) } };
    out[a ?? 'libre'] = row; console.log(String(a ?? 'libre').padEnd(13), JSON.stringify(row));
  }
  writeFileSync('artefacts/nez-45deg/engine.json', JSON.stringify(out, null, 1));
}

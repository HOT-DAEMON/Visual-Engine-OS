import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultFrame, refView, renderHead, sectionAt, sectionPoint } from '../../src/head-turntable';
import { encodePngRgba } from '../../src/core/png';
import { variedHead } from '../../src/head-turntable/engines/from-face';
import { SKULL_SHAPE } from '../../src/head-turntable/engines/skull-model';
import { HeadRenders, verifyHeadSubject } from '../../src/head-turntable/verify-head';
import type { HeadTurnSpec } from '../../src/head-turntable';

/**
 * Artefacts du modèle de coupe du crâne : rendus AVANT (coupes elliptiques : les rangées sans champs de forme au-dessus de la mâchoire) et APRÈS (modèle), tirés du MÊME arbre ;
 * contours des coupes vues de dessus ; diversité des silhouettes entre graines ; verdicts. Usage : tsx artefacts-skull.ts <dossier> [graines] [hauteurPx]
 */
const out = process.argv[2] ?? '/tmp/artefacts-skull', seeds = (process.argv[3] ?? '1,2,3,4,5,6').split(',').map(Number), H = Number(process.argv[4] ?? 500);
const YAWS = [0, 20, 45, 70, 90, 110, 135, 160, 180], LEVELS = [0.15, 0.3, 0.5, 0.65];
for (const d of ['avant', 'apres']) mkdirSync(join(out, d), { recursive: true });
/** Spec d'origine : mêmes rangées, mais les coupes au-dessus de la mâchoire redeviennent des ellipses (comportement d'avant le modèle). */
const ellipse = (s: HeadTurnSpec): HeadTurnSpec => ({ ...s, rows: s.rows.map((r) => (r.y < 0.76 ? { y: r.y, a: r.a, zf: r.zf, zb: r.zb } : r)) });
const mask = (r: { w: number; rgba: Uint8ClampedArray }, rowsMax: number): Uint8Array => { const m = new Uint8Array(r.w * rowsMax); for (let i = 0; i < r.w * rowsMax; i++) { const o = i * 4; m[i] = r.rgba[o + 3]! > 128 && !(r.rgba[o]! > 245 && r.rgba[o + 1]! > 245 && r.rgba[o + 2]! > 245) ? 1 : 0; } return m; };
const diversity = (ms: Uint8Array[]): number => { let s = 0, n = 0; for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) { let x = 0, u = 0; for (let k = 0; k < ms[i]!.length; k++) { const a = ms[i]![k]!, b = ms[j]![k]!; x += a ^ b; u += a | b; } s += x / Math.max(1, u); n++; } return s / n; };
const heads = seeds.map((s) => ({ seed: s, v: variedHead(s) }));
const metrics: Record<string, unknown> = { shape: SKULL_SHAPE, seeds, diversite_silhouettes_xor_union: {} as Record<string, { avant: number; apres: number }>, sections: {} as Record<string, unknown>, verification: {} as Record<string, unknown> };
const div = metrics.diversite_silhouettes_xor_union as Record<string, { avant: number; apres: number }>;
for (const yaw of YAWS) {
  const A: Uint8Array[] = [], B: Uint8Array[] = [];
  for (const { seed, v } of heads) for (const [tag, spec, acc] of [['avant', ellipse(v.spec), A], ['apres', v.spec, B]] as const) {
    const r = renderHead(refView(yaw), spec, { frame: defaultFrame(H), ss: 2 }); mkdirSync(join(out, tag, `seed${seed}`), { recursive: true });
    writeFileSync(join(out, tag, `seed${seed}`, `yaw_${yaw}.png`), encodePngRgba(r.w, r.h, r.rgba)); acc.push(mask(r, Math.floor(r.h * 0.66)));
  }
  div[String(yaw)] = { avant: +diversity(A).toFixed(4), apres: +diversity(B).toFixed(4) };
}
const sec: Record<string, unknown> = {};
for (const { seed, v } of heads) {
  const o: Record<string, unknown> = {};
  for (const y of LEVELS) {
    const s = sectionAt(v.spec, y), pts = (sp: typeof s): number[][] => Array.from({ length: 96 }, (_, k) => { const q = sectionPoint(sp, (k / 96) * 2 * Math.PI); return [+q.x.toFixed(4), +q.z.toFixed(4)]; });
    const e = sectionAt(ellipse(v.spec), y);
    o[String(y)] = { apres: pts(s), avant: pts(e), pf: +s.pf.toFixed(3), qf: +s.qf.toFixed(3), pb: +(s.pb ?? 2).toFixed(3), qb: +(s.qb ?? 2).toFixed(3), wf: +((s.zw - s.zb) / (s.zf - s.zb)).toFixed(3) };
  }
  sec[`seed${seed}`] = o;
}
metrics.sections = sec;
for (const { seed, v } of heads) { const rep = verifyHeadSubject({ id: `seed${seed}`, spec: v.spec, lengthH: v.profile.derivation.lengthH }, new HeadRenders(v.spec, 420)); const all = rep.layers.flatMap((l) => l.checks); (metrics.verification as Record<string, unknown>)[`seed${seed}`] = { pass: rep.pass, controles: all.length, echecs_bloquants: rep.hardFailures.map((c) => `${c.id}=${c.value}`), skull: all.filter((c) => c.id.includes('skull')).map((c) => ({ id: c.id, value: c.value, min: c.min, max: c.max, ok: c.ok, kind: c.kind })) }; }
writeFileSync(join(out, 'metrics.json'), JSON.stringify(metrics, null, 1));
console.log(JSON.stringify(div));

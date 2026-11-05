import { generateRandomFace, SceneSpec } from '../src';
import { faceRelations } from '../src/anatomy/face-relations';
import { placedEyesByHost } from '../src/anatomy/placed';
import { publishedOrbits } from '../src/anatomy/orbit';
import { hostFace } from '../src/render/face';
import { noseGeometry } from '../src/face';
import type { HostSpec } from '../src/schema';

/** Mesure les relations du visage sur N graines : par relation, échecs / total, min–médiane–max de la valeur. `tsx scripts/relations-measure.ts [N]` */
const N = Number(process.argv[2] ?? 200);
const stat = new Map<string, { n: number; fail: number; v: number[]; limit: number; cmp: string; sev: string; kind: string }>();
for (let seed = 1; seed <= N; seed++) {
  const sc = SceneSpec.parse({ width: 640, height: 900, objects: generateRandomFace(seed, { id: 'f0', transform: { x: 0, y: 0, scale: 1 } }).objects });
  const host = sc.objects.find((o) => o.kind === 'host') as HostSpec;
  const { params, lm } = hostFace(host);
  const pub = publishedOrbits(lm, placedEyesByHost(sc).get('f0') ?? []);
  for (const r of faceRelations(params, lm, noseGeometry(params, lm), pub)) {
    const id = r.id.replace(/\.(left|right)$/, ''), s = stat.get(id) ?? { n: 0, fail: 0, v: [], limit: r.limit, cmp: r.cmp, sev: r.severity, kind: r.kind };
    s.n++; s.v.push(r.value); if (!Number.isFinite(r.value) || (r.cmp === '<=' ? r.value > r.limit : r.value < r.limit)) s.fail++;
    stat.set(id, s);
  }
}
for (const [id, s] of [...stat].sort()) {
  const v = [...s.v].sort((a, b) => a - b), q = (f: number): string => (v[Math.floor(f * (v.length - 1))] as number).toFixed(3);
  console.log(`${id.padEnd(38)} ${s.kind.padEnd(10)} ${s.sev.padEnd(5)} fail ${String(s.fail).padStart(3)}/${String(s.n).padEnd(3)} limite ${s.cmp} ${s.limit}  min ${q(0)}  méd ${q(0.5)}  max ${q(1)}`);
}

import { Resvg } from '@resvg/resvg-js';
import { performance } from 'node:perf_hooks';
import { compileScene } from '../src';

/** Banc des yeux : temps de compilation (médiane) et de rastérisation (médiane) par configuration, + poids et nombre de filtres. */
const W = 1024, H = 768;
const scene = (eye: object) => ({ width: W, height: H, background: '#2b2f3f', objects: [{ kind: 'eye', id: 'e', seed: 4, transform: { x: W / 2, y: H / 2 }, shape: { width: 700, height: 400 }, ...eye }] });
const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] as number;
const FULL = {
  iris: { layers: [{ color: '#2a6fdb' }, { color: '#e0b030', mask: 'ring', inner: 0.15, outer: 0.45, irregularity: 0.5 }, { color: '#33d6c4', mask: 'half', glow: 0.5 }] },
  highlights: { list: [{ shape: 'star', anchor: 'iris', x: 0.3, y: -0.3, softness: 0.3, intensity: 0.5 }, { kind: 'reflection' }] },
  microdetail: { vessels: { density: 0.8 }, imperfections: 3 },
  pupil: { shape: 'star', edge: { softness: 0.4 } },
  appearance: { glow: { intensity: 0.4 }, bloom: { intensity: 0.3 } },
  headTurn: { model: 'sphere', yawDeg: 25, azimuthDeg: 22 },
};
const configs: [string, object][] = [['défaut', {}], ['défaut+microdétail', { microdetail: {} }], ['complet', FULL]];
export function runBench(reps = 7): { name: string; compileMs: number; rasterMs: number; kb: number; filters: number }[] {
  return configs.map(([name, eye]) => {
    const c: number[] = [], r: number[] = [];
    let svg = '';
    for (let i = 0; i < reps; i++) {
      const t0 = performance.now();
      const res = compileScene(scene(eye) as never);
      if (!res.ok) throw new Error(res.issues.join());
      svg = res.svg;
      const t1 = performance.now();
      new Resvg(svg).render().asPng();
      r.push(performance.now() - t1);
      c.push(t1 - t0);
    }
    return { name, compileMs: +med(c).toFixed(1), rasterMs: +med(r).toFixed(1), kb: +(svg.length / 1024).toFixed(1), filters: (svg.match(/<filter /g) ?? []).length };
  });
}
if (process.argv[1]?.endsWith('bench-eyes.ts')) console.table(runBench());

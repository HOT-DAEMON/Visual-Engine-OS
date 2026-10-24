import { Resvg } from '@resvg/resvg-js';
import { compileScene } from '../src';
import { faceLandmarks, hairGeometry } from '../src/face';
import { layout } from './lib/proof';

/**
 * Mesure PAR ÉTAPE du coût d'un visage chevelu : géométrie des cheveux, compilation SVG, rastérisation (resvg).
 * `npx tsx scripts/bench-hair-sim.ts` — médiane de plusieurs passes ; taille du SVG et nombre de mèches.
 */
const CEL = { shading: { mode: 'cel', bands: 3, highlightBand: 0.6, castShadow: 0.8 } };
const hair = (sim: object) => ({ style: 'short', texture: 'straight', fringe: 'none', color: '#23232b', seed: 5, volume: 0.5, density: 0.85, part: 0.2, appearance: CEL, sim }) as never;
const med = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] as number;
const time = (n: number, f: () => void): number => { const t: number[] = []; for (let i = 0; i < n; i++) { const s = performance.now(); f(); t.push(performance.now() - s); } return med(t); };
const cases: [string, object][] = [['classique', { enabled: false }], ['sim (défaut)', { enabled: true, archetype: 'messy_bangs' }], ['sim sans brins fins', { enabled: true, archetype: 'messy_bangs', strandsPerPacket: 0 }]];
const out: Record<string, unknown>[] = [];
for (const [label, sim] of cases) {
  const L = layout(1, 1, 600, 700, 1, () => ({ seed: 321, opts: { identity: 3, hairEngine: 'classic', hair: hair(sim), facialHair: { mustache: 'none', beard: 'none' } } as never }));
  const { face, lm } = L.cells[0]!;
  const lm2 = faceLandmarks(face.params, face.width, face.height);
  let g = null as ReturnType<typeof hairGeometry>;
  const tg = time(5, () => { g = hairGeometry(face.params, lm2); });
  let svg = '';
  const tc = time(5, () => { const r = compileScene({ width: 600, height: 700, background: '#ffffff', objects: L.objects }); if (!r.ok) throw new Error(r.issues.join('\n')); svg = r.svg; });
  const tr = time(5, () => { new Resvg(svg, { fitTo: { mode: 'width', value: 600 } }).render().asPng(); });
  void lm;
  const row = { cas: label, geometrieCheveuxMs: Math.round(tg), compileSvgMs: Math.round(tc), resvgMs: Math.round(tr), svgKo: Math.round(svg.length / 1024), meches: g?.locks.length ?? 0 };
  out.push(row); console.log(JSON.stringify(row));
}

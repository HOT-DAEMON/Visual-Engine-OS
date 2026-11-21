import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { compileScene } from '../../src';
import { openingGeometry } from '../../src/geometry/eye';
import { resolveEye } from '../../src/render/eye/eye';
import { irisCenter, irisRadii } from '../../src/render/eye/helpers';
import { EyeSpec } from '../../src/schema';

/**
 * MESURE ATOMIQUE D'UN ŒIL DU MOTEUR (passe 12) : l'œil est rendu en grand (échelle `K`), puis `scripts/eye-refs/extract_iris_atoms.py --png` applique les MÊMES détecteurs
 * que sur les références (fentes, cellules, étoiles, anneau, part sombre par bande). Aucune formule dupliquée côté TypeScript : un seul détecteur, deux sources.
 */
export interface AtomMetrics {
  readonly darkByBand: { rho: number[]; darkShare: number; lum: number | null }[];
  readonly slits: { persistentCount: number; meanWidthDeg: number | null; meanDepth: number | null };
  readonly cells: { count: number; areaMedian: number; areaCV: number; areaP10: number; areaP90: number; elongationMedian: number | null; solidityMedian: number | null };
  readonly stars: { count: number; top: { feretOverR: number; rho: number }[]; feretTop6Mean: number | null };
  readonly ring: { ringRho: number; ringWidthRho: number; angularDashes: number };
}
const W = 1000, H = 700, K = 3.2;
export function renderEyePng(input: Record<string, unknown>, k = K): { png: Buffer; cx: number; cy: number; rx: number; ry: number } {
  const eye = resolveEye(EyeSpec.parse({ ...input, eyebrow: null })); const g = openingGeometry(eye.shape, eye.canthi);
  const r: any = compileScene({ width: W, height: H, background: '#f4ede6', objects: [{ kind: 'eye', id: 'a', transform: { x: W / 2, y: H / 2, scale: k }, ...input, eyebrow: null }] } as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  const png = Buffer.from(new Resvg(r.svg as string, { fitTo: { mode: 'width', value: W } }).render().asPng());
  const c = irisCenter(eye, g); const { rx, ry } = irisRadii(eye);
  return { png, cx: W / 2 + c.x * k, cy: H / 2 + c.y * k, rx: rx * k, ry: ry * k };
}
export function atomMetrics(input: Record<string, unknown>): AtomMetrics {
  const m = renderEyePng(input); const dir = mkdtempSync(join(tmpdir(), 'atoms-')); const f = join(dir, 'e.png'); writeFileSync(f, m.png);
  return JSON.parse(execFileSync('python3', ['scripts/eye-refs/extract_iris_atoms.py', '--png', f, String(m.cx), String(m.cy), String(m.rx), String(m.ry)], { encoding: 'utf8' })) as AtomMetrics;
}

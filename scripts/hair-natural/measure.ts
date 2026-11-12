import { generateRandomFace } from '../../src';
import { faceLandmarks } from '../../src/face';
import { hairGeometry, type HairGeometry } from '../../src/face/hair';
import { centerOf, gridOver, paint } from '../../src/face/hair/coverage';
import { distanceOutsideSkull } from '../../src/face/hair/thickness';
import type { Poly } from '../../src/face/poly';
import { HAIR_STYLES } from '../../src/schema';

/**
 * Mesures de DIAGNOSTIC de la silhouette réelle (base + mèches) : penchement du dôme, décentrage du sommet, plus grande plaque de coque nue.
 *   npx tsx scripts/hair-natural/measure.ts <style|all> [N=40] [seed0=9000] [pas=71]
 */
export interface Sil { lean: number; leanSlope: number; asym: number; top: number; bareMax: number; bareAll: number; rows: number }

export function silhouette(geo: HairGeometry, W: number, H: number, sideY: number): Sil | null {
  const polys: Poly[] = [geo.base[0] as Poly, ...(geo.backBase ? [geo.backBase] : []), ...geo.locks.filter((l) => l.layer !== 'over').map((l) => l.poly)];
  const all = polys.flat();
  const g = gridOver(all, 0.006 * W);
  const sil = new Uint8Array(g.nx * g.ny);
  for (const q of polys) paint(g, q, sil);
  const rows: { y: number; xl: number; xr: number }[] = [];
  for (let j = 0; j < g.ny; j++) {
    let xl = Infinity, xr = -Infinity;
    for (let i = 0; i < g.nx; i++) if (sil[j * g.nx + i]) { const x = g.x0 + (i + 0.5) * g.cell; if (x < xl) xl = x; if (x > xr) xr = x; }
    if (xr > xl) rows.push({ y: g.y0 + (j + 0.5) * g.cell, xl, xr });
  }
  if (rows.length < 10) return null;
  const y0 = rows[0]!.y;
  const dome = rows.filter((r) => r.y <= sideY && r.y >= y0 + 0.01 * H);
  if (dome.length < 5) return null;
  const mids = dome.map((r) => (r.xl + r.xr) / 2);
  const lean = mids.reduce((a, b) => a + b, 0) / mids.length / W;
  const ys = dome.map((r) => r.y), my = ys.reduce((a, b) => a + b, 0) / ys.length, mm = mids.reduce((a, b) => a + b, 0) / mids.length;
  let sxy = 0, syy = 0;
  dome.forEach((r, k) => { sxy += (r.y - my) * ((mids[k] as number) - mm); syy += (r.y - my) ** 2; });
  const widest = dome.reduce((m, r) => (r.xr - r.xl > m.xr - m.xl ? r : m), dome[0]!);
  const topRows = rows.filter((r) => r.y <= y0 + 0.06 * H);
  const top = topRows.reduce((a, r) => a + (r.xl + r.xr) / 2, 0) / topRows.length / W;
  // Plaques nues : cellules de la coque hors crâne sans aucune mèche ; plus grande composante connexe (4-voisins).
  const base = geo.base[0] as Poly;
  const gb = gridOver(base, 0.008 * W), inside = new Uint8Array(gb.nx * gb.ny), cov = new Uint8Array(gb.nx * gb.ny);
  paint(gb, base, inside);
  for (const l of geo.locks) if (l.layer === 'front' && l.rank !== 'hairline') paint(gb, l.poly, cov);
  const bare = new Uint8Array(gb.nx * gb.ny);
  let nIn = 0, nBare = 0;
  for (let i = 0; i < bare.length; i++) if (inside[i]) { if (distanceOutsideSkull(geo.boundary.skull, centerOf(gb, i), 60) > 0) { nIn++; if (!cov[i]) { bare[i] = 1; nBare++; } } }
  let best = 0;
  const seen = new Uint8Array(bare.length), stack: number[] = [];
  for (let s = 0; s < bare.length; s++) {
    if (!bare[s] || seen[s]) continue;
    let size = 0; stack.push(s); seen[s] = 1;
    while (stack.length) {
      const c = stack.pop() as number; size++;
      const x = c % gb.nx, y = Math.floor(c / gb.nx);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= gb.nx || ny >= gb.ny) continue;
        const n = ny * gb.nx + nx;
        if (bare[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
      }
    }
    best = Math.max(best, size);
  }
  const cellArea = (gb.cell / W) ** 2;
  return { lean, leanSlope: syy > 0 ? (sxy / syy) : 0, asym: (Math.abs(widest.xr) - Math.abs(widest.xl)) / (Math.abs(widest.xr) + Math.abs(widest.xl)), top, bareMax: best * cellArea, bareAll: nIn ? nBare / nIn : 0, rows: rows.length };
}

const q = (a: number[], p: number): number => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] as number; };
if (process.argv[1]?.endsWith('measure.ts')) {
  const [which = 'afro', n = '40', s0 = '9000', step = '71'] = process.argv.slice(2);
  const styles = which === 'all' ? HAIR_STYLES.filter((s) => s !== 'bald') : [which];
  for (const style of styles) {
    const acc: Record<string, number[]> = { lean: [], leanSlope: [], asym: [], top: [], bareMax: [], bareAll: [] };
    for (let i = 0; i < Number(n); i++) {
      const f = generateRandomFace(Number(s0) + i * Number(step), { hair: { style } as never, hairEngine: 'v2' });
      const lm = faceLandmarks(f.params, f.width, f.height);
      const geo = hairGeometry(f.params, lm);
      if (!geo) continue;
      const m = silhouette(geo, lm.W, lm.H, lm.hair.sideY);
      if (!m) continue;
      for (const k of Object.keys(acc)) (acc[k] as number[]).push(Math.abs((m as unknown as Record<string, number>)[k] as number));
    }
    const row = Object.entries(acc).map(([k, a]) => `${k} med ${q(a, 0.5).toFixed(3)} p90 ${q(a, 0.9).toFixed(3)} max ${Math.max(...a).toFixed(3)}`);
    console.log(`${style.padEnd(9)} ${row.join(' | ')}`);
  }
}

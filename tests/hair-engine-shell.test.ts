import { describe, expect, it } from 'vitest';
import { generate } from '../src/hair-grammar/grammar';
import { DEFAULT_HEAD, sectionAt } from '../src/hair-grammar/head';
import { walk } from '../src/hair-grammar/lock';
import { TOUSLED } from '../src/hair-grammar/profiles/tousled';
import { offsetNormal, shellNormal, shellPoint } from '../src/hair-grammar/shell';
import { dot, len, sub, type V3 } from '../src/hair-grammar/vec';

const H = DEFAULT_HEAD;
const ang = (a: V3, b: V3): number => (Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (len(a) * len(b) || 1)))) * 180) / Math.PI;

describe('coque : raccord mâchoire → cou de classe C¹', () => {
  it('sectionAt et coque coïncident sous la mâchoire (y < 0,32)', () => {
    for (const y of [-0.3, 0, 0.15, 0.3]) { const s = sectionAt(H, y); const p = shellPoint(H, y, Math.PI / 2); expect(p.x).toBeCloseTo(Math.max(0.02, s.a), 9); }
  });
  it('pas de saut de pente en y = 0,32 (avant : −1,34 → −0,12) : l\'écart de pente à ±0,002 est < 0,05', () => {
    const e = 1e-3; const slope = (y: number): number => (shellPoint(H, y + e, Math.PI / 2).x - shellPoint(H, y - e, Math.PI / 2).x) / (2 * e);
    expect(Math.abs(slope(0.32 - 2e-3) - slope(0.32 + 2e-3))).toBeLessThan(0.05);
  });
  it('la coque est continue : deux points voisins en y restent à moins de 0,03 H sur toute la zone de raccord', () => {
    for (const az of [0, 0.8, 1.6, 2.4, 3.14]) for (let y = 0.2; y < 0.7; y += 0.005) expect(len(sub(shellPoint(H, y + 0.005, az), shellPoint(H, y, az)))).toBeLessThan(0.03);
  });
  it('au-delà de la mâchoire (y ≥ 0,25), la normale ne tourne jamais de plus de 8° par pas de 0,005 H (pas de coude)', () => {
    for (const az of [0, 1.2, 2.4]) for (let y = 0.25; y < 0.7; y += 0.005) expect(ang(shellNormal(H, y, az), shellNormal(H, y + 0.005, az))).toBeLessThan(8);
  });
});

describe('normale de décollement', () => {
  it('égale la normale exacte au sommet et sur les côtés (y < 0,08) et pour une mèche plaquée (off < 0,02)', () => {
    for (const y of [-0.3, 0, 0.05]) expect(ang(offsetNormal(H, y, 1.1, 0.1), shellNormal(H, y, 1.1))).toBeLessThan(1e-4);
    for (const y of [0.2, 0.4]) expect(ang(offsetNormal(H, y, 1.1, 0.01), shellNormal(H, y, 1.1))).toBeLessThan(1e-4);
  });
  it('est unitaire et reste dans un cône de 60° autour de la normale exacte, même à la mâchoire', () => {
    for (const y of [0.15, 0.2, 0.3, 0.45]) for (const off of [0.03, 0.08, 0.15]) { const n = offsetNormal(H, y, 0.9, off); expect(len(n)).toBeCloseTo(1, 6); expect(ang(n, shellNormal(H, y, 0.9))).toBeLessThan(60); }
  });
});

describe('marches des mèches générées : plus de pli 3D', () => {
  /** Saut de direction 3D (°) entre deux pas successifs : un pli de la courbe décalée donne > 90°. */
  const worst = (specs: ReturnType<typeof generate>): { fold: number; n: number } => {
    let fold = 0;
    for (const L of specs) { const S = walk(H, L, 28); for (let k = 2; k < S.length; k++) { const a = sub(S[k - 1]!.p, S[k - 2]!.p); const b = sub(S[k]!.p, S[k - 1]!.p); if (len(a) < 1e-9 || len(b) < 1e-9) continue; if (ang(a, b) > 90) fold++; } }
    return { fold, n: specs.length };
  };
  it('moins de 1 pli 3D pour 100 mèches sur 12 graines (mesure avant le correctif : 74 sur 400)', () => {
    let fold = 0; let n = 0; for (let s = 1; s <= 12; s++) { const w = worst(generate(TOUSLED, s)); fold += w.fold; n += w.n; }
    expect(fold / n).toBeLessThan(0.01);
  });
  it('le décollement effectif ne dépasse jamais le décollement demandé et reste ≥ 0', () => {
    for (const L of generate(TOUSLED, 4)) for (const s of walk(H, L, 28)) { expect(s.off).toBeGreaterThanOrEqual(0); expect(s.off).toBeLessThanOrEqual(Math.max(L.lift0, L.lift1) + 0.05 + 1e-9); }
  });
  it('déterminisme : deux marches identiques', () => { const L = generate(TOUSLED, 2)[3]!; expect(walk(H, L, 28)).toEqual(walk(H, L, 28)); });
});

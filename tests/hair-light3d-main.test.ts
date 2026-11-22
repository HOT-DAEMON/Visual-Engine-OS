import { describe, expect, it } from 'vitest';
import type { HairLock } from '../src/face/hair';
import { lightVector, direction2D } from '../src/lighting/light';
import { celBands } from '../src/render/face/hair-cel';
import { shadowReach, tubeExposure } from '../src/render/face/hair-light';

/** Lumière 3D du moteur principal : portée de l'ombre = f(élévation), exposition d'un faisceau cylindrique (`part`/`sim`). Voir `hair-light.ts`. */
const L = (az: number, el: number): ReturnType<typeof lightVector> => lightVector({ azimuthDeg: az, elevationDeg: el, color: '#fff', intensity: 1 });
const line = (n: number, dx: number, dy: number): { x: number; y: number }[] => Array.from({ length: n }, (_, i) => ({ x: 100 + i * dx, y: 100 + i * dy }));
const poly = (sp: { x: number; y: number }[]): { x: number; y: number }[] => [...sp.map((p) => ({ x: p.x - 4, y: p.y })), ...[...sp].reverse().map((p) => ({ x: p.x + 4, y: p.y }))];

describe('portée de l\'ombre portée', () => {
  it('élévation de référence du schéma (55°) : facteur 1 — rendu d\'origine inchangé ; sans lumière 3D : 1', () => {
    expect(shadowReach(L(300, 55))).toBeCloseTo(1, 9); expect(shadowReach(undefined)).toBe(1);
  });
  it('lumière rasante → ombre plus longue ; lumière de face → plus courte ; bornée ; indépendante de l\'azimut', () => {
    expect(shadowReach(L(300, 20))).toBeGreaterThan(1.5); expect(shadowReach(L(300, 85))).toBeLessThan(0.5 + 1e-9);
    expect(shadowReach(L(300, 10))).toBeLessThanOrEqual(2.2); expect(shadowReach(L(300, 89))).toBeGreaterThanOrEqual(0.45);
    expect(shadowReach(L(10, 35))).toBeCloseTo(shadowReach(L(200, 35)), 9);
    const e = [15, 25, 35, 45, 55, 65, 75, 85].map((d) => shadowReach(L(0, d))); for (let i = 1; i < e.length; i++) expect(e[i]!).toBeLessThanOrEqual(e[i - 1]!);
  });
});

describe('exposition d\'un faisceau cylindrique', () => {
  const sp = line(12, 0, 6); // axe vertical
  it('lumière de face : exposition 1 ; lumière dans le dos : 0 ; toujours dans [0, 1]', () => {
    for (const e of tubeExposure(sp, { x: 0, y: 0, z: 1 })) expect(e).toBeCloseTo(1, 6);
    for (const e of tubeExposure(sp, { x: 0, y: 0, z: -1 })) expect(e).toBeCloseTo(0, 6);
    for (const [az, el] of [[0, 20], [90, 50], [200, 70], [300, 35]] as const) for (const e of tubeExposure(sp, L(az, el))) { expect(e).toBeGreaterThanOrEqual(0); expect(e).toBeLessThanOrEqual(1); }
  });
  it('lumière rasante perpendiculaire à l\'axe : moitié de la face visible éclairée (≈ 0,5) ; plus de hauteur → plus d\'exposition', () => {
    const grazing = tubeExposure(sp, { x: 1, y: 0, z: 0 })[5]!; expect(grazing).toBeCloseTo(0.5, 6);
    expect(tubeExposure(sp, L(90, 70))[5]!).toBeGreaterThan(tubeExposure(sp, L(90, 20))[5]!);
  });
  it('indépendante du sens de parcours de l\'axe (haut → bas = bas → haut)', () => {
    const a = tubeExposure(sp, L(120, 40)); const b = tubeExposure([...sp].reverse(), L(120, 40)).reverse(); a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 9));
  });
});

describe('celBands : pièce ronde `part`/`sim` sans `geom`', () => {
  const sp = line(14, 0, 6); const base = { poly: poly(sp), rank: 'main', tone: 0, layer: 'front', spine: sp, w0: 8 } as unknown as HairLock;
  const area = (p: { x: number; y: number }[] | null): number => { if (!p) return 0; let a = 0; for (let i = 0; i < p.length; i++) { const u = p[i]!; const v = p[(i + 1) % p.length]!; a += u.x * v.y - v.x * u.y; } return Math.abs(a) / 2; };
  const hl = (l: HairLock, light?: ReturnType<typeof lightVector>): number => area(celBands(l, direction2D(light ?? L(300, 55)), 0.6, false, undefined, light).highlight);
  it('sans lumière 3D transmise : comportement 2D d\'origine, identique pour une mèche ronde ou ordinaire', () => {
    expect(hl({ ...base, part: 'tail' })).toBeCloseTo(hl(base), 9);
  });
  it('une queue / mèche simulée éclairée de face a un reflet plus large qu\'à contre-jour ; une mèche ordinaire ne change pas', () => {
    const front = L(0, 88); const back = { ...L(0, 55), z: -0.8 };
    for (const k of [{ part: 'tail' }, { sim: true }, { part: 'braid' }] as const) expect(hl({ ...base, ...k }, front)).toBeGreaterThan(hl({ ...base, ...k }, back) * 1.5);
    expect(hl(base, front)).toBeCloseTo(hl(base, back), 9);
  });
});

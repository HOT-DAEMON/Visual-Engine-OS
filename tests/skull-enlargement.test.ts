import { describe, expect, it } from 'vitest';
import { generateRandomProfile } from '../src/generation/random-skull';
import { skullGeometry } from '../src/skull/geometry';
import { mastoidBump, mastoidContour } from '../src/skull/vault-mastoid';
import { transmission } from '../src/skull/vault-tissue';
import { SkullParams } from '../src/skull/types';
import { headSpecFromProfile, variedHead } from '../src/head-turntable/engines/from-face';
import { isBare, vertexY } from '../src/head-turntable/engines/rows';
import { generateRandomFace, SceneSpec } from '../src';
import { dominantColor } from '../src/materials';
import { hostFace } from '../src/render/face';
import { deriveSkull } from '../src/skull/derive';
import { hostHairline } from '../src/head-turntable/engines/from-host';
import { topRow } from '../src/head-turntable/silhouette';
import { hostOverlap } from '../src/head-turntable/verify-host';
import type { HostSpec } from '../src/schema';
import { vaultRise } from '../src/head-turntable/engines/vault-model';
import { skullRelief, PARIETAL_MOVE, SKULL_RELIEF } from '../src/head-turntable/engines/skull-relief';
import { vaultRelief, vaultAnchors } from '../src/head-turntable/engines/vault-relief';
import { vaultSpec } from '../src/head-turntable/vault-lab';
import { HeadRenders } from '../src/head-turntable/verify-head';
import { enlargementAnatomyChecks, enlargementGeometryChecks, enlargementStyleChecks } from '../src/head-turntable/verify-enlargement';

const D = Math.PI / 180;
describe('crâne nu : la tête 3D n\'est plus plus haute ni plus large que le visage 2D', () => {
  it('une tête chauve est nue (vertex à Y0, aucune épaisseur de coupe) ; une coupe courte peinte garde l\'héritage de la planche', () => {
    const bald = vaultSpec({}, 3), calotte = variedHead(3).spec;
    expect(isBare(bald.engine!)).toBe(true); expect(vertexY(bald.engine!)).toBeCloseTo(0.05, 9); expect(bald.rows[0]!.y).toBeCloseTo(0.05 - vaultRise(bald.engine!), 9);   // le sommet de la table est le vertex, relevé ou abaissé par la hauteur réelle de la voûte
    expect((bald.engine!.fit as { hairTh: number }).hairTh).toBe(0);
    expect(isBare(calotte.engine!)).toBe(false); expect(calotte.rows[0]!.y).toBeCloseTo(-vaultRise(calotte.engine!), 9);
  });
  it('les trois couches de vérification passent sur plusieurs graines et sur une voûte extrême', () => {
    const cases = [vaultSpec({}, 3), vaultSpec({}, 7), vaultSpec({ vaultHeight: 1, parietalBulge: 1, parietalHeight: 1, parietalAzimuth: 1, occipitalFlat: 1 }, 3), vaultSpec({ vaultHeight: 0, parietalFlat: 1 }, 11)];
    for (const spec of cases) {
      const R = new HeadRenders(spec, 360), cs = [...enlargementGeometryChecks(spec, R.at(0, true)), ...enlargementAnatomyChecks(spec), ...enlargementStyleChecks(spec, (y) => R.at(y))];
      expect(cs.length).toBeGreaterThanOrEqual(9);
      expect(cs.filter((c) => !c.ok && c.kind === 'hard').map((c) => c.id)).toEqual([]);
    }
  }, 120_000);
  it('la largeur des coupes est celle du contour 2D (écart ≤ 0,001 U), alors que l\'ancien chemin la dépassait de 0,02–0,05 U', () => {
    const spec = vaultSpec({}, 3), g = enlargementGeometryChecks(spec, new HeadRenders(spec, 360).at(0, true)).find((c) => c.id === 'head.geo.enlarge.width')!;
    expect(g.value).toBeLessThan(0.001);
  }, 60_000);
});

describe('hôte chauve : le sommet 3D est celui du visage 2D (ancien : 0,05 U trop haut)', () => {
  const crownExcess = (seed: number, legacyCrown: boolean): { top: number; iou: number } => {
    const f = generateRandomFace(seed, { id: 'f0', transform: { x: 150, y: 220, scale: 0.8 } } as never), host = SceneSpec.parse({ width: 700, height: 460, objects: f.objects }).objects.find((o) => o.kind === 'host') as HostSpec;
    const { params, lm } = hostFace(host), d = deriveSkull(params, lm.W / lm.H, { hair: 'auto' }, { ci: 0, axes: {} });
    const src = { face: { params, width: lm.W, height: lm.H }, skull: d.skull, derivation: d, skin: dominantColor(host.material.base), hair: params.hair.color ?? '#4a3222' } as never;
    const spec = headSpecFromProfile(src, undefined, hostHairline(params, lm), { legacyCrown }), R = new HeadRenders(spec).skull.at(0, true);
    return { top: 0.05 - vaultRise(spec.engine!) - (topRow(R) - R.originY) / R.ppu, iou: hostOverlap(spec, R)!.iou };
  };
  it.each([42, 4, 16])('graine %i : sommet au-dessus du vertex 2D : ancien ≈ +0,05 U, crâne nu < 0,01 U ; l\'IoU de la face ne bouge pas (> 0,99)', (seed) => {
    const old = crownExcess(seed, true), nu = crownExcess(seed, false);
    expect(old.top).toBeGreaterThan(0.04); expect(old.top).toBeLessThan(0.06);
    expect(Math.abs(nu.top)).toBeLessThan(0.01);
    expect(old.iou).toBeGreaterThan(0.99); expect(nu.iou).toBeGreaterThan(0.99);
  }, 60_000);
});

describe('mastoïde : taille, direction, pente', () => {
  const c0 = { y: 0.67, az: 118 };
  it('nominal = l\'ancienne gaussienne (σ 13° × 0,055 U) à 1e-12', () => {
    for (const [dy, da] of [[0, 0], [0.03, 5], [-0.05, -9], [0.02, 14]] as [number, number][]) {
      const old = Math.exp(-0.5 * (dy / 0.055) ** 2) * Math.exp(-0.5 * (da / 13) ** 2);
      expect(Math.abs(mastoidBump(c0.y + dy, c0.az + da, c0.y, c0.az, 0, 0, 0) - old)).toBeLessThan(1e-12);
    }
  });
  it('taille : l\'emprise (contour à mi-hauteur) croît avec `mastoidSize` (0,6 → 1,5 de l\'emprise nominale)', () => {
    const area = (s: number): number => { const p = mastoidContour(0.5, s, 0, 0); let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]!; a += p[i]!.x * q.y - q.x * p[i]!.y; } return Math.abs(a) / 2; };
    expect(area(-1)).toBeLessThan(area(0)); expect(area(0)).toBeLessThan(area(1));
    expect(Math.sqrt(area(1) / area(0))).toBeCloseTo(1.5, 2); expect(Math.sqrt(area(-1) / area(0))).toBeCloseTo(0.6, 2);
  });
  it('direction : l\'axe long tourne (±35°) et s\'allonge ; elle est antisymétrique', () => {
    const ang = (d: number): number => { const p = mastoidContour(0.5, 0, d, 0, 72); let best = p[0]!, r = 0; for (const q of p) if (Math.hypot(q.x, q.y) > r) { r = Math.hypot(q.x, q.y); best = q; } return Math.atan2(best.y, best.x) / D; };
    const a1 = ang(1), am = ang(-1); expect(Math.abs(Math.abs(a1) - 35)).toBeLessThan(6); expect(a1 * am).toBeLessThan(0);
    const ext = (d: number): number => Math.max(...mastoidContour(0.5, 0, d, 0, 72).map((q) => Math.hypot(q.x, q.y)));
    expect(ext(1)).toBeGreaterThan(ext(0) * 1.2);
  });
  it('pente : conique (−1) = pointe plus aiguë qu\'émoussé (+1) : le flanc à 80 % du maximum est plus loin du centre pour le plateau', () => {
    const r = (s: number): number => Math.max(...mastoidContour(0.8, 0, 0, s).map((q) => Math.hypot(q.x, q.y)));
    expect(r(-1)).toBeLessThan(r(0)); expect(r(0)).toBeLessThan(r(1));
  });
  it('dans le relief 3D : sans saillie (`mastoid` = 0) forme et taille n\'ont aucun effet ; avec saillie la forme déplace le relief', () => {
    const at = (ov: Partial<SkullParams>): number[] => { const e = vaultSpec(ov, 3).engine!, A = vaultAnchors(e); return [0, 0.03, -0.04].flatMap((dy) => [112, 118, 126].map((az) => vaultRelief(e, A.yM + dy, az * D))); };
    expect(at({ mastoidSize: 1, mastoidDirection: 1, mastoidSlope: 1 })).toEqual(at({}));
    const a = at({ mastoid: 1 }), b = at({ mastoid: 1, mastoidDirection: 1 }), c = at({ mastoid: 1, mastoidSize: 1 });
    expect(a.some((v, i) => Math.abs(v - b[i]!) > 1e-4)).toBe(true); expect(a.some((v, i) => Math.abs(v - c[i]!) > 1e-4)).toBe(true);
  });
});

describe('éminence pariétale : position', () => {
  it('le maximum du relief suit `parietalHeight` (y) et `parietalAzimuth` (az) ; nominal inchangé', () => {
    const peak = (ov: Partial<SkullParams>): { y: number; az: number } => { const e = vaultSpec(ov, 3).engine!; let best = { y: 0, az: 0, v: -1 };
      for (let y = 0.1; y <= 0.45; y += 0.005) for (let az = 80; az <= 150; az += 1) { const v = skullRelief(e, y, az * D); if (v > best.v) best = { y, az, v }; } return best; };
    const n = peak({}), hi = peak({ parietalHeight: 1 }), lo = peak({ parietalHeight: -1 }), bk = peak({ parietalAzimuth: 1 }), fw = peak({ parietalAzimuth: -1 });
    expect(Math.abs(n.y - SKULL_RELIEF.yP)).toBeLessThan(0.02); expect(Math.abs(n.az - SKULL_RELIEF.azP)).toBeLessThan(3);
    expect(hi.y).toBeLessThan(n.y); expect(lo.y).toBeGreaterThan(n.y); expect(lo.y - hi.y).toBeGreaterThan(PARIETAL_MOVE.dy * 1.4);   // +1 = HAUTE : y est compté vers le bas, donc plus petit (sens corrigé en passe 2, voir docs/SKULL-VAULT-2.md)
    expect(bk.az - fw.az).toBeGreaterThan(PARIETAL_MOVE.daz * 1.4);
  });
});

describe('tissus : transmission exponentielle', () => {
  it('vaut exactement 1 à scalp = 0,5 pour le pariétal et décroît strictement avec l\'épaisseur ; plus ample qu\'avant sur la mastoïde', () => {
    expect(transmission('parietal', 0.5, 0)).toBeCloseTo(1, 12);
    const t = [0.05, 0.3, 0.5, 0.7, 0.95].map((s) => transmission('mastoid', s, 0));
    for (let i = 1; i < t.length; i++) expect(t[i]!).toBeLessThan(t[i - 1]!);
    expect(transmission('mastoid', 0.5, 0)).toBeCloseTo(1.175, 9);   // ancien calibrage à scalp = 0,5, inchangé
  });
});

describe('profil 2D : lit les mesures de voûte qui changent la profondeur ou la hauteur du contour', () => {
  const p = generateRandomProfile(3), H = 400;
  const poly = (ov: object) => skullGeometry(p.face.params, SkullParams.parse({ ...p.skull, ...ov }), H).poly;
  const dist = (a: ReturnType<typeof poly>, b: ReturnType<typeof poly>): number => { let m = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) m = Math.max(m, Math.hypot(a[i]!.x - b[i]!.x, a[i]!.y - b[i]!.y)); return m / H; };
  it.each(['frontalFlat', 'parietalBulge', 'parietalFlat', 'occipitalFlat', 'occipitalSlope', 'parietalHeight', 'parietalAzimuth', 'glabella', 'nuchalLine', 'browArch', 'frontalEminence', 'metopicRidge', 'occipitalBun', 'inionSize'])('%s déplace le contour de plus de 0,004 H, nominal identique', (k) => {
    const ex = k.startsWith('parietalH') || k.startsWith('parietalA') ? { parietalBulge: 1 } : {};
    expect(dist(poly({ ...ex, [k]: -1 }), poly({ ...ex, [k]: 1 }))).toBeGreaterThan(0.004);
    expect(dist(poly({}), poly({ [k]: 0 }))).toBe(0);
  });
  it.each(['cranialBreadth', 'templeBreadth', 'frontalBreadth', 'temporalFlat', 'temporalHollow', 'planeTransition', 'parietalConvexity', 'asymWidth', 'temporalLine', 'temporalMuscle', 'asterion', 'asymMastoid', 'asymParietalHeight'])('%s (largeur seule) ne change pas la silhouette de profil', (k) => {
    expect(dist(poly({ [k]: -1 }), poly({ [k]: 1 }))).toBe(0);
  });
});

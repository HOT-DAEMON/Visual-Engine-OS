import { describe, expect, it } from 'vitest';
import type { HairLock } from '../src/face/hair';
import { direction2D, lightVector } from '../src/lighting/light';
import { celBands } from '../src/render/face/hair-cel';
import { DEFAULT_HEAD, landmarks, project } from '../src/hair-grammar/head';
import { generate } from '../src/hair-grammar/grammar';
import { frameFromEyes, grammarToHairLocks } from '../src/hair-grammar/interop';
import { lightFromVector, lightToVector } from '../src/hair-grammar/light-bridge';
import { lightScreen } from '../src/hair-grammar/local-geometry';
import { paintHairPro } from '../src/hair-grammar/paint-pro';
import { TOUSLED } from '../src/hair-grammar/profiles/tousled';
import { len } from '../src/hair-grammar/vec';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

/**
 * LUMIÈRE COMMUNE : un seul `LightVector` (hôte) éclaire à la fois le 2D (`ld`) et l'exposition 3D des rubans (`LockGeom.exposure`). Voir `light-bridge.ts`.
 */
const L = (az: number, el: number): ReturnType<typeof lightVector> => lightVector({ azimuthDeg: az, elevationDeg: el, color: '#fff', intensity: 1 });

describe('pont de lumière : un seul vecteur, deux lectures', () => {
  it('aller-retour : lightToVector(lightFromVector(v)) = v pour 6 vues × 5 lumières', () => {
    for (const yaw of [0, 17, 45, -60, 75, -75]) for (const [az, el] of [[315, 50], [0, 80], [90, 20], [200, 35], [270, 60]] as const) {
      const v = L(az, el); const r = lightToVector(lightFromVector(v, viewAt(yaw)), viewAt(yaw), v);
      expect(Math.abs(r.x - v.x)).toBeLessThan(1e-9); expect(Math.abs(r.y - v.y)).toBeLessThan(1e-9); expect(Math.abs(r.z - v.z)).toBeLessThan(1e-9);
    }
  });
  it('la lumière 3D est unitaire', () => { expect(len(lightFromVector(L(300, 40), viewAt(30)).dir)).toBeCloseTo(1, 9); });
  it('direction 2D de l\'hôte (`ld`) = projection de la lumière 3D de la grammaire (`lightScreen`), pour toute vue', () => {
    for (const yaw of [0, 17, 45, -60, 75, -75]) for (const [az, el] of [[315, 50], [90, 20], [200, 35]] as const) {
      const v = L(az, el); const a = direction2D(v); const b = lightScreen(viewAt(yaw), lightFromVector(v, viewAt(yaw)));
      expect(Math.abs(a.x - b.x)).toBeLessThan(1e-6); expect(Math.abs(a.y - b.y)).toBeLessThan(1e-6);
    }
  });
});

describe('l\'exposition 3D suit la lumière de l\'hôte', () => {
  const V = viewAt(17); const specs = generate(TOUSLED, 1);
  const mean = (v: ReturnType<typeof lightVector>): number => { const p = paintHairPro(DEFAULT_HEAD, specs, V, undefined, lightFromVector(v, V)); const e = p.geoms.flatMap((g) => g.exposure); return e.reduce((a, b) => a + b, 0) / e.length; };
  it('une lumière de face éclaire davantage (exposition moyenne plus haute) qu\'une lumière de dos', () => {
    const front = mean(L(0, 85)); const back = mean({ ...L(0, 85), z: -0.9 }); expect(front).toBeGreaterThan(back + 0.1);
  });
  it('déplacer la lumière change l\'exposition : le même ruban n\'a pas la même exposition à gauche et à droite', () => {
    const p = (az: number): number[] => paintHairPro(DEFAULT_HEAD, specs, V, undefined, lightFromVector(L(az, 30), V)).geoms.flatMap((g) => g.exposure);
    const l = p(270); const r = p(90); let diff = 0; for (let i = 0; i < l.length; i++) diff += Math.abs((l[i] as number) - (r[i] as number)); expect(diff / l.length).toBeGreaterThan(0.05);
  });
});

describe('le rendu principal lit l\'exposition (HairLock.geom.exposure)', () => {
  const V = viewAt(17); const lm = landmarks(DEFAULT_HEAD); const eR = project(V, lm.eyeR); const eL = project(V, lm.eyeL);
  const light = L(315, 45); const pro = paintHairPro(DEFAULT_HEAD, generate(TOUSLED, 1), V, undefined, lightFromVector(light, V));
  const locks = grammarToHairLocks(pro.locks, { frame: frameFromEyes(eR, eL, eR, eL), head: DEFAULT_HEAD, headW: 2 * DEFAULT_HEAD.rx * V.s });
  const L0 = [...locks.filter((l) => (l.rank === 'mass' || l.rank === 'main') && l.layer !== 'back')].sort((a, b) => b.spine!.length - a.spine!.length)[0]!;
  const area = (p: readonly { x: number; y: number }[] | null): number => { if (!p) return 0; let a = 0; for (let i = 0; i < p.length; i++) { const u = p[i]!; const v = p[(i + 1) % p.length]!; a += u.x * v.y - v.x * u.y; } return Math.abs(a) / 2; };
  const ld = direction2D(light); const withEx = (f: (e: number) => number): HairLock => ({ ...L0, geom: { ...L0.geom!, exposure: L0.geom!.exposure!.map(f) } });
  it('l\'exposition est portée par la géométrie convertie et bornée à [0, 1]', () => { expect(L0.geom!.exposure).toHaveLength(L0.spine!.length); expect(L0.geom!.exposure!.every((e) => e >= 0 && e <= 1)).toBe(true); });
  it('même `ld`, même mèche : un reflet plus petit dans l\'ombre (exposition 0) qu\'en pleine lumière (exposition 1) ; neutre sans exposition', () => {
    const dark = area(celBands(withEx(() => 0), ld, 0.75, false).highlight); const lit = area(celBands(withEx(() => 1), ld, 0.75, false).highlight);
    const none = area(celBands({ ...L0, geom: { ...L0.geom!, exposure: undefined } }, ld, 0.75, false).highlight);
    expect(dark).toBeLessThan(lit * 0.5); expect(none).toBeGreaterThan(dark); expect(none).toBeLessThan(lit);
  });
  it('la forme de la bande d\'ombre ne dépend PAS de l\'exposition (seul le reflet est modulé)', () => {
    expect(celBands(withEx(() => 0), ld, 0.75, false).shade).toEqual(celBands(withEx(() => 1), ld, 0.75, false).shade);
  });
});

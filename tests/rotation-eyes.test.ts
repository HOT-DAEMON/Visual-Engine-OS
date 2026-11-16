import { describe, expect, it } from 'vitest';
import { compileScene, generateRandomFace as face } from '../src';
import { openingGeometry, turnOpening, turnPoint, facingOf } from '../src/geometry/eye';
import { SceneSpec } from '../src/schema';
import { compileEye } from '../src/render/eye/eye';
import { lightVector } from '../src/lighting/light';
import { headTurnOf } from '../src/lighting/head-turn';

/**
 * ROTATION — ÉTAPE 3 : YEUX (`docs/ROTATION-STEP-03-EYES-RESULT.md`). Tests ciblés sur ce que l'audit devait prouver ; aucun test ne fige une convention encore ambiguë (§4.1 du contrat) :
 * le désaccord de signe du tangage est porté par un `it.fails` qui BASCULE en échec visible le jour où il sera corrigé.
 */
const eyeOf = (over: Record<string, unknown>) => {
  const o = SceneSpec.parse({ width: 300, height: 200, objects: [{ kind: 'eye', id: 'e', seed: 11, shape: { width: 120, height: 64 }, eyebrow: null, transform: { x: 150, y: 100, scale: 1 }, ...over }] }).objects[0]!;
  if (o.kind !== 'eye') throw new Error('œil attendu');
  return o;
};
const g0 = (): ReturnType<typeof openingGeometry> => { const e = eyeOf({}); return openingGeometry(e.shape, e.canthi); };
const turn = (yaw: number, az: number, pitch = 0, recenter = true) => turnOpening(g0(), { yawDeg: yaw, pitchDeg: pitch, azimuthDeg: az, radius: 120 * 3 }, recenter);

describe('azimuts opposés ±22° (œil gauche / œil droit de l\'image)', () => {
  it('à +35° (tête vers la droite) l\'œil de gauche (−22°) est plus large et plus tourné vers la caméra que celui de droite (+22°)', () => {
    const L = turn(35, -22), R = turn(35, 22);
    expect(L.g.w).toBeGreaterThan(R.g.w);
    expect(L.g.w / g0().w).toBeCloseTo(Math.cos(((-22 + 35) * Math.PI) / 180) / Math.cos((22 * Math.PI) / 180), 2);   // loi analytique cos(az + lacet) / cos(az)
    expect(R.g.w / g0().w).toBeCloseTo(Math.cos(((22 + 35) * Math.PI) / 180) / Math.cos((22 * Math.PI) / 180), 2);
    expect(L.facing).toBeCloseTo(Math.cos((13 * Math.PI) / 180), 6); expect(R.facing).toBeCloseTo(Math.cos((57 * Math.PI) / 180), 6);
    expect(L.facing).toBeGreaterThan(R.facing); expect(R.facing).toBeGreaterThan(0);
  });
  it('symétrie miroir exacte de la projection : turnPoint(x, y ; lacet +35, az −22) = miroir de turnPoint(−x, y ; lacet −35, az +22)', () => {
    for (const [x, y] of [[0, 0], [-60, 5], [55, -12], [20, 30], [-30, -28]] as [number, number][]) {
      const a = turnPoint({ x, y }, { yawDeg: 35, pitchDeg: 10, azimuthDeg: -22, radius: 360 }), b = turnPoint({ x: -x, y }, { yawDeg: -35, pitchDeg: 10, azimuthDeg: 22, radius: 360 });
      expect(a.x).toBeCloseTo(-b.x, 9); expect(a.y).toBeCloseTo(b.y, 9);
    }
  });
  it('visibilité : à 75° l\'œil de droite (+22°) est derrière le crâne (facing ≤ 0), celui de gauche (−22°) reste visible', () => {
    expect(facingOf({ yawDeg: 75, pitchDeg: 0, azimuthDeg: 22, radius: 360 })).toBeLessThan(0);
    expect(facingOf({ yawDeg: 75, pitchDeg: 0, azimuthDeg: -22, radius: 360 })).toBeGreaterThan(0);
  });
});

describe('pas de double parallaxe', () => {
  it('modèle sphere : aucun `headWrap` (translate/échelle) ajouté par compileEye en plus de turnOpening ; modèle flat : un seul', () => {
    const L = lightVector({ azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity: 1 });
    const wrap = (model: 'flat' | 'sphere'): string | undefined => /<g transform="[^"]*"><g transform="([^"]*)">/.exec(compileEye(eyeOf({ headTurn: { model, yawDeg: 35, pitchDeg: 0, azimuthDeg: -22 } }), L).markup)?.[1];
    expect(wrap('sphere')).toBeUndefined(); expect(wrap('flat')).toBeDefined();
  });
  it('parallax = true : le déplacement du centre est exposé UNE fois (`shift`), géométrie = géométrie recentrée + shift exact', () => {
    const c = turn(35, -22, 10, true), p = turn(35, -22, 10, false);
    expect(Math.hypot(p.shift.x, p.shift.y)).toBeGreaterThan(1); expect(p.shift.x).toBeCloseTo(c.shift.x, 9);
    for (const k of ['pi', 'po', 'u1', 'u2', 'l1', 'l2'] as const) { expect(p.g[k].x).toBeCloseTo(c.g[k].x + p.shift.x, 6); expect(p.g[k].y).toBeCloseTo(c.g[k].y + p.shift.y, 6); }
  });
});

describe('convention du tangage (§4.1 du contrat) : défaut signalé, non corrigé', () => {
  it.fails('le tangage > 0 déplace l\'œil du même côté vertical pour les modèles flat (headTurnOf) et sphere (turnPoint, parallax)', () => {
    const flat = headTurnOf(0, 20, 120 * 0.9).dy, sphere = turn(0, 0, 20, false).shift.y;
    expect(Math.sign(flat)).toBe(Math.sign(sphere));   // mesuré : flat = +, sphere = − (voir ROTATION-CONTRACT.md §1)
  });
});

describe('visage hôte : les yeux sont des objets `eye` compilés par compileEye, sans pose de tête', () => {
  it('generateRandomFace ne fournit ni `headTurn` ni azimut aux yeux : modèle par défaut (flat), azimut 0 : intégration ABSENTE (documentée, non corrigée)', () => {
    const eyes = (face(11, { id: 'f0', transform: { x: 400, y: 420, scale: 1 } } as never).objects as { kind: string; headTurn?: unknown }[]).filter((o) => o.kind === 'eye');
    expect(eyes).toHaveLength(2);
    for (const e of eyes) expect(e.headTurn).toBeUndefined();
    expect((compileScene({ width: 800, height: 800, objects: face(11, { id: 'f0', transform: { x: 400, y: 420, scale: 1 } } as never).objects } as never) as { svg: string }).svg.length).toBeGreaterThan(1000);
  });
});

import { describe, expect, it } from 'vitest';
import { EyeSpec, generateRandomFace } from '../src';
import { applyTurnAbout, eyeTurn, isIdentityJac, openingPolygon, turnedHalfExtents, type Vec } from '../src/geometry/eye';
import { resolveEye } from '../src/render/eye/eye';
import { irisCenter } from '../src/render/eye/helpers';
import { gazeOf } from '../src/lighting/gaze3d';
import { verifyEye } from '../src/verify/eye';

/** PASSE 18 — rotation de tête (modèle `sphere`) : l'iris et ses reflets sont mesurés TELS QUE DESSINÉS (matrice locale `turnT`), et le décalage du regard subit la même matrice que l'ouverture. */
const SEEDS = [11, 23, 5, 42, 77, 3, 9, 14, 31, 58];
const eyesOf = (seed: number): Record<string, unknown>[] => {
  const f = generateRandomFace(seed, { id: 'f0', transform: { x: 400, y: 420, scale: 1 } } as never);
  return (f.objects as { kind: string; place?: unknown }[]).filter((o) => o.kind === 'eye').map(({ place: _p, ...e }) => e);
};
const turned = (e: Record<string, unknown>, i: number, yaw: number): Record<string, unknown> => ({ ...e, headTurn: { model: 'sphere', yawDeg: yaw, pitchDeg: 0, azimuthDeg: i === 0 ? -22 : 22, parallax: false } });
const inside = (p: Vec, poly: readonly Vec[]): boolean => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i] as Vec, b = poly[j] as Vec; if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; };

describe('EYE-01 rotation 3D — mesure de l’iris tel que dessiné (passe 18)', () => {
  it('helpers : identité exacte à l’identité, demi-axes = (rx, ry), compression propre à la matrice', () => {
    const I = { a: 1, b: 0, c: 0, d: 1 };
    expect(isIdentityJac(I)).toBe(true);
    expect(applyTurnAbout({ x: 3, y: -4 }, { x: 1, y: 2 }, I)).toEqual({ x: 3, y: -4 });
    expect(turnedHalfExtents(7, 5, I)).toEqual({ rx: 7, ry: 5 });
    const J = { a: 0.2, b: 0, c: 0, d: 1 };
    expect(isIdentityJac(J)).toBe(false);
    const p = applyTurnAbout({ x: 11, y: 2 }, { x: 1, y: 2 }, J);
    expect(p.x).toBeCloseTo(1 + 0.2 * 10, 12); expect(p.y).toBeCloseTo(2, 12);
    expect(turnedHalfExtents(10, 4, J).rx).toBeCloseTo(2, 12);
  });

  it('irisCenter : sans rotation (ou matrice identité) le centre est inchangé ; tourné, le décalage du regard est comprimé par la matrice', () => {
    for (const seed of SEEDS.slice(0, 4)) for (const [i, e] of eyesOf(seed).entries()) {
      const eye = resolveEye(EyeSpec.parse(e)); const { g0 } = eyeTurn(eye);
      expect(irisCenter(eye, g0, { a: 1, b: 0, c: 0, d: 1 })).toEqual(irisCenter(eye, g0));
      const t = resolveEye(EyeSpec.parse(turned(e, i, 60))); const { g, turned: tr } = eyeTurn(t); const gz = gazeOf(t); const c = irisCenter(t, g, tr!.jac);
      expect(c.x - (g.bbox.x + g.bbox.w / 2)).toBeCloseTo(tr!.jac.a * gz.dx + tr!.jac.b * gz.dy, 9);
      expect(c.y - (g.bbox.y + g.bbox.h / 2)).toBeCloseTo(tr!.jac.c * gz.dx + tr!.jac.d * gz.dy, 9);
    }
  });

  it('contrôle négatif : l’ancien centre (décalage non comprimé) sortait de l’ouverture là où le centre corrigé reste dedans (graine 3, œil droit, lacet 60°)', () => {
    const e = eyesOf(3)[1] as Record<string, unknown>; const t = resolveEye(EyeSpec.parse(turned(e, 1, 60))); const { g, turned: tr } = eyeTurn(t); const poly = openingPolygon(g);
    expect(inside(irisCenter(t, g), poly)).toBe(false);          // avant la passe 18
    expect(inside(irisCenter(t, g, tr!.jac), poly)).toBe(true);  // après
  });

  it('10 graines × 2 yeux, lacet 60° / azimut ±22° : `iris-meets-opening` et `highlights-confined` n’échouent plus (avant : ~le tiers à l’azimut +22°)', () => {
    let n = 0; const fails: string[] = [];
    for (const seed of SEEDS) for (const [i, e] of eyesOf(seed).entries()) for (const yaw of [30, 45, 60]) {
      n++; const r = verifyEye(turned(e, i, yaw));
      for (const c of r.checks) if (!c.ok && (c.id === 'iris-meets-opening' || c.id === 'highlights-confined')) fails.push(`s${seed} e${i} yaw${yaw} ${c.id}`);
    }
    expect(n).toBe(60); expect(fails).toEqual([]);
  });

  it('`iris-center-in-opening` : au plus 1 cas sur 60 (résiduel documenté : œil très haut + regard fortement baissé, cisaillement de la sphère)', () => {
    let bad = 0;
    for (const seed of SEEDS) for (const [i, e] of eyesOf(seed).entries()) for (const yaw of [30, 45, 60]) if (verifyEye(turned(e, i, yaw)).checks.some((c) => c.id === 'iris-center-in-opening' && !c.ok)) bad++;
    expect(bad).toBeLessThanOrEqual(1);
  });

  it('de face (lacet 0, aucune rotation) : aucune règle de rotation ne change de verdict', () => {
    for (const seed of SEEDS.slice(0, 5)) for (const e of eyesOf(seed)) { const r = verifyEye(e); expect(r.checks.filter((c) => !c.ok && c.severity === 'error')).toEqual([]); }
  });
});

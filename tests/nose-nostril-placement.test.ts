import { describe, expect, it } from 'vitest';
import { faceLandmarks, noseGeometry } from '../src/face';
import { noseFrame } from '../src/face/nose/frame';
import { NOSTRIL_PLACEMENT } from '../src/face/nose/nostrils';
import { NOSE_REFS } from '../src/face/nose/refs.generated';
import { FaceParams } from '../src/schema';
import { underviewRelief } from '../src/relief/underview';
import { noseSeparationCheck } from '../src/verify/nose-lit';

/** Loi de placement des narines (docs/NOSE-NOSTRIL-PLACEMENT.md) : séparation mesurée comme la réf. 03 (écart des narines / largeur de la silhouette). */
const make = (patch: object) => { const p = FaceParams.parse({ anatomyEngine: 'structured', nose: patch } as never), lm = faceLandmarks(p, 300, 380); return { p, lm, n: noseGeometry(p, lm), F: noseFrame(p, lm) }; };
const SWEEP: readonly (readonly [string, object])[] = [
  ['défaut', {}], ['columella 0', { nostrils: { columella: 0 } }], ['columella 1', { nostrils: { columella: 1 } }], ['évasement 0', { alae: { flare: 0 } }], ['évasement 1', { alae: { flare: 1 } }],
  ['largeur 0,15', { width: 0.15 }], ['largeur 0,30', { width: 0.3 }], ['forme 1', { nostrils: { shape: 1 } }], ['taille 1', { nostril: 1 }], ['taille 0', { nostril: 0 }], ['inclinaison 0°', { nostrils: { tiltDeg: 0 } }], ['inclinaison 40°', { nostrils: { tiltDeg: 40 } }],
];
const sepOf = (patch: object): number => {
  const { n } = make(patch), gap = n.nostrils.right.c.x - n.nostrils.left.c.x, c = noseSeparationCheck(underviewRelief(n, { pitchDeg: 40 }, 2), gap, 2);
  const m = /(\d\.\d+) hors/.exec(c.message ?? ''); if (!m) throw new Error('séparation illisible'); return Number(m[1]);
};

describe('narines : loi de placement ajustée sur la réf. 03', () => {
  it('la constante est une fraction de la marge libre (0 < K < 1)', () => { expect(NOSTRIL_PLACEMENT).toBeGreaterThan(0); expect(NOSTRIL_PLACEMENT).toBeLessThan(1); });

  it('le nez par défaut retombe sur la MÉDIANE de la réf. 03 (± 0,03) et dans la plage de la réf. 05 (non utilisée à l\'ajustement)', () => {
    const s = sepOf({}), r3 = NOSE_REFS.r03.separationOverNoseW, r5 = NOSE_REFS.r05.separationOverNoseW;
    expect(Math.abs(s - r3.median)).toBeLessThanOrEqual(0.03);
    expect(s).toBeGreaterThanOrEqual(r5.min); expect(s).toBeLessThanOrEqual(r5.max);
  }, 30_000);

  it('12 réglages (largeur, évasement, columelle, taille, forme, inclinaison) : séparation toujours dans la plage mesurée de la réf. 03', () => {
    const r = NOSE_REFS.r03.separationOverNoseW;
    for (const [lab, patch] of SWEEP) { const s = sepOf(patch); expect(s, lab).toBeGreaterThanOrEqual(r.min); expect(s, lab).toBeLessThanOrEqual(r.max); }
  }, 120_000);

  it('la columelle module toujours la séparation (axe non écrasé) : 0 < 0,5 < 1', () => {
    const a = sepOf({ nostrils: { columella: 0 } }), b = sepOf({}), c = sepOf({ nostrils: { columella: 1 } });
    expect(a).toBeLessThan(b); expect(b).toBeLessThan(c); expect(c - a).toBeGreaterThan(0.05);
  }, 60_000);

  it('chaque narine reste dans son couloir : jamais en deçà de la columelle, jamais au-delà de 78 % de la crête alaire (douze réglages, deux côtés)', () => {
    for (const [lab, patch] of SWEEP) {
      const { n, F } = make(patch);
      for (const ng of [n.nostrils.left, n.nostrils.right]) {
        const xs = ng.poly.map((q) => Math.abs(q.x)), lo = Math.min(...xs), hi = Math.max(...xs);
        expect(lo, `${lab} bord interne`).toBeGreaterThanOrEqual(F.colHalf - 1e-6); expect(hi, `${lab} bord externe`).toBeLessThanOrEqual(F.alarX * 0.78 + 1e-6);
      }
    }
  });

  it('symétrie de la loi : à asymétrie nulle, les deux narines sont à ± la même abscisse', () => {
    const { n } = make({}); expect(n.nostrils.right.c.x).toBeCloseTo(-n.nostrils.left.c.x, 9);
  });
});

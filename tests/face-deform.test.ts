import { describe, expect, it } from 'vitest';
import { rightSamples } from '../src/face';
import { facePose, resolveExpression } from '../src/face/deform';
import { bundle } from './helpers-structure';

/** Les trois déformations (T12) : A morphologique, B articulatoire, C expressive. */
const MASSIVE = { jawWidth: 0.95, softTissue: { masseter: { volume: 0.8 } }, chin: { form: 1, projection: 0.8 } };
const bone = (b: ReturnType<typeof bundle>) => ({ gonion: b.lm.outline.keys.gonion, chinHalf: b.lm.outline.chinHalf, bone: b.g.mandible.silhouette.boneHalf, samples: rightSamples(b.lm.outline, 24).flatMap((q) => [q.x, q.y]) });

describe('A · B · C se combinent sans s\'écraser (T12)', () => {
  const rest = bundle(MASSIVE);
  const MOVES = {
    sourire: { deform: { expression: { smile: 1 } } },
    grimace: { deform: { expression: { grimace: 1 } } },
    colère: { deform: { expression: { anger: 1 } } },
    caricature: { deform: { expression: { smile: 1, grimace: 1, caricature: 1 } } },
    'parler (ouverture)': { mouth: { open: 0.7 } },
    'parler + sourire + grimace': { mouth: { open: 0.7 }, deform: { expression: { smile: 0.8, grimace: 0.5 }, articulation: { jawShift: 0.5, protrusion: 0.4 } } },
  };
  for (const [name, move] of Object.entries(MOVES)) {
    it(`mâchoire massive qui fait « ${name} » : l'os et le contour du crâne ne bougent pas`, () => {
      const b = bundle({ ...MASSIVE, ...move, mouth: { ...(move as { mouth?: object }).mouth } });
      const r = bone(rest);
      const m = bone(b);
      // Largeur osseuse, largeur du menton et largeur de la mâchoire : identiques.
      expect(m.bone).toBeCloseTo(r.bone, 9);
      expect(m.chinHalf).toBeCloseTo(r.chinHalf, 6);
      expect(m.gonion.x).toBeCloseTo(r.gonion.x, 6);
      // L'expression seule ne touche pas au contour du tout.
      if (!('mouth' in move)) expect(Math.max(...m.samples.map((v, i) => Math.abs(v - (r.samples[i] as number))))).toBeLessThan(1e-9);
    });
  }

  it('la morphologie reste lisible : une mâchoire carrée garde sa largeur de menton dans le rapport', () => {
    const a = bundle(MASSIVE).g.chin.flatness;
    const b = bundle({ ...MASSIVE, deform: { expression: { smile: 1, caricature: 1 } } }).g.chin.flatness;
    expect(b).toBeCloseTo(a, 9);
  });

  it('l\'expression est une SOMME de déplacements : sourire + grimace = sourire puis grimace (au gain 1)', () => {
    const e = (x: object) => resolveExpression(bundle({ deform: { expression: x } }).p, bundle().lm);
    const s = e({ smile: 0.5 });
    const g = e({ grimace: 0.5 });
    const sg = e({ smile: 0.5, grimace: 0.5 });
    for (const k of ['cornerLift', 'cornerOut', 'cheekRaise', 'upperLipRaise', 'lowerLipDepress', 'foldDeepen'] as const) expect(sg[k], k).toBeCloseTo(s[k] + g[k], 9);
  });

  it('la caricature multiplie tous les déplacements par 1 + 1,5 × caricature', () => {
    const lm = bundle().lm;
    const a = resolveExpression(bundle({ deform: { expression: { smile: 0.6 } } }).p, lm);
    const b = resolveExpression(bundle({ deform: { expression: { smile: 0.6, caricature: 1 } } }).p, lm);
    expect(b.cornerOut / a.cornerOut).toBeCloseTo(2.5, 9);
    expect(b.cornerLift / a.cornerLift).toBeCloseTo(2.5, 9);
  });

  it('B et C sont indépendantes : l\'expression ne lit pas l\'ouverture et l\'ouverture ne lit pas l\'expression', () => {
    const lm = bundle().lm;
    const p1 = bundle({ deform: { expression: { smile: 1 } } }).p;
    const p2 = bundle({ mouth: { open: 0.9 }, deform: { expression: { smile: 1 } } }).p;
    expect(resolveExpression(p1, lm)).toEqual(resolveExpression(p2, lm));
    // Les commissures (expression) ne dépendent pas de l'ouverture (articulation).
    expect(bundle({ deform: { expression: { smile: 1 } } }).mouth.corners.right.y).toBeCloseTo(bundle({ mouth: { open: 0.9 }, deform: { expression: { smile: 1 } } }).mouth.corners.right.y, 6);
  });

  it('les joues déformées gardent leur aire (maintien du volume) et la déformation est mesurée', () => {
    const b = bundle({ deform: { expression: { smile: 1, caricature: 0.5 } } });
    const pose = facePose(b.p, b.lm, b.g.tissue.cheeks);
    const area = (poly: readonly { x: number; y: number }[]): number => Math.abs(poly.reduce((s, q, i) => { const n = poly[(i + 1) % poly.length] as { x: number; y: number }; return s + (q.x * n.y - n.x * q.y); }, 0)) / 2;
    const rest = facePose(bundle().p, bundle().lm, bundle().g.tissue.cheeks);
    expect(area(pose.cheeks.right.poly)).toBeCloseTo(area(rest.cheeks.right.poly), 3);
    expect(pose.cheeks.right.stretch).not.toBeCloseTo(1, 4);
  });

  it('les plis sont déplacés par le champ de tissu : un sourire déplace le pli péri-buccal, pas une ligne fixe', () => {
    const a = bundle().mouth.folds.right;
    const b = bundle({ deform: { expression: { smile: 1 } } }).mouth.folds.right;
    const d = Math.max(...a.map((q, i) => Math.hypot(q.x - (b[i] as { x: number }).x, q.y - (b[i] as { y: number }).y)));
    expect(d).toBeGreaterThan(1);
    expect(bundle({ deform: { expression: { smile: 1 } } }).mouth.folds.depth).toBeGreaterThan(bundle().mouth.folds.depth);
  });
});

import { describe, expect, it } from 'vitest';
import { DEPENDENCY_RULES, measureStructure } from '../src/face/structure';
import { rightSamples } from '../src/face';
import { bundle, face, H, set, W } from './helpers-structure';

/** Valeur « extrême mais valide » posée sur chaque chemin de paramètre des règles de dépendance. */
const PUSH: Record<string, number> = { 'chin.projection': 0.95, chinWidth: 0.3, jawWidth: 0.92, 'softTissue.masseter.volume': 0.9, 'softTissue.fat': 0.9, 'mouth.open': 0.9 };
const measure = (patch: Record<string, unknown>) => measureStructure(face(patch), W, H);

describe('dépendances entre paramètres (T10)', () => {
  const rest = { mouth: { open: 0.2 } };
  for (const rule of DEPENDENCY_RULES) {
    it(`règle « ${rule.id} » : recalcule ce qu'elle annonce et laisse immobile ce qu'elle protège`, () => {
      const before = measure(rest);
      let patch: Record<string, unknown> = rest;
      for (const w of rule.when) patch = set(patch, w, PUSH[w] ?? 0.9);
      const after = measure(patch);
      for (const k of rule.recompute) {
        expect(k in before, `mesure inconnue : ${k}`).toBe(true);
        expect(Math.abs((after[k] as number) - (before[k] as number)), `à recalculer : ${k}`).toBeGreaterThan(1e-6);
      }
      for (const k of rule.preserve) {
        expect(k in before, `mesure inconnue : ${k}`).toBe(true);
        expect(Math.abs((after[k] as number) - (before[k] as number)), `à préserver : ${k}`).toBeLessThan(1e-6);
      }
    });
  }

  it('le menton qui avance n\'allonge PAS la mandibule ni n\'élargit le cou', () => {
    const a = bundle({ chin: { projection: 0.1 } });
    const b = bundle({ chin: { projection: 0.95 } });
    expect(b.g.mandible.bodyLengthPx).toBeCloseTo(a.g.mandible.bodyLengthPx, 6);
    expect(b.g.neck.halfWidthPx).toBeCloseTo(a.g.neck.halfWidthPx, 6);
    // … mais il élargit le raccord latéral et allonge l'ombre sous le menton.
    expect(b.g.chin.lateral.right.rx).toBeGreaterThan(a.g.chin.lateral.right.rx * 1.3);
    expect(b.g.neck.shadowReachPx).toBeGreaterThan(a.g.neck.shadowReachPx * 1.3);
  });

  it('le couplage menton → cou est explicite : 0 par défaut, il agit quand on le demande', () => {
    const indep = bundle({ chin: { projection: 0.95 } }).g.neck.halfWidthPx;
    const coupled = bundle({ chin: { projection: 0.95 }, neck: { chinCoupling: 1 } }).g.neck.halfWidthPx;
    const ref = bundle({ chin: { projection: 0.5 } }).g.neck.halfWidthPx;
    expect(indep).toBeCloseTo(ref, 6);
    expect(coupled).toBeGreaterThan(indep);
  });
});

describe('largeur de mâchoire décomposée (T6)', () => {
  it('silhouette = os + muscle + graisse, chaque contribution indépendante', () => {
    const s0 = bundle().g.mandible.silhouette;
    const m = bundle({ softTissue: { masseter: { volume: 1 } } }).g.mandible.silhouette;
    const f = bundle({ softTissue: { fat: 1 } }).g.mandible.silhouette;
    expect(s0.outerHalf).toBeCloseTo(s0.boneHalf, 9);
    expect(m.boneHalf).toBeCloseTo(s0.boneHalf, 9);
    expect(m.outerHalf - s0.outerHalf).toBeCloseTo(0.04 * W, 6);
    expect(f.outerHalf - s0.outerHalf).toBeCloseTo(0.03 * W, 6);
    // Une mâchoire large peut venir de l'os OU du muscle OU de la graisse : même silhouette, anatomies différentes.
    const bone = bundle({ jawWidth: s0.boneHalf * 2 / W + 0.08 }).g.mandible.silhouette;
    const muscle = bundle({ softTissue: { masseter: { volume: 1 } } }).g.mandible.silhouette;
    expect(Math.abs(bone.outerHalf - muscle.outerHalf)).toBeLessThan(0.002 * W);
    expect(bone.muscleHalf).toBe(0);
    expect(muscle.boneHalf).toBeLessThan(bone.boneHalf);
  });

  it('le serrage des mâchoires élargit la silhouette par le muscle seulement', () => {
    const a = bundle().g.mandible.silhouette;
    const b = bundle({ deform: { articulation: { clench: 1 } } }).g.mandible.silhouette;
    expect(b.boneHalf).toBeCloseTo(a.boneHalf, 9);
    expect(b.muscleHalf).toBeGreaterThan(a.muscleHalf);
  });
});

describe('mandibule sans déformer le crâne (T4)', () => {
  const cranium = (patch: Record<string, unknown>): number[] => {
    const { lm, p } = bundle(patch);
    // Crâne = contour de la tête de son sommet jusqu'à la TEMPE (premier segment du contour) : la mandibule commence sous la tempe.
    const temple = -lm.H / 2 + p.templeY * lm.H;
    return rightSamples(lm.outline, 24).filter((q) => q.y < temple - 1e-6).flatMap((q) => [q.x, q.y]);
  };
  const base = cranium({});
  for (const [name, patch] of Object.entries({
    'largeur osseuse': { jawWidth: 0.95 },
    'angle': { jaw: { angle: 0.95 } },
    'courbure du corps': { mandible: { bodyCurve: 0.05 } },
    'convergence': { jaw: { taper: 0.05 } },
    'masséter': { softTissue: { masseter: { volume: 1 } } },
    'graisse': { softTissue: { fat: 1 } },
  })) {
    it(`${name} ne bouge pas le contour du crâne (du sommet à la tempe)`, () => {
      const c = cranium(patch);
      expect(c.length).toBe(base.length);
      expect(Math.max(...c.map((v, i) => Math.abs(v - (base[i] as number))))).toBeLessThan(1e-6);
    });
  }

  it('la courbure du corps change réellement la mâchoire (sinon le test précédent serait vide)', () => {
    const a = bundle({ mandible: { bodyCurve: 0.05 } }).g.mandible.lowerBorder;
    const b = bundle({ mandible: { bodyCurve: 0.95 } }).g.mandible.lowerBorder;
    const d = Math.max(...a.map((q, i) => Math.hypot(q.x - (b[i] as { x: number }).x, q.y - (b[i] as { y: number }).y)));
    expect(d).toBeGreaterThan(1);
  });
});

describe('contour de la mandibule aux extrêmes (régression : boucles à poignée 0,68)', () => {
  it('courbure du corps 0 et 1 sur 16 visages : le contour reste monotone en y et la vérification passe', async () => {
    const { generateRandomFace } = await import('../src/generation/random-face');
    const { verifyFace } = await import('../src/verify');
    for (const bodyCurve of [0, 1]) {
      for (let s = 1; s <= 8; s++) {
        const r = verifyFace(generateRandomFace(s * 977, { structure: { patch: { mandible: { bodyCurve }, jaw: { taper: s % 2 ? 0 : 1 } } } }));
        expect(r.failures.map((c) => c.id), `bodyCurve ${bodyCurve} seed ${s * 977}`).toEqual([]);
      }
    }
  }, 180_000);
});

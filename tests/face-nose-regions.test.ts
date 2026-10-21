import { describe, expect, it } from 'vitest';
import { inPoly, polyArea } from '../src/face/poly';
import { bundle, set } from './helpers-structure';

/** Mesures NORMALISÉES des sept axes à dissocier : chacune ne doit bouger que pour SON axe (T1, T2). */
function axes(patch: Record<string, unknown>) {
  const { lm, nose } = bundle(patch);
  const xs = nose.tip.poly.map((q) => q.x);
  const ys = nose.tip.poly.map((q) => q.y);
  const R = nose.regions;
  return {
    // Longueur : de la ligne des yeux à la base du nez (c'est ce que règle `nose.length`).
    length: nose.baseY - lm.eyeY,
    width: 2 * nose.alae.right.outerX,
    // Projection : rapport projection / longueur dorsale (la contrainte anatomique 45–95 % est un RAPPORT).
    projection: nose.tip.projectionPx / (nose.baseY - nose.root.y),
    // Hauteur de la racine : distance de la ligne des yeux à la racine.
    rootHeight: lm.eyeY - nose.root.y,
    // Forme de la pointe : remplissage de sa boîte englobante (carré ≈ 1, losange ≈ 0,5).
    tipShape: Math.abs(polyArea(nose.tip.poly)) / ((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))),
    // Ouverture des narines : aire de l'ouverture rapportée au carré de la largeur du nez (sans unité).
    opening: Math.abs(polyArea(R.nostrils.right.aperture)) / (2 * nose.alae.right.outerX) ** 2,
    // Largeur de la base : demi-base rapportée à la crête alaire.
    baseWidth: R.base.halfWidth / nose.alae.right.outerX,
  };
}
type Axes = ReturnType<typeof axes>;
const VARIANTS: Record<keyof Axes, Record<string, unknown>> = {
  length: { nose: { length: 0.22 } },
  width: { nose: { width: 0.24 } },
  projection: { nose: { tip: { projection: 0.95 } } },
  rootHeight: { nose: { root: { height: 0.95 } } },
  tipShape: { nose: { tip: { roundness: 0.95 } } },
  opening: { nose: { nostrils: { opening: 0.2 } } },
  baseWidth: { nose: { base: { width: 0.9 } } },
};

describe('nez — sept axes dissociés (T2)', () => {
  const base = axes({});
  for (const [axis, patch] of Object.entries(VARIANTS) as [keyof Axes, Record<string, unknown>][]) {
    it(`l'axe « ${axis} » change sa mesure et laisse les six autres (≤ 2 %)`, () => {
      const m = axes(patch);
      // Sa propre mesure bouge d'au moins 5 %.
      expect(Math.abs(m[axis] - base[axis]) / Math.abs(base[axis])).toBeGreaterThan(0.05);
      // Les autres ne bougent pas (tolérance 2 % : arrondis des super-ellipses).
      for (const other of Object.keys(base) as (keyof Axes)[]) {
        if (other === axis) continue;
        expect(Math.abs(m[other] - base[other]) / Math.abs(base[other]), `${axis} → ${other}`).toBeLessThan(0.02);
      }
    });
  }
});

describe('nez — régions (T1)', () => {
  it('toutes les régions existent et sont des polygones valides', () => {
    const { nose } = bundle();
    const R = nose.regions;
    for (const poly of [R.sidewalls.left.poly, R.sidewalls.right.poly, R.domes.left.poly, R.domes.right.poly, R.base.poly, R.columella.poly, R.philtrum.poly, R.nostrils.left.outer, R.nostrils.left.aperture, R.nostrils.right.aperture]) {
      expect(poly.length).toBeGreaterThan(3);
      expect(Math.abs(polyArea(poly))).toBeGreaterThan(0.5);
    }
    expect(R.grooves.left.line.length).toBeGreaterThan(2);
    expect(R.philtrum.columns.left.length).toBeGreaterThan(2);
  });

  it('les régions sont symétriques gauche / droite (nez sans asymétrie)', () => {
    const { nose } = bundle({ nose: { dorsum: { deviation: 0.5 }, nostrils: { asymmetry: 0 } } });
    const R = nose.regions;
    expect(R.domes.left.c.x).toBeCloseTo(-R.domes.right.c.x, 6);
    expect(R.sidewalls.left.meanWidthPx).toBeCloseTo(R.sidewalls.right.meanWidthPx, 3);
  });

  it('la pente des parois règle leur largeur (plans plats = parois larges)', () => {
    const flat = bundle(set({}, 'nose.sidewall.slope', 0)).nose.regions.sidewalls.right.meanWidthPx;
    const steep = bundle(set({}, 'nose.sidewall.slope', 1)).nose.regions.sidewalls.right.meanWidthPx;
    expect(flat).toBeGreaterThan(steep * 1.5);
  });

  it('la séparation des dômes les écarte, et ils restent dans la pointe', () => {
    const merged = bundle(set({}, 'nose.domes.separation', 0)).nose;
    const split = bundle({ nose: { domes: { separation: 0.5 }, tip: { width: 0.8 } } }).nose;
    expect(split.regions.domes.right.c.x).toBeGreaterThan(merged.regions.domes.right.c.x);
    const inTip = split.regions.domes.right.poly.every((q) => Math.abs(q.x) <= split.tip.rx * 1.001);
    expect(inTip).toBe(true);
  });

  it('l\'ouverture sombre est toujours inscrite dans le contour de la narine, et le rebord s\'épaissit avec `rim`', () => {
    for (const rim of [0, 0.5, 1]) {
      const n = bundle({ nose: { nostrils: { rim, opening: 1 } } }).nose.regions.nostrils.right;
      // Chaque sommet de l'ouverture est dans le polygone du contour extérieur (test d'appartenance, pas une comparaison de rayons).
      const share = n.aperture.filter((q) => inPoly(n.outer, q.x, q.y)).length / n.aperture.length;
      expect(share, `rim=${rim}`).toBeGreaterThanOrEqual(0.98);
    }
    const thin = bundle(set({}, 'nose.nostrils.rim', 0)).nose.regions.nostrils.right.rimPx;
    const thick = bundle(set({}, 'nose.nostrils.rim', 1)).nose.regions.nostrils.right.rimPx;
    expect(thick).toBeGreaterThan(thin);
  });

  it('la descente de la columelle déplace son bas et celui du philtrum suit', () => {
    const up = bundle(set({}, 'nose.columella.hang', -1)).nose.regions;
    const down = bundle(set({}, 'nose.columella.hang', 1)).nose.regions;
    expect(down.columella.bottomY).toBeGreaterThan(up.columella.bottomY);
    expect(down.philtrum.lengthPx).toBeLessThan(up.philtrum.lengthPx);
  });
});

describe('nez — contraintes anatomiques (T2)', () => {
  it('sans demande extrême aucune contrainte n\'est appliquée', () => {
    expect(bundle().nose.regions.constraints).toEqual([]);
  });

  it('les contraintes ramènent la valeur et la NOTENT (rien n\'est corrigé en silence)', () => {
    const { nose } = bundle({ nose: { domes: { separation: 1 }, tip: { width: 0.1 }, nostrils: { opening: 1, visibility: 0.2 } } });
    const ids = nose.regions.constraints.map((c) => c.id);
    expect(ids).toContain('domes-inside-tip');
    expect(ids).toContain('opening-vs-visibility');
    for (const c of nose.regions.constraints) {
      expect(c.applied).not.toBe(c.requested);
      expect(c.reason.length).toBeGreaterThan(10);
    }
  });

  it('une columelle pendante extrême ne touche jamais la lèvre', () => {
    const { nose, lm } = bundle({ nose: { columella: { hang: 1 }, length: 0.26 } });
    expect(lm.lips.topY - nose.regions.columella.bottomY).toBeGreaterThanOrEqual(0.0179 * lm.H);
  });
});

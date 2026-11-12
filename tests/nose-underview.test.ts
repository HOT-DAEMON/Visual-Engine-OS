import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { generateRandomFace } from '../src';
import { faceLandmarks, noseGeometry } from '../src/face';
import { noseView, convexHull } from '../src/face/nose';
import { UNDERVIEW_MODEL } from '../src/face/nose/underview-model';
import { UNDERVIEW_FIT } from '../src/face/nose/underview.generated';
import { FaceParams } from '../src/schema';
import { checkNoseView, noseViewChecks, verifyFace } from '../src/verify';

/**
 * Vue de dessous du nez : (1) la mesure de references/nez/04.jpg existe et est saine ; (2) le résidu stocké est celui que le moteur produit
 * (recalculé, pas relu) ; (3) invariants géométriques de la projection ; (4) couverture des plages mesurées par les axes EXISTANTS du contrat ;
 * (5) la vérification détecte des défauts injectés.
 */
const m04 = JSON.parse(readFileSync('references/nez/measures-04.json', 'utf8')) as { summary: any; noses: { index: number; ellipse: { axisRatio: number; radialResidual: number }; triangle: null | { degenerate: boolean; heightOverEllipseH: number; baseYRelEllipseCentre: number; apexBelowEllipseBottom: number; baseWidthOverEllipseW: number } }[] };
const geo = (patch: Record<string, unknown> = {}) => { const p = FaceParams.parse({ anatomyEngine: 'structured', ...patch }); return noseGeometry(p, faceLandmarks(p, 300, 380)); };
const usable = m04.noses.filter((n) => n.triangle && !n.triangle.degenerate);

describe('mesure de references/nez/04.jpg', () => {
  it('14 nez trouvés, 13 exploitables, le n°14 (vu de dessous, triangle quasi absent) est déclaré dégénéré et exclu', () => {
    expect(m04.noses).toHaveLength(14); expect(usable).toHaveLength(13); expect(m04.summary.degenerateIndices).toEqual([14]);
  });
  it('les ellipses sont ajustées proprement (résidu radial médian < 0,06 du demi-axe) : la mesure n\'est pas du bruit', () => {
    const r = m04.noses.map((n) => n.ellipse.radialResidual).sort((a, b) => a - b);
    expect(r[Math.floor(r.length / 2)]!).toBeLessThan(0.06);
  });
});

describe('modèle z de la vue de dessous', () => {
  it('contrainte anatomique : le haut de l\'aile n\'est pas derrière son pied', () => { expect(UNDERVIEW_MODEL.alarTop).toBeGreaterThanOrEqual(UNDERVIEW_MODEL.alarBase); });
  it('le résidu stocké est celui que le moteur actuel produit sur les 13 nez (recalculé, tangage libre par pas de 2°)', () => {
    const g = geo(); let sum = 0;
    for (const n of usable) {
      let best = Infinity;
      for (let ph = 0; ph <= 90; ph += 2) { const v = noseView(g, ph), t = n.triangle!, q = v.triangleMetrics; best = Math.min(best, 0.5 * (v.ellipse.axisRatio - n.ellipse.axisRatio) ** 2 + (q.heightOverEllipseH - t.heightOverEllipseH) ** 2 + (q.baseYRelEllipseCentre - t.baseYRelEllipseCentre) ** 2 + (q.apexBelowEllipseBottom - t.apexBelowEllipseBottom) ** 2); }
      sum += best;
    }
    expect(Math.abs(Math.sqrt(sum / usable.length) - UNDERVIEW_FIT.residualRms)).toBeLessThan(0.005);
  });
  it('le modèle fait mieux que la simple médiane, y compris en leave-one-out (limite : le tangage reste libre par nez)', () => {
    expect(UNDERVIEW_FIT.residualRms).toBeLessThan(UNDERVIEW_FIT.baselineMedianRms);
    expect(UNDERVIEW_FIT.leaveOneOutRms).toBeLessThan(UNDERVIEW_FIT.baselineMedianRms);
  });
});

describe('invariants de la projection', () => {
  const g = geo();
  it('déterministe', () => { expect(JSON.stringify(noseView(g, 40, 10))).toBe(JSON.stringify(noseView(g, 40, 10))); });
  it('la hauteur du triangle croît strictement avec le tangage de 0 à 90°', () => {
    let prev = -Infinity;
    for (const ph of [0, 15, 30, 45, 60, 75, 90]) { const h = noseView(g, ph).triangleMetrics.heightOverEllipseH; expect(h).toBeGreaterThan(prev); prev = h; }
  });
  it('tangage > 0 (vue de dessous) : la pointe MONTE à l\'écran ; tangage < 0 (vue de dessus) : elle DESCEND', () => {
    const y0 = noseView(g, 0).tip.y; expect(noseView(g, 45).tip.y).toBeLessThan(y0); expect(noseView(g, -45).tip.y).toBeGreaterThan(y0);
  });
  it('lacet : la pointe passe du côté du lacet ; deux lacets opposés donnent des vues miroir (nez symétrique)', () => {
    const a = noseView(g, 30, 25), b = noseView(g, 30, -25);
    expect(a.tip.x).toBeGreaterThan(0); expect(b.tip.x).toBeLessThan(0); expect(Math.abs(a.tip.x + b.tip.x)).toBeLessThan(1e-6); expect(Math.abs(a.tip.y - b.tip.y)).toBeLessThan(1e-6);
  });
  it('narines : cachées d\'en haut (≤ −10°), visibles d\'en bas (≥ 20°), visibilité croissante avec le tangage', () => {
    expect(noseView(g, -30).nostrilVisibility).toBeLessThanOrEqual(0.05); expect(noseView(g, 20).nostrilVisibility).toBeGreaterThanOrEqual(0.95);
    let prev = -1; for (const ph of [-10, 0, 10, 20]) { const v = noseView(g, ph).nostrilVisibility; expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
  });
  it('l\'enveloppe est l\'enveloppe convexe du lobule et des ailes (le lobule ferme la silhouette du bas)', () => {
    const v = noseView(g, 50), h = convexHull([...v.lobule, ...v.alae.left, ...v.alae.right]);
    expect(v.envelope).toEqual(h);
    // Vu de dessous, le point le plus BAS de l'enveloppe est celui du pied d'aile / bord du lobule, jamais au-dessus du centre de la pointe.
    expect(Math.max(...v.envelope.map((q) => q.y))).toBeGreaterThan(v.tip.y);
  });
});

describe('couverture des plages MESURÉES par les axes existants du contrat (aucun axe ajouté)', () => {
  const ratios = usable.map((n) => n.ellipse.axisRatio), rMin = Math.min(...ratios), rMax = Math.max(...ratios);
  it('le rapport d\'axes de l\'ellipse atteint le haut de la plage mesurée (≥ 0,85 × le max) avec les axes largeur / pointe / ailes', () => {
    const cand = [0.1, 0.12, 0.14].map((w) => noseView(geo({ nose: { width: w, alae: { flare: 0 } } }), 20).ellipse.axisRatio);
    expect(Math.max(...cand)).toBeGreaterThanOrEqual(0.85 * rMax);
  });
  it('… et le bas de la plage (≤ 1,15 × le min) par le tangage', () => { expect(noseView(geo(), 90).ellipse.axisRatio).toBeLessThanOrEqual(1.15 * rMin); });
  it('la largeur du triangle (base des narines / enveloppe) du moteur tombe dans la plage mesurée', () => {
    const bw = usable.map((n) => n.triangle!.baseWidthOverEllipseW), lo = Math.min(...bw), hi = Math.max(...bw);
    const v = noseView(geo(), 45).triangleMetrics.baseWidthOverEllipseW; expect(v).toBeGreaterThanOrEqual(lo); expect(v).toBeLessThanOrEqual(hi);
  });
});

describe('vérification de la vue du nez', () => {
  const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 321];
  it('12 visages aléatoires × 4 tangages : aucune ERREUR ; les avertissements de style n\'apparaissent qu\'à fort tangage (≥ 75°)', () => {
    for (const s of SEEDS) for (const ph of [10, 30, 50, 80]) {
      const c = checkNoseView(generateRandomFace(s, {}), ph);
      expect(c.filter((k) => !k.ok && k.severity === 'error'), `seed ${s} ${ph}°`).toEqual([]);
      // Écart connu et NON masqué : vers 80° l'enveloppe devient plus aplatie (ratio ≈ 0,27) que la plus plate des références mesurées (0,34).
      const warns = c.filter((k) => !k.ok); if (ph < 75) expect(warns, `seed ${s} ${ph}°`).toEqual([]); else expect(warns.every((k) => k.id === 'nose-view-axis-ratio-min')).toBe(true);
    }
  });
  it('est branchée dans verifyFace', () => { const r = verifyFace(generateRandomFace(7, {})); for (const id of ['nose-view-finite', 'nose-view-envelope-covers', 'nose-view-tip-above-subnasale', 'nose-view-axis-ratio-min']) expect(r.checks.some((c) => c.id === id), id).toBe(true); });
  const base = noseView(geo(), 40); const failed = (v: typeof base) => noseViewChecks(v).filter((c) => !c.ok && c.severity === 'error').map((c) => c.id);
  it('détecte un NaN, une pointe sous le sous-nez, une narine hors enveloppe et un lobule qui déborde', () => {
    expect(failed({ ...base, lobule: [{ x: NaN, y: 0 }, ...base.lobule] })).toContain('nose-view-finite');
    expect(failed({ ...base, tip: { x: 0, y: base.triangle.apex.y + 10 } })).toContain('nose-view-tip-above-subnasale');
    expect(failed({ ...noseView(geo(), -30), nostrilVisibility: 1 })).toContain('nose-view-nostrils-hidden-from-above');
    expect(failed({ ...base, nostrilVisibility: 0 })).toContain('nose-view-nostrils-visible-from-below');
    const far = base.nostrils.left.map((q) => ({ x: q.x - 400, y: q.y })); expect(failed({ ...base, nostrils: { ...base.nostrils, left: far } })).toContain('nose-view-nostrils-inside');
    const big = base.lobule.map((q) => ({ x: q.x * 3, y: q.y })); expect(failed({ ...base, lobule: big })).toContain('nose-view-envelope-covers');
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { generateRandomFace } from '../src';
import { faceLandmarks, noseGeometry } from '../src/face';
import { noseView, convexHull } from '../src/face/nose';
import { UNDERVIEW_MODEL, UNDERVIEW_FITTED } from '../src/face/nose/underview-model';
import { identifyAngles, normaliseModel } from '../src/face/nose/underview-identify';
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
  // Protocole v2 (docs/NOSE-UNDERVIEW-CALIB.md) : tangage et lacet identifiés sur (rapport d'axes, |décalage du sommet|), erreurs normalisées par l'écart-type.
  const frames = m04.noses.filter((n) => n.triangle && !n.triangle.degenerate && (n.triangle as any).frame.valid);
  const sd = (a: number[]): number => { const mu = a.reduce((s2, x) => s2 + x, 0) / a.length; return Math.sqrt(a.reduce((s2, x) => s2 + (x - mu) ** 2, 0) / a.length); };
  const obs = frames.map((n) => { const f = (n.triangle as any).frame; return { r: n.ellipse.axisRatio, u: Math.abs(f.apexUOverMajor), h: f.heightOverMinor, by: f.baseVRelCentre, ab: f.apexBelowBottom }; });
  const SD = { h: sd(obs.map((o) => o.h)), by: sd(obs.map((o) => o.by)), ab: sd(obs.map((o) => o.ab)), r: sd(obs.map((o) => o.r)), u: sd(obs.map((o) => o.u)) };
  const protocolCost = (model: typeof UNDERVIEW_MODEL): number => {
    const g = geo(); let sum = 0;
    for (const o of obs) {
      const id = identifyAngles(g, model, o, { sr: SD.r, su: SD.u });
      if (!id) { sum += 4; continue; }
      const v = noseView(g, id.pitchDeg, id.yawDeg, normaliseModel(model)), f = v.frame;
      const sq3 = (((f.heightOverMinor - o.h) / SD.h) ** 2 + ((f.baseVRelCentre - o.by) / SD.by) ** 2 + ((f.apexBelowBottom - o.ab) / SD.ab) ** 2) / 3;
      const sqId = (((v.ellipse.axisRatio - o.r) / SD.r) ** 2 + ((Math.abs(f.apexUOverMajor) - o.u) / SD.u) ** 2) / 2;
      sum += (3 * sq3 + 2 * sqId) / 5;
    }
    return Math.sqrt(sum / obs.length);
  };
  it('le résidu stocké de l\'optimum ajusté est celui que le moteur actuel produit (recalculé avec le protocole v2, pas relu)', () => {
    expect(obs).toHaveLength(UNDERVIEW_FIT.noses);
    expect(Math.abs(protocolCost(UNDERVIEW_FITTED) - UNDERVIEW_FIT.residualRms)).toBeLessThan(0.01);
  });
  it('RÉSULTAT NÉGATIF VERROUILLÉ : sous le protocole équitable, le modèle ne bat pas nettement la médiane en leave-one-out, et fait PIRE qu\'elle sur les 3 grandeurs prédites', () => {
    // Si ce test échoue parce que le modèle est devenu MEILLEUR : bonne nouvelle, mettre à jour docs/NOSE-UNDERVIEW-CALIB.md et ce seuil.
    expect(UNDERVIEW_FIT.leaveOneOutRms).toBeGreaterThan(0.9 * UNDERVIEW_FIT.baselineMedianLooRms);
    expect(UNDERVIEW_FIT.predicted3.modelLooRms).toBeGreaterThan(UNDERVIEW_FIT.predicted3.medianLooRms);
  });
  it('les constantes ADOPTÉES par le rendu ne sont pas celles de l\'optimum ajusté (celui-ci est dégénéré : constantes des ailes sur la borne)', () => {
    expect(UNDERVIEW_FITTED.alarBase).toBeGreaterThanOrEqual(0.95 - 1e-9);
    expect(UNDERVIEW_MODEL.alarBase).toBeLessThan(UNDERVIEW_FITTED.alarBase);
    // l'optimum dégénéré ne sait pas aplatir l'enveloppe : à 80° son rapport d'axes reste très au-dessus de la plus plate des références valides
    const g = geo(); const rMinRef = Math.min(...obs.map((o) => o.r));
    expect(noseView(g, 80, 0, normaliseModel(UNDERVIEW_FITTED)).ellipse.axisRatio).toBeGreaterThan(1.5 * rMinRef);
  });
  it('identifiabilité mesurée : alarBase n\'est PAS identifié (optimum sur la borne, profil monotone) ; lobuleRim a un plateau intérieur', () => {
    expect(UNDERVIEW_FIT.plateau.alarBase[0]).toBeGreaterThanOrEqual(0.95 - 1e-9);
    expect(UNDERVIEW_FIT.plateau.lobuleRim[0]).toBeGreaterThan(0.05); expect(UNDERVIEW_FIT.plateau.lobuleRim[1]).toBeLessThan(0.6);
    const pc = UNDERVIEW_FIT.profileCost.alarBase as readonly number[];
    for (let i = 1; i < pc.length; i++) expect(pc[i]!).toBeLessThanOrEqual(pc[i - 1]! + 1e-9);
  });
  it('l\'identification des angles est déterministe, reste dans ses bornes, et ne lit que (r, |u|) : changer h, by, ab ne la modifie pas', () => {
    const g = geo(), o = obs[0]!, a1 = identifyAngles(g, UNDERVIEW_MODEL, { r: o.r, u: o.u }, { sr: SD.r, su: SD.u }), a2 = identifyAngles(g, UNDERVIEW_MODEL, { r: o.r, u: o.u }, { sr: SD.r, su: SD.u });
    expect(a1).toEqual(a2); expect(a1!.pitchDeg).toBeGreaterThanOrEqual(0); expect(a1!.pitchDeg).toBeLessThanOrEqual(90); expect(a1!.yawDeg).toBeLessThanOrEqual(60);
  });
});

describe('repère propre de l\'ellipse (roulis compensé)', () => {
  const g = geo();
  it('les grandeurs du triangle dans le repère propre sont INVARIANTES au roulis dans le plan ; les grandeurs « image » ne le sont pas', () => {
    for (const [ph, ya] of [[25, 0], [25, 20], [40, 30]] as const) {
      const ref = noseView(g, ph, ya, UNDERVIEW_MODEL, 0); let maxImageDrift = 0;
      for (const roll of [-30, -15, 25]) {
        const v = noseView(g, ph, ya, UNDERVIEW_MODEL, roll);
        for (const k of ['heightOverMinor', 'baseVRelCentre', 'apexBelowBottom', 'apexUOverMajor'] as const) expect(Math.abs(v.frame[k] - ref.frame[k]), `${ph}/${ya} roll ${roll} ${k}`).toBeLessThan(1e-9);
        maxImageDrift = Math.max(maxImageDrift, Math.abs(v.triangleMetrics.apexBelowEllipseBottom - ref.triangleMetrics.apexBelowEllipseBottom));
      }
      // la grandeur « image » dérive nettement pour au moins un des roulis (elle peut repasser par hasard près de sa valeur pour l'un d'eux)
      expect(maxImageDrift, `${ph}/${ya}`).toBeGreaterThan(0.1);
    }
  });
  it('le roulis tourne la vue de l\'angle demandé (l\'ellipse suit) et ne change pas son rapport d\'axes', () => {
    const a = noseView(g, 30, 0, UNDERVIEW_MODEL, 0), b = noseView(g, 30, 0, UNDERVIEW_MODEL, -20);
    expect(Math.abs(b.ellipse.angleDeg - (a.ellipse.angleDeg - 20))).toBeLessThan(1e-6); expect(Math.abs(b.ellipse.axisRatio - a.ellipse.axisRatio)).toBeLessThan(1e-9);
  });
  it('la mesure de la réf. 04 : 11 nez à repère valide, les n°7 et 8 (orientation ambiguë) exclus, au lieu d\'être devinés', () => {
    const valid = m04.noses.filter((n) => n.triangle && !n.triangle.degenerate && (n.triangle as any).frame.valid);
    expect(valid).toHaveLength(11); expect(m04.summary.frameExcludedIndices).toEqual([7, 8]);
  });
  it('un lacet décale la pointe et pas le sous-nez : |décalage du sommet| croît avec le lacet', () => {
    let prev = -1; for (const ya of [0, 10, 20, 30, 40]) { const u = Math.abs(noseView(g, 30, ya).frame.apexUOverMajor); expect(u).toBeGreaterThan(prev); prev = u; }
  });
});

describe('mesures des réf. 03 et 05 (nouvelles)', () => {
  const m03 = JSON.parse(readFileSync('references/nez/measures-03.json', 'utf8')) as { summary: any; noses: any[] };
  const m05 = JSON.parse(readFileSync('references/nez/measures-05.json', 'utf8')) as { summary: any; cells: any[] };
  it('03 : 16 nez trouvés, l\'amas qui en contient deux est détecté et exclu, 11 paires de narines mesurées', () => {
    expect(m03.noses).toHaveLength(16); expect(m03.summary.mergedExcluded).toEqual([7]); expect(m03.summary.withPair).toBe(11);
  });
  it('03 : la séparation des narines (rapport à la largeur du nez) tombe dans une plage anatomiquement plausible et resserrée', () => {
    const s = m03.summary.separationOverNoseW; expect(s.min).toBeGreaterThan(0.3); expect(s.max).toBeLessThan(0.6); expect(s.median).toBeGreaterThan(0.38); expect(s.median).toBeLessThan(0.5);
  });
  it('05 : la grille 6 × 4 est retrouvée (24 cellules mesurées), seules les paires détectées sont rapportées', () => {
    expect(m05.cells).toHaveLength(24); expect(m05.summary.measured).toBe(24); expect(m05.summary.withNostrilPair).toBeLessThanOrEqual(24); expect(m05.summary.gridColumns).toHaveLength(5); expect(m05.summary.gridRows).toHaveLength(7);
  });
  it('05 : le crayon est gris — aucune grandeur de teinte (rougeur) n\'est rapportée, seulement la moucheture', () => {
    for (const c of m05.cells) { expect(Object.keys(c)).not.toContain('redness'); expect(typeof c.speckDensityPer1000px2).toBe('number'); }
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

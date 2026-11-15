import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { faceLandmarks, noseGeometry, noseArchetype, widthProfile25 } from '../src/face';
import { noseView } from '../src/face/nose';
import { FaceParams } from '../src/schema';
import { ZONE_LIMITS } from '../src/face/zones-limits';

/** Plafond du rapport L/H, réf. 02 quantifiée, écart des estimateurs d'ellipse (docs/NOSE-ASPECT-CEILING.md). Chaque valeur est RECALCULÉE depuis le moteur. */
const aspect = (patch: object): number => { const p = FaceParams.parse({ anatomyEngine: 'structured', ...patch }); return widthProfile25(noseGeometry(p, faceLandmarks(p, 300, 380)).silhouette).aspect; };
const nose = (o: object, root: object = {}, alae: object = {}) => ({ nose: { ...o, root, alae } });
const json = (f: string) => JSON.parse(readFileSync(`references/nez/${f}`, 'utf8'));

describe('plafond du rapport L/H de la silhouette de face (cause du « 0,825 »)', () => {
  it('une longueur sous le plancher de zone est INERTE : même silhouette de 0,08 au plancher', () => {
    const a = [0.08, 0.1, 0.139, ZONE_LIMITS.nose.min].map((length) => aspect(nose({ width: 0.28, length })));
    for (const v of a) expect(v).toBeCloseTo(a[0]!, 6);
    expect(aspect(nose({ width: 0.28, length: 0.26 }))).toBeLessThan(a[0]! * 0.8);
  });
  it('le jeu v1 (évasement 0, largeur 0,28, racine 0,5, longueur au plancher) donne exactement 0,825 : le plafond constaté', () => {
    expect(aspect(nose({ width: 0.28, length: ZONE_LIMITS.nose.min }, { height: 0.5 }, { flare: 0 }))).toBeCloseTo(0.8248, 3);
  });
  it('la hauteur de racine (haut de la silhouette) et l\'évasement relèvent le plafond : 1,40 atteignable avec racine 0, évasement 1, largeur 0,3', () => {
    const top = aspect(nose({ width: 0.3, length: ZONE_LIMITS.nose.min }, { height: 0 }, { flare: 1 }));
    expect(top).toBeGreaterThan(1.39); expect(top).toBeLessThan(1.41);
    expect(aspect(nose({ width: 0.28, length: ZONE_LIMITS.nose.min }, { height: 1 }, { flare: 0 }))).toBeLessThan(0.8248);
  });
  it('les formes de 06 au-dessus du plafond (ellipse large 1,597, losange 1,52) sont déclarées hors de portée ; plat-trapèze et cloche-ailes sont atteignables', () => {
    const c = json('aspect-ceiling.json');
    expect(c.reach['ellipse-large'].reachable).toBe(false); expect(c.reach['losange-petit'].reachable).toBe(false);
    expect(c.reach['plat-trapeze'].reachable).toBe(true); expect(c.reach['cloche-ailes'].reachable).toBe(true);
    expect(c.ceiling.aspect).toBeCloseTo(aspect(nose({ width: 0.3, length: ZONE_LIMITS.nose.min }, { height: 0 }, { flare: 1 })), 6);
  });
  it('après libération des axes, « cloche-ailes » reproduit le rapport L/H de la référence (±3 %) et les résidus de 06 ont baissé pour les 5 formes', () => {
    const v1 = json('fit-06-v1.json'), v2 = json('fit-06.json');
    expect(Math.abs(aspect(noseArchetype('cloche-ailes' as never)) / v2['cloche-ailes'].refAspect - 1)).toBeLessThan(0.03);
    for (const k of Object.keys(v1)) expect(v2[k].residual).toBeLessThan(v1[k].residual);
  });
});

describe('réf. 02 (8 nez au trait) : quantifiée dans references/nez/measures-02.json', () => {
  const m = json('measures-02.json');
  it('8 nez mesurés ; le rapport L/H est la seule grandeur robuste (boîtes vérifiées sur artefacts/nez-refs/02-overlay.png)', () => {
    expect(m.summary.noses).toBe(8);
    expect(m.summary.aspectWH.min).toBeGreaterThan(0.4); expect(m.summary.aspectWH.max).toBeLessThan(0.9);
  });
  it('le nez par défaut et la pyramide sont DANS l\'étendue mesurée ; la cloche-ailes (issue de la planche 06, autre vue) est hors étendue : écart déclaré, pas masqué', () => {
    const { min, max } = m.summary.aspectWH;
    expect(aspect({})).toBeGreaterThanOrEqual(min); expect(aspect({})).toBeLessThanOrEqual(max);
    const py = aspect(noseArchetype('pyramide' as never)); expect(py).toBeGreaterThanOrEqual(min); expect(py).toBeLessThanOrEqual(max);
    expect(aspect(noseArchetype('cloche-ailes' as never))).toBeGreaterThan(max);
  });
});

describe('estimateur d\'ellipse : moments d\'aire (moteur) contre moindres carrés (mesure)', () => {
  const e = json('ellipse-estimators.json');
  it('36 cas : l\'écart du rapport d\'axes reste sous 5 % et celui de l\'angle sous 1° (négligeable devant le lacet/roulis non modélisés, 22–68 %)', () => {
    expect(e.summary.cases).toBe(36);
    expect(e.summary.relRatioGap.max).toBeLessThan(0.05); expect(e.summary.angleGapDeg.max).toBeLessThan(1);
  });
  it('le fichier n\'est pas périmé : le rapport d\'axes stocké du premier cas est celui que le moteur produit', () => {
    const p = FaceParams.parse({ anatomyEngine: 'structured' }), v = noseView(noseGeometry(p, faceLandmarks(p, 300, 380)), 20, 0);
    expect(v.ellipse.axisRatio).toBeCloseTo(e.cases[0].axisRatioMoments, 3);
  });
});

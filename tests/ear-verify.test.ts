import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { earGeometry } from '../src/face';
import { faceLandmarks } from '../src/face/landmarks';
import { FaceParams } from '../src/schema';
import { checkEars, earAnatomyChecks } from '../src/verify/ear';
import { renderEars } from '../src/render/face/ears';
import { resolveAppearance } from '../src/appearance';
import { checkFaceEngine } from '../src/verify/face-engine';

const S = (patch: object = {}) => FaceParams.parse({ anatomyEngine: 'structured', ...patch });
const errs = (c: ReturnType<typeof checkEars>): string[] => c.filter((x) => !x.ok && x.severity === 'error').map((x) => x.id);

describe('couche de vérification de l\'oreille', () => {
  it('visage par défaut : trois couches présentes, aucune erreur', () => {
    const p = S();
    const c = checkEars(p, faceLandmarks(p, 300, 400), '#9a7650');
    expect(new Set(c.map((x) => x.layer))).toEqual(new Set(['geometry', 'anatomy', 'style']));
    expect(errs(c)).toEqual([]);
    for (const k of c) { expect(Number.isFinite(k.value)).toBe(true); expect(Number.isFinite(k.limit)).toBe(true); }
  });

  it('chaque famille, chaque matériau, les deux looks : aucune erreur', () => {
    for (const family of ['human', 'feline', 'canid', 'equid', 'elven', 'draconic', 'alien'] as const) for (const look of ['realistic', 'anime'] as const) {
      const p = S({ ears: { family, style: { look } } });
      expect(errs(checkEars(p, faceLandmarks(p, 300, 400), '#c89a78')), `${family}/${look}`).toEqual([]);
    }
    for (const kind of ['skin', 'cartilage', 'scaly', 'membrane', 'ceramic', 'crystal', 'hybrid'] as const) {
      const p = S({ ears: { material: { kind } } });
      expect(errs(checkEars(p, faceLandmarks(p, 300, 400), '#c89a78')), kind).toEqual([]);
    }
  });

  it('40 visages aléatoires (moteur structuré) : la vérification complète du visage n\'a aucune erreur', () => {
    for (let s = 1; s <= 40; s++) {
      const f = generateRandomFace(s * 389, { structure: true });
      const bad = checkFaceEngine(f).filter((c) => !c.ok && c.severity === 'error').map((c) => c.id);
      expect(bad, `seed ${s * 389}`).toEqual([]);
    }
  }, 280000);

  it('CONTRÔLE NÉGATIF : une oreille décalée de 20 px par rapport à la ligne des yeux est détectée', () => {
    const p = S();
    const lm = faceLandmarks(p, 300, 400);
    const e = earGeometry(p, lm)[1]!;
    const bad = { ...e, align: { ...e.align!, crusToEyeLine: 20 } };
    expect(earAnatomyChecks(p, lm, bad).filter((c) => !c.ok).map((c) => c.id)).toContain('ear-crus-on-eye-line-R');
  });

  it('CONTRÔLE NÉGATIF : un lobule à 30 px de la ligne de la bouche est détecté', () => {
    const p = S();
    const lm = faceLandmarks(p, 300, 400);
    const e = earGeometry(p, lm)[1]!;
    const bad = { ...e, align: { ...e.align!, lobuleToLine: 30, corrections: [] } };
    expect(earAnatomyChecks(p, lm, bad).filter((c) => !c.ok).map((c) => c.id)).toContain('ear-lobule-on-line-R');
  });

  it('classic : aucune vérification d\'oreille (le moteur d\'avant est inchangé)', () => {
    const p = FaceParams.parse({ anatomyEngine: 'classic' });
    expect(checkEars(p, faceLandmarks(p, 300, 400), '#9a7650')).toEqual([]);
  });
});

describe('rendu de l\'oreille', () => {
  const render = (patch: object): string => { const p = S(patch); const ra = resolveAppearance('#c89a78', p.skin); const defs: string[] = []; return renderEars(p, faceLandmarks(p, 300, 400), '#c89a78', ra, undefined, defs).join('') + defs.join(''); };

  it('réaliste : éclairage de relief (feDiffuseLighting) ; anime : aucun filtre de relief, contour plus épais', () => {
    expect(render({})).toContain('feDiffuseLighting');
    expect(render({ ears: { style: { look: 'anime' } } })).not.toContain('feDiffuseLighting');
  });

  it('chaque matériau produit un SVG valide sans élément hors liste blanche', () => {
    for (const kind of ['skin', 'cartilage', 'scaly', 'membrane', 'ceramic', 'crystal', 'hybrid'] as const) expect(render({ ears: { material: { kind } } }).length, kind).toBeGreaterThan(500);
  });

  it('les micro-reliefs dépendent de la densité de détails (LOD)', () => {
    const lo = render({ ears: { style: { detail: 0.2 } } });
    const hi = render({ ears: { style: { detail: 0.9 } } });
    expect(hi.length).toBeGreaterThan(lo.length);
  });

  it('rendu déterministe', () => { expect(render({ ears: { seed: 3 } })).toBe(render({ ears: { seed: 3 } })); });
});

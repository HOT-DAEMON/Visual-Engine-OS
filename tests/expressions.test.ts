import { describe, expect, it } from 'vitest';
import { applyExpression } from '../src/expressions';
import { compileScene, EyeSpec } from '../src';

const eye = (over: Record<string, unknown> = {}) => EyeSpec.parse({ id: 'e', kind: 'eye', ...over });
const ALL_KINDS = [
  'angry',
  'sad',
  'fearful',
  'anguished',
  'melancholic',
  'drowsy',
  'surprised',
  'sulky',
  'furious',
  'joyful',
  'smiling',
  'fierce',
  'stressed',
] as const;
function svgOf(input: unknown): string {
  const r = compileScene(input);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
}

describe('applyExpression', () => {
  it('sans expression : retourne EXACTEMENT la même référence (aucun recalcul)', () => {
    const e = eye();
    expect(applyExpression(e)).toBe(e);
  });

  it("kind='neutral' ou intensity=0 : identité, même référence", () => {
    const e1 = eye({ expression: { kind: 'neutral', intensity: 1 } });
    expect(applyExpression(e1)).toBe(e1);
    const e2 = eye({ expression: { kind: 'angry', intensity: 0 } });
    expect(applyExpression(e2)).toBe(e2);
  });

  it('est pure : n\'altère pas l\'entrée', () => {
    const e = eye({ expression: { kind: 'angry', intensity: 1 } });
    const before = JSON.stringify(e);
    applyExpression(e);
    expect(JSON.stringify(e)).toBe(before);
  });

  it('est déterministe', () => {
    const e = eye({ expression: { kind: 'sad', intensity: 0.6 } });
    expect(applyExpression(e)).toEqual(applyExpression(e));
  });

  it('ne modifie ni les couleurs ni la géométrie de l\'iris/sclère/cils/canthi/pli', () => {
    const e = eye({ expression: { kind: 'fearful', intensity: 1 } });
    const out = applyExpression(e);
    expect(out.iris).toBe(e.iris);
    expect(out.sclera).toBe(e.sclera);
    expect(out.lashes).toBe(e.lashes);
    expect(out.canthi).toBe(e.canthi);
    expect(out.epicanthicFold).toBe(e.epicanthicFold);
    expect(out.highlights).toBe(e.highlights);
  });

  it('l\'intensité met à l\'échelle linéairement l\'effet (0.5 = moitié de l\'écart à 1)', () => {
    const base = eye();
    const half = applyExpression(eye({ expression: { kind: 'angry', intensity: 0.5 } }));
    const full = applyExpression(eye({ expression: { kind: 'angry', intensity: 1 } }));
    const dHalf = base.shape.openness - half.shape.openness;
    const dFull = base.shape.openness - full.shape.openness;
    expect(dHalf).toBeCloseTo(dFull / 2, 6);
  });

  it('reste dans les bornes du schéma même à intensité 1 sur des valeurs déjà extrêmes', () => {
    const e = eye({ shape: { openness: 1.2 }, expression: { kind: 'fearful', intensity: 1 } });
    const out = applyExpression(e);
    expect(out.shape.openness).toBeLessThanOrEqual(1.2);
    expect(out.shape.openness).toBeGreaterThanOrEqual(0.05);
    const drowsy = applyExpression(eye({ shape: { openness: 0.05 }, expression: { kind: 'drowsy', intensity: 1 } }));
    expect(drowsy.shape.openness).toBeGreaterThanOrEqual(0.05);
  });

  it('eyebrow: null reste null après expression (pas de sourcil recréé)', () => {
    const out = applyExpression(eye({ eyebrow: null, expression: { kind: 'angry', intensity: 1 } }));
    expect(out.eyebrow).toBeNull();
  });

  it('angry ferme l\'œil et abaisse/incline le sourcil ; fearful l\'ouvre et le relève', () => {
    const base = eye();
    const angry = applyExpression(eye({ expression: { kind: 'angry', intensity: 1 } }));
    const fearful = applyExpression(eye({ expression: { kind: 'fearful', intensity: 1 } }));
    expect(angry.shape.openness).toBeLessThan(base.shape.openness);
    expect(fearful.shape.openness).toBeGreaterThan(base.shape.openness);
    expect(angry.eyebrow?.gap).toBeLessThan(base.eyebrow?.gap as number);
    expect(fearful.eyebrow?.gap).toBeGreaterThan(base.eyebrow?.gap as number);
  });

  it('chaque expression non neutre produit un résultat différent du neutre', () => {
    const base = eye();
    for (const kind of ALL_KINDS) {
      const out = applyExpression(eye({ expression: { kind, intensity: 1 } }));
      expect(out).not.toEqual(base);
    }
  });

  it('les 13 expressions non neutres sont toutes DEUX À DEUX distinctes (aucun doublon de pose)', () => {
    const outputs = ALL_KINDS.map((kind) => JSON.stringify(applyExpression(eye({ expression: { kind, intensity: 1 } }))));
    expect(new Set(outputs).size).toBe(ALL_KINDS.length);
  });

  it('joyful et smiling restent distincts malgré leur proximité sémantique (ouverture : agrandie vs plissée)', () => {
    const base = eye();
    const joyful = applyExpression(eye({ expression: { kind: 'joyful', intensity: 1 } }));
    const smiling = applyExpression(eye({ expression: { kind: 'smiling', intensity: 1 } }));
    expect(joyful.shape.openness).toBeGreaterThan(base.shape.openness);
    expect(smiling.shape.openness).toBeLessThan(base.shape.openness);
  });

  it('furious va plus loin qu\'angry sur chaque axe de tension (pas un simple alias)', () => {
    const angry = applyExpression(eye({ expression: { kind: 'angry', intensity: 1 } }));
    const furious = applyExpression(eye({ expression: { kind: 'furious', intensity: 1 } }));
    expect(furious.shape.openness).toBeLessThan(angry.shape.openness);
    expect(furious.eyebrow?.pinch).toBeGreaterThanOrEqual(angry.eyebrow?.pinch as number);
  });

  it('surprised se distingue de fearful par l\'absence de convergence des sourcils (browPinch quasi nul)', () => {
    const surprised = applyExpression(eye({ expression: { kind: 'surprised', intensity: 1 } }));
    const fearful = applyExpression(eye({ expression: { kind: 'fearful', intensity: 1 } }));
    expect(Math.abs(surprised.eyebrow?.pinch as number)).toBeLessThan(Math.abs(fearful.eyebrow?.pinch as number));
  });
});

describe('intégration : expression dans compileEye', () => {
  it('se rend sans erreur pour toutes les émotions, à toute intensité', () => {
    for (const kind of ['neutral', ...ALL_KINDS] as const) {
      for (const intensity of [0, 0.3, 1]) {
        const svg = svgOf({ objects: [{ kind: 'eye', id: 'e', expression: { kind, intensity } }] });
        expect(svg).not.toMatch(/NaN|Infinity/);
      }
    }
  });

  it('deux intensités différentes produisent des SVG différents (sauf neutral)', () => {
    const low = svgOf({ objects: [{ kind: 'eye', id: 'e', expression: { kind: 'sad', intensity: 0.2 } }] });
    const high = svgOf({ objects: [{ kind: 'eye', id: 'e', expression: { kind: 'sad', intensity: 1 } }] });
    expect(low).not.toBe(high);
  });
});

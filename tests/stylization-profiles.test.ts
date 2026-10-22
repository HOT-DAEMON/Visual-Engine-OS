import { describe, expect, it } from 'vitest';
import { FaceParams } from '../src/schema';
import { faceLandmarks } from '../src/face';
import { applyStylization, isNeutralProfile, relationsOf, STYLIZATION_PROFILES, withProfile, type StylizationProfileName } from '../src/face/stylize';
import { measureFace } from '../src/face/contracts';
import { resolveExpression } from '../src/face/deform/expression';

const names = Object.keys(STYLIZATION_PROFILES) as StylizationProfileName[];

describe('profils de stylisation nommés', () => {
  it.each(names)('profil « %s » : valide, idempotent, relations anatomiques préservées', (name) => {
    const p = applyStylization(FaceParams.parse(withProfile({ anatomyEngine: 'structured' }, name)));
    expect(applyStylization(p)).toEqual(p);
    const lm = faceLandmarks(p, 300, 380);
    for (const r of relationsOf(lm)) expect(r.margin, `${name} : ${r.id} — ${r.message}`).toBeGreaterThanOrEqual(-1e-6);
  });
  it('« realiste » est le profil neutre ; les autres exagèrent réellement (mesure de la mâchoire ou de la bouche)', () => {
    expect(isNeutralProfile(FaceParams.parse(withProfile({ anatomyEngine: 'structured' }, 'realiste')).stylization)).toBe(true);
    const base = measureFace(FaceParams.parse(withProfile({ anatomyEngine: 'structured' }, 'realiste')), 300, 380);
    const car = measureFace(FaceParams.parse(withProfile({ anatomyEngine: 'structured' }, 'caricature')), 300, 380);
    expect(Math.abs(car['chin.projectionPx']! - base['chin.projectionPx']!) + Math.abs(car['mouth.halfWidthPx']! - base['mouth.halfWidthPx']!)).toBeGreaterThan(1);
  });
});

describe('quatre nouveaux axes d\'expression (surprise, dégoût, dédain, « o »)', () => {
  const AXES = ['surprise', 'disgust', 'disdain', 'ooh'] as const;
  const face = (e: Record<string, number>) => FaceParams.parse({ anatomyEngine: 'structured', deform: { expression: e } });
  const neutral = measureFace(face({}), 300, 380);
  it.each(AXES)('%s : change la bouche, ne touche JAMAIS l\'os (crâne, mandibule)', (ax) => {
    const m = measureFace(face({ [ax]: 1 }), 300, 380);
    const mouthChanged = Object.keys(m).filter((k) => k.startsWith('mouth.') && Math.abs(m[k]! - neutral[k]!) > 1e-9);
    expect(mouthChanged.length, `${ax} ne change aucune mesure de bouche`).toBeGreaterThan(0);
    for (const k of Object.keys(m).filter((k) => k.startsWith('cranium.') || k.startsWith('mandible.'))) expect(m[k]).toBeCloseTo(neutral[k]!, 9);
  });
  it('les pulsions se SOMMENT (gain 1) : surprise + dégoût = surprise + dégoût', () => {
    const lm = faceLandmarks(face({}), 300, 380);
    const a = resolveExpression(face({ surprise: 0.5 }), lm); const b = resolveExpression(face({ disgust: 0.5 }), lm); const ab = resolveExpression(face({ surprise: 0.5, disgust: 0.5 }), lm);
    expect(ab.upperLipRaise).toBeCloseTo(a.upperLipRaise + b.upperLipRaise, 9);
    expect(ab.noseFlare).toBeCloseTo(a.noseFlare + b.noseFlare, 9);
  });
  it('neutre : aucune pulsion', () => {
    const pulls = resolveExpression(face({}), faceLandmarks(face({}), 300, 380));
    for (const [k, v] of Object.entries(pulls)) if (k !== 'gain') expect(Math.abs(v), k).toBeLessThan(1e-12);
  });
});

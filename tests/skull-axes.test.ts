import { describe, expect, it } from 'vitest';
import { generateRandomProfile } from '../src/generation/random-skull';
import { AXIS_FREE, CI_BOUNDS, CI_FREE, DERIVED_AXES, deriveSkull, targetIndex } from '../src/skull/derive';
import { renderProfile } from '../src/skull/render';
import { verifyProfile } from '../src/verify/skull';

const full = (s: number, face = generateRandomProfile(s).face.params) => {
  const P = generateRandomProfile(s);
  return { P, rep: verifyProfile(face, P.skull, { skin: P.skin, hair: P.hair, eye: P.eye, faceSize: { width: P.face.width, height: P.face.height }, derivation: P.derivation }) };
};

describe('dérivation du crâne depuis la face', () => {
  it('indice céphalique cible monotone et borné', () => {
    expect(targetIndex(0.9)).toBeGreaterThan(targetIndex(0.7));
    for (const r of [0.5, 0.71, 0.8, 0.91, 1.2]) expect(targetIndex(r)).toBeGreaterThanOrEqual(CI_BOUNDS[0]);
    expect(targetIndex(2)).toBeLessThanOrEqual(CI_BOUNDS[1]);
  });
  it('la variation libre est bornée (indice et axes) quel que soit le tirage', () => {
    const P = generateRandomProfile(3);
    for (const v of [-9, -1, 0, 1, 9]) {
      const D = deriveSkull(P.face.params, P.face.width / P.face.height, {}, { ci: v, axes: Object.fromEntries(DERIVED_AXES.map((a) => [a, v])) });
      expect(Math.abs(D.ci.free)).toBeLessThanOrEqual(CI_FREE + 1e-12);
      for (const a of DERIVED_AXES) expect(Math.abs(D.axes[a].free)).toBeLessThanOrEqual(AXIS_FREE + 1e-12);
      expect(D.ci.applied).toBeGreaterThanOrEqual(CI_BOUNDS[0]);
      expect(D.ci.applied).toBeLessThanOrEqual(CI_BOUNDS[1]);
    }
  });
  it('une face plus large donne une tête plus large et un indice plus élevé (sans variation libre)', () => {
    const P = generateRandomProfile(5);
    const a = deriveSkull(P.face.params, 0.72, {}), b = deriveSkull(P.face.params, 0.9, {});
    expect(b.breadthH).toBeGreaterThan(a.breadthH);
    expect(b.ci.applied).toBeGreaterThan(a.ci.applied);
  });
  it('les axes dérivés suivent la face (pommettes, cou)', () => {
    const P = generateRandomProfile(5);
    const hi = { ...P.face.params, cheek: { ...P.face.params.cheek, boneProjection: 0.95, lateralWidth: 0.95 }, neck: { ...P.face.params.neck, width: 0.7 } };
    const lo = { ...P.face.params, cheek: { ...P.face.params.cheek, boneProjection: 0.05, lateralWidth: 0.05 }, neck: { ...P.face.params.neck, width: 0.2 } };
    const a = deriveSkull(hi, 0.8, {}), b = deriveSkull(lo, 0.8, {});
    expect(a.skull.zygoma).toBeGreaterThan(b.skull.zygoma);
    expect(a.skull.neckDepth).toBeGreaterThan(b.skull.neckDepth);
  });
});

describe('profil branché sur les moteurs de la face + contrôles croisés', () => {
  it('40 graines : aucune erreur de vérification (géométrie, anatomie, style, croisé)', () => {
    for (let s = 1; s <= 40; s++) expect(full(s).rep.failures.map((f) => `${s}:${f.id}`)).toEqual([]);
  });
  it('le profil est déterministe', () => {
    const P = generateRandomProfile(9);
    const o = { skin: P.skin, hair: P.hair, eye: P.eye };
    expect(renderProfile(P.face.params, P.skull, o).svg).toBe(renderProfile(P.face.params, P.skull, o).svg);
  });
  it('chauve : pas de cheveux ; sans pilosité : pas de barbe ; avec : présents', () => {
    const P = generateRandomProfile(8);
    const o = { skin: P.skin, hair: P.hair, eye: P.eye };
    const bald = renderProfile({ ...P.face.params, hair: { ...P.face.params.hair, style: 'bald' }, facialHair: { ...P.face.params.facialHair, beard: 'none', mustache: 'none', sideburns: 'none' } }, P.skull, o);
    expect(bald.shapes.hair).toBeNull();
    expect(bald.shapes.beard).toBeNull();
    const bearded = renderProfile({ ...P.face.params, hair: { ...P.face.params.hair, style: 'long' }, facialHair: { ...P.face.params.facialHair, beard: 'full', mustache: 'full' } }, P.skull, o);
    expect(bearded.shapes.hair).not.toBeNull();
    expect(bearded.shapes.beard).not.toBeNull();
  });
  it('un contrôle croisé détecte une incohérence (œil de profil agrandi de 50 % sans que la face change)', () => {
    const P = generateRandomProfile(8);
    const f = { ...P.face.params, hair: { ...P.face.params.hair, style: 'short' as const } };
    const rep = verifyProfile(f, P.skull, { skin: P.skin, hair: P.hair, eye: { ...P.eye, heightH: P.eye.heightH * 1.5 }, faceEyeHeightH: P.eye.heightH, faceSize: { width: P.face.width, height: P.face.height }, derivation: P.derivation });
    expect(rep.failures.map((x) => x.id)).toContain('eye-height-matches-face');
  });
});

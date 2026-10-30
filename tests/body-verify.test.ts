import { describe, expect, it } from 'vitest';
import { ARCHETYPE_NAMES, BodyParams, bodyGeometry, generateBody, renderBody } from '../src/body';
import type { BodyGeo } from '../src/body/geometry';
import { verifyBody } from '../src/verify';
import { referenceAnchor } from './body-helpers';

const A = referenceAnchor();
const SKIN = '#c99a76';
const rep = (g: BodyGeo) => verifyBody(g, renderBody(g, { skin: SKIN }), SKIN);
const fails = (g: BodyGeo) => rep(g).checks.filter((c) => !c.ok).map((c) => `${c.layer}/${c.id}=${c.value}`);

describe('vérification du rendu du corps — 3 couches', () => {
  it('13 archétypes × 8 graines : aucune erreur NI avertissement, sur les 3 couches', () => {
    for (const n of ARCHETYPE_NAMES) for (let s = 1; s <= 8; s++) expect(fails(bodyGeometry(generateBody(s * 17, n), A)), `${n}#${s}`).toEqual([]);
  });
  it('les trois couches (géométrie, anatomie, style) sont toutes exercées', () => {
    const layers = new Set(rep(bodyGeometry({}, A)).checks.map((c) => c.layer));
    expect([...layers].sort()).toEqual(['anatomy', 'geometry', 'style']);
  });
  it('le contrôle GÉOMÉTRIQUE échoue sur un point non fini', () => {
    const g = bodyGeometry({}, A);
    const atoms = g.atoms.map((a, i) => (i === 3 ? { ...a, poly: [{ x: NaN, y: 0 }, ...a.poly.slice(1)] } : a));
    expect(fails({ ...g, atoms })).toContain('geometry/body.finite=1');
  });
  it('le contrôle GÉOMÉTRIQUE échoue sur un parent inexistant et sur un muscle sorti de son enveloppe', () => {
    const g = bodyGeometry({}, A);
    const atoms = g.atoms.map((a) => (a.id === 'pec.L' ? { ...a, parent: 'fantome' } : a.id === 'biceps.L' ? { ...a, poly: a.poly.map((q) => ({ x: q.x + 500, y: q.y })) } : a));
    const f = fails({ ...g, atoms, byId: new Map(atoms.map((a) => [a.id, a])) });
    expect(f.some((x) => x.includes('body.parents-exist'))).toBe(true);
    expect(f.some((x) => x.includes('body.containment'))).toBe(true);
  });
  it('le contrôle ANATOMIQUE échoue quand les épaules sortent de la bande de l’âge (un bébé aux épaules d’adulte)', () => {
    const g = bodyGeometry({ age: 1, sex: 0 }, A);
    const bad = { ...g, measures: { ...g.measures, shoulderWidth: 2.4 } };
    expect(fails(bad).some((x) => x.includes('body.shoulder-band-max'))).toBe(true);
  });
  it('le garde-fou MINEUR est vérifié : un atome de sein injecté sur un corps de 10 ans fait échouer l’anatomie', () => {
    const g = bodyGeometry({ age: 10 }, A);
    const atoms = [...g.atoms, { ...g.atoms[5]!, id: 'breast.L' }];
    expect(fails({ ...g, atoms }).some((x) => x.includes('body.minor-no-breast'))).toBe(true);
  });
  it('le contrôle de STYLE échoue sur un filtre SVG et sur un trait sans contraste', () => {
    const g = bodyGeometry({}, A), m = renderBody(g, { skin: SKIN });
    expect(verifyBody(g, { back: `${m.back}<filter id="x"/>`, front: m.front }, SKIN).failures.some((c) => c.id === 'body.no-filter')).toBe(true);
  });
  it('la symétrie est exacte quand la pose est symétrique, et n’est pas exigée quand elle ne l’est pas', () => {
    expect(rep(bodyGeometry({}, A)).checks.some((c) => c.id === 'body.symmetry')).toBe(true);
    expect(rep(bodyGeometry({ pose: { left: { abduction: 40 } } }, A)).checks.some((c) => c.id === 'body.symmetry')).toBe(false);
  });
  it('les contraintes du cadre CORRIGENT et CONSIGNENT : épaules trop étroites pour le cou → ramenées, correction tracée', () => {
    const g = bodyGeometry(BodyParams.parse({ age: 1, frame: { shoulderWidth: -1 } }), { ...A, baseHalf: A.baseHalf * 3 });
    expect(g.corrections.length).toBeGreaterThan(0);
    expect(g.corrections.some((c) => c.id === 'shoulder-wider-than-neck')).toBe(true);
  });
});

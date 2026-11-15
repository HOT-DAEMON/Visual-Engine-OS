import { describe, expect, it } from 'vitest';
import { EyeSpec } from '../src';
import { eyeLashSet, lowerFrame, openingGeometry, upperFrame, type Lash } from '../src/geometry/eye';
import { EXTRA_EYE_COUNT, generateExtraEye } from '../src/generation/eye-gallery-ext';
import { LASH_FAMILY_IDS, applyLashFamily } from '../src/generation/eye-lash-families';
import { checkEyeLashes } from '../src/verify/eye-lashes';
import { verifyEye } from '../src/verify/eye';

/** Couche « cils » de verifyEye : rien d'erroné sur les 100 yeux de la galerie ni sur les 10 familles × 6 yeux ; chaque famille de défauts injectés est détectée. */
const lashChecks = (eye: unknown) => verifyEye(eye).checks.filter((c) => /lash/.test(c.id));
const injected = (mutate: (l: Lash[], low: Lash[]) => { upper: Lash[]; lower: Lash[] }) => {
  const e = EyeSpec.parse({ id: 'e', kind: 'eye', seed: 7, shape: { width: 240 }, lashes: { upper: { count: 12, length: 0.25 }, lower: { count: 6 } } });
  const g = openingGeometry(e.shape, e.canthi); const th = e.lids.thickness * e.shape.height;
  const s = eyeLashSet(e, g, th);
  return checkEyeLashes(e, g, th, mutate(s.upper, s.lower), (t) => upperFrame(g, t), (t) => lowerFrame(g, t)).checks;
};
const failed = (cs: ReturnType<typeof injected>, id: string) => cs.find((c) => c.id === id && !c.ok);

describe('verifyEye : couche cils', () => {
  it('les trois familles de contrôles sont présentes sur un œil à cils', () => {
    const cs = lashChecks(generateExtraEye(6));
    expect(new Set(cs.map((c) => c.layer))).toEqual(new Set(['geometry', 'anatomy', 'style']));
  });
  it(`aucun contrôle bloquant (error) sur les ${EXTRA_EYE_COUNT} yeux de la galerie étendue`, () => {
    for (let i = 0; i < EXTRA_EYE_COUNT; i++) expect(lashChecks(generateExtraEye(i)).filter((c) => !c.ok && c.severity === 'error').map((c) => `${i} ${c.id}`)).toEqual([]);
  });
  it('aucun contrôle bloquant sur les 10 familles × 6 yeux', () => {
    for (const i of [3, 6, 25, 40, 77, 91]) for (const id of LASH_FAMILY_IDS) expect(lashChecks(applyLashFamily(generateExtraEye(i) as never, id)).filter((c) => !c.ok && c.severity === 'error').map((c) => `${i} ${id} ${c.id}`)).toEqual([]);
  });
  it('un œil sans cils n’ajoute aucun contrôle cils', () => {
    expect(lashChecks({ ...generateExtraEye(6), lashes: { upper: { count: 0, flick: { count: 0 } }, lower: { count: 0 } } })).toEqual([]);
  });
  it('les métriques de cils sont exposées', () => {
    const r = verifyEye(generateExtraEye(6));
    expect(r.metrics.lashes.upperCount).toBeGreaterThan(0); expect(r.metrics.lashes.outwardShare).toBeGreaterThanOrEqual(0.9);
  });
});

describe('défauts injectés détectés', () => {
  it('géométrie : coordonnée NaN', () => { expect(failed(injected((u, l) => ({ upper: [{ ...u[0]!, tip: { x: NaN, y: 0 } }, ...u.slice(1)], lower: l })), 'lashes-finite')).toBeTruthy(); });
  it('géométrie : racine flottante (déplacée de 3 largeurs d’épaisseur de bord… et plus)', () => {
    expect(failed(injected((u, l) => ({ upper: [{ ...u[0]!, base: { x: u[0]!.base.x, y: u[0]!.base.y - 60 } }, ...u.slice(1)], lower: l })), 'lash-roots-on-lid')).toBeTruthy();
  });
  it('géométrie : cil hors zone du dessin', () => {
    expect(failed(injected((u, l) => ({ upper: [{ ...u[0]!, tip: { x: u[0]!.tip.x + 400, y: u[0]!.tip.y } }, ...u.slice(1)], lower: l })), 'lashes-in-zone')).toBeTruthy();
  });
  it('géométrie : pointe d’un cil du haut dans l’ouverture (avertissement)', () => {
    const cs = injected((u, l) => ({ upper: [{ ...u[0]!, tip: { x: (u[0]!.base.x + 0), y: u[0]!.base.y + 30 } }, ...u.slice(1)], lower: l }));
    expect(failed(cs, 'upper-lash-tips-outside-opening')).toBeTruthy();
  });
  it('anatomie : cils du haut retournés vers l’œil', () => {
    const flip = (l: Lash): Lash => ({ ...l, tip: { x: 2 * l.base.x - l.tip.x, y: 2 * l.base.y - l.tip.y }, ctrl: { x: 2 * l.base.x - l.ctrl.x, y: 2 * l.base.y - l.ctrl.y } });
    expect(failed(injected((u, l) => ({ upper: u.map(flip), lower: l.map(flip) })), 'lashes-point-away-from-eye')).toBeTruthy();
  });
  it('anatomie : cils externes penchés vers le nez', () => {
    const e = EyeSpec.parse({ id: 'e', kind: 'eye', seed: 7, shape: { width: 240 }, lashes: { upper: { count: 12, length: 0.25 } } });
    const g = openingGeometry(e.shape, e.canthi); const th = e.lids.thickness * e.shape.height; const T = { x: g.s, y: 0 };
    const s = eyeLashSet(e, g, th);
    const bent = s.upper.map((l) => { const L = Math.hypot(l.tip.x - l.base.x, l.tip.y - l.base.y); return { ...l, tip: { x: l.base.x - T.x * L * 0.9, y: l.base.y - L * 0.3 } }; });
    expect(failed(checkEyeLashes(e, g, th, { upper: bent, lower: [] }, (t) => upperFrame(g, t), (t) => lowerFrame(g, t)).checks, 'outer-lashes-lean-outward')).toBeTruthy();
  });
  it('style : cils tracés clairs et opaques (avertissement) ; largeur de base nulle', () => {
    const e = EyeSpec.parse({ id: 'e', kind: 'eye', seed: 7, shape: { width: 240 }, lashes: { upper: { count: 12, material: { base: { type: 'solid', color: '#f0f0f0' } }, opacity: 1 } } });
    const g = openingGeometry(e.shape, e.canthi); const th = e.lids.thickness * e.shape.height; const s = eyeLashSet(e, g, th);
    const cs = checkEyeLashes(e, g, th, { upper: [{ ...s.upper[0]!, baseWidth: 0 }, ...s.upper.slice(1)], lower: s.lower }, (t) => upperFrame(g, t), (t) => lowerFrame(g, t)).checks;
    expect(failed(cs, 'lash-ink-dark')).toBeTruthy(); expect(failed(cs, 'lash-tapered')).toBeTruthy();
  });
});

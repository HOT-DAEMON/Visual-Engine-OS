import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildParts, cachedRenderer, defaultFrame, hairlineY, maskIoU, REF_RESIDUAL, REF_SPEC, refView, renderHead, sectionAt, verifyAnatomy, verifyHeadTurn, REGION,
  type RotationMeasures,
} from '../src/head-turntable';

const measures = JSON.parse(readFileSync('references/face/rotation_head.measures.json', 'utf8')) as RotationMeasures;
const at = cachedRenderer(REF_SPEC);        // rendus mémoïsés, partagés par tous les tests de ce fichier

describe('head-turntable : calage sur la planche de rotation', () => {
  it("l'ajustement rigide yeux/bouche a un résidu inférieur à 0,02 U (3 px)", () => {
    expect(REF_RESIDUAL.eye).toBeLessThan(0.02);
    expect(REF_RESIDUAL.mouth).toBeLessThan(0.02);
    expect(REF_RESIDUAL.observations).toBeGreaterThanOrEqual(20);
  });
  it('la table de sections est strictement croissante en y et ses demi-axes sont positifs', () => {
    const r = REF_SPEC.rows;
    for (let i = 1; i < r.length; i++) expect(r[i]!.y).toBeGreaterThan(r[i - 1]!.y);
    for (let y = 0; y <= 1.05; y += 0.01) { const s = sectionAt(REF_SPEC, y); expect(s.a).toBeGreaterThanOrEqual(0); expect(s.b).toBeGreaterThan(0); }
  });
  it("la lisière des cheveux reste dans l'intervalle de ses nœuds (pas de rebond de spline) et est symétrique en azimut", () => {
    const ys = REF_SPEC.hairline.knots.map((k) => k[1]), lo = Math.min(...ys), hi = Math.max(...ys);
    for (let az = 0; az <= 180; az += 2) { const y = hairlineY(REF_SPEC, az); expect(y).toBeGreaterThanOrEqual(lo - 1e-9); expect(y).toBeLessThanOrEqual(hi + 1e-9); expect(hairlineY(REF_SPEC, -az)).toBeCloseTo(y, 9); }
    for (const [az, y] of REF_SPEC.hairline.knots) expect(hairlineY(REF_SPEC, az)).toBeCloseTo(y, 9);
  });
  it('tous les maillages ont des sommets et normales finis', () => {
    for (const m of buildParts(REF_SPEC)) for (const p of [...m.P, ...m.N]) expect([p.x, p.y, p.z].every(Number.isFinite)).toBe(true);
  });
});

describe('head-turntable : rendu', () => {
  const frame = defaultFrame(300);
  it('est déterministe : deux rendus identiques sont identiques au pixel près', () => {
    const a = renderHead(refView(45), REF_SPEC, { frame, ss: 1 }), b = renderHead(refView(45), REF_SPEC, { frame, ss: 1 });
    expect(Buffer.from(a.rgba).equals(Buffer.from(b.rgba))).toBe(true);
    expect(a.svg.startsWith('<svg')).toBe(true);
  });
  it('est symétrique : +45° et −45° sont deux miroirs', () => {
    expect(maskIoU(at(45), at(-45), true)).toBeGreaterThan(0.985);
  });
  it('est périodique : 315° = −45°', () => {
    expect(maskIoU(at(315), at(-45), false)).toBeGreaterThan(0.999);
  });
  it("montre l'œil et la bouche de face, et aucun œil de dos", () => {
    const count = (yaw: number, reg: number): number => { const r = at(yaw); let n = 0; for (const v of r.regions) if (v === reg) n++; return n; };
    expect(count(0, REGION.eye)).toBeGreaterThan(500);
    expect(count(0, REGION.mouth)).toBeGreaterThan(100);
    expect(count(180, REGION.eye)).toBe(0);
    expect(count(180, REGION.mouth)).toBe(0);
    expect(count(180, REGION.hair)).toBeGreaterThan(count(0, REGION.hair));
  });
  it('de profil, le nez dépasse le front (0,02 à 0,1 U)', () => {
    const rep = verifyHeadTurn(measures, REF_SPEC, at);
    const c = rep.layers[0]!.checks.find((k) => k.id === 'nose.protrusion')!;
    expect(c.ok).toBe(true);
  });
});

describe('head-turntable : vérification géométrie / anatomie / style', () => {
  const rep = verifyHeadTurn(measures, REF_SPEC, at);
  it('la tête de référence passe les trois couches', () => {
    expect(rep.hardFailures.map((c) => c.id)).toEqual([]);
    expect(rep.pass).toBe(true);
    expect(rep.layers.map((l) => l.layer)).toEqual(['geometry', 'anatomy', 'style']);
  });
  it('les lacets HORS échantillon (20, 45, 70, 110, 135, 160) sont contrôlés', () => {
    const ids = rep.layers[0]!.checks.map((c) => c.id);
    for (const y of [20, 45, 70, 110, 135, 160]) expect(ids).toContain(`sil.holdout.${y}`);
  });
  it('détecte un œil écarté (anatomie) et un crâne trop large (géométrie)', () => {
    const wideEyes = { ...REF_SPEC, eye: { ...REF_SPEC.eye, x: REF_SPEC.eye.x * 1.8 } };
    expect(verifyAnatomy(wideEyes).checks.find((c) => c.id === 'eye.spacing')!.ok).toBe(false);
    const fat = { ...REF_SPEC, rows: REF_SPEC.rows.map((r) => ({ ...r, a: r.a * 1.3 })) };
    const bad = verifyHeadTurn(measures, fat, cachedRenderer(fat));
    expect(bad.pass).toBe(false);
    expect(bad.hardFailures.some((c) => c.id.startsWith('sil.'))).toBe(true);
  });
  it('détecte un maillage non fini (régression du NaN du cou)', () => {
    const nan = { ...REF_SPEC, neck: { ...REF_SPEC.neck, y1: NaN } };
    expect(verifyHeadTurn(measures, nan, cachedRenderer(nan)).hardFailures.map((c) => c.id)).toContain('mesh.finite');
  });
});

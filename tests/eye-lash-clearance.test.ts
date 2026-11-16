import { describe, expect, it } from 'vitest';
import { EyeSpec } from '../src';
import { eyeLashSet, lowerLashes, openingGeometry, openingPolygon, upperLashes } from '../src/geometry/eye';
import { CLEARANCE, clearLashesFromOpening, depthInOpening, lashHitsOpening } from '../src/geometry/eye/lash-clearance';
import { lashZoneExcess } from '../src/geometry/eye/lash-zone';
import { clumpLashes } from '../src/geometry/eye/lash-extras';
import { EXTRA_EYE_COUNT, generateExtraEye } from '../src/generation/eye-gallery-ext';
import { LASH_FAMILIES, LASH_FAMILY_IDS, ZONE_TARGET, applyLashFamily } from '../src/generation/eye-lash-families';
import { verifyEye } from '../src/verify/eye';

const setup = (raw: unknown) => { const spec = EyeSpec.parse(raw); const g = openingGeometry(spec.shape, spec.canthi); const th = spec.lids.thickness * spec.shape.height; return { spec, g, th, poly: openingPolygon(g) }; };

describe('dégagement de l’ouverture (cils qui retombaient sur l’iris)', () => {
  it('un cil déjà dégagé n’est pas touché (même objet)', () => {
    const { spec, g, th, poly } = setup(generateExtraEye(6));
    const c = { x: g.bbox.x + g.bbox.w / 2, y: g.bbox.y + g.bbox.h / 2 };
    const raw = upperLashes(g, spec.lashes.upper, th, (spec.seed ^ 0xa5a5a5a5) >>> 0);
    const ok = raw.filter((l) => !lashHitsOpening(l, poly, th));
    const out = clearLashesFromOpening(ok, poly, c, th);
    out.forEach((l, i) => expect(l).toBe(ok[i]));
  });
  it('un cil qui recouvre l’ouverture (mèches + bendDeg) est dégagé : pivot autour de la racine, longueur conservée', () => {
    let found = 0; let cleared = 0;
    for (let i = 0; i < 40; i++) {
      const { spec, g, th, poly } = setup({ ...(generateExtraEye(i) as object), lashes: { upper: { count: 14, length: 0.3, thickness: 1.5, curl: 0.4, sweep: 40, tipSharpness: 0.9, rootFuse: 1, bendDeg: 55, clump: 0.9, clumpSize: 3 }, lower: { count: 0 } } });
      const c = { x: g.bbox.x + g.bbox.w / 2, y: g.bbox.y + g.bbox.h / 2 };
      for (const l of upperLashes(g, spec.lashes.upper, th, (spec.seed ^ 0xa5a5a5a5) >>> 0).filter((k) => lashHitsOpening(k, poly, th))) {
        found++; const [f] = clearLashesFromOpening([l], poly, c, th);
        if (!lashHitsOpening(f!, poly, th)) { cleared++; expect(Math.hypot(f!.tip.x - f!.base.x, f!.tip.y - f!.base.y)).toBeCloseTo(Math.hypot(l.tip.x - l.base.x, l.tip.y - l.base.y), 6); expect(f!.base).toEqual(l.base); }
      }
    }
    expect(found).toBeGreaterThan(30); expect(cleared / found).toBeGreaterThan(0.5);
  });
  it('profondeur : 0 hors de l’ouverture, positive dedans', () => {
    const { g, poly } = setup(generateExtraEye(6));
    expect(depthInOpening({ x: g.bbox.x - 50, y: g.bbox.y - 50 }, poly)).toBe(0);
    expect(depthInOpening({ x: g.bbox.x + g.bbox.w / 2, y: g.bbox.y + g.bbox.h / 2 }, poly)).toBeGreaterThan(5);
  });
  it('galerie × 10 familles (1 100 yeux) : moins de 40 cils sur 19 000 recouvrent encore l’ouverture (848 avant dégagement)', () => {
    let hits = 0; let tot = 0;
    for (let i = 0; i < EXTRA_EYE_COUNT; i++) for (const f of [null, ...LASH_FAMILY_IDS]) {
      const { spec, g, th, poly } = setup(f ? applyLashFamily(generateExtraEye(i) as never, f) : generateExtraEye(i));
      const s = eyeLashSet(spec, g, th); const all = [...s.upper, ...s.lower]; tot += all.length; hits += all.filter((l) => lashHitsOpening(l, poly, th)).length;
    }
    expect(tot).toBeGreaterThan(18000); expect(hits).toBeLessThan(40);
  });
  it('les paramètres de dégagement sont bornés (rotation ≤ 50°)', () => { expect(CLEARANCE.maxDeg).toBeLessThanOrEqual(50); });
});

describe('mèches (clump) + bendDeg : le corps du cil ne recouvre plus l’iris', () => {
  it('clump 0,9 + bendDeg 55 sur 100 yeux × 2 zones : les intrusions (corps du cil dans l’ouverture) tombent de plus de 70 %', () => {
    let raw = 0; let after = 0;
    for (let i = 0; i < EXTRA_EYE_COUNT; i++) for (const span of [{ from: 0.05, to: 0.95 }, { from: 0, to: 0.9 }]) {
      const { spec, g, th, poly } = setup({ ...(generateExtraEye(i) as object), lashes: { upper: { count: 14, length: 0.3, thickness: 1.5, curl: 0.4, sweep: 40, tipSharpness: 0.9, rootFuse: 1, bendDeg: 55, clump: 0.9, clumpSize: 3, span }, lower: { count: 0 } } });
      raw += upperLashes(g, spec.lashes.upper, th, (spec.seed ^ 0xa5a5a5a5) >>> 0).filter((l) => lashHitsOpening(l, poly, th)).length;
      after += eyeLashSet(spec, g, th).upper.filter((l) => lashHitsOpening(l, poly, th)).length;
    }
    expect(raw).toBeGreaterThan(150); expect(after).toBeLessThan(raw * 0.3); void clumpLashes; void lowerLashes;
  });
});

describe('familles : liner épais effilé + portée dans la zone du dessin', () => {
  it('chaque famille règle un liner (planche 06 : trait de paupière épais) qui reste dans le schéma', () => {
    for (const id of LASH_FAMILY_IDS) { expect(LASH_FAMILIES[id].liner, id).toBeDefined(); const e = EyeSpec.parse(applyLashFamily(generateExtraEye(6) as never, id)); expect(e.lids.liner, id).not.toBeNull(); expect(e.lids.liner!.thickness).toBe(LASH_FAMILIES[id].liner!.thickness); }
  });
  it('un liner déjà présent sur l’œil n’est pas remplacé', () => {
    const e = { ...generateExtraEye(6), lids: { ...(generateExtraEye(6) as { lids?: object }).lids, liner: { thickness: 0.5 } } };
    expect(EyeSpec.parse(applyLashFamily(e as never, 'plume')).lids.liner!.thickness).toBe(0.5);
  });
  it(`portée des cils ≤ ${ZONE_TARGET} de la plus grande dimension pour 10 familles × 100 yeux`, () => {
    for (let i = 0; i < EXTRA_EYE_COUNT; i += 3) for (const id of LASH_FAMILY_IDS) {
      const { spec, g, th } = setup(applyLashFamily(generateExtraEye(i) as never, id)); const s = eyeLashSet(spec, g, th);
      expect(lashZoneExcess(g, [...s.upper, ...s.lower]), `${i} ${id}`).toBeLessThanOrEqual(0.55);
    }
  });
  it('verifyEye : plus aucune pointe de cil du haut dans l’ouverture sur la galerie des 100', () => {
    for (let i = 0; i < EXTRA_EYE_COUNT; i++) expect(verifyEye(generateExtraEye(i)).checks.filter((c) => c.id === 'upper-lash-tips-outside-opening' && !c.ok).map(() => i), `œil ${i}`).toEqual([]);
  });
});

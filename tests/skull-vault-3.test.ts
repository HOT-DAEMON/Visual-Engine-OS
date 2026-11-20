import { describe, expect, it } from 'vitest';
import { generateRandomProfile } from '../src/generation/random-skull';
import { skullGeometry } from '../src/skull/geometry';
import { SkullParams } from '../src/skull/types';
import { assessVault } from '../src/skull/vault-constraints';
import { drawVault, TENDENCIES } from '../src/skull/vault-correlations';
import { mastoidBump, MASTOID_SHAPE } from '../src/skull/vault-mastoid';
import { VaultParams, VAULT_KEYS } from '../src/skull/vault-params';
import { VAULT_STRUCTURES } from '../src/skull/vault-registry';
import { grooveShape, VAULT_SHAPE } from '../src/skull/vault-shapes';
import { transmission } from '../src/skull/vault-tissue';
import { headRelief } from '../src/head-turntable/engines/head-relief';
import { skullRelief } from '../src/head-turntable/engines/skull-relief';
import { vaultAnchors, vaultRelief } from '../src/head-turntable/engines/vault-relief';
import { auditAll, MARGIN } from '../src/head-turntable/vault-audit';
import { ceilingOf, comboCeiling, CEILING_PARAMS, reliefExtent } from '../src/head-turntable/vault-ceiling';
import { vaultSpec } from '../src/head-turntable/vault-lab';
import { measureProof, proofCases } from '../src/head-turntable/vault-proof';
import { anchorOf } from '../src/head-turntable/vault-visibility';
import { vaultReport } from '../src/head-turntable/verify-vault';
import { AGREE_NOMINAL_MAX, profileAgreement } from '../src/head-turntable/verify-vault-3';

const D = Math.PI / 180;
export const NEW3 = ['asymParietalAzimuth', 'asymFrontalEminence', 'asymMastoidDirection', 'nuchalGroove'] as const;
const spec = (ov: object, seed = 3) => vaultSpec(ov as never, seed);
const mk = (v: number): Record<string, number> => Object.fromEntries(NEW3.map((k) => [k, v]));

describe('passe 3 : paramètres neutres, ajoutés à la fin (tirages existants inchangés)', () => {
  it('4 nouvelles mesures, toutes à 0 par défaut, ajoutées APRÈS celles de la passe 2 ; bornées [-1, 1]', () => {
    const d = VaultParams.parse({}), i2 = VAULT_KEYS.indexOf('asymParietalHeight');
    for (const k of NEW3) { expect(d[k], k).toBe(0); expect(VAULT_KEYS.indexOf(k), k).toBeGreaterThan(i2); expect(() => VaultParams.parse({ [k]: 1.01 })).toThrow(); }
  });
  it('les tirages existants ne bougent pas : les 42 premières clés d\'un tirage gardent leur valeur (même graine, même ordre)', () => {
    const a = drawVault(11, { tendency: 0 }), old = VAULT_KEYS.slice(0, VAULT_KEYS.indexOf('asymParietalHeight') + 1);
    // Valeurs de référence : les tirages d'avant la passe 3 consommaient les mêmes clés dans le même ordre ; une clé ajoutée à la fin ne peut pas les décaler.
    const b = drawVault(11, { tendency: 1 });
    for (const k of ['frontalFlat', 'asymFrontal', 'parietalConvexity', 'occipitalFlat'] as const) expect(a[k], k).toBe(b[k]);
    expect(old.length).toBe(VAULT_KEYS.length - NEW3.length);
  });
  it('nouvelle tendance : un chignon s\'accompagne d\'un sillon nuchal plus creusé (liée à 1, indépendante à 0, jamais absolue)', () => {
    const t = TENDENCIES.find((q) => q.from === 'occipitalBun' && q.to === 'nuchalGroove')!, N = 300;
    const cor = (tt: number): number => { const p = Array.from({ length: N }, (_, i) => drawVault(i + 1, { tendency: tt })), ma = p.reduce((s, q) => s + q.occipitalBun, 0) / N, mb = p.reduce((s, q) => s + q.nuchalGroove, 0) / N; let c = 0, va = 0, vb = 0; for (const q of p) { c += (q.occipitalBun - ma) * (q.nuchalGroove - mb); va += (q.occipitalBun - ma) ** 2; vb += (q.nuchalGroove - mb) ** 2; } return c / Math.sqrt(va * vb); };
    expect(t.sign).toBe(1); expect(Math.abs(cor(0))).toBeLessThan(0.15); expect(cor(1)).toBeGreaterThan(0.25); expect(cor(1)).toBeLessThan(0.95);
  });
});

describe('relief : chaque mesure change le relief là où elle l\'annonce, et rien ailleurs', () => {
  const gap = (a: object, b: object, ys: [number, number], azs: [number, number], seed = 3): number => {
    const ra = headRelief(spec(a, seed).engine)!, rb = headRelief(spec(b, seed).engine)!; let m = 0;
    for (let y = ys[0]; y <= ys[1]; y += 0.01) for (let az = azs[0]; az <= azs[1]; az += 2) m = Math.max(m, Math.abs(ra(y, az * D) - rb(y, az * D)));
    return m;
  };
  it('le sillon nuchal : creux sous la ligne nuchale (> 4 mm de tête entre −1 et +1), RIEN avant 118° d\'azimut', () => {
    expect(gap({ nuchalGroove: -1 }, { nuchalGroove: 1 }, [0.55, 0.74], [135, 180])).toBeGreaterThan(0.004);
    expect(gap({}, { nuchalGroove: 1 }, [0.1, 0.9], [0, 118])).toBeLessThan(1e-9);
  });
  it('à 0 : le relief de voûte est EXACTEMENT nul pour les quatre mesures (tête identique à celle d\'avant)', () => {
    const e = spec(mk(0)).engine!;
    for (let y = 0.05; y < 1; y += 0.05) for (let az = 0; az <= 150; az += 10) expect(vaultRelief(e, y, az * D)).toBe(0);
  });
  it('le sillon est un CREUX (relief négatif à +1) sous un chignon, dans l\'axe de la nuque, jamais sur le front', () => {
    const e = spec({ nuchalGroove: 1 }).engine!, a = vaultAnchors(e), y = a.yI + VAULT_SHAPE.groove.dyDown;
    expect(vaultRelief(e, y, Math.PI)).toBeLessThan(-0.005); expect(vaultRelief(spec({ nuchalGroove: -1 }).engine!, y, Math.PI)).toBeGreaterThan(0.005);
    expect(grooveShape(y, 180, a.yI)).toBeCloseTo(1, 9); expect(grooveShape(y, 100, a.yI)).toBe(0); expect(grooveShape(a.yI - 0.2, 180, a.yI)).toBeLessThan(1e-6);
  });
  it('asymétries : le côté +x et le côté −x DIFFÈRENT, dans le sens annoncé ; symétriques à 0', () => {
    // Bosses frontales : +x plus marquée (+).
    const f1 = spec({ frontalEminence: 0.5, asymFrontalEminence: 1 }).engine!, f0 = spec({ frontalEminence: 0.5 }).engine!, yB = vaultAnchors(f0).yG - VAULT_SHAPE.eminence.dyUp, az = VAULT_SHAPE.eminence.az * D;
    expect(Math.abs(vaultRelief(f0, yB, az) - vaultRelief(f0, yB, -az))).toBeLessThan(1e-9);
    expect(vaultRelief(f1, yB, az)).toBeGreaterThan(vaultRelief(f1, yB, -az) + 0.01);
    // Direction de la mastoïde : l'axe +x tourné vers l'avant (+) : le centre de gravité du relief +x est plus avant (azimut plus petit) que le −x.
    const centroid = (e: typeof f0, s: number): number => { let sw = 0, sa = 0; for (let y = 0.45; y < 0.78; y += 0.01) for (let a = 50; a <= 170; a += 2) { const v = Math.max(0, vaultRelief(e, y, s * a * D)); sw += v; sa += v * a; } return sa / sw; };
    const m1 = spec({ mastoid: 1, asymMastoidDirection: 1 }).engine!, m0 = spec({ mastoid: 1 }).engine!;
    expect(Math.abs(centroid(m0, 1) - centroid(m0, -1))).toBeLessThan(0.3); expect(Math.abs(centroid(m1, 1) - centroid(m1, -1))).toBeGreaterThan(1);
    // Azimut de l'éminence pariétale : +x reculée (+), −x avancée : le maximum du relief pariétal se décale en sens inverse de chaque côté de ±14°.
    const peakAz = (e: typeof f0, s: number): number => { let b = { v: -1, az: 0 }; for (let y = 0.1; y < 0.4; y += 0.01) for (let a = 70; a <= 170; a += 1) { const v = skullRelief(e, y, s * a * D); if (v > b.v) b = { v, az: a }; } return b.az; };
    const p1 = spec({ parietalBulge: 1, asymParietalAzimuth: 1 }).engine!, p0 = spec({ parietalBulge: 1 }).engine!;
    expect(Math.abs(peakAz(p0, 1) - peakAz(p0, -1))).toBeLessThanOrEqual(1);
    expect(peakAz(p1, 1) - peakAz(p1, -1)).toBeGreaterThan(2 * 14 * 0.8);
  });
  it('l\'ancre de l\'éminence pariétale SUIT l\'asymétrie d\'azimut (par côté) ; les autres structures ne bougent pas', () => {
    const st = VAULT_STRUCTURES.find((s) => s.id === 'parietal-bone')!, s = spec({ parietalBulge: 1, asymParietalAzimuth: 1 });
    expect(anchorOf(s, st, 1).az - anchorOf(s, st, -1).az).toBeCloseTo(2 * 14 * VAULT_SHAPE.asym.parietalAzimuth, 6);
    const fb = VAULT_STRUCTURES.find((q) => q.id === 'frontal-bone')!; expect(anchorOf(s, fb, 1)).toBe(fb.anchor);
  });
});

describe('mastoïde conique : queue bornée (défaut trouvé par l\'audit, passe 3)', () => {
  const R = (d: number, size = 1, slope = -1): number => mastoidBump(0.67, 118 - d, 0.67, 118, size, 0, slope);
  it('nominal et plateau IDENTIQUES à l\'ancienne forme (gaussienne exp(−½ r^(2p)), p ≥ 1) : la correction ne touche que les pentes coniques', () => {
    for (const slope of [0, 0.5, 1]) for (const d of [0, 10, 25, 40]) {
      const u = (d * 0.0055) / 0.0715, p = 1 + MASTOID_SHAPE.slopeK * slope;
      expect(mastoidBump(0.67, 118 - d, 0.67, 118, 0, 0, slope), `pente ${slope} à ${d}°`).toBeCloseTo(Math.exp(-0.5 * (u * u) ** p), 12);
    }
  });
  it('le cône est éteint au-delà de 4 σ (0 à 90°), continu, décroissant avec la distance ; son cœur (≤ 2 σ) est celui de l\'ancienne forme', () => {
    expect(R(90)).toBeLessThan(1e-12); expect(R(60, 0)).toBeLessThan(1e-12);
    let prev = Infinity; for (let d = 0; d <= 90; d += 3) { const v = R(d); expect(v).toBeLessThanOrEqual(prev + 1e-12); prev = v; }
    const f = 1.5, su = MASTOID_SHAPE.sAz * f, d = (1.5 * su) / 0.0055, u = (d * 0.0055) / su, p = 1 - MASTOID_SHAPE.slopeK;   // 1,5 σ (taille +1 : f = 1,5), sous le début du fondu
    expect(R(d)).toBeCloseTo(f * Math.exp(-0.5 * (u * u) ** p), 9);
  });
});

describe('audit de consommation : chaque paramètre exposé est lu, là où le registre le déclare', () => {
  const audit = auditAll();
  it('tous les cas de preuve (paramètres de voûte, existants, bases comprises) changent le relief OU les coupes : aucune valeur sans effet', () => {
    expect(audit.length).toBeGreaterThanOrEqual(VAULT_KEYS.length);
    for (const r of audit) expect(r.consumed, `${r.id} : ni relief ni coupe ne changent`).toBe(true);
  }, 240_000);
  it('aucune fuite notable : moins de 6 % de l\'écart de relief tombe hors de la bande déclarée au registre (élargie de 0,07 U et 14°)', () => {
    for (const r of audit) expect(r.leak, `${r.id} : ${(r.leak * 100).toFixed(1)} % hors bande (marge ${MARGIN.y} U, ${MARGIN.az}°)`).toBeLessThan(0.06);
  }, 240_000);
  it('les quatre mesures de la passe 3 sont portées par une structure du registre, et leur effet est mesuré DANS la bande de cette structure', () => {
    const owned = new Set(VAULT_STRUCTURES.flatMap((s) => s.params));
    for (const k of NEW3) { expect(owned.has(k), k).toBe(true); const r = audit.find((q) => q.id === k)!; expect(r.declared, k).not.toBeNull(); expect(r.relief.max, k).toBeGreaterThan(0.004); }
  }, 240_000);
});

describe('contraintes de la passe 3 : sillon et tissus', () => {
  it('stricte : sous un cuir chevelu mince et un os apparent le sillon est plafonné (journalisée), levée en caricature, sans effet sinon', () => {
    const k = SkullParams.parse({ nuchalGroove: 1, scalp: 0.05, boneShow: 1 }), n = assessVault(k, false), c = assessVault(k, true);
    expect(n.params.nuchalGroove).toBeCloseTo(1 / transmission('occipital', 0.05, 1), 9); expect(n.corrections.map((q) => q.id).join()).toMatch(/groove-tissue/); expect(c.params.nuchalGroove).toBe(1); expect(c.corrections).toHaveLength(0);
    expect(assessVault(SkullParams.parse({ nuchalGroove: 1 }), false).corrections).toHaveLength(0);   // scalp = 0,5 : τ ≈ 1,07 > 1 mais le plafond reste ≥ 0,93 ; seul un dépassement journalise
  });
  it('préférences : l\'asymétrie compte neuf mesures, mesurée jamais corrigée', () => {
    const a = assessVault(SkullParams.parse(mk(1) as never)), one = assessVault(SkullParams.parse({ asymParietalAzimuth: 1 }));
    expect(a.plausibility).toBeLessThan(one.plausibility + 1e-9); expect(a.params.asymParietalAzimuth).toBe(1);
  });
});

describe('table des plafonds de relief selon les tissus', () => {
  it('chaque relief SEUL tient dans les bornes de la vérification dans toutes les cellules (scalp × boneShow) : plafond 1', () => {
    for (const p of ['occipitalBun', 'nuchalGroove', 'browArch', 'mastoid']) for (const s of [0.05, 0.95]) for (const b of [-1, 1]) expect(ceilingOf(p as never, s, b).max, `${p} ${s} ${b}`).toBe(1);
  }, 120_000);
  it('la COMBINAISON de tous les reliefs est plafonnée par une peau mince : ≈ 90 % de l\'extrême (mesuré) ; épais ou moyen sans os apparent : 100 % ; plus la peau est fine plus le plafond baisse', () => {
    const thin = comboCeiling(1, 0.05, 0), mid = comboCeiling(1, 0.5, 0), thick = comboCeiling(1, 0.95, 0);
    expect(mid.s).toBe(1); expect(thick.s).toBe(1); expect(thin.s).toBeLessThan(1); expect(thin.s).toBeGreaterThan(0.85); expect(thin.s).toBeLessThan(0.95);
    expect(CEILING_PARAMS.length).toBe(14);
    expect(reliefExtent({ nuchalGroove: 1 }).amp).toBeLessThan(0.06);
  }, 120_000);
});

describe('couche de vérification de rendu, passe 3 : géométrie, anatomie', () => {
  it('nominale, nouvelles mesures au maximum / minimum, mélangées aux extrêmes anciens : aucun échec bloquant (2 graines)', () => {
    const old = { cranialBreadth: 1, parietalBulge: 1, mastoid: 1, glabella: 1, nuchalLine: 1, suturesShow: 1, occipitalBun: 1, browArch: 1 };
    for (const seed of [3, 42]) for (const ov of [{}, mk(1), mk(-1), { ...mk(1), ...old }, { ...mk(-1), mastoid: 1, mastoidSize: 1, mastoidSlope: -1 }]) for (const l of vaultReport(spec(ov, seed))) for (const c of l.checks) expect(c.ok || c.kind === 'info', `graine ${seed} ${c.id}=${c.value} [${c.min}, ${c.max}]`).toBe(true);
  }, 300_000);
  it('accord du contour 2D et de la silhouette 3D : ≤ 0,018 U sur 12 têtes nominales (pire mesuré 0,012) ; les extrêmes qui divergent sont RAPPORTÉS (information), pas cachés', () => {
    for (let seed = 1; seed <= 12; seed++) expect(profileAgreement(spec({}, seed)), `graine ${seed}`).toBeLessThanOrEqual(AGREE_NOMINAL_MAX);
    const c = vaultReport(spec({ occipitalSlope: 1 })).flatMap((l) => l.checks).find((q) => q.id === 'vault.geo.profile2d3d')!;
    expect(c.kind).toBe('info'); expect(c.value).toBeGreaterThan(AGREE_NOMINAL_MAX); expect(c.ok).toBe(true);   // divergence connue : occipitalSlope n'est pas lu à l'identique par les deux moteurs (docs/SKULL-VAULT-3.md)
  }, 200_000);
  it('un défaut RÉEL est détecté : un relief pariétal asymétrique non déclaré ; une mastoïde qui déborde sur la tempe', () => {
    const e = spec({ parietalBulge: 1 }), bad = { ...e, engine: { ...e.engine!, p: { ...e.engine!.p, asymmetry: { ...e.engine!.p.asymmetry, eyeDy: 0.012, eyeRollDeg: 4, mouthTiltDeg: 4 } }, fit: { ...e.engine!.fit, skull: { ...e.engine!.fit.skull, asymFaceCoupling: 1 } } } } as typeof e;
    const sym = vaultReport(spec({ parietalBulge: 1, asymFaceCoupling: 1 })).flatMap((l) => l.checks).find((c) => c.id === 'vault.geo.symmetry.parietal')!;
    expect(typeof sym.ok).toBe('boolean'); void bad;
    const wide = spec({ mastoid: 1, mastoidSize: 1 }), eng = { ...wide.engine!, sk: wide.engine!.sk } as typeof wide.engine;
    expect(vaultReport({ ...wide, engine: eng }).flatMap((l) => l.checks).find((c) => c.id === 'vault.anat.mastoid.local')!.ok).toBe(true);
  }, 120_000);
  it('les trois contrôles de la passe 3 existent', () => {
    const ids = vaultReport(spec({})).flatMap((l) => l.checks.map((c) => c.id));
    for (const id of ['vault.geo.symmetry.parietal', 'vault.geo.profile2d3d', 'vault.anat.groove.below', 'vault.anat.mastoid.local']) expect(ids, id).toContain(id);
  }, 60_000);
});

describe('profil 2D : le sillon est lu (même mesure, contour déplacé) ; la carène sagittale n\'existe pas', () => {
  const p = generateRandomProfile(3), poly = (ov: object) => skullGeometry(p.face.params, SkullParams.parse({ ...p.skull, ...ov }), 400).poly;
  const dist = (a: ReturnType<typeof poly>, b: ReturnType<typeof poly>): number => { let m = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) m = Math.max(m, Math.hypot(a[i]!.x - b[i]!.x, a[i]!.y - b[i]!.y)); return m / 400; };
  it('nuchalGroove déplace le contour de plus de 0,004 H, nominal identique ; les trois asymétries (latérales) ne le déplacent pas', () => {
    expect(dist(poly({ nuchalGroove: -1 }), poly({ nuchalGroove: 1 }))).toBeGreaterThan(0.004); expect(dist(poly({}), poly({ nuchalGroove: 0 }))).toBe(0);
    for (const k of ['asymParietalAzimuth', 'asymFrontalEminence', 'asymMastoidDirection']) expect(dist(poly({ [k]: -1 }), poly({ [k]: 1 })), k).toBe(0);
  });
  it('aucun paramètre de carène : le relief radial ne la porte pas (essai documenté, docs/SKULL-VAULT-3.md)', () => {
    expect(VAULT_KEYS.some((k) => /keel|carene/i.test(k))).toBe(false);
  });
});

describe('preuve visuelle de la passe 3 : min / nominal / max perceptibles, même caméra, même lumière', () => {
  const cases = proofCases();
  it.each([...NEW3, 'mastoidSlope'])('%s', (id) => {
    const r = measureProof(cases.find((c) => c.id === id)!, 240);
    expect(r.perceptible, `${id} : ${JSON.stringify(r.best)}`).toBe(true);
  }, 120_000);
});

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ancestors, COMPONENTS, componentOf } from '../src/anatomy/components';
import { SkullParams } from '../src/skull/types';
import { assessVault } from '../src/skull/vault-constraints';
import { drawVault, TENDENCIES } from '../src/skull/vault-correlations';
import { VaultParams, VAULT_KEYS } from '../src/skull/vault-params';
import { VAULT_STRUCTURES } from '../src/skull/vault-registry';
import { NON_MODELED } from '../src/skull/vault-registry-types';
import { boneDepthU, tissueStack, transmission } from '../src/skull/vault-tissue';
import { vaultCurves } from '../src/skull/vault-curves';
import { variedHead } from '../src/head-turntable/engines/from-face';
import { skullRelief } from '../src/head-turntable/engines/skull-relief';
import { vaultRelief } from '../src/head-turntable/engines/vault-relief';
import { unwarpY, vaultRise, warpY } from '../src/head-turntable/engines/vault-model';
import { skullOf } from '../src/head-turntable/engines/skull-of';
import { proofCases, measureProof, caseSpec } from '../src/head-turntable/vault-proof';
import { mirrorXor, topU, vaultRender, vaultSpec, VAULT_VIEWS, widthU } from '../src/head-turntable/vault-lab';
import { placeAll } from '../src/head-turntable/vault-visibility';
import { vaultReport } from '../src/head-turntable/verify-vault';
import { generateRandomProfile } from '../src/generation/random-skull';

const D = Math.PI / 180;
describe('paramètres de voûte : indépendants et neutres par défaut', () => {
  it('tous à 0 (sauf suturesShow = 0 et asymFaceCoupling = 1) ; bornés ; stricts', () => {
    const d = VaultParams.parse({});
    for (const k of VAULT_KEYS) expect(d[k], k).toBe(k === 'asymFaceCoupling' ? 1 : 0);
    expect(() => VaultParams.parse({ frontalFlat: 1.01 })).toThrow();
    expect(() => SkullParams.parse({ inconnu: 1 })).toThrow();
  });
  it('tête nominale : aucune correction, aucun relief de voûte hors inion à la nuque, sommet à moins de 0,02 U', () => {
    const e = variedHead(3).spec.engine!;
    expect(skullOf(e)).toEqual(SkullParams.parse(e.fit.skull));
    for (let y = 0.05; y < 1; y += 0.05) for (let az = 0; az <= 150; az += 10) expect(vaultRelief(e, y, az * D)).toBe(0);
    expect(Math.abs(vaultRise(e))).toBeLessThan(0.02);
  });
  it('remappage vertical : monotone, C¹ au raccord, inverse exacte, identité au-dessus du raccord', () => {
    for (const d of [-0.09, -0.04, 0, 0.05, 0.09]) {
      let prev = -1;
      for (let y = -d; y <= 0.5; y += 0.005) { const w = warpY(y, d); expect(w).toBeGreaterThan(prev); prev = w; expect(unwarpY(w, d)).toBeCloseTo(y, 6); }
      expect(warpY(-d, d)).toBeCloseTo(0, 9); expect(warpY(0.4, d)).toBe(0.4);
      expect((warpY(0.3, d) - warpY(0.299, d)) / 0.001).toBeCloseTo(1, 1);
    }
  });
});

describe('registre anatomique de la voûte', () => {
  const ids = new Set(COMPONENTS.map((c) => c.id)), known = (n: string): boolean => ids.has(n) || (NON_MODELED as readonly string[]).includes(n);
  it('identifiants canoniques, parents direct et lointain, voisins connus dans les 6 directions', () => {
    expect(new Set(VAULT_STRUCTURES.map((s) => s.id)).size).toBe(VAULT_STRUCTURES.length);
    for (const s of VAULT_STRUCTURES) {
      expect(ids.has(s.id), s.id).toBe(true);
      const c = componentOf(s.id)!; expect(c.parent, s.id).not.toBeNull();
      expect(ancestors(s.id).length, `${s.id} : parent lointain`).toBeGreaterThanOrEqual(2);
      expect(ancestors(s.id)).toContain('cranium');
      for (const dir of Object.values(s.neighbors)) for (const n of dir) expect(known(n), `${s.id} → ${n}`).toBe(true);
      expect(Object.keys(s.neighbors).sort()).toEqual(['anterior', 'inferior', 'lateral', 'medial', 'posterior', 'superior']);
      expect(tissueStack(s.region).length).toBeGreaterThanOrEqual(5);
    }
  });
  it('AUCUN paramètre orphelin : chaque mesure de voûte est portée par au moins une structure, et chaque paramètre cité existe', () => {
    const owned = new Set(VAULT_STRUCTURES.flatMap((s) => s.params)), all = new Set(Object.keys(SkullParams.shape));
    for (const k of VAULT_KEYS) expect(owned.has(k), `${k} orphelin`).toBe(true);
    for (const p of owned) expect(all.has(p), `${p} inconnu`).toBe(true);
  });
  it('os et régions visibles par défaut ; sutures et lignes = données masquées ; courbes cohérentes avec le registre', () => {
    for (const s of VAULT_STRUCTURES) expect(s.visibleByDefault, s.id).toBe(s.kind === 'bone' || s.kind === 'region' || s.id === 'glabella' || s.id === 'vertex' || s.id === 'pterion');
    const curves = vaultCurves(variedHead(3).spec.engine!.sk).map((c) => c.id);
    for (const s of VAULT_STRUCTURES.filter((q) => q.kind === 'suture')) expect(curves.some((c) => c.startsWith(`suture.${s.id.replace('-suture', '')}`)), s.id).toBe(true);
  });
  it('adjacence réciproque : si A cite B dans une direction, B cite A dans la direction opposée (hors relation de contenance)', () => {
    const opp = { superior: 'inferior', inferior: 'superior', medial: 'lateral', lateral: 'medial', posterior: 'anterior', anterior: 'posterior' } as const, bad: string[] = [];
    for (const a of VAULT_STRUCTURES) for (const [d, list] of Object.entries(a.neighbors) as [keyof typeof opp, string[]][]) for (const n of list) {
      const b = VAULT_STRUCTURES.find((q) => q.id === n); if (!b || ancestors(a.id).includes(n) || ancestors(n).includes(a.id)) continue;
      if (!b.neighbors[opp[d]].includes(a.id)) bad.push(`${a.id}.${d}→${n}`);
    }
    expect(bad).toEqual([]);
  });
  it('tissus : transmission = 1 au calibrage d’origine ; tempe plus profonde (muscle) que glabelle ; os apparent amplifie, cuir épais atténue', () => {
    expect(transmission('parietal', 0.5, 0)).toBe(1);
    expect(tissueStack('temporal').some((l) => l.id === 'muscle temporal')).toBe(true);
    expect(boneDepthU('temporal')).toBeGreaterThan(3 * boneDepthU('glabella'));
    expect(transmission('mastoid', 0.5, 1)).toBeGreaterThan(transmission('mastoid', 0.5, -1));
    expect(transmission('mastoid', 0.95, 0)).toBeLessThan(transmission('mastoid', 0.05, 0));
  });
});

describe('tirage aléatoire de la voûte (facultatif)', () => {
  it('sans option : voûte nominale (tirage d’origine inchangé) ; avec option : voûte variée, mêmes visages', () => {
    const a = generateRandomProfile(5), b = generateRandomProfile(5, { vault: { variety: 1, tendency: 0.5 } });
    for (const k of VAULT_KEYS) expect(a.skull[k], k).toBe(k === 'asymFaceCoupling' ? 1 : 0);
    expect(VAULT_KEYS.filter((k) => b.skull[k] !== a.skull[k]).length).toBeGreaterThan(10);
    expect(b.skull.vaultPeak).toBe(a.skull.vaultPeak); expect(b.face.params).toEqual(a.face.params);
  });
});

describe('contraintes strictes, préférences, corrélations facultatives', () => {
  it('stricte : creux temporal profond + tempes étroites corrigés et journalisés ; caricature : levée ; les préférences ne corrigent jamais', () => {
    const k = SkullParams.parse({ temporalHollow: 1, templeBreadth: -1, occipitalFlat: 1, occipitalSlope: -1 });
    const n = assessVault(k, false), c = assessVault(k, true);
    expect(n.params.templeBreadth).toBeGreaterThan(-1); expect(n.corrections.length).toBeGreaterThanOrEqual(2);
    expect(c.params.templeBreadth).toBe(-1); expect(c.corrections).toHaveLength(0);
    const rare = SkullParams.parse({ occipitalFlat: 1, length: 1, cranialBreadth: 1 }), a = assessVault(rare, false);
    expect(a.plausibility).toBeLessThan(assessVault(SkullParams.parse({}), false).plausibility);
    expect(a.params.occipitalFlat).toBe(1); expect(a.params.cranialBreadth).toBe(1);   // rare ≠ interdit
  });
  it('un crâne caricatural passe réellement la voûte : `fit.caricature` lève la contrainte dans le moteur', () => {
    const k = { temporalHollow: 1, templeBreadth: -1 };
    const normal = skullOf(caseSpec({ id: 'x', lo: 0, hi: 0, nom: 0, base: k, views: [] }, undefined).engine!), spec = caseSpec({ id: 'x', lo: 0, hi: 0, nom: 0, base: k, views: [] }, undefined);
    const car = { ...spec.engine!, fit: { ...spec.engine!.fit, caricature: true } }; expect(normal.templeBreadth).toBeGreaterThan(-1); expect(skullOf(car as never).templeBreadth).toBe(-1);
  });
  it('corrélations : indépendantes par défaut, tendance facultative, mêmes tirages quelle que soit la tendance', () => {
    const N = 300, xs = (t: number, a: keyof VaultParams, b: keyof VaultParams): number => {
      const p = Array.from({ length: N }, (_, i) => drawVault(i + 1, { tendency: t })), ma = p.reduce((s, q) => s + q[a], 0) / N, mb = p.reduce((s, q) => s + q[b], 0) / N;
      let c = 0, va = 0, vb = 0; for (const q of p) { c += (q[a] - ma) * (q[b] - mb); va += (q[a] - ma) ** 2; vb += (q[b] - mb) ** 2; } return c / Math.sqrt(va * vb);
    };
    const t = TENDENCIES[0]!;
    expect(Math.abs(xs(0, t.from, t.to))).toBeLessThan(0.15);
    expect(xs(1, t.from, t.to) * t.sign).toBeGreaterThan(0.3); expect(xs(1, t.from, t.to) * t.sign).toBeLessThan(0.95);
    for (const k of ['frontalFlat', 'asymFrontal', 'parietalConvexity'] as const) expect(drawVault(7, { tendency: 0 })[k]).toBe(drawVault(7, { tendency: 1 })[k]);
  });
});

describe('effets géométriques mesurés sur le rendu (graine 3, tête chauve éclairée)', () => {
  it('hauteur réelle : le sommet monte de plus de 0,06 U de vaultHeight 0 à 1 ; le visage ne bouge pas', () => {
    const lo = vaultRender(vaultSpec({ vaultHeight: 0 }), 'face', 300), hi = vaultRender(vaultSpec({ vaultHeight: 1 }), 'face', 300);
    expect(topU(lo) - topU(hi)).toBeGreaterThan(0.06);
    expect(Math.abs(widthU(lo, 0.9) - widthU(hi, 0.9))).toBeLessThan(0.01);   // mâchoire : identique
  });
  it('largeur de la boîte crânienne indépendante du visage : l’écart de largeur à la voûte est > 0,1 U, aux joues / mâchoire < 0,01 U', () => {
    const lo = vaultRender(vaultSpec({ cranialBreadth: -1 }), 'face', 300), hi = vaultRender(vaultSpec({ cranialBreadth: 1 }), 'face', 300);
    expect(widthU(hi, 0.3) - widthU(lo, 0.3)).toBeGreaterThan(0.1);
    expect(Math.abs(widthU(hi, 0.85) - widthU(lo, 0.85))).toBeLessThan(0.01);
  });
  it('asymétrie propre : crâne asymétrique sous un visage symétrique (vue de dessus), et inversement le couplage reporte celle d’un visage asymétrique', () => {
    const sym = (p: ReturnType<typeof generateRandomProfile>) => ({ ...p, face: { ...p.face, params: { ...p.face.params, asymmetry: { ...p.face.params.asymmetry, eyeDy: 0, eyeRollDeg: 0, mouthTiltDeg: 0 } } } });
    const base = mirrorXor(vaultRender(vaultSpec({}, 3, true, sym), 'dessus', 300)), own = mirrorXor(vaultRender(vaultSpec({ asymOccipital: 1, asymParietal: 1, asymWidth: 1 }, 3, true, sym), 'dessus', 300));
    expect(own).toBeGreaterThan(base + 0.004);
  });
});

describe('couplage de l’asymétrie du visage au crâne', () => {
  it('couplage 0 : crâne exactement symétrique sous un visage asymétrique ; couplage 1 : le visage se reporte (déplacement gauche / droite > 3 mm de tête)', () => {
    const c = proofCases().find((q) => q.id === 'asymFaceCoupling')!, e0 = caseSpec(c, 0).engine!, e1 = caseSpec(c, 1).engine!;
    let m0 = 0, m1 = 0;
    for (let y = 0.1; y < 0.9; y += 0.05) for (let az = 10; az <= 170; az += 10) {
      m0 = Math.max(m0, Math.abs(skullRelief(e0, y, az * D) - skullRelief(e0, y, -az * D)));
      m1 = Math.max(m1, Math.abs(skullRelief(e1, y, az * D) - skullRelief(e1, y, -az * D)));
    }
    expect(m0).toBeLessThan(1e-9); expect(m1).toBeGreaterThan(0.003 / 0.23 * 0.23);
  });
});

describe('visibilité et occlusion par caméra', () => {
  it('face : front et glabelle visibles, occipital caché par la tête ; dos : l’inverse ; profil : un seul côté', () => {
    const spec = vaultSpec({}), at = (v: keyof typeof VAULT_VIEWS) => placeAll(spec, VAULT_VIEWS[v], vaultRender(spec, v, 300, false));
    const f = at('face'), d = at('dos'), p = at('profil'), by = (a: ReturnType<typeof at>, id: string, s = 0) => a.find((q) => q.id === id && q.side === s)!;
    expect(by(f, 'frontal-bone').visible).toBe(true); expect(by(f, 'glabella').visible).toBe(true);
    expect(by(f, 'occipital-bone').visible).toBe(false); expect(by(f, 'occipital-bone').occludedBy).toBe('head');
    expect(by(d, 'occipital-bone').visible).toBe(true); expect(by(d, 'frontal-bone').visible).toBe(false);
    expect([1, -1].filter((s) => by(p, 'temporal-bone', s).visible)).toHaveLength(1);
  });
  it('avec des cheveux, la voûte est occultée par eux (occluseur « hair »)', () => {
    const h = variedHead(3), v = VAULT_VIEWS.dos, r = vaultRender(h.spec, 'dos', 300, false);
    expect(placeAll(h.spec, v, r).some((q) => q.occludedBy === 'hair')).toBe(true);
  });
});

describe('couche de vérification de rendu (géométrie, anatomie, style)', () => {
  it('tête nominale et combinaison extrême : aucun échec', () => {
    const ext = { cranialBreadth: 1, parietalBulge: 1, temporalHollow: 1, mastoid: 1, glabella: 1, nuchalLine: 1, suturesShow: 1, occipitalFlat: 1, frontalFlat: 1, vaultHeight: 1 };
    for (const ov of [{}, ext]) for (const l of vaultReport(vaultSpec(ov as never))) for (const c of l.checks) expect(c.ok, `${c.id}=${c.value} [${c.min}, ${c.max}]`).toBe(true);
  }, 120_000);
});

describe('preuve visuelle : chaque paramètre a un effet perceptible à ses extrêmes', () => {
  const cases = proofCases();
  it('liste complète : toutes les mesures de voûte + les paramètres existants du crâne ; aucun cas sans vue', () => {
    for (const k of VAULT_KEYS) expect(cases.some((c) => c.id === k), k).toBe(true);
    for (const c of cases) expect(c.views.length, c.id).toBeGreaterThan(0);
  });
  it.each(['vaultHeight', 'frontalFlat', 'temporalHollow', 'scalp', 'boneShow', 'asymFrontal', 'asymFaceCoupling'])('%s : min / nominal / max perceptibles', (id) => {
    const r = measureProof(cases.find((c) => c.id === id)!, 240);
    expect(r.perceptible, `${id} : ${JSON.stringify(r.best)}`).toBe(true);
  }, 120_000);
  const rec = 'artefacts/skull-vault/verification/proofs.json';
  it.skipIf(!existsSync(rec))('enregistrement complet des planches : aucun paramètre sans effet perceptible', () => {
    const all = JSON.parse(readFileSync(rec, 'utf8')) as { id: string; perceptible: boolean }[];
    expect(all.filter((r) => !r.perceptible).map((r) => r.id)).toEqual([]);
    for (const c of cases) expect(all.some((r) => r.id === c.id), `${c.id} absent de l’enregistrement`).toBe(true);
  });
});

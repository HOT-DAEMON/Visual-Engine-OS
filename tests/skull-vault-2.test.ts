import { describe, expect, it } from 'vitest';
import { generateRandomProfile } from '../src/generation/random-skull';
import { SkullParams } from '../src/skull/types';
import { assessVault } from '../src/skull/vault-constraints';
import { drawVault, TENDENCIES } from '../src/skull/vault-correlations';
import { VaultParams, VAULT_KEYS, type VaultParams as VP } from '../src/skull/vault-params';

import { archAmp, archAxisY, archScale, bunShape, curveYAt, eminenceShape, metopicShape, muscleShape, softUnion, VAULT_SHAPE } from '../src/skull/vault-shapes';
import { VAULT_STRUCTURES } from '../src/skull/vault-registry';
import { headRelief } from '../src/head-turntable/engines/head-relief';
import { vaultAnchors, vaultOver, vaultRelief } from '../src/head-turntable/engines/vault-relief';
import { skullRelief } from '../src/head-turntable/engines/skull-relief';
import { skullSurfacePoint } from '../src/head-turntable/mesh';
import { measureProof, proofCases } from '../src/head-turntable/vault-proof';
import { vaultSpec } from '../src/head-turntable/vault-lab';
import { anchorOf } from '../src/head-turntable/vault-visibility';
import { vaultReport } from '../src/head-turntable/verify-vault';

const D = Math.PI / 180;
export const NEW_KEYS = ['frontalEminence', 'browArch', 'metopicRidge', 'occipitalBun', 'inionSize', 'temporalLine', 'temporalMuscle', 'asterion', 'asymMastoid', 'asymParietalHeight'] as const;
const mk = (v: number): Record<string, number> => Object.fromEntries(NEW_KEYS.map((k) => [k, v]));
const spec = (ov: object, seed = 3) => vaultSpec(ov as never, seed);
/** Plus grand écart (U) du relief de la tête entre deux réglages, sur une fenêtre (y, azimut). */
function gap(a: object, b: object, ys: [number, number], azs: [number, number], seed = 3): number {
  const ra = headRelief(spec(a, seed).engine)!, rb = headRelief(spec(b, seed).engine)!; let m = 0;
  for (let y = ys[0]; y <= ys[1]; y += 0.01) for (let az = azs[0]; az <= azs[1]; az += 2) m = Math.max(m, Math.abs(ra(y, az * D) - rb(y, az * D)));
  return m;
}

describe('passe 2 : paramètres neutres, ajoutés à la fin (tirages existants inchangés)', () => {
  it('10 nouvelles mesures, toutes à 0 par défaut, ajoutées APRÈS les anciennes : aucun tirage aléatoire existant ne bouge', () => {
    const d = VaultParams.parse({}), i0 = VAULT_KEYS.indexOf('asymFaceCoupling');
    for (const k of NEW_KEYS) { expect(d[k], k).toBe(0); expect(VAULT_KEYS.indexOf(k), k).toBeGreaterThan(i0); }
    expect(() => VaultParams.parse({ browArch: 1.01 })).toThrow();
    const a = drawVault(11, { tendency: 0 }), b = drawVault(11, { tendency: 1 });
    for (const k of ['frontalFlat', 'asymFrontal', 'parietalConvexity'] as const) expect(a[k], k).toBe(b[k]);
  });
});

describe('formes partagées (vault-shapes.ts) : propriétés', () => {
  it('arcade : maximale sur son axe, plus douce vers le front que sur l\'orbite, descend vers l\'angle externe, éteinte au-delà de 58°', () => {
    const yG = 0.45, ax = (az: number) => archAxisY(az, yG);
    expect(ax(50)).toBeGreaterThan(ax(10) + 0.01);
    expect(VAULT_SHAPE.arch.up).toBeGreaterThan(VAULT_SHAPE.arch.down);
  });
  it('arcade : l\'axe est le maximum (1), le côté orbite tombe plus vite que le côté front, éteinte à 58°', async () => {
    const { archShape } = await import('../src/skull/vault-shapes');
    const yG = 0.45, a = archAxisY(20, yG);
    expect(archShape(a, 20, yG)).toBeCloseTo(1, 6);
    expect(archShape(a + 0.03, 20, yG)).toBeLessThan(archShape(a - 0.03, 20, yG));
    expect(archShape(a, 60, yG)).toBe(0);
  });
  it('amplitude de l\'arcade : signée, la gouttière plus douce que le torus, échelonnée par browRidge (0,6 … 1,4)', () => {
    expect(archAmp(0, 0.5)).toBe(0);
    expect(archAmp(-1, 0.5)).toBeCloseTo(-VAULT_SHAPE.arch.sulcus * archAmp(1, 0.5), 9);
    expect(archScale(0)).toBeCloseTo(0.6, 9); expect(archScale(1)).toBeCloseTo(1.4, 9);
    expect(archAmp(1, 1)).toBeGreaterThan(archAmp(1, 0));
  });
  it('fusion douce : continue vers le maximum quand un terme tend vers 0, jamais plus de ×1,19 le maximum, somme pour des signes opposés', () => {
    expect(softUnion(0.03, 1e-9)).toBeCloseTo(0.03, 6); expect(softUnion(0.03, 0.03)).toBeCloseTo(0.03 * 2 ** 0.25, 9);
    expect(softUnion(-0.03, -0.03)).toBeCloseTo(-0.03 * 2 ** 0.25, 9); expect(softUnion(0.03, -0.02)).toBeCloseTo(0.01, 9);
    for (let i = 1; i < 40; i++) { const a = 0.001 * i, b = 0.04 - a; expect(softUnion(a, b)).toBeLessThanOrEqual(Math.max(a, b) * 2 ** 0.25 + 1e-12); expect(softUnion(a, b)).toBeGreaterThanOrEqual(Math.max(a, b)); }
  });
  it('éminences, métopique, chignon : centrés sur leur repère, symétriques, bornés [0, 1]', () => {
    const yG = 0.45, E = VAULT_SHAPE.eminence;
    expect(eminenceShape(yG - E.dyUp, E.az, yG)).toBeCloseTo(1, 9);
    expect(metopicShape(0.3, 0, yG, 0.125)).toBeCloseTo(1, 6); expect(metopicShape(0.3, 20, yG, 0.125)).toBeLessThan(0.01); expect(metopicShape(0.12, 0, yG, 0.125)).toBeLessThan(0.05);
    expect(bunShape(0.626 - VAULT_SHAPE.bun.dyUp, 180, 0.626)).toBeCloseTo(1, 9);
  });
  it('muscle : nul au-dessus de la crête, présent dessous ; interpolation de courbe bornée aux extrémités', () => {
    expect(muscleShape(0.3, 84, 0.476, 0.4)).toBeLessThan(0.01); expect(muscleShape(0.47, 84, 0.476, 0.32)).toBeGreaterThan(0.9);
    const pts = [{ y: 1, az: 0 }, { y: 3, az: 10 }];
    expect(curveYAt(pts, -5)).toBe(1); expect(curveYAt(pts, 5)).toBe(2); expect(curveYAt(pts, 50)).toBe(3);
  });
});

describe('relief 3D : chaque mesure change le relief là où son registre l\'annonce, et rien ailleurs', () => {
  const W: Record<string, { ys: [number, number]; azs: [number, number]; base?: object }> = {
    frontalEminence: { ys: [0.25, 0.4], azs: [15, 40] }, browArch: { ys: [0.42, 0.55], azs: [5, 55] }, metopicRidge: { ys: [0.15, 0.4], azs: [0, 8] },
    occipitalBun: { ys: [0.35, 0.58], azs: [150, 180] }, inionSize: { ys: [0.58, 0.67], azs: [165, 180] }, temporalLine: { ys: [0.3, 0.55], azs: [40, 115] },
    temporalMuscle: { ys: [0.4, 0.56], azs: [65, 105] }, asterion: { ys: [0.5, 0.57], azs: [112, 132] }, asymMastoid: { ys: [0.6, 0.72], azs: [105, 130], base: { mastoid: 0.5 } },
    asymParietalHeight: { ys: [0.12, 0.38], azs: [95, 130], base: { parietalBulge: 1 } },
  };
  it.each(NEW_KEYS)('%s : écart de relief > 4 mm de tête entre −1 et +1 dans sa région', (k) => {
    const w = W[k]!, g = gap({ ...w.base, [k]: -1 }, { ...w.base, [k]: 1 }, w.ys, w.azs);
    expect(g, `${k} : ${g.toFixed(4)} U`).toBeGreaterThan(0.004 / 0.23 * 0.23 * 1);   // 0,004 U ≈ 1 mm ; seuil volontairement bas : la perceptibilité est prouvée sur le RENDU plus bas
  });
  it('aucune fuite : les reliefs frontaux ne touchent pas l\'occiput, le chignon ne touche pas le front', () => {
    expect(gap({}, { frontalEminence: 1, browArch: 1, metopicRidge: 1 }, [0.1, 0.8], [100, 180])).toBeLessThan(1e-9);
    expect(gap({}, { occipitalBun: 1, inionSize: 1 }, [0.1, 0.8], [0, 80])).toBeLessThan(1e-4);   // queue gaussienne du chignon : < 0,1 mm de tête
  });
  it('à 0 : le relief de voûte est EXACTEMENT nul (tête identique à celle d\'avant)', () => {
    const e = spec({}).engine!;
    for (let y = 0.05; y < 1; y += 0.05) for (let az = 0; az <= 150; az += 10) expect(vaultRelief(e, y, az * D)).toBe(0);   // au-delà de 150° agit l'`inion` existant (lu en écart à son nominal)
  });
  it('la crête persistante REMPLACE la crête fine de suturesShow : jamais cumulées', () => {
    const a = spec({ temporalLine: 1 }).engine!, b = spec({ temporalLine: 1, suturesShow: 1 }).engine!, ln = vaultAnchors(a).curves.find((c) => c.id === 'line.temporal')!, p = ln.pts[2]!;
    expect(Math.abs(vaultRelief(a, p.y, p.az * D) - vaultRelief(b, p.y, p.az * D))).toBeLessThan(1e-6);
  });
  it('asymétries : mastoïde et position pariétale DIFFÉRENTES à gauche et à droite ; symétriques à 0 ; le côté fort s\'inverse avec le signe', () => {
    const yM = vaultAnchors(spec({}).engine!).yM, e1 = spec({ mastoid: 0.5, asymMastoid: 1 }).engine!, e0 = spec({ mastoid: 0.5 }).engine!, e2 = spec({ mastoid: 0.5, asymMastoid: -1 }).engine!;
    expect(Math.abs(vaultRelief(e0, yM, 118 * D) - vaultRelief(e0, yM, -118 * D))).toBeLessThan(1e-9);
    expect(vaultRelief(e1, yM, 118 * D)).toBeGreaterThan(vaultRelief(e1, yM, -118 * D) + 0.005);
    expect(vaultRelief(e2, yM, 118 * D)).toBeLessThan(vaultRelief(e2, yM, -118 * D) - 0.005);
    const peak = (e: never, s: number): number => { let b = { v: -1, y: 0 }; for (let y = 0.05; y < 0.5; y += 0.005) { const v = skullRelief(e, y, s * 112 * D); if (v > b.v) b = { v, y }; } return b.y; };
    const p0 = spec({ parietalBulge: 1 }).engine!, p1 = spec({ parietalBulge: 1, asymParietalHeight: 1 }).engine!;
    expect(Math.abs(peak(p0 as never, 1) - peak(p0 as never, -1))).toBeLessThan(0.011);
    expect(peak(p1 as never, 1) - peak(p1 as never, -1)).toBeLessThan(-0.08);   // le côté +x MONTE (y plus petit), le côté −x descend
  });
  it('tolérance de largeur : le muscle et la crête temporaux peuvent dépasser la coupe au point le plus large ; rien sinon', () => {
    const a = vaultAnchors(spec({}).engine!);
    expect(vaultOver(spec({}).engine!, a.yT)).toBe(0);
    expect(vaultOver(spec({ temporalMuscle: 1 }).engine!, a.yT)).toBeGreaterThan(0.01);
    expect(vaultOver(spec({ temporalMuscle: -1, temporalLine: -1 }).engine!, a.yT)).toBe(0);
  });
  it('les cheveux lisent le MÊME relief : la surface de la tête (source du volume de cheveux) recule de plus de 0,02 U avec le chignon', () => {
    const s0 = spec({}), s1 = spec({ occipitalBun: 1 }), y = vaultAnchors(s1.engine!).yI - VAULT_SHAPE.bun.dyUp;
    const z = (s: typeof s0) => skullSurfacePoint(s, headRelief(s.engine), y, Math.PI).z;
    expect(z(s0) - z(s1)).toBeGreaterThan(0.02);
  });
});

describe('registre : structures, ancres, paramètres de la passe 2', () => {
  it('6 nouvelles structures, chacune porte au moins un paramètre neuf ; les 10 mesures sont toutes portées', () => {
    const ids = ['frontal-eminence', 'supraorbital-arch', 'metopic-ridge', 'occipital-bun', 'temporal-muscle', 'asterion'];
    for (const id of ids) expect(VAULT_STRUCTURES.some((s) => s.id === id), id).toBe(true);
    const owned = new Set(VAULT_STRUCTURES.flatMap((s) => s.params));
    for (const k of NEW_KEYS) expect(owned.has(k), k).toBe(true);
    expect(VAULT_STRUCTURES.find((s) => s.id === 'metopic-ridge')!.visibleByDefault).toBe(false);   // ligne = donnée, relief seulement si le paramètre ≠ 0
  });
  it('l\'ancre de l\'éminence pariétale SUIT sa position : hauteur, azimut, asymétrie de hauteur (par côté)', () => {
    const st = VAULT_STRUCTURES.find((s) => s.id === 'parietal-bone')!, s = (ov: object) => spec(ov);
    const base = anchorOf(s({}), st, 1), up = anchorOf(s({ parietalHeight: 1 }), st, 1), back = anchorOf(s({ parietalAzimuth: 1 }), st, 1);
    expect(up.yU!).toBeCloseTo(base.yU! - 0.06, 6);   // +1 = haute : y (vers le bas) diminue
    expect(back.az).toBeCloseTo(base.az + 14, 6);
    const as1 = anchorOf(s({ asymParietalHeight: 1 }), st, 1), as2 = anchorOf(s({ asymParietalHeight: 1 }), st, -1);
    expect(as2.yU! - as1.yU!).toBeCloseTo(2 * VAULT_SHAPE.asym.parietalHeight * 0.06, 6);
    expect(anchorOf(s({ parietalHeight: 1 }), VAULT_STRUCTURES.find((q) => q.id === 'frontal-bone')!, 1)).toBe(VAULT_STRUCTURES.find((q) => q.id === 'frontal-bone')!.anchor);
  });
});

describe('contraintes, préférences, corrélations de la passe 2', () => {
  it('strictes : muscle puissant ⇒ fosse peu creuse ; occiput plat ⇒ pas de chignon ; journalisées ; levées en caricature ; ne touchent rien sinon', () => {
    const k = SkullParams.parse({ temporalMuscle: 1, temporalHollow: 1, occipitalFlat: 1, occipitalBun: 1 });
    const n = assessVault(k, false), c = assessVault(k, true);
    expect(n.params.temporalHollow).toBeLessThanOrEqual(0.5 + 1e-9); expect(n.params.occipitalBun).toBeLessThanOrEqual(0.4 + 1e-9);
    expect(n.corrections.map((q) => q.id).join()).toMatch(/muscle-fills-hollow/); expect(c.corrections).toHaveLength(0); expect(c.params.occipitalBun).toBe(1);
    expect(assessVault(SkullParams.parse({ ...mk(1), temporalMuscle: 0, occipitalFlat: 0 }), false).corrections).toHaveLength(0);
  });
  it('préférences : mesurées, jamais corrigées ; front à bosses + arcade forte rare', () => {
    const rare = assessVault(SkullParams.parse({ frontalEminence: 1, browArch: 1 })), banal = assessVault(SkullParams.parse({ frontalEminence: 1, browArch: -1 }));
    expect(rare.plausibility).toBeLessThan(banal.plausibility); expect(rare.params.browArch).toBe(1); expect(rare.preferences.some((p) => p.id === 'front-juvenile-robuste' && p.score === 0)).toBe(true);
  });
  it('corrélations facultatives : 4 nouvelles tendances ; indépendantes par défaut, liées à tendance 1, jamais absolues', () => {
    const N = 300, cor = (t: number, a: keyof VP, b: keyof VP): number => {
      const p = Array.from({ length: N }, (_, i) => drawVault(i + 1, { tendency: t })), ma = p.reduce((s, q) => s + q[a], 0) / N, mb = p.reduce((s, q) => s + q[b], 0) / N;
      let c = 0, va = 0, vb = 0; for (const q of p) { c += (q[a] - ma) * (q[b] - mb); va += (q[a] - ma) ** 2; vb += (q[b] - mb) ** 2; } return c / Math.sqrt(va * vb);
    };
    for (const t of TENDENCIES.filter((q) => (NEW_KEYS as readonly string[]).includes(q.from))) {
      expect(Math.abs(cor(0, t.from, t.to)), `${t.from}→${t.to} indépendantes`).toBeLessThan(0.15);
      expect(cor(1, t.from, t.to) * t.sign, `${t.from}→${t.to} liées`).toBeGreaterThan(0.25); expect(cor(1, t.from, t.to) * t.sign).toBeLessThan(0.95);
    }
  });
});

describe('couche de vérification de rendu, passe 2 : géométrie, anatomie, style', () => {
  it('nominale, tout au maximum, tout au minimum, mélangées aux extrêmes anciens : aucun échec (2 graines)', () => {
    const old = { cranialBreadth: 1, parietalBulge: 1, mastoid: 1, glabella: 1, nuchalLine: 1, suturesShow: 1, frontalFlat: 1, vaultHeight: 1 };
    for (const seed of [3, 42]) for (const ov of [{}, mk(1), mk(-1), { ...mk(1), ...old }, { ...mk(-1), glabella: -1, mastoid: -1, parietalBulge: -1 }]) for (const l of vaultReport(spec(ov, seed))) for (const c of l.checks) expect(c.ok, `graine ${seed} ${c.id}=${c.value} [${c.min}, ${c.max}]`).toBe(true);
  }, 240_000);
  it('ancre pariétale : suit le sommet du relief aux extrêmes de position (hauteur, azimut, asymétrie), éminence nette', () => {
    for (const ov of [{ parietalHeight: 1 }, { parietalHeight: -1 }, { parietalAzimuth: 1 }, { parietalAzimuth: -1 }, { asymParietalHeight: 1, parietalHeight: -1 }]) {
      const c = vaultReport(spec({ parietalBulge: 1, ...ov })).flatMap((l) => l.checks).find((q) => q.id === 'vault.anat.parietal.anchor')!;
      expect(c.ok, `${JSON.stringify(ov)} : ${c.value}`).toBe(true);
    }
  }, 120_000);
  it('24 voûtes TIRÉES au hasard avec les 10 nouvelles mesures (variété 0,9, tendances 0,5) : aucun échec, toutes couches', () => {
    for (let seed = 1; seed <= 24; seed++) {
      const p = generateRandomProfile(seed, { vault: { variety: 0.9, tendency: 0.5 } });
      for (const l of vaultReport(spec(p.skull, seed))) for (const c of l.checks) expect(c.ok, `graine ${seed} ${c.id}=${c.value} [${c.min}, ${c.max}]`).toBe(true);
    }
  }, 280_000);
  it('les contrôles de la passe 2 existent dans les trois couches', () => {
    const ids = vaultReport(spec({})).flatMap((l) => l.checks.map((c) => c.id));
    for (const id of ['vault.geo.symmetry', 'vault.anat.arch.orbit', 'vault.anat.eminence.between', 'vault.anat.bun.level', 'vault.anat.line.above', 'vault.anat.parietal.anchor', 'vault.anat.visible.front', 'vault.anat.visible.back', 'vault.style.silhouette.back', 'vault.style.relief.curvature']) expect(ids, id).toContain(id);
  }, 60_000);
  it('un défaut RÉEL est détecté : une arcade sous la ligne des yeux, un relief asymétrique non déclaré', () => {
    const e = spec({ asymFaceCoupling: 0, browArch: 1 }), bad = { ...e, engine: { ...e.engine!, lm: { ...e.engine!.lm, eyeY: -5000 } } } as typeof e;
    expect(vaultReport(bad).flatMap((l) => l.checks).find((c) => c.id === 'vault.anat.arch.orbit')!.ok).toBe(false);
  }, 60_000);
});

describe('preuve visuelle de la passe 2 : min / nominal / max perceptibles, même caméra, même lumière', () => {
  const cases = proofCases();
  it.each([...NEW_KEYS, 'browRidge'])('%s', (id) => {
    const r = measureProof(cases.find((c) => c.id === id)!, 240);
    expect(r.perceptible, `${id} : ${JSON.stringify(r.best)}`).toBe(true);
  }, 120_000);
});

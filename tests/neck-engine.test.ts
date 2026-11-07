import { describe, expect, it } from 'vitest';
import { generateRandomFace, SceneSpec } from '../src';
import { faceLandmarks, halfWidthAt } from '../src/face';
import { neckModelFor, frontSilhouette, profileSilhouette } from '../src/neck';
import { NECK_OPERATORS } from '../src/schema/neck-system';
import { FaceParams } from '../src/schema';
import { checkNeckModel } from '../src/verify/neck';
import { OPERATORS } from '../src/neck/operators';

/** Visage de référence + surcharge du cou (`neck.system.*` ou champs plats de `FaceNeck`). */
function model(neck: Record<string, unknown> = {}, face: Record<string, unknown> = {}, yaw = 0) {
  const f = generateRandomFace(321, { id: 'f', neck: { visible: true } } as never);
  const host = (SceneSpec.parse({ width: 800, height: 800, background: null, objects: f.objects }) as { objects: { kind: string; face?: Record<string, unknown> }[] }).objects[0]!;
  const raw = host.face as Record<string, unknown>;
  const p = FaceParams.parse({ ...raw, ...face, neck: { ...(raw.neck as object), visible: true, ...neck } });
  const lm = faceLandmarks(p, 400, 520);
  return { p, lm, m: neckModelFor(p, lm, yaw) };
}
const sys = (s: Record<string, unknown>) => ({ system: s });

describe('moteur de cou — cadre et compatibilité', () => {
  it('par défaut, lm.neck est IDENTIQUE à l\'ancienne formule (aucun visage existant ne bouge)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const f = generateRandomFace(seed, { id: 'f' } as never);
      const lm = faceLandmarks(f.params, f.width, f.height);
      const n = f.params.neck, W = lm.W, H = lm.H;
      const half0 = (n.width * W) / 2 + n.chinCoupling * (f.params.chin.projection - 0.5) * 0.05 * W;
      const lo = lm.outline.chinHalf * 1.15, hi = halfWidthAt(lm.outline, lm.jawY) * 0.85;
      const half = Math.min(hi, Math.max(lo, half0));
      expect(lm.neck.half).toBeCloseTo(half, 9);
      expect(lm.neck.topY).toBeCloseTo(-H / 2 + 0.6 * H, 9);
      expect(lm.neck.bottomY).toBeCloseTo(H / 2 + n.length * H, 9);
    }
  });

  it('un seul moteur : aucune autre copie de la formule du cadre, aucun ancien rendu de cou', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const q = join(d, n); return statSync(q).isDirectory() ? walk(q) : q.endsWith('.ts') ? [q] : []; });
    const files = walk('src');
    const has = (needle: string): string[] => files.filter((f) => readFileSync(f, 'utf8').includes(needle));
    // La FORMULE (appel du résolveur) n'existe qu'une fois ; `relations.ts` ne fait que référencer l'identifiant de correction.
    expect(has("limit('neck-between-chin-and-jaw'")).toEqual([join('src', 'neck', 'frame.ts')]);
    expect(has('export function renderNeck(')).toEqual([join('src', 'render', 'neck', 'index.ts')]);
    expect(has('export function neckPath(').length + has('export const neckPath').length).toBe(1);
  });

  it('la compression axiale raccourcit le cou ET remonte la base du corps (lm.neck.bottomY)', () => {
    const a = model().lm.neck.bottomY, b = model(sys({ pose: { compression: 0.8 } })).lm.neck.bottomY;
    expect(b).toBeLessThan(a - 20);
    const c = model(sys({ pose: { stretch: 0.8 } })).lm.neck.bottomY;
    expect(c).toBeGreaterThan(a + 10);
  });

  it('l\'exagération de style peut dépasser la mâchoire (cou de taureau) : choix explicite, jamais en défaut', () => {
    const base = model({ width: 0.7 }), bull = model({ width: 0.7, system: { style: { mode: 'caricature', exaggeration: 1 }, modifiers: { mass: 0.9 } } });
    expect(bull.lm.neck.half).toBeGreaterThan(base.lm.neck.half * 1.15);
  });
});

describe('moteur de cou — déterminisme', () => {
  it('mêmes paramètres, même modèle ; la graine ne compte que si la variation locale est non nulle', () => {
    const a = model(sys({ asymmetry: { localVariation: 0.8, seed: 5 } })).m, b = model(sys({ asymmetry: { localVariation: 0.8, seed: 5 } })).m, c = model(sys({ asymmetry: { localVariation: 0.8, seed: 6 } })).m;
    expect(JSON.stringify(a.stations)).toBe(JSON.stringify(b.stations));
    expect(JSON.stringify(a.stations)).not.toBe(JSON.stringify(c.stations));
    expect(JSON.stringify(model(sys({ asymmetry: { seed: 5 } })).m.stations)).toBe(JSON.stringify(model(sys({ asymmetry: { seed: 6 } })).m.stations));
  });
});

describe('moteur de cou — opérateurs (TODO §6)', () => {
  const all = NECK_OPERATORS.map((op) => ({ op, amount: 0.8, at: 0.5, span: 0.5, side: 0 as const }));
  it('les 12 opérateurs sont déclarés, chacun avec ordre, plage et domaine', () => {
    expect(OPERATORS.map((o) => o.op).sort()).toEqual([...NECK_OPERATORS].sort());
    expect(new Set(OPERATORS.map((o) => o.order)).size).toBe(12);
    for (const o of OPERATORS) { expect(o.domain.length).toBeGreaterThan(0); expect(o.range[0]).toBeLessThan(o.range[1]); }
  });
  it('l\'ordre d\'exécution est canonique : la liste mélangée donne EXACTEMENT le même cou', () => {
    const shuffled = [...all].reverse();
    const a = model(sys({ operators: all })).m, b = model(sys({ operators: shuffled })).m;
    expect(JSON.stringify(a.stations)).toBe(JSON.stringify(b.stations));
    expect(a.composition.stack.applied.map((o) => o.order)).toEqual([...a.composition.stack.applied.map((o) => o.order)].sort((x, y) => x - y));
  });
  it('chaque opérateur change la géométrie ; les ancrages haut et base ne bougent JAMAIS', () => {
    const base = model().m;
    for (const op of NECK_OPERATORS) {
      const m = model(sys({ operators: [{ op, amount: 0.9, at: 0.5, span: 0.5, side: 0 }] })).m;
      const changed = m.stations.some((s, i) => ['x', 'y', 'z', 'aL', 'aR', 'bF', 'bB'].some((k) => Math.abs((s as never)[k] - (base.stations[i] as never)[k]) > 1e-6)) || m.fields.muscle.some((v) => v > 0) || m.fields.fold.some((v) => v > 1) || m.fields.simplify > 0;
      expect(changed, op).toBe(true);
      expect(m.stations[0]!.y).toBeCloseTo(base.stations[0]!.y, 6);
      expect(m.stations[m.stations.length - 1]!.y).toBeCloseTo(base.stations[base.stations.length - 1]!.y, 6);
      expect(m.stations[m.stations.length - 1]!.x).toBeCloseTo(base.stations[base.stations.length - 1]!.x, 6);
    }
  });
  it('un amount hors plage est ramené ET consigné', () => {
    const m = model(sys({ operators: [{ op: 'local_compression', amount: -0.7, at: 0.5, span: 0.4, side: 0 }] })).m;
    expect(m.composition.stack.applied[0]!.clamped).toBe(true);
    expect(m.corrections.some((c) => c.id === 'operator-range-local_compression')).toBe(true);
  });
  it('compression et plis réagissent : la compression locale amplifie les plis (lecture croisée)', () => {
    const m = model(sys({ operators: [{ op: 'local_compression', amount: 1, at: 0.5, span: 0.4, side: 0 }, { op: 'fold_amplification', amount: 0.5, at: 0.5, span: 0.4, side: 0 }] })).m;
    const noComp = model(sys({ operators: [{ op: 'fold_amplification', amount: 0.5, at: 0.5, span: 0.4, side: 0 }] })).m;
    const mid = Math.floor(m.fields.fold.length / 2);
    expect(m.fields.fold[mid]!).toBeGreaterThan(noComp.fields.fold[mid]! * 1.5);
  });
  it('garde-fous : pas d\'inversion de surface (humain) ; relâchés seulement pour « fantasy », explicitement', () => {
    const crush = [{ op: 'width_profile_warp', amount: -1, at: 0.5, span: 1, side: 0 }, { op: 'width_profile_warp', amount: -1, at: 0.5, span: 1, side: 0 }, { op: 'width_profile_warp', amount: -1, at: 0.5, span: 1, side: 0 }, { op: 'local_compression', amount: 1, at: 0.5, span: 1, side: 0 }, { op: 'local_compression', amount: 1, at: 0.5, span: 1, side: 0 }, { op: 'local_compression', amount: 1, at: 0.5, span: 1, side: 0 }];
    const h = model(sys({ operators: crush })).m, f = model(sys({ species: 'fantasy', operators: crush })).m;
    const floor = (m: typeof h) => Math.min(...m.stations.map((s) => Math.min(s.aL, s.aR))) / m.composition.morphology.aTop;
    expect(floor(h)).toBeGreaterThanOrEqual(0.3 - 1e-9);
    expect(h.corrections.some((c) => c.id === 'deform-guard-section')).toBe(true);
    expect(floor(f)).toBeLessThan(floor(h));
  });
});

describe('moteur de cou — espèces (TODO §3)', () => {
  it('humain → paramètres de fantasy hors biologie : ramenés et consignés, composants désactivés avec leur raison', () => {
    const m = model(sys({ profile: { segments: 9, curvature: 1, crossSection: 1 } })).m;
    expect(m.composition.morphology.segments).toBe(1);
    expect(m.composition.morphology.curvature).toBeLessThanOrEqual(0.45 + 1e-9);
    expect(m.corrections.map((c) => c.id)).toEqual(expect.arrayContaining(['species-human-segments', 'species-human-curvature', 'species-human-cross']));
    const d = model(sys({ species: 'dragon' })).m.composition.structures;
    expect(d.find((s) => s.id === 'larynx')).toMatchObject({ visibility: 0, disabledBy: 'species:dragon' });
    expect(d.find((s) => s.id === 'scm')).toMatchObject({ visibility: 0, disabledBy: 'species:dragon' });
    expect(model(sys({ species: 'human' })).m.composition.structures.filter((s) => s.disabledBy)).toEqual([]);
  });
  it('un serpent a au moins 4 segments ; fantasy n\'a aucune limite biologique', () => {
    expect(model(sys({ species: 'serpent', profile: { segments: 1 } })).m.composition.morphology.segments).toBe(4);
    expect(model(sys({ species: 'fantasy', profile: { curvature: 1, segments: 12 } })).m.composition.morphology.segments).toBe(12);
  });
});

describe('moteur de cou — pose, rig et langage corporel (TODO §4-5)', () => {
  const mean = (a: Float64Array) => a.reduce((s, v) => s + v, 0) / a.length;
  it('inclinaison latérale : côté comprimé à droite, SCM gauche tendu', () => {
    const m = model(sys({ pose: { bodyLanguage: 'curiosity', bodyLanguageAmount: 1 } })).m; // roulis +14°
    expect(mean(m.fields.compressionSide)).toBeGreaterThan(0.02);
    expect(mean(m.fields.muscleSide)).toBeLessThan(-0.02);
  });
  it('rotation de la tête : le cou en suit la part `twistShare`, progressivement (haut > base = 0)', () => {
    const a = model(sys({ pose: { twistShare: 0.55 } }), {}, 40).m, b = model(sys({ pose: { twistShare: 0.8 } }), {}, 40).m;
    const top = a.stations[0]!.twist, base = a.stations[a.stations.length - 1]!.twist;
    expect(top).toBeCloseTo((40 * Math.PI / 180) * 0.55, 6);
    expect(base).toBeCloseTo(0, 6);
    expect(b.stations[0]!.twist).toBeGreaterThan(top);
    expect(mean(a.fields.muscleSide)).toBeLessThan(0);
  });
  it('limites articulaires : un lacet de 400° est ramené et consigné', () => {
    const m = model({}, {}, 400).m;
    expect(m.corrections.some((c) => c.id === 'rig-limit-yaw')).toBe(true);
    expect(Math.abs(m.stations[0]!.twist)).toBeLessThan(Math.PI);
  });
  it('les neuf expressions décalent la pose sans la figer (intensité 0 = neutre ; intensité réelle = écart proportionnel)', () => {
    const base = model().m;
    for (const e of ['fear', 'pride', 'shame', 'defiance', 'fatigue', 'curiosity', 'anger', 'relaxed'] as const) {
      const half = model(sys({ pose: { bodyLanguage: e, bodyLanguageAmount: 0.5 } })).m, full = model(sys({ pose: { bodyLanguage: e, bodyLanguageAmount: 1 } })).m;
      const dist = (m: typeof base) => m.stations.reduce((s, st, i) => s + Math.abs(st.z - base.stations[i]!.z) + Math.abs(st.x - base.stations[i]!.x) + Math.abs(st.aL - base.stations[i]!.aL) + Math.abs(st.bF - base.stations[i]!.bF) + Math.abs(st.y - base.stations[i]!.y), 0) + m.fields.compression.reduce((s, v) => s + v, 0) + m.fields.muscle.reduce((s, v) => s + v, 0);
      expect(dist(full), e).toBeGreaterThan(dist(half) * 1.1);
      expect(dist(half), e).toBeGreaterThan(0);
    }
    expect(JSON.stringify(model(sys({ pose: { bodyLanguage: 'fear', bodyLanguageAmount: 0 } })).m.stations)).toBe(JSON.stringify(base.stations));
  });
  it('les stratégies coexistent et se distinguent : chain (coudes) ≠ weighted ≠ centerline ≠ fields (axe immobile)', () => {
    const pose = { bodyLanguage: 'shame', bodyLanguageAmount: 1 };
    const z = (strategies: string[]) => model(sys({ pose, strategies, profile: { segments: 5 } })).m.stations.map((s) => s.z);
    const c = z(['chain']), w = z(['weighted']), l = z(['centerline']), f = z(['fields']), mix = z(['chain', 'weighted']);
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(w)); expect(JSON.stringify(w)).not.toBe(JSON.stringify(l));
    expect(Math.max(...f.map(Math.abs))).toBeLessThan(Math.max(...w.map(Math.abs)) * 0.05);
    expect(JSON.stringify(mix)).not.toBe(JSON.stringify(c));
  });
  it('contact : un collier serre le cou à son ancrage et le tissu déborde de part et d\'autre', () => {
    const a = model().m, b = model(sys({ attachments: [{ kind: 'collar', at: 0.7, size: 0.6, count: 1, color: '#884422' }] })).m;
    const i = Math.round(0.7 * (a.stations.length - 1));
    expect(b.stations[i]!.aL).toBeLessThan(a.stations[i]!.aL * 0.97);
    expect(b.stations[Math.round(0.78 * (a.stations.length - 1))]!.aL).toBeGreaterThanOrEqual(a.stations[Math.round(0.78 * (a.stations.length - 1))]!.aL * 0.99);
  });
});

describe('moteur de cou — vérification (TODO §9)', () => {
  it('un cou valide passe les trois couches ; des corruptions sont DÉTECTÉES (contrôles négatifs)', () => {
    const { m } = model();
    expect(checkNeckModel(m).filter((c) => !c.ok && c.severity === 'error')).toEqual([]);
    const bad = (mut: (s: typeof m.stations[number], i: number) => Partial<typeof m.stations[number]>) => ({ ...m, stations: m.stations.map((s, i) => ({ ...s, ...mut(s, i) })) });
    const fails = (mm: typeof m) => checkNeckModel(mm).filter((c) => !c.ok && c.severity === 'error').map((c) => c.id);
    expect(fails(bad((_s, i) => (i === 5 ? { y: m.stations[3]!.y } : {})))).toContain('neck.axis-monotone');
    expect(fails(bad((s, i) => (i === 7 ? { aL: s.aL * 0.1 } : {})))).toContain('neck.section-floor');
    expect(fails(bad((_s, i) => (i === 0 ? { x: m.ctx.chinHalf * 2 } : {})))).toContain('neck.under-head');
    expect(fails(bad((_s, i) => (i === 2 ? { aL: Number.NaN } : {})))).toContain('neck.finite');
    expect(fails(bad((s, i) => (i === m.stations.length - 1 ? { y: s.y + 5 } : {})))).toContain('neck.anchor-base');
  });
  it('un composant incompatible avec l\'espèce est signalé', () => {
    const { m } = model(sys({ species: 'dragon' }));
    const tampered = { ...m, composition: { ...m.composition, structures: m.composition.structures.map((s) => (s.id === 'larynx' ? { ...s, visibility: 0.8, disabledBy: undefined } : s)) } };
    expect(checkNeckModel(tampered).filter((c) => !c.ok).map((c) => c.id)).toContain('neck.species-structures');
  });
  it('profil et face lisent le même axe ; le contrat commun tient sur 12 cous variés', () => {
    for (let i = 0; i < 12; i++) {
      const { m } = model(sys({ dimensions: { depthRatio: 0.5 + 0.08 * i }, profile: { taper: -0.5 + i / 12, waist: (i % 4) / 4 }, orientation: { torsionDeg: i * 4 - 20 } }));
      const f = frontSilhouette(m), p = profileSilhouette(m);
      m.stations.forEach((s, k) => { expect(f.left[k]!.y).toBe(s.y); expect(p.front[k]!.y).toBe(s.y); expect(f.right[k]!.x).toBeGreaterThan(f.left[k]!.x); });
      expect(checkNeckModel(m).filter((c) => !c.ok && c.severity === 'error')).toEqual([]);
    }
  });
});

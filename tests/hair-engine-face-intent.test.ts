import { describe, expect, it } from 'vitest';
import { verifyComposed } from '../src/hair-grammar/compose-verify';
import { generate } from '../src/hair-grammar/grammar';
import { bladeOutline, smoothPath, type Blade } from '../src/hair-grammar/blade';
import { DEFAULT_HEAD, facing, landmarks, project } from '../src/hair-grammar/head';
import type { PaintedLock } from '../src/hair-grammar/paint';
import { PRESETS } from '../src/hair-grammar/intent';
import { generateIntended } from '../src/hair-grammar/intent-run';
import type { LockSpec } from '../src/hair-grammar/lock';
import { repairCycle } from '../src/hair-grammar/repair';
import { TOUSLED } from '../src/hair-grammar/profiles/tousled';
import { v3 } from '../src/hair-grammar/vec';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

/** `anat.face` (nez / bouche recouverts) et la boucle intention → vérification → réparation (docs/HAIR-FACE-INTENT.md). */
const H = DEFAULT_HEAD; const V = viewAt(0);
/** Mèche fautive : née sur le front, elle retombe droit devant le visage, jusque sous la bouche. */
const INTRUDER: LockSpec = { id: 'intruder-0', family: 'fringe', root: { el: 68, az: 0 }, aim: v3(0, 1, 0.45), length: 1.15, bend: 0, wave: { amp: 0, freq: 1, phase: 0 }, flick: { amt: 0, len: 0.2 }, lift0: 0.06, lift1: 0.12, liftPow: 1, gravity: 0, width: 0.16, peak: 0.4, taper: 1, tone: 0, strands: 0, layer: 'front' };
const codes = (specs: LockSpec[], view = V): string[] => verifyComposed(H, specs, view).defects.map((d) => d.code);

describe('anat.face : nez et bouche', () => {
  it('une mèche qui retombe sur le visage est DÉTECTÉE, nommée, et le rapport d\'anatomie échoue', () => {
    const v = verifyComposed(H, [...generate(TOUSLED, 1), INTRUDER], V);
    const d = v.defects.filter((x) => x.code === 'anat.face'); expect(d.length).toBeGreaterThanOrEqual(1);
    expect(d[0]!.lock).toBe('intruder-0'); expect(d[0]!.layer).toBe('anatomy');
    const chk = v.reports.find((r) => r.layer === 'anatomy')!.checks.find((c) => c.name === 'nez / bouche recouverts')!; expect(chk.ok).toBe(false); expect(chk.value).toBeGreaterThanOrEqual(1);
  });
  it('pas de faux positif : les coiffures de la grammaire ne recouvrent ni nez ni bouche (6 graines, 5 vues de −60° à +60°)', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) for (const yaw of [-60, -30, 0, 30, 60]) expect(codes(generate(TOUSLED, seed), viewAt(yaw))).not.toContain('anat.face');
  });
  it('la réparation écarte la mèche : le score baisse, la correction est journalisée et GARDÉE', () => {
    const specs = [...generate(TOUSLED, 1), INTRUDER]; const before = verifyComposed(H, specs, V);
    const r = repairCycle(TOUSLED, specs, V, 1);
    expect(r.verdict.score).toBeLessThan(before.score);
    const kept = r.journal.filter((a) => a.code === 'anat.face' && a.kept); expect(kept.length).toBeGreaterThanOrEqual(1); expect(kept[0]!.after).toBeLessThan(kept[0]!.before);
    expect(r.verdict.defects.filter((d) => d.code === 'anat.face')).toHaveLength(0);
  });
  it('la correction ne change QUE la mèche fautive', () => {
    const specs = [...generate(TOUSLED, 1), INTRUDER]; const r = repairCycle(TOUSLED, specs, V, 1);
    const same = specs.filter((s) => s.id !== 'intruder-0').every((s) => JSON.stringify(r.specs.find((q) => q.id === s.id)) === JSON.stringify(s) || r.journal.some((a) => a.lock === s.id));
    expect(same).toBe(true);
  });
});

describe('generateIntended : intention → vérification → réparation', () => {
  const INTENTS = [{ volume: 1, weight: 1 }, { volume: -1, sleek: 1 }, { wind: 1, windDir: 0.6, volume: 0.5 }, PRESETS.windswept, PRESETS.airy] as const;
  it('la réparation ne dégrade JAMAIS : score final ≤ score initial (5 intentions × 3 graines × 2 vues)', () => {
    let gain = 0;
    for (const I of INTENTS) for (const seed of [1, 2, 3]) for (const yaw of [-35, 35]) {
      const r = generateIntended(TOUSLED, I, viewAt(yaw), seed); expect(r.verdict.score).toBeLessThanOrEqual(r.initial.score); gain += r.initial.score - r.verdict.score;
    }
    expect(gain).toBeGreaterThanOrEqual(0);
  }, 60000);
  it('sans réparation : verdict = verdict initial, journal vide ; avec : le journal ne contient que des tentatives mesurées', () => {
    const a = generateIntended(TOUSLED, { volume: 1, weight: 1 }, V, 3, false); expect(a.verdict).toBe(a.initial); expect(a.journal).toEqual([]);
    const b = generateIntended(TOUSLED, { volume: 1, weight: 1 }, V, 3);
    for (const t of b.journal) { expect(Number.isFinite(t.before) && Number.isFinite(t.after)).toBe(true); expect(t.kept).toBe(t.after < t.before); }
  });
  it('déterministe', () => {
    expect(JSON.stringify(generateIntended(TOUSLED, { volume: 1 }, V, 2).specs)).toBe(JSON.stringify(generateIntended(TOUSLED, { volume: 1 }, V, 2).specs));
  });
});

/** Une lame verticale fabriquée, centrée en (x, y) de l'image : sert à poser une mèche EXACTEMENT sur un repère. */
const ribbonAt = (id: string, x: number, y: number): PaintedLock => {
  const N = 12; const half = 6; const spine = Array.from({ length: N }, (_, i) => ({ x, y: y - 12 + (24 * i) / (N - 1) }));
  const blade: Blade = { spine, half: spine.map(() => half), left: spine.map((p) => ({ x: p.x - half, y: p.y })), right: spine.map((p) => ({ x: p.x + half, y: p.y })), facing: spine.map(() => 1), t: spine.map((_, i) => i / (N - 1)), depth: spine.map(() => 0.5), twist: spine.map(() => 0) };
  const spec = { ...INTRUDER, id, family: 'probe' } as LockSpec;
  return { spec, blade, layer: 'front', svg: `<path d="${smoothPath(bladeOutline(blade), true)}"/>` };
};

describe('vérification par vue : seuls les repères VISIBLES comptent (yaw en DEGRÉS)', () => {
  const lm = landmarks(H); const eyeCodes = (yaw: number, which: 'eyeR' | 'eyeL'): string[] => { const v = viewAt(yaw); const q = project(v, lm[which]); return verifyComposed(H, [INTRUDER], v, [ribbonAt('probe-0', q.x, q.y)]).defects.filter((d) => d.lock === 'probe-0').map((d) => d.code); };
  it('facing : de face les deux yeux regardent la caméra ; à 70° un seul, l\'autre est derrière la tête', () => {
    expect(facing(H, viewAt(0), lm.eyeR)).toBeGreaterThan(0.6); expect(facing(H, viewAt(0), lm.eyeL)).toBeGreaterThan(0.6);
    const a = facing(H, viewAt(70), lm.eyeR); const b = facing(H, viewAt(70), lm.eyeL); expect(Math.max(a, b)).toBeGreaterThan(0.3); expect(Math.min(a, b)).toBeLessThan(0);
  });
  it('le yaw est en degrés : 30 déplace nettement le nez dans l\'image, 0,3 à peine', () => {
    const x = (y: number): number => project({ ...viewAt(30), yaw: y }, lm.noseTip).x; // vue brute : viewAt refuse justement les radians
    expect(Math.abs(x(30) - x(0))).toBeGreaterThan(10); expect(Math.abs(x(0.3) - x(0))).toBeLessThan(0.5);
  });
  it('de face : une mèche posée sur un œil est détectée (les deux yeux)', () => {
    expect(eyeCodes(0, 'eyeR')).toContain('anat.eye'); expect(eyeCodes(0, 'eyeL')).toContain('anat.eye');
  });
  it('à 70° : une mèche sur l\'œil VISIBLE est détectée, sur l\'œil CACHÉ elle ne l\'est pas', () => {
    const vis = facing(H, viewAt(70), lm.eyeR) > facing(H, viewAt(70), lm.eyeL) ? 'eyeR' : 'eyeL'; const hid = vis === 'eyeR' ? 'eyeL' : 'eyeR';
    expect(eyeCodes(70, vis)).toContain('anat.eye'); expect(eyeCodes(70, hid)).not.toContain('anat.eye');
  });
});

describe('réparation : plusieurs mèches sur le même repère, et balayage de vues (−75° … +75°)', () => {
  it('deux mèches sur le visage : UN défaut par mèche, et la réparation les écarte TOUTES (une seule ne baissait pas le score)', () => {
    const twin: LockSpec = { ...INTRUDER, id: 'intruder-1', root: { el: 70, az: 4 }, width: 0.14 };
    const specs = [...generate(TOUSLED, 1), INTRUDER, twin]; const v = verifyComposed(H, specs, V);
    expect(new Set(v.defects.filter((d) => d.code === 'anat.face').map((d) => d.lock))).toEqual(new Set(['intruder-0', 'intruder-1']));
    expect(repairCycle(TOUSLED, specs, V, 1).verdict.defects.filter((d) => d.code === 'anat.face')).toHaveLength(0);
  });
  it('balayage de lacet de −75° à +75° : la réparation ne dégrade jamais et ne laisse ni œil ni nez recouvert (2 graines × 6 vues)', () => {
    for (const seed of [1, 2]) for (const yaw of [-75, -45, -15, 15, 45, 75]) {
      const v = viewAt(yaw); const s0 = generate(TOUSLED, seed); const before = verifyComposed(H, s0, v); const r = repairCycle(TOUSLED, s0, v, seed);
      expect(r.verdict.score).toBeLessThanOrEqual(before.score);
      expect(r.verdict.defects.filter((d) => d.code === 'anat.eye' || d.code === 'anat.face'), `seed ${seed}, ${yaw}°`).toHaveLength(0);
    }
  }, 90000);
});

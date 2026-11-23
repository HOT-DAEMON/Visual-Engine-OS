import { describe, expect, it } from 'vitest';
import { generate } from '../src/hair-grammar/grammar';
import { applyIntent, type Intent } from '../src/hair-grammar/intent';
import { generateIntended } from '../src/hair-grammar/intent-run';
import { verifyComposed } from '../src/hair-grammar/compose-verify';
import { observePart, partFromColumns, GROOVE_MAX_U } from '../src/hair-grammar/observe-part';
import { type Reference } from '../src/hair-grammar/observe';
import { paintLock } from '../src/hair-grammar/paint';
import { applyPart } from '../src/hair-grammar/part';
import { awayEdits, sideOf } from '../src/hair-grammar/part-edits';
import { PART_FLOOR, PART_HALF, crossesPart, partOpenness, partSamples, summarize, withLock } from '../src/hair-grammar/part-line';
import { clearCorridor, shapePart } from '../src/hair-grammar/part-shape';
import { TOUSLED } from '../src/hair-grammar/profiles/tousled';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

/**
 * RAIE = SILLON (passe 5). La netteté de passe 4 mesurait la colonne la plus vide de la calotte : elle lisait une large fenêtre chauve comme une raie (mesuré : 16 cas sur 18 de génération brute n'avaient
 * AUCUN sillon, seulement des fenêtres de 0,24–0,59 rx). Ces tests fixent la nouvelle lecture (`observe-part.ts`, `part-line.ts`) et ce que la génération / la réparation en garantissent.
 */
const V = viewAt(0); const H = TOUSLED.head;
const readLine = (specs: ReturnType<typeof generate>, view = V, xp = 0) => partOpenness(H, view, specs.map((L) => paintLock(H, L, view)), xp);

describe('observe-part : sillon contre fenêtre chauve (colonnes)', () => {
  const du = 0.02; const uOf = (i: number): number => -0.8 + i * du;
  const cols = (f: (u: number) => number): number[] => Array.from({ length: 80 }, (_, i) => f(uOf(i)));
  it('un creux étroit et profond est un sillon, à sa position, profondeur ≈ 1', () => {
    const o = partFromColumns(cols((u) => (Math.abs(u + 0.3) < 0.05 ? 0 : 0.9)), uOf, du);
    expect(o.groove).toBe(true); expect(o.u).toBeCloseTo(-0.3, 1); expect(o.clarity).toBeGreaterThan(0.95); expect(o.width).toBeLessThanOrEqual(GROOVE_MAX_U + du); expect(o.window).toBe(0);
  });
  it('une large fenêtre chauve n\'est PAS une raie : netteté 0, largeur rapportée à part', () => {
    const o = partFromColumns(cols((u) => (Math.abs(u + 0.2) < 0.25 ? 0 : 0.9)), uOf, du);
    expect(o.groove).toBe(false); expect(o.clarity).toBe(0); expect(o.window).toBeGreaterThan(GROOVE_MAX_U); expect(o.u).toBeCloseTo(-0.2, 1);
  });
  it('un creux qui touche le bord de la zone jugée est le bord de la chevelure, pas un sillon', () => {
    const o = partFromColumns(cols((u) => (u < -0.7 ? 0 : 0.9)), uOf, du); expect(o.groove).toBe(false);
  });
  it('couverture uniforme ou chevelure absente : aucune raie', () => {
    expect(partFromColumns(cols(() => 0.9), uOf, du).groove).toBe(false); expect(partFromColumns(cols(() => 0.01), uOf, du).groove).toBe(false);
  });
  it('sur un masque : un sillon de 5 px est lu à sa position ; une fenêtre de 40 px non', () => {
    const E = { cx: 78, cy: 90, rx: 49, ry: 50 }; const mk = (bare: (x: number) => boolean): Reference => {
      const w = 156; const h = 150; const mask = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!bare(x) && Math.hypot((x - E.cx) / (E.rx * 1.2), (y - E.cy) / (E.ry * 1.2)) < 1) mask[y * w + x] = 1;
      return { w, h, mask, gray: new Float32Array(w * h) };
    };
    const g = observePart(mk((x) => Math.abs(x - (78 - 0.3 * 49)) < 2.5), E); expect(g.groove).toBe(true); expect(g.u).toBeCloseTo(-0.3, 1);
    const w = observePart(mk((x) => Math.abs(x - 78) < 20), E); expect(w.groove).toBe(false); expect(w.window).toBeGreaterThan(0.5);
  });
});

describe('part-line : lecture exacte de la raie demandée', () => {
  const { profile } = applyIntent(TOUSLED, { part: -0.3 }); const xp = -0.3 * H.rx;
  it('une mèche posée sur la ligne la recouvre ; écartée de 0,15 H, plus', () => {
    const base = generate(profile, 1)[0]!;
    const on = { ...base, id: 'on', root: { el: 70, az: -25 }, aim: { x: 0, y: 1, z: 0 } };
    const nOn = crossesPart(H, V, paintLock(H, on, V), xp); expect(nOn).toBeGreaterThan(0);
    const away = { ...on, id: 'away', root: { el: 70, az: 25 } }; expect(crossesPart(H, V, paintLock(H, away, V), xp)).toBe(0);
  });
  it('lecture incrémentale = relecture complète (withLock n\'altère pas la lecture de base)', () => {
    const specs = applyPart(H, generate(profile, 2), xp); const painted = specs.map((L) => paintLock(H, L, V)); const extra = paintLock(H, { ...specs[0]!, id: 'x', root: { el: 75, az: -60 } }, V);
    const S = partSamples(H, V, painted, xp); const before = JSON.stringify(summarize(S)); const inc = summarize(withLock(S, extra)); expect(JSON.stringify(summarize(S))).toBe(before);
    const full = partOpenness(H, V, [...painted, extra], xp); expect(inc.bare).toBeCloseTo(full.bare, 10); expect(inc.clarity).toBeCloseTo(full.clarity, 10); expect(inc.meanOpen).toBeCloseTo(full.meanOpen, 10);
  });
  it('ligne cachée (côté détourné à −45°) : sans objet, netteté 1 — pas un faux défaut', () => {
    const l = partOpenness(H, viewAt(-45), generate(profile, 1).map((L) => paintLock(H, L, viewAt(-45))), xp); expect(l.judged).toBeLessThan(4); expect(l.clarity).toBe(1);
  });
  it('éditions d\'écartement : du côté d\'où naît la mèche, triées par coût', () => {
    const L = { ...generate(profile, 1)[0]!, root: { el: 50, az: -60 } }; expect(sideOf(H, L, xp)).toBe(-1);
    const e = awayEdits(-1); expect(e.length).toBeGreaterThan(10); for (let i = 1; i < e.length; i++) expect((e[i] as { cost: number }).cost).toBeGreaterThanOrEqual((e[i - 1] as { cost: number }).cost);
  });
});

describe('shapePart : un couloir libre ET des flancs refermés', () => {
  const POS = [-0.4, -0.3, 0.4];
  it('génération brute, 3 positions × 4 graines : couloir libre partout, netteté ≥ plancher dans ≥ 10 cas sur 12 (avant : 2 sillons sur 18)', () => {
    let ok = 0; let free = 0;
    for (const part of POS) for (const seed of [1, 2, 3, 4]) {
      const l = readLine(generateIntended(TOUSLED, { part }, V, seed, false).specs, V, part * H.rx);
      if (l.bare === 1) free++; if (l.clarity >= PART_FLOOR) ok++;
    }
    expect(free).toBe(12); expect(ok).toBeGreaterThanOrEqual(10);
  });
  it('sans raie demandée, shapePart n\'est pas appelé : la génération est inchangée', () => {
    const a = generateIntended(TOUSLED, {}, V, 3, false).specs; const b = generate(applyIntent(TOUSLED, {}).profile, 3); expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id));
  });
  it('shapePart ne dégrade jamais : couloir libre après ≥ avant, ouverture moyenne après ≤ avant', () => {
    for (const seed of [1, 2, 3]) {
      const { profile } = applyIntent(TOUSLED, { part: -0.3 }); const xp = -0.3 * H.rx; const r = shapePart(profile, applyPart(H, generate(profile, seed), xp), V, xp, seed);
      expect(r.after.bare).toBeGreaterThanOrEqual(r.before.bare); expect(r.after.bare).toBe(1); expect(r.after.meanOpen).toBeLessThanOrEqual(r.before.meanOpen + 1e-9);
    }
  });
  it('clearCorridor libère le couloir sans recouvrir œil, nez ni bouche', () => {
    const { profile } = applyIntent(TOUSLED, { part: 0 }); const specs = generate(profile, 3).map((L, i) => (i % 5 === 0 && L.root.el > 40 ? { ...L, root: { el: L.root.el, az: 0 } } : L));
    const r = clearCorridor(profile, specs, V, 0); const l = readLine(r.specs, V, 0); expect(l.bare).toBe(1);
    const v = verifyComposed(H, r.specs, V, undefined, undefined, { part: 0 }); expect(v.defects.filter((d) => d.code === 'anat.eye' || d.code === 'anat.face').length).toBeLessThanOrEqual(verifyComposed(H, specs, V).defects.filter((d) => d.code === 'anat.eye' || d.code === 'anat.face').length);
  });
});

describe('vérification : la raie est jugée (style) et localisée', () => {
  it('une mèche sur la raie → défaut `style.part` localisé sur elle ; sans `opts.part`, aucun jugement de raie', () => {
    const { profile } = applyIntent(TOUSLED, { part: 0 }); const specs = generate(profile, 1); const base = specs[0]!;
    const bad = [...specs, { ...base, id: 'on-part', root: { el: 70, az: 0 }, aim: { x: 0, y: 1, z: 0 } }];
    const v = verifyComposed(H, bad, V, undefined, undefined, { part: 0 }); const d = v.defects.find((x) => x.code === 'style.part' && x.lock === 'on-part');
    expect(d?.lock).toBe('on-part'); expect(d?.layer).toBe('style');
    expect(verifyComposed(H, bad, V).defects.some((x) => x.code === 'style.part' || x.code === 'style.partgap')).toBe(false);
  });
  it('une raie trop ouverte (couloir libre, rideaux loin) → `style.partgap` global', () => {
    const { profile } = applyIntent(TOUSLED, { part: 0 }); const wide = generate(profile, 1).filter((L) => !(L.root.el > 40 && Math.abs(L.root.az) < 45));
    const l = readLine(wide, V, 0); if (l.bare === 1 && l.clarity < PART_FLOOR) expect(verifyComposed(H, wide, V, undefined, undefined, { part: 0 }).defects.some((x) => x.code === 'style.partgap')).toBe(true);
  });
});

describe('cycle complet : la raie survit à la réparation', () => {
  const FULL: Intent = { volume: 0.6, fringe: 0.5, part: -0.3, tips: 0.5, weight: 0.3 };
  it('intention complète, graine 5 (passe 4 : netteté 1,00 → 0,09) : couloir libre et sillon ≥ plancher après réparation', () => {
    const r = generateIntended(TOUSLED, FULL, V, 5); const l = readLine(r.specs, V, -0.3 * H.rx);
    expect(l.bare).toBe(1); expect(l.clarity).toBeGreaterThanOrEqual(PART_FLOOR);
    expect(r.verdict.defects.filter((d) => /part/.test(d.code))).toEqual([]);
  });
  it('raie −0,3 à −30°, 0° et 30° (graines 1–2) : aucune mèche sur la raie, aucun défaut de raie, score final ≤ initial', () => {
    for (const yaw of [-30, 0, 30]) for (const seed of [1, 2]) {
      const view = viewAt(yaw); const r = generateIntended(TOUSLED, { part: -0.3 }, view, seed); const l = readLine(r.specs, view, -0.3 * H.rx);
      expect(l.bare).toBe(1); expect(r.verdict.defects.filter((d) => /part/.test(d.code))).toEqual([]); expect(r.verdict.score).toBeLessThanOrEqual(r.initial.score);
    }
  });
  it('raie +0,4 vue de −45° (côté visible) : même garantie', () => {
    const view = viewAt(-45); const r = generateIntended(TOUSLED, { part: 0.4 }, view, 2); const l = readLine(r.specs, view, 0.4 * H.rx); expect(l.bare).toBe(1); expect(r.verdict.defects.filter((d) => /part/.test(d.code))).toEqual([]);
  });
  it('le couloir protégé garde sa largeur de passe 4 (±0,035 H)', () => { expect(PART_HALF).toBe(0.035); });
});

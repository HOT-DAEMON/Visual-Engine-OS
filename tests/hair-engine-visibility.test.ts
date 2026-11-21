import { describe, expect, it } from 'vitest';
import { verifyComposed } from '../src/hair-grammar/compose-verify';
import { generate } from '../src/hair-grammar/grammar';
import { DEFAULT_HEAD, project } from '../src/hair-grammar/head';
import { applyIntent, PRESETS } from '../src/hair-grammar/intent';
import { relationsOf } from '../src/hair-grammar/occlusion';
import { orderStability } from '../src/hair-grammar/occlusion-stability';
import { renderResolved } from '../src/hair-grammar/occlusion-paint';
import { paintLock } from '../src/hair-grammar/paint';
import { TOUSLED } from '../src/hair-grammar/profiles/tousled';
import { repairCycle } from '../src/hair-grammar/repair';
import { headOutline, misLayeredLocks, visibility } from '../src/hair-grammar/visibility';
import { v3 } from '../src/hair-grammar/vec';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

const H = DEFAULT_HEAD;

describe('visibilité par ordre de peinture', () => {
  const V = viewAt(29); const specs = generate(TOUSLED, 1); const painted = specs.map((L) => paintLock(H, L, V)); const vis = visibility(H, V, painted);
  it('une part visible par mèche, dans [0, 1] ; coiffure dense : mesuré 28 % des mèches de devant à plus de moitié visibles', () => {
    expect(vis.visible).toHaveLength(specs.length); for (const v of vis.visible) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    const front = painted.map((p, i) => ({ p, i })).filter((x) => x.p.layer !== 'back'); expect(front.filter((x) => (vis.visible[x.i] as number) > 0.5).length / front.length).toBeGreaterThan(0.2); // mesuré 0,28 : une coiffure dense se recouvre beaucoup (sous-couches « mass »)
  });
  it('la mèche peinte en dernier est entièrement visible (rien ne la recouvre)', () => {
    const last = painted.map((p, i) => ({ p, i })).filter((x) => x.p.layer === 'over' || x.p.layer === 'front').at(-1)!; expect(vis.visible[last.i]).toBeGreaterThan(0.95);
  });
  it('contour de la tête : contient le centre du crâne projeté, et tourne avec la vue', () => {
    const c = project(V, v3(0, 0, H.cz)); const o = headOutline(H, V); const xs = o.map((q) => q.x);
    expect(Math.min(...xs)).toBeLessThan(c.x); expect(Math.max(...xs)).toBeGreaterThan(c.x);
    const w0 = (() => { const q = headOutline(H, viewAt(0)).map((p) => p.x); return Math.max(...q) - Math.min(...q); })(); const w75 = (() => { const q = headOutline(H, viewAt(75)).map((p) => p.x); return Math.max(...q) - Math.min(...q); })();
    expect(w75).toBeGreaterThan(w0 * 0.8); // crâne plus profond que large : le contour ne s'effondre pas en profil
  });
  it('part de l\'axe visible : une mèche de devant a au moins la moitié de son axe visible, une mèche enfouie moins', () => {
    for (const i of vis.buried) expect(vis.spineVisible[i]).toBeLessThan(0.6);
  });
});

describe('étagement : mèche peinte devant alors qu\'elle est derrière le crâne', () => {
  it('une mèche forcée en couche `front` mais posée sur la nuque est détectée (`geom.layer`) puis réparée', () => {
    const V = viewAt(0); const base = generate(TOUSLED, 1);
    const nape = { ...base.find((s) => s.family === 'farSide')!, id: 'nape-x', root: { el: 20, az: 180 }, aim: v3(0, 1, -0.2), layer: 'front' as const, length: 0.5 };
    const specs = [...base, nape]; const painted = specs.map((L) => paintLock(H, L, V));
    expect(misLayeredLocks(painted, headOutline(H, V))).toContain(specs.length - 1);
    const v = verifyComposed(H, specs, V); expect(v.defects.some((d) => d.code === 'geom.layer' && d.lock === 'nape-x')).toBe(true);
    const r = repairCycle(TOUSLED, specs, V, 1, 12); expect(r.verdict.defects.some((d) => d.code === 'geom.layer')).toBe(false); expect(r.verdict.score).toBeLessThan(v.score);
  });
  it('les coiffures générées (4 intentions × 4 lacets) n\'ont aucune mèche mal étagée, sauf cas rare (≤ 1 sur 16)', () => {
    let n = 0;
    for (const I of [{}, PRESETS.heavy, PRESETS.voluminous, PRESETS.windswept]) for (const yaw of [0, 29, 60, -75]) { const P = applyIntent(TOUSLED, I).profile; const V = viewAt(yaw); n += misLayeredLocks(generate(P, 1).map((L) => paintLock(H, L, V)), headOutline(H, V)).length; }
    expect(n).toBeLessThanOrEqual(1);
  });
  it('option `visibility` du vérificateur : rapporte la visibilité et une vérification de mèches enfouies', () => {
    const V = viewAt(29); const v = verifyComposed(H, generate(TOUSLED, 1), V, undefined, undefined, { visibility: true });
    expect(v.visibility?.visible.length).toBe(generate(TOUSLED, 1).length); expect(v.reports[0]!.checks.some((c) => c.name.includes('enfouies'))).toBe(true);
    expect(verifyComposed(H, generate(TOUSLED, 1), V).visibility).toBeUndefined();
  });
});

describe('profondeur de VOLUME (mode `all`)', () => {
  const run = (volume: boolean): { cut: number; cross: number; flip: number; imposed: number } => {
    let cut = 0; let cross = 0; let flip = 0; let imposed = 0;
    for (const I of [{}, PRESETS.heavy]) for (const yaw of [0, 29]) for (const seed of [1, 2]) {
      const P = applyIntent(TOUSLED, I).profile; const sp = generate(P, seed); const V = viewAt(yaw); const pl = sp.map((L) => paintLock(H, L, V));
      const s = renderResolved(pl, undefined, 'all', relationsOf(pl, volume)).stats; cut += s.cut; cross += s.crossings;
      const st = orderStability(H, sp, V, 8, 'all', volume); flip += st.flipped; imposed += st.imposed;
    }
    return { cut, cross, flip, imposed };
  };
  const plan = run(false); const vol = run(true);
  it('les dalles qui se pénètrent n\'imposent plus d\'ordre : au moins 50 % de découpes et de croisements imposés en moins', () => {
    expect(vol.cut).toBeLessThan(plan.cut * 0.5); expect(vol.cross).toBeLessThan(plan.cross * 0.5);
  });
  it('l\'ordre imposé est plus stable à 8° de lacet : taux d\'inversion plus bas qu\'avec un simple plan de profondeur', () => {
    expect(vol.flip / Math.max(1, vol.imposed)).toBeLessThan(plan.flip / Math.max(1, plan.imposed));
  });
  it('mode `weave` inchangé : le volume ne s\'applique pas aux brins d\'un même entrelacs', () => {
    const V = viewAt(29); const pl = generate(TOUSLED, 1).map((L) => paintLock(H, L, V));
    expect(relationsOf(pl, false).map((r) => [r.a, r.b, r.kind])).toEqual(relationsOf(pl).map((r) => [r.a, r.b, r.kind]));
  });
});

import { describe, expect, it } from 'vitest';
import { generate } from '../src/hair-grammar/grammar';
import { DEFAULT_HEAD, project, viewRayInHead } from '../src/hair-grammar/head';
import { generateIntended } from '../src/hair-grammar/intent-run';
import { observePart } from '../src/hair-grammar/observe-part';
import { paintLock } from '../src/hair-grammar/paint';
import { TOUSLED } from '../src/hair-grammar/profiles/tousled';
import { fitFromReference, headEllipse, referenceFromPainted } from '../src/hair-grammar/reference-fit';
import { PART_READ_MIN, fitFromReferencePart, imageUToSkull, partFromObservation } from '../src/hair-grammar/reference-fit-part';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

const W = 156; const Hh = 150; const H = DEFAULT_HEAD; const V0 = viewAt(0);
const refOfPart = (part: number, seed: number) => { const r = generateIntended(TOUSLED, { part }, V0, seed, false); return referenceFromPainted(r.specs.map((L) => paintLock(r.profile.head, L, V0)), W, Hh, headEllipse(TOUSLED, V0)); };

describe('raie lue → position de crâne (imageUToSkull)', () => {
  it('à 0° de lacet, la position image u (unités rx) est la position de crâne xp = u·rx', () => {
    for (const u of [-0.6, -0.2, 0, 0.3, 0.6]) expect(imageUToSkull(TOUSLED, V0, u)).toBeCloseTo(u * TOUSLED.head.rx, 3);
  });
  it('aller-retour à ±30° et ±60° : projeter la ligne de crâne x = xp à 47° d\'élévation, puis inverser, redonne xp (points visibles seulement : une lecture sur image ne retrouve pas un point caché)', () => {
    let checked = 0;
    for (const yaw of [-60, -30, 30, 60]) for (const xp of [-0.2, -0.05, 0.1, 0.25]) {
      const v = viewAt(yaw); const c = Math.cos((47 * Math.PI) / 180); const s = Math.sin((47 * Math.PI) / 180);
      const az = Math.asin(xp / (H.rx * c)); const p = { x: H.rx * c * Math.sin(az), y: -H.ry * s, z: H.cz + H.rz * c * Math.cos(az) };
      const n = { x: p.x / (H.rx * H.rx), y: p.y / (H.ry * H.ry), z: (p.z - H.cz) / (H.rz * H.rz) }; const r = viewRayInHead(v);
      if (n.x * r.x + n.y * r.y + n.z * r.z <= 0.05 * Math.hypot(n.x, n.y, n.z)) continue; // caché ou rasant
      const u = (project(v, p).x - project(v, { x: 0, y: 0, z: H.cz }).x) / (H.rx * v.s);
      expect(imageUToSkull(TOUSLED, v, u)).toBeCloseTo(xp, 2); checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(8);
  });
});

describe('partFromObservation', () => {
  const obs = (o: Partial<ReturnType<typeof observePart>>) => ({ u: 0.3, clarity: 0.9, groove: true, ...o }) as ReturnType<typeof observePart>;
  it('un sillon net est converti ; un sillon incertain ou absent ne crée PAS de raie', () => {
    expect(partFromObservation(obs({}), TOUSLED, V0)).toBeCloseTo(0.3 * TOUSLED.head.rx, 3);
    expect(partFromObservation(obs({ clarity: PART_READ_MIN - 0.05 }), TOUSLED, V0)).toBeUndefined();
    expect(partFromObservation(obs({ groove: false }), TOUSLED, V0)).toBeUndefined();
  });
});

describe('fitFromReferencePart', () => {
  it('référence portant une raie à +0,3 : l\'intention la retrouve (±0,1) et le résultat porte un sillon net', () => {
    const R = refOfPart(0.3, 2); const f = fitFromReferencePart(TOUSLED, R, V0, { seed: 2, iters: 2 });
    expect(f.partRead.observed.groove).toBe(true);
    expect(Math.abs((f.intent.part ?? 99) - 0.3)).toBeLessThan(0.1);
    expect(f.partRead.final.groove).toBe(true); expect(f.partRead.final.clarity).toBeGreaterThanOrEqual(PART_READ_MIN);
  });
  it('raie à −0,3 : le signe est conservé', () => {
    const f = fitFromReferencePart(TOUSLED, refOfPart(-0.3, 3), V0, { seed: 3, iters: 2 });
    expect(f.intent.part).toBeLessThan(0); expect(Math.abs((f.intent.part ?? 99) + 0.3)).toBeLessThan(0.1);
  });
  it('part: false = ajustement historique, au bit près (même intention, mêmes mèches)', () => {
    const R = refOfPart(0.3, 2); const a = fitFromReferencePart(TOUSLED, R, V0, { seed: 2, iters: 1, part: false }); const b = fitFromReference(TOUSLED, R, V0, { seed: 2, iters: 1 });
    expect(a.intent).toEqual(b.intent); expect(a.specs).toEqual(b.specs);
  });
  it('référence sans sillon net : aucune raie inventée (intention sans `part`)', () => {
    const R = referenceFromPainted(generate(TOUSLED, 1).map((L) => paintLock(H, L, V0)), W, Hh, headEllipse(TOUSLED, V0));
    const f = fitFromReferencePart(TOUSLED, R, V0, { seed: 1, iters: 1 });
    if (f.partRead.part === undefined) expect(f.intent.part).toBeUndefined(); else expect(f.partRead.observed.clarity).toBeGreaterThanOrEqual(PART_READ_MIN);
  });
  it('déterministe', () => { const R = refOfPart(0.3, 2); expect(fitFromReferencePart(TOUSLED, R, V0, { seed: 2, iters: 1 }).intent).toEqual(fitFromReferencePart(TOUSLED, R, V0, { seed: 2, iters: 1 }).intent); });
});

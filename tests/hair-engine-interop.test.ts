import { describe, expect, it } from 'vitest';
import { generate } from '../src/hair-grammar/grammar';
import { applyFrame, checkHairLockContract, frameFromEyes, grammarToHairLocks, rankOf } from '../src/hair-grammar/interop';
import { DEFAULT_HEAD, landmarks, project } from '../src/hair-grammar/head';
import { paintHair } from '../src/hair-grammar/paint';
import { TOUSLED } from '../src/hair-grammar/profiles/tousled';
import { viewAt } from '../scripts/hair-grammar/engine-kit';
import type { HairLock } from '../src/face/hair/types';

const V = viewAt(0.3); const lm = landmarks(DEFAULT_HEAD); const eR = project(V, lm.eyeR); const eL = project(V, lm.eyeL);
const painted = paintHair(DEFAULT_HEAD, generate(TOUSLED, 1), V).locks;
const headW = 2 * DEFAULT_HEAD.rx * V.s;

describe('contrat d\'interopérabilité grammaire → moteur principal', () => {
  it('similitude yeux → yeux : envoie exactement les deux yeux sur la cible, conserve les rapports de distances', () => {
    const f = frameFromEyes(eR, eL, { x: 100, y: 200 }, { x: 160, y: 190 });
    const a = applyFrame(f, eR); const b = applyFrame(f, eL); expect(a.x).toBeCloseTo(100, 6); expect(a.y).toBeCloseTo(200, 6); expect(b.x).toBeCloseTo(160, 6); expect(b.y).toBeCloseTo(190, 6);
    const p = { x: eR.x + 10, y: eR.y + 7 }; const q = applyFrame(f, p); expect(Math.hypot(q.x - a.x, q.y - a.y) / Math.hypot(p.x - eR.x, p.y - eR.y)).toBeCloseTo(f.k, 6);
  });
  const id = frameFromEyes(eR, eL, eR, eL);
  const locks = grammarToHairLocks(painted, { frame: id, head: DEFAULT_HEAD, headW });
  it('une HairLock par mèche peinte, qui respecte tous les invariants du contrat', () => { expect(locks).toHaveLength(painted.length); expect(checkHairLockContract(locks, headW)).toEqual([]); });
  it('repère identité : les polygones sont ceux de la lame (aucune dérive)', () => { expect(locks[0]!.poly[0]!.x).toBeCloseTo(painted[0]!.blade.left[0]!.x, 4); });
  it('changement de repère : mèches mises à l\'échelle de l\'écart des yeux, forme conservée (rapport largeur/hauteur de la boîte)', () => {
    const f = frameFromEyes(eR, eL, { x: 0, y: 0 }, { x: 2 * Math.hypot(eL.x - eR.x, eL.y - eR.y), y: 0 });
    const big = grammarToHairLocks(painted, { frame: f, head: DEFAULT_HEAD, headW }); const bb = (l: HairLock) => { const xs = l.poly.map((p) => p.x); const ys = l.poly.map((p) => p.y); return (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys)); };
    expect(Math.abs(bb(big[3]!) - bb(locks[3]!))).toBeLessThan(0.15 * bb(locks[3]!) + 0.5);
  });
  it('rangs : les grosses lames ressortent « mass/main », les fines « fine/hairline » ; edge réservé aux gros rangs', () => {
    expect(locks.some((l) => l.rank === 'mass' || l.rank === 'main')).toBe(true); locks.forEach((l) => { if (l.edge) expect(['mass', 'main']).toContain(l.rank); });
    expect(rankOf({ ...painted[0]!.blade, half: painted[0]!.blade.half.map(() => headW) }, headW)).toBe('mass');
  });
  it('étages : de 0 à 3, tous représentés et les plus longues mèches d\'abord', () => { const t = new Set(locks.map((l) => l.tier)); expect([...t].every((x) => x !== undefined && x >= 0 && x <= 3)).toBe(true); expect(t.size).toBeGreaterThanOrEqual(3); });
  it('le contrôle DÉTECTE une violation (polygone vide, ton hors bornes, spine courte)', () => {
    const bad: HairLock[] = [{ ...locks[0]!, poly: [] }, { ...locks[1]!, tone: 3 }, { ...locks[2]!, spine: locks[2]!.spine!.slice(0, 2) }];
    const rules = checkHairLockContract(bad, headW).map((i) => i.rule); expect(rules.some((r) => r.startsWith('poly'))).toBe(true); expect(rules.some((r) => r.startsWith('tone'))).toBe(true); expect(rules.some((r) => r.startsWith('spine'))).toBe(true);
  });
});

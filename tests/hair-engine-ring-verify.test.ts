import { describe, expect, it } from 'vitest';
import { generate } from '../src/hair-grammar/grammar';
import { DEFAULT_HEAD as H } from '../src/hair-grammar/head';
import { INK_PRO, paintLockPro, type ProLock } from '../src/hair-grammar/paint-pro';
import { TOUSLED } from '../src/hair-grammar/profiles/tousled';
import { ringBands } from '../src/hair-grammar/spec-ring';
import { verifyRing, MIN_LOCKS } from '../src/hair-grammar/verify-ring';
import { norm, v3 } from '../src/hair-grammar/vec';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

const V = viewAt(0); const L = { dir: norm(v3(0.6, -0.6, 0.5)) };
const scene = (seed = 1, light = L): ProLock[] => generate(TOUSLED, seed).map((s) => paintLockPro(H, s, V, { ...INK_PRO }, light));
const by = (reps: ReturnType<typeof verifyRing>, layer: string, name: RegExp) => reps.find((r) => r.layer === layer)!.checks.find((c) => name.test(c.name))!;

describe('verifyRing — trois couches', () => {
  it('renvoie géométrie, anatomie, style, tous les contrôles finis', () => {
    const r = verifyRing(H, V, scene(), L);
    expect(r.map((x) => x.layer)).toEqual(['geometry', 'anatomy', 'style']);
    for (const rep of r) for (const c of rep.checks) expect(Number.isFinite(c.value)).toBe(true);
  });
  it('une coiffure générée, sous plusieurs lumières et graines, passe les trois couches', () => {
    const lights = [L, { dir: norm(v3(-0.45, -0.65, 0.6)) }, { dir: norm(v3(0, -0.9, 0.4)) }];
    for (const light of lights) for (const seed of [1, 2, 3]) { const r = verifyRing(H, V, scene(seed, light), light); for (const rep of r) expect(rep.checks.filter((c) => !c.ok), `${seed} ${rep.layer}`).toEqual([]); }
  });
  it('déterministe', () => { expect(verifyRing(H, V, scene(), L)).toEqual(verifyRing(H, V, scene(), L)); });
});

describe('verifyRing — chaque contrôle détecte bien sa panne (mutations)', () => {
  it('géométrie : un contour de lame resserré autour de la spine laisse la bande dépasser', () => {
    const s = scene(); const squeeze = s.map((l) => { const k = (p: { x: number; y: number }, i: number) => { const c = l.blade.spine[i]!; return { x: c.x + (p.x - c.x) * 0.25, y: c.y + (p.y - c.y) * 0.25 }; }; return { ...l, blade: { ...l.blade, left: l.blade.left.map(k), right: l.blade.right.map(k) } }; });
    expect(by(verifyRing(H, V, squeeze, L), 'geometry', /hors du contour/).ok).toBe(false);
  });
  it('géométrie : un sommet NaN est compté', () => {
    const s = scene(); const bad = s.map((l) => ({ ...l, geom: { ...l.geom, normal: l.geom.normal.map((n) => ({ x: Number.NaN, y: n.y })) } }));
    expect(by(verifyRing(H, V, bad, L), 'geometry', /non finis/).ok).toBe(false);
  });
  it('anatomie : un ruban vu par le dessous ne doit porter aucun reflet — et la vérification le verrait', () => {
    const s = scene(); const flipped = s.map((l) => ({ ...l, geom: { ...l.geom, backface: l.geom.backface.map(() => true) } }));
    // ringBands refuse le dessous : zéro reflet, donc zéro contrôle en échec sur ce point (la garde est dans le générateur, la vérification confirme)
    expect(by(verifyRing(H, V, flipped, L), 'anatomy', /dessous/).value).toBe(0);
    expect(by(verifyRing(H, V, flipped, L), 'style', /part de mèches/).ok).toBe(false);
  });
  it('style : aucun reflet (lumière derrière la tête) = mèches « mates », refusé', () => {
    const behind = { dir: norm(v3(0, 0, -1)) }; expect(by(verifyRing(H, V, scene(1, behind), behind), 'style', /part de mèches/).ok).toBe(false);
  });
  it('style : une scène trop petite n\'est pas jugée sur la part', () => {
    const s = scene().slice(0, MIN_LOCKS - 1); expect(by(verifyRing(H, V, s, L), 'style', /part de mèches/).ok).toBe(true);
  });
  it('style : un reflet plus grand que 35 % de la lame est refusé (lame resserrée, la bande reste)', () => {
    const s = scene(); const narrow = s.map((l) => { const k = (p: { x: number; y: number }, i: number) => { const c = l.blade.spine[i]!; return { x: c.x + (p.x - c.x) * 0.1, y: c.y + (p.y - c.y) * 0.1 }; }; return { ...l, blade: { ...l.blade, left: l.blade.left.map(k), right: l.blade.right.map(k) } }; });
    expect(by(verifyRing(H, V, narrow, L), 'style', /aire max/).ok).toBe(false);
  });
});

describe('reflet et courbure (défaut relevé par la vérification)', () => {
  it('la couverture est bornée par la courbure : sous lumière zénithale, aucune bande n\'a ses coins dans un pli du contour', () => {
    const zen = { dir: norm(v3(0, -0.9, 0.4)) }; let rings = 0; let capped = 0;
    for (const seed of [1, 2, 3]) for (const l of scene(seed, zen)) { const r = ringBands(l.blade, l.geom, l.spec, V, zen); if (!r) continue; rings++; if (r.coverage < 0.8) capped++; expect(r.coverage).toBeGreaterThanOrEqual(0.3); expect(r.coverage).toBeLessThanOrEqual(0.8); }
    expect(rings).toBeGreaterThan(10); expect(capped).toBeGreaterThan(0); // la borne agit réellement (plafond, jamais d élargissement)
  });
});

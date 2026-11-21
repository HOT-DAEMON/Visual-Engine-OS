import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { resolveAppearance } from '../src/appearance';
import { faceLandmarks, hairGeometry } from '../src/face';
import type { HairLock } from '../src/face/hair';
import { halfWidth, normals } from '../src/face/hair/ribbon';
import { lightVector } from '../src/lighting/light';
import { celBands, localGlossShare } from '../src/render/face/hair-cel';
import { hairGloss } from '../src/render/face/hair-detail';
import { lockMarkup, type LockStyle } from '../src/render/face/hair-lock';
import { Appearance } from '../src/schema';
import { DEFAULT_HEAD, landmarks, project } from '../src/hair-grammar/head';
import { generate } from '../src/hair-grammar/grammar';
import { checkHairLockContract, frameFromEyes, grammarToHairLocks } from '../src/hair-grammar/interop';
import { paintHairPro } from '../src/hair-grammar/paint-pro';
import { TOUSLED } from '../src/hair-grammar/profiles/tousled';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

/**
 * PONT « une seule apparence » (docs/HAIR-GEOM-BRIDGE.md) : la géométrie locale du moteur de grammaire (`HairLock.geom`) est LUE par le rendu
 * principal. On rend de vraies `HairLock` (venues de la grammaire) avec `lockMarkup` — ce que l'ancien contrat ne faisait pas.
 */
const V = viewAt(17); const lm = landmarks(DEFAULT_HEAD); const eR = project(V, lm.eyeR); const eL = project(V, lm.eyeL); const headW = 2 * DEFAULT_HEAD.rx * V.s;
const frame = frameFromEyes(eR, eL, eR, eL);
const pro = paintHairPro(DEFAULT_HEAD, generate(TOUSLED, 1), V);
const locks = grammarToHairLocks(pro.locks, { frame, head: DEFAULT_HEAD, headW });
const big = locks.filter((l) => (l.rank === 'mass' || l.rank === 'main') && l.layer !== 'back');
const LD = { x: -0.6, y: -0.8 };
const area = (p: readonly { x: number; y: number }[]): number => { let a = 0; for (let i = 0; i < p.length; i++) { const u = p[i]!; const v = p[(i + 1) % p.length]!; a += u.x * v.y - v.x * u.y; } return Math.abs(a) / 2; };
const withGeom = (l: HairLock, f: (g: NonNullable<HairLock['geom']>) => Partial<NonNullable<HairLock['geom']>>): HairLock => ({ ...l, geom: { ...l.geom!, ...f(l.geom!) } });
/** Un mèche épaisse choisie : la plus longue, qui a une vraie bande de reflet. */
const L0 = [...big].sort((a, b) => b.spine!.length - a.spine!.length)[0]!;

describe('HairLock.geom : fourni par la grammaire, vérifié par le contrat', () => {
  it('chaque mèche issue de paintHairPro porte sa géométrie, alignée sur sa ligne médiane ; le contrat est respecté', () => {
    expect(locks.every((l) => l.geom !== undefined)).toBe(true);
    expect(checkHairLockContract(locks, headW)).toEqual([]);
    for (const l of locks) { expect(l.geom!.width).toHaveLength(l.spine!.length); expect(l.geom!.occlusion.every((o) => o >= 0 && o <= 1)).toBe(true); }
  });
  it('sans géométrie (paintHair simple), les mèches n\'en portent pas : rien n\'est inventé', () => {
    const bare = grammarToHairLocks(pro.locks.map(({ spec, blade, layer, svg }) => ({ spec, blade, layer, svg })), { frame, head: DEFAULT_HEAD, headW });
    expect(bare.every((l) => l.geom === undefined)).toBe(true);
  });
  it('le contrat DÉTECTE une géométrie mal alignée ou invalide', () => {
    const rules = checkHairLockContract([withGeom(L0, (g) => ({ width: g.width.slice(2) })), withGeom(L0, (g) => ({ occlusion: g.occlusion.map(() => 2) }))], headW).map((i) => i.rule);
    expect(rules.filter((r) => r.startsWith('geom')).length).toBe(2);
  });
  it('la largeur est dans le repère du moteur principal (× échelle k de la similitude)', () => {
    const f2 = { ...frame, k: frame.k * 2 }; const a = grammarToHairLocks(pro.locks, { frame: f2, head: DEFAULT_HEAD, headW });
    const i = locks.indexOf(L0); expect(a[i]!.geom!.width[10]! / L0.geom!.width[10]!).toBeCloseTo(2, 6);
  });
});

describe('celBands lit la géométrie locale', () => {
  const bare: HairLock = { ...L0, geom: undefined };
  const n = L0.spine!.length;
  /** Géométrie « neutre » : largeur = formule d'origine, aucune torsion, face avant, aucune occlusion. */
  const neutral = (l: HairLock): HairLock => ({ ...l, geom: { width: Array.from({ length: n }, (_, i) => 2 * Math.max(0.03 * l.w0!, halfWidth(i / (n - 1), l.w0!, l.sharp ?? 0.5, l.profile ?? 'ribbon', l.power ?? 1, l.rootW))), twist: new Array<number>(n).fill(0), backface: new Array<boolean>(n).fill(false), occlusion: new Array<number>(n).fill(0) } });
  it('RÉGRESSION : une géométrie neutre (mêmes largeurs que la formule) redonne EXACTEMENT les bandes d\'avant', () => {
    const a = celBands(bare, LD, 0.75, true); const b = celBands(neutral(bare), LD, 0.75, true);
    for (const k of ['shade', 'core', 'highlight'] as const) { expect(b[k]).toHaveLength(a[k]!.length); b[k]!.forEach((q, i) => { expect(q.x).toBeCloseTo(a[k]![i]!.x, 9); expect(q.y).toBeCloseTo(a[k]![i]!.y, 9); }); }
  });
  it('la demi-largeur est CELLE DE LA LAME : élargir la lame élargit l\'ombre', () => {
    const wide = withGeom(neutral(bare), (g) => ({ width: g.width.map((w) => w * 1.5) }));
    expect(area(celBands(wide, LD, 0.75, false).shade!)).toBeGreaterThan(area(celBands(neutral(bare), LD, 0.75, false).shade!) * 1.2);
  });
  it('torsion : un ruban vu par la tranche a un reflet étranglé, un ruban plat un reflet continu', () => {
    const flat = area(celBands(neutral(bare), LD, 0.75, false).highlight!);
    const twisted = area(celBands(withGeom(neutral(bare), () => ({ twist: Array.from({ length: n }, (_, i) => 1.2 * Math.sin((i / n) * Math.PI * 3)) })), LD, 0.75, false).highlight!);
    expect(twisted).toBeLessThan(flat * 0.8);
    const edgeOn = area(celBands(withGeom(neutral(bare), () => ({ twist: new Array<number>(n).fill(Math.PI / 2 - 0.05) })), LD, 0.75, false).highlight!);
    expect(edgeOn).toBeLessThan(flat * 0.05);
  });
  it('occlusion : le reflet s\'atténue sous un recouvrement (60 % au plus)', () => {
    const flat = area(celBands(neutral(bare), LD, 0.75, false).highlight!);
    const occ = area(celBands(withGeom(neutral(bare), () => ({ occlusion: new Array<number>(n).fill(1) })), LD, 0.75, false).highlight!);
    expect(occ / flat).toBeCloseTo(0.4, 1);
  });
  it('dessous du ruban : la lumière s\'inverse, le reflet change de côté de l\'axe', () => {
    // Côté du CENTRE du reflet par rapport à l'axe : moyenne des deux bords de la bande (λ+ et λ−) projetée sur la normale, échantillon par échantillon.
    const side = (l: HairLock): number => { const h = celBands(l, LD, 0.75, false).highlight!; const sp = l.spine!; const nn = normals(sp); const a = Math.floor(0.12 * (n - 1)); const m = Math.floor(0.78 * (n - 1)) - a + 1; let s = 0; for (let i = 0; i < m; i++) { const u = h[i]!; const w = h[2 * m - 1 - i]!; s += ((u.x + w.x) / 2 - sp[a + i]!.x) * nn[a + i]!.x + ((u.y + w.y) / 2 - sp[a + i]!.y) * nn[a + i]!.y; } return s; };
    const front = side(neutral(bare)); const back = side(withGeom(neutral(bare), () => ({ backface: new Array<boolean>(n).fill(true) })));
    expect(Math.sign(front)).toBe(-Math.sign(back)); expect(Math.abs(back)).toBeCloseTo(Math.abs(front), 6);
  });
});

describe('lockMarkup rend les HairLock de la grammaire (mode cel et hors cel)', () => {
  const style = (mode: 'cel' | 'smooth'): LockStyle => ({ id: 't', ra: resolveAppearance('#3a2a20', Appearance.parse({ shading: { mode, bands: 3, highlightBand: 0.75, castShadow: 0.4 } })), ld: LD, W: 400 });
  const cnt = (m: string[], s: string): number => m.join('').split(s).length - 1;
  it('cel : le rendu produit des bandes ; avec géométrie torsadée il diffère de la formule (même mèche)', () => {
    const a = lockMarkup({ ...L0, geom: undefined }, 0, style('cel'), 0, true).markup.join('');
    const g = lockMarkup(withGeom(L0, () => ({ twist: Array.from({ length: L0.spine!.length }, (_, i) => 1.1 * Math.sin((i / 40) * Math.PI * 4)) })), 0, style('cel'), 0, true).markup.join('');
    expect(a).toContain('clip-path'); expect(g).not.toBe(a);
  });
  it('hors cel : sans géométrie aucun reflet de mèche (comme avant) ; avec géométrie, un reflet local clippé par SA mèche', () => {
    const none = lockMarkup({ ...L0, geom: undefined }, 0, style('smooth'), 0, true); const loc = lockMarkup(L0, 0, style('smooth'), 0, true);
    expect(cnt(none.markup, 'clip-path')).toBe(0); expect(cnt(loc.markup, 'clip-path')).toBe(1); expect(loc.defs.join('')).toContain('clipPath');
  });
  it('une mèche de dessous (calque back) ne reçoit pas de reflet, même avec géométrie', () => {
    expect(cnt(lockMarkup({ ...L0, layer: 'back' }, 0, style('smooth'), 0, true).markup, 'clip-path')).toBe(0);
  });
});

describe('hairGloss : la tache globale s\'efface quand les mèches portent leur reflet', () => {
  const f = generateRandomFace(11, { hair: { style: 'long', texture: 'straight', fringe: 'none', seed: 9, density: 0.8, thinning: 0, hairline: 0.5 } as never, hairEngine: 'classic' } as never);
  const fl = faceLandmarks(f.params, f.width, f.height); const geo = hairGeometry(f.params, fl)!;
  const ra = resolveAppearance('#3a2a20', Appearance.parse({ shading: { mode: 'smooth' } })); const L = lightVector({ azimuthDeg: 315, elevationDeg: 45, color: '#ffffff', intensity: 1 } as never);
  const carry = (g: typeof geo): typeof geo => ({ ...g, locks: g.locks.map((l) => ({ ...l, geom: { width: l.spine?.map(() => 4) ?? [], twist: l.spine?.map(() => 0) ?? [], backface: l.spine?.map(() => false) ?? [], occlusion: l.spine?.map(() => 0) ?? [] } })) });
  it('localGlossShare : 0 sans géométrie, 1 quand toutes les mèches épaisses de devant en portent', () => {
    expect(localGlossShare(geo.locks)).toBe(0); expect(localGlossShare(carry(geo).locks)).toBe(1);
  });
  it('sans géométrie : tache globale (comportement d\'avant) ; avec : plus de tache globale', () => {
    expect(hairGloss('g', geo, f.params, fl, L, 0, ra).markup.length).toBeGreaterThan(0);
    expect(hairGloss('g', carry(geo), f.params, fl, L, 0, ra).markup).toEqual([]);
  });
});

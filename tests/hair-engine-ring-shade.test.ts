import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveAppearance } from '../src/appearance';
import { peakShadeOpacity, PEAK_SHADE_FALLBACK, PEAK_SHADE_MAX, shadeDip } from '../src/core/shade';
import type { HairLock } from '../src/face/hair';
import { smoothPath } from '../src/hair-grammar/blade';
import { generate } from '../src/hair-grammar/grammar';
import { DEFAULT_HEAD as H, landmarks, project } from '../src/hair-grammar/head';
import { checkHairLockContract, frameFromEyes, grammarToHairLocks, toHairLockRing } from '../src/hair-grammar/interop';
import { fillOf } from '../src/hair-grammar/paint';
import { INK_PRO, paintHairPro, paintLockPro, type ProLock } from '../src/hair-grammar/paint-pro';
import { TOUSLED } from '../src/hair-grammar/profiles/tousled';
import { shadeBreak, shadeOutsideShare, shadeRise, shadeSlope, SHADE_OUTSIDE_MAX } from '../src/hair-grammar/ring-check';
import { MEASURED } from '../src/hair-grammar/ring-measures';
import { deriveShadeProfile } from '../src/hair-grammar/ring-profile';
import { emittedProfile, shadeAt, shadeMarkup, shadeSegments } from '../src/hair-grammar/ring-shade';
import { ringBands } from '../src/hair-grammar/spec-ring';
import { norm, v3 } from '../src/hair-grammar/vec';
import { ringPath } from '../src/render/face/hair-ring';
import { lockMarkup, type LockStyle } from '../src/render/face/hair-lock';
import { Appearance } from '../src/schema';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

const V = viewAt(0); const L = { dir: norm(v3(0.6, -0.6, 0.5)) };
const ST = { ...INK_PRO, ring: 'add' as const };
const scene = (st = ST, seed = 1): ProLock[] => generate(TOUSLED, seed).map((s) => paintLockPro(H, s, V, st, L));
const json = JSON.parse(readFileSync(new URL('../artefacts/hair-engine-pass7/measures-ref60.json', import.meta.url), 'utf8'));
const strips = (): { l: ProLock; r: NonNullable<ReturnType<typeof ringBands>> }[] => [1, 2, 3].flatMap((seed) => scene(ST, seed)).flatMap((l) => { const r = ringBands(l.blade, l.geom, l.spec, V, L); return r ? [{ l, r }] : []; });

describe('profil lisse : dérivé de la mesure, jamais inventé', () => {
  const f = json.fan; const nodes = deriveShadeProfile(f.profile, f.edgeAt, f.dip, f.shadowFullLen);
  it('la dérivation rejouée sur le JSON retrouve les nœuds inscrits dans ring-measures.ts (écart < 0,01)', () => {
    expect(nodes).toHaveLength(MEASURED.shadeProfile.length);
    nodes.forEach(([x, w], i) => { expect(x).toBeCloseTo(MEASURED.shadeProfile[i]![0], 9); expect(Math.abs(w - MEASURED.shadeProfile[i]![1])).toBeLessThan(0.01); });
  });
  it('commence au creux maximal (1), s\'éteint sans bord (0) et ne remonte jamais', () => {
    expect(nodes[0]![1]).toBe(1); expect(nodes.at(-1)![1]).toBe(0);
    for (let i = 1; i < nodes.length; i++) expect(nodes[i]![1]).toBeLessThanOrEqual(nodes[i - 1]![1] + 1e-12);
  });
  it('plus doux qu\'un palier (variation max entre nœuds ≤ 0,2 ; un palier de la passe 7 valait 0,27 à 0,40) et plus fidèle aux points mesurés que les trois paliers', () => {
    const jump = Math.max(...nodes.slice(1).map((n, i) => Math.abs(n[1] - nodes[i]![1]))); expect(jump).toBeLessThanOrEqual(0.2);
    const sorted = (f.profile as [number, number][]).filter((p) => p[0] > 0.7).map((p) => p[1]).sort((a, b) => a - b); const base = sorted[Math.floor(sorted.length / 2)] as number;
    const pts = (f.profile as [number, number][]).filter((p) => p[0] > f.edgeAt && p[0] < 0.94).map((p) => [(p[0] - f.edgeAt) / f.shadowFullLen, (p[1] / base - 1) / f.dip] as const).filter((p) => p[0] <= 1);
    const a = 0.171; const T = 1 - (1 - a) ** 3; const steps = (x: number): number => (x <= 0.33 ? 1 : x <= 0.65 ? (1 - (1 - a) ** 2) / T : a / T);
    const rms = (fn: (x: number) => number): number => Math.sqrt(pts.reduce((s, p) => s + (fn(p[0]) - p[1]) ** 2, 0) / pts.length);
    expect(rms((x) => shadeAt(x))).toBeLessThan(rms(steps));
  });
  it('shadeAt interpole entre nœuds et borne hors de [0, 1]', () => {
    expect(shadeAt(-1)).toBe(1); expect(shadeAt(0)).toBe(1); expect(shadeAt(1)).toBe(0); expect(shadeAt(2)).toBe(0); expect(shadeAt(0.45)).toBeCloseTo((0.83 + 0.72) / 2, 9);
  });
});

describe('opacité de crête selon le ton (core/shade.ts)', () => {
  const sh = '#35353b';
  it('donne le creux relatif mesuré (−33,5 %) sur les remplissages clairs et moyens', () => {
    for (const fill of ['#e6e6ea', '#b0b0b8', '#8a8a92']) { const a = peakShadeOpacity(fill, sh); expect(a).toBeGreaterThan(0); expect(shadeDip(fill, sh, a)).toBeCloseTo(-0.335, 3); }
  });
  it('0 sous un remplissage presque aussi sombre que l\'ombre (elle l\'éclaircirait), bornée à PEAK_SHADE_MAX sinon', () => {
    expect(peakShadeOpacity('#2a2a30', sh)).toBe(0); expect(peakShadeOpacity('#3a3a40', sh)).toBe(0);
    expect(peakShadeOpacity('#5a5a62', sh)).toBeLessThanOrEqual(PEAK_SHADE_MAX); expect(peakShadeOpacity('#5a5a62', sh)).toBeGreaterThan(0);
  });
  it('repli sûr sur une couleur qui n\'est pas un #rrggbb', () => { expect(peakShadeOpacity('not-a-color', sh)).toBe(PEAK_SHADE_FALLBACK); });
});

describe('segments d\'ombre : géométrie sur 3 graines × la coiffure tousled', () => {
  const S = strips();
  it('il y a des ombres à vérifier', () => { expect(S.length).toBeGreaterThan(10); });
  it('les segments se raccordent exactement (position et poids), le poids ne remonte jamais, chaque pas ≤ 0,2', () => {
    for (const { r } of S) { expect(shadeBreak(r)).toBeLessThan(1e-9); expect(shadeRise(r)).toBe(0); expect(shadeSlope(r)).toBeLessThanOrEqual(0.2 + 1e-9); }
  });
  it('les sommets restent dans la lame (≤ 10 % par ombre) et sont finis', () => {
    for (const { l, r } of S) { expect(shadeOutsideShare(l, r)).toBeLessThanOrEqual(SHADE_OUTSIDE_MAX); expect(r.shade.every((g) => [...g.poly, g.from, g.to].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)))).toBe(true); }
  });
  it('un segment par intervalle de nœuds quand la mèche est assez longue ; le profil émis part du creux maximal, ne remonte jamais, et s\'éteint à 0 sauf si la pointe ou la racine coupe l\'ombre', () => {
    const full = S.filter(({ r }) => r.shade.length === MEASURED.shadeProfile.length - 1); expect(full.length).toBeGreaterThan(S.length / 2);
    for (const { r } of full) { const e = emittedProfile(r.shade); expect(e[0]![1]).toBe(1); for (let i = 1; i < e.length; i++) expect(e[i]![1]).toBeLessThanOrEqual(e[i - 1]![1] + 1e-12); }
    // Une ombre coupée par la pointe garde un poids > 0 à son dernier bord (le dégradé n'est pas étiré jusqu'à 0) : seules les ombres entières s'éteignent.
    const ends = full.map(({ r }) => emittedProfile(r.shade).at(-1)![1]); expect(ends.filter((w) => w === 0).length).toBeGreaterThan(ends.length / 2);
  });
  it('un segment coupé par la pointe garde le poids de SA vraie distance (pas d\'étirement du dégradé)', () => {
    const at = (s: number, u: number) => ({ x: s, y: u }); const segs = shadeSegments(at, 80, 1, 40, 100); // l'ombre voudrait finir à 120, la mèche s'arrête à 100
    expect(segs.at(-1)!.to.x).toBe(100); expect(segs.at(-1)!.w1).toBeGreaterThan(0); expect(shadeSegments(at, 120, 1, 40, 100)).toHaveLength(0);
  });
});

describe('SVG du moteur de grammaire : lisse par défaut, paliers sur demande', () => {
  const base = scene().find((x) => { const r = ringBands(x.blade, x.geom, x.spec, V, L); return r && r.shade.length === 10; })!;
  const paint = (shoulder?: object): string => paintLockPro(H, base.spec, V, { ...ST, ...(shoulder ? { shoulder } : {}) } as never, L).svg;
  it('défaut = dégradé : un linearGradient par segment, aucun palier', () => {
    const svg = paint(); expect((svg.match(/<linearGradient/g) ?? []).length).toBe(10); expect(svg).toContain('stop-opacity');
  });
  it('`profile: "steps"` rend les trois paliers de la passe 7 (aucun dégradé), au bit près du chemin historique', () => {
    const svg = paint({ profile: 'steps' }); expect(svg).not.toContain('linearGradient');
    const old = paintLockPro(H, base.spec, V, { ...ST, shoulder: { profile: 'steps', len: 0.2, opacity: 0.12 } } as never, L).svg; expect(old).not.toBe(svg);
  });
  it('`ring: "off"` ne dessine rien du reflet transversal et ne porte pas de `ring`', () => {
    const l = paintLockPro(H, base.spec, V, { ...INK_PRO, ring: 'off' }, L); expect(l.ring).toBeUndefined(); expect(l.svg).not.toContain('linearGradient');
  });
  it('déterministe, et deux mèches différentes n\'ont jamais le même identifiant de dégradé', () => {
    expect(paint()).toBe(paint());
    const ids = scene().flatMap((l) => [...l.svg.matchAll(/id="(rsh[0-9a-f]+-\d+)"/g)].map((m) => m[1]!)); expect(new Set(ids).size).toBe(ids.length);
  });
  it('un ton sombre (ombre invisible) n\'émet aucun dégradé', () => {
    expect(paintLockPro(H, { ...base.spec, tone: -0.95 }, V, ST, L).svg).not.toContain('linearGradient');
  });
  it('shadeMarkup est vide si la crête est nulle ou s\'il n\'y a pas de segment', () => {
    expect(shadeMarkup(base.ring ? [] : [], 0.4, '#000')).toBe(''); expect(shadeMarkup(ringBands(base.blade, base.geom, base.spec, V, L)!.shade, 0, '#000')).toBe('');
  });
});

describe('pont : le reflet de grammaire arrive dans HairLock.geom.ring, dans le repère du moteur principal', () => {
  const lm = landmarks(H); const eR = project(V, lm.eyeR); const eL = project(V, lm.eyeL); const headW = 2 * H.rx * V.s; const frame = frameFromEyes(eR, eL, eR, eL);
  const pro = paintHairPro(H, generate(TOUSLED, 1), V, ST, L); const locks = grammarToHairLocks(pro.locks as never, { frame, head: H, headW });
  const withRing = locks.filter((l) => l.geom?.ring);
  it('des mèches portent un reflet, le contrat est respecté, et sans `ring` activé aucune n\'en porte', () => {
    expect(withRing.length).toBeGreaterThanOrEqual(3); expect(checkHairLockContract(locks, headW)).toEqual([]);
    const off = grammarToHairLocks(paintHairPro(H, generate(TOUSLED, 1), V, INK_PRO, L).locks as never, { frame, head: H, headW }); expect(off.some((l) => l.geom?.ring)).toBe(false);
  });
  it('les points suivent la similitude (échelle k) ; poids et force sont inchangés', () => {
    const p = pro.locks.find((x) => (x as ProLock).ring) as ProLock; const f2 = { ...frame, k: frame.k * 2, tx: 0, ty: 0 }; const a = toHairLockRing(p.ring!, frame); const b = toHairLockRing(p.ring!, f2);
    const span = (r: typeof a): number => Math.hypot(r.highlight[0]!.x - r.highlight[2]!.x, r.highlight[0]!.y - r.highlight[2]!.y); expect(span(b) / span(a)).toBeCloseTo(2, 6);
    expect(b.strength).toBe(a.strength); expect(b.shade.map((s) => [s.w0, s.w1])).toEqual(a.shade.map((s) => [s.w0, s.w1]));
  });
  it('le contrat DÉTECTE un reflet invalide : ombre qui remonte, segments rompus, force hors [0, 1], bande dégénérée', () => {
    const l = withRing[0]!; const r = l.geom!.ring!; const bad = (ring: typeof r): string[] => checkHairLockContract([{ ...l, geom: { ...l.geom!, ring } }], headW).map((i) => i.rule);
    expect(bad({ ...r, shade: r.shade.map((s, i) => (i === 1 ? { ...s, w1: Math.min(1, s.w0 + 0.1) } : s)) }).some((x) => x.startsWith('ring'))).toBe(true);
    expect(bad({ ...r, shade: r.shade.map((s, i) => (i === 1 ? { ...s, from: { x: s.from.x + 5, y: s.from.y } } : s)) }).some((x) => x.startsWith('ring'))).toBe(true);
    expect(bad({ ...r, strength: 1.5 }).some((x) => x.startsWith('ring'))).toBe(true); expect(bad({ ...r, highlight: r.highlight.slice(0, 2) }).some((x) => x.startsWith('ring'))).toBe(true);
  });
});

describe('rendu principal : lockMarkup lit le reflet (off / replace / add)', () => {
  const lm = landmarks(H); const eR = project(V, lm.eyeR); const eL = project(V, lm.eyeL); const headW = 2 * H.rx * V.s; const frame = frameFromEyes(eR, eL, eR, eL);
  const locks = grammarToHairLocks(paintHairPro(H, generate(TOUSLED, 1), V, ST, L).locks as never, { frame, head: H, headW });
  const L1 = locks.filter((l) => l.geom?.ring && (l.rank === 'mass' || l.rank === 'main') && l.layer !== 'back').sort((a, b) => b.spine!.length - a.spine!.length)[0]!;
  const ra = resolveAppearance('#c9b8a0', Appearance.parse({})); const cel = resolveAppearance('#c9b8a0', Appearance.parse({ shading: { mode: 'cel', bands: 3, highlightBand: 0.75, castShadow: 0.9 } }));
  const sty = (ring?: LockStyle['ring'], a = ra): LockStyle => ({ id: 't', ra: a, ld: { x: -0.6, y: -0.8 }, W: 400, ...(ring ? { ring } : {}) });
  const count = (m: { markup: string[] }, re: RegExp): number => (m.markup.join('').match(re) ?? []).length;
  const grads = (m: { defs: string[] }): number => (m.defs.join('').match(/<linearGradient/g) ?? []).length;
  it('RÉGRESSION : absent ou "off", le rendu est identique à celui d\'une mèche sans reflet, au bit près', () => {
    const bare: HairLock = { ...L1, geom: { ...L1.geom!, ring: undefined } };
    const a = lockMarkup(bare, 0, sty(), 0, true); for (const m of [sty(), sty('off')]) { const b = lockMarkup(L1, 0, m, 0, true); expect(b.markup).toEqual(a.markup); expect(b.defs).toEqual(a.defs); }
  });
  it('"add" garde la bande axiale ET ajoute l\'ombre lisse (un dégradé par segment) et la bande transversale', () => {
    const off = lockMarkup(L1, 0, sty(), 0, true); const add = lockMarkup(L1, 0, sty('add'), 0, true); const n = L1.geom!.ring!.shade.length;
    expect(grads(add) - grads(off)).toBe(n); expect(count(add, /<path/g) - count(off, /<path/g)).toBe(n + 1);
  });
  it('"replace" retire la bande axiale : un chemin de moins que « add »', () => {
    const add = lockMarkup(L1, 0, sty('add'), 0, true); const rep = lockMarkup(L1, 0, sty('replace'), 0, true);
    expect(count(add, /<path/g) - count(rep, /<path/g)).toBe(1); expect(grads(rep)).toBe(grads(add));
  });
  it('"replace" par mèche : sans anneau, la bande axiale reste (jamais de mèche mate) ; le rendu est celui de "off"', () => {
    const L0 = locks.filter((l) => l.geom && !l.geom.ring && (l.rank === 'mass' || l.rank === 'main') && l.layer !== 'back')[0]!;
    expect(L0).toBeDefined(); expect(lockMarkup(L0, 0, sty('replace'), 0, true)).toEqual(lockMarkup(L0, 0, sty(), 0, true));
  });
  it('une mèche SANS géométrie ignore `ring` ; une mèche de derrière ne dessine pas de reflet', () => {
    const bare: HairLock = { ...L1, geom: undefined }; expect(lockMarkup(bare, 0, sty('replace'), 0, true)).toEqual(lockMarkup(bare, 0, sty(), 0, true));
    const back = { ...L1, layer: 'back' as const }; expect(lockMarkup(back, 0, sty('add'), 0, true)).toEqual(lockMarkup(back, 0, sty(), 0, true));
  });
  it('rendu cel : seul le reflet est dessiné (l\'ombre reste aux bandes cel, bords nets voulus) — aucun dégradé de plus', () => {
    const off = lockMarkup(L1, 0, sty(undefined, cel), 0, true); const add = lockMarkup(L1, 0, sty('add', cel), 0, true);
    expect(grads(add)).toBe(grads(off)); expect(count(add, /<path/g) - count(off, /<path/g)).toBe(1);
  });
  it('identifiants uniques entre mèches (clipPath et dégradés) : deux mèches du même style ne se marchent pas dessus', () => {
    const ids = locks.filter((l) => l.geom?.ring && (l.rank === 'mass' || l.rank === 'main') && l.layer !== 'back').flatMap((l, k) => [...lockMarkup(l, k, sty('add'), 0, true).defs.join('').matchAll(/id="([^"]+)"/g)].map((m) => m[1]!));
    expect(ids.length).toBeGreaterThan(5); expect(new Set(ids).size).toBe(ids.length);
  });
  it('la bande est tracée par la MÊME spline fermée que dans le moteur de grammaire, au caractère près (sinon elle se déforme en zigzag)', () => {
    for (const { r } of strips()) expect(ringPath(r.highlight)).toBe(smoothPath(r.highlight, true));
    const m = lockMarkup(L1, 0, sty('add'), 0, true).markup.join(''); expect(m).toContain(ringPath(L1.geom!.ring!.highlight));
  });
  it('le reflet est intégralement rogné par le contour de la mèche (clip-path) et reste fini', () => {
    const m = lockMarkup(L1, 0, sty('add'), 0, true); expect(m.markup.join('')).toMatch(/clip-path="url\(#t-rc0\)"/); expect(m.markup.join('')).not.toMatch(/NaN|Infinity/); expect(m.defs.join('')).not.toMatch(/NaN|Infinity/);
  });
});

describe('verifyRing : l\'ombre lisse passe la couche de vérification (géométrie, anatomie, style)', () => {
  it('tousled : aucun défaut bloquant en mode lisse', async () => {
    const { verifyRing } = await import('../src/hair-grammar/verify-ring');
    for (const seed of [1, 2, 3]) { const rep = verifyRing(H, V, scene(ST, seed), L, ST); expect(rep.map((c) => c.layer).sort()).toEqual(['anatomy', 'geometry', 'style']); for (const c of rep) expect(c.checks.filter((k) => !k.ok), `${seed} ${c.layer}`).toEqual([]); }
  });
  it('COIFFURE FINALE (paintHairPro, occlusion croisée) : jugée sur les mèches visibles, 3 lumières × 3 graines × 2 vues, tout passe', async () => {
    const { verifyRing, isVisibleLock, ringShare } = await import('../src/hair-grammar/verify-ring'); let vis = 0; let ring = 0;
    for (const d of [norm(v3(-0.45, -0.65, 0.6)), norm(v3(0.6, -0.6, 0.5)), norm(v3(0, -0.9, 0.4))]) for (const seed of [1, 2, 3]) for (const yaw of [0, 30]) {
      const v = viewAt(yaw); const light = { dir: d }; const locks = paintHairPro(H, generate(TOUSLED, seed), v, ST, light).locks as unknown as ProLock[];
      for (const c of verifyRing(H, v, locks, light, ST)) expect(c.checks.filter((k) => !k.ok), `${seed}/${yaw}/${c.layer}`).toEqual([]);
      const q = ringShare(locks); vis += q.visible; ring += q.withRing; expect(locks.filter((l) => l.layer === 'back').every((l) => !isVisibleLock(l))).toBe(true);
    }
    // Une coiffure finale a 3–7 mèches visibles : la proportion se juge sur le LOT (mesuré 0,40 ; bornes 15–85 %).
    expect(vis).toBeGreaterThan(60); expect(ring / vis).toBeGreaterThan(0.15); expect(ring / vis).toBeLessThan(0.85);
  });
  it('les contrôles propres à l\'ombre lisse sont présents (continuité, débordement, dureté, monotonie)', async () => {
    const { verifyRing } = await import('../src/hair-grammar/verify-ring'); const names = verifyRing(H, V, scene(), L, ST).flatMap((c) => c.checks.map((k) => k.name)).join('|');
    for (const re of [/continuité entre segments/, /sommets hors de la lame/, /variation maximale du poids/, /remontée maximale du poids/]) expect(names).toMatch(re);
  });
  it('le ton du remplissage est lu depuis le style (fillOf) : la crête suit le ton', () => {
    const a = peakShadeOpacity(fillOf(0.5, INK_PRO), INK_PRO.shadow); const b = peakShadeOpacity(fillOf(-0.6, INK_PRO), INK_PRO.shadow); expect(a).toBeGreaterThanOrEqual(b);
  });
});

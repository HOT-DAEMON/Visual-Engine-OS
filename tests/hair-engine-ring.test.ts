import { describe, expect, it } from 'vitest';
import { generate } from '../src/hair-grammar/grammar';
import { DEFAULT_HEAD, viewRayInHead } from '../src/hair-grammar/head';
import { LIGHT, type Light } from '../src/hair-grammar/local-geometry';
import { INK_PRO, paintLockPro } from '../src/hair-grammar/paint-pro';
import { TOUSLED } from '../src/hair-grammar/profiles/tousled';
import { RING, ringBands } from '../src/hair-grammar/spec-ring';
import { add, dot, norm, v3, type V2, type V3 } from '../src/hair-grammar/vec';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

const H = DEFAULT_HEAD; const V0 = viewAt(0); const specs = generate(TOUSLED, 1);
const light = (x: number, y: number, z: number): Light => ({ dir: norm(v3(x, y, z)) });
const lock = (i: number, L: Light = LIGHT) => paintLockPro(H, specs[i] as never, V0, { ...INK_PRO, ring: 'replace' }, L);
const bands = (i: number, L: Light = LIGHT) => { const p = lock(i, L); return { p, r: ringBands(p.blade, p.geom, p.spec, V0, L) }; };
const all = (L: Light = LIGHT) => specs.map((_, i) => bands(i, L)).filter((x) => x.r !== null) as { p: ReturnType<typeof lock>; r: NonNullable<ReturnType<typeof ringBands>> }[];
type Found = { p: ReturnType<typeof lock>; r: NonNullable<ReturnType<typeof ringBands>> };
/** Fraction d'arc (0 racine, 1 pointe) de chaque échantillon : `r.at` est une abscisse curviligne, les échantillons de la lame ne sont pas équidistants. */
const arcFracs = (p: Found['p']): number[] => { const c = [0]; const sp = p.blade.spine; for (let i = 1; i < sp.length; i++) c.push((c[i - 1] as number) + Math.hypot((sp[i] as V2).x - (sp[i - 1] as V2).x, (sp[i] as V2).y - (sp[i - 1] as V2).y)); const T = c[c.length - 1] as number; return c.map((x) => x / T); };
const nearest = (f: number[], at: number): number => f.reduce((b, x, i) => (Math.abs(x - at) < Math.abs((f[b] as number) - at) ? i : b), 0);
const arcLen = (s: readonly V2[]) => s.slice(1).reduce((a, q, i) => a + Math.hypot(q.x - (s[i] as V2).x, q.y - (s[i] as V2).y), 0);

describe('reflet transversal : compatibilité', () => {
  it('sans option `ring` (ou `off`) : sortie identique, aucune bande ajoutée', () => {
    for (const i of [0, 3, 7, 11].filter((k) => k < specs.length)) {
      const a = paintLockPro(H, specs[i] as never, V0, INK_PRO, LIGHT).svg; const b = paintLockPro(H, specs[i] as never, V0, { ...INK_PRO, ring: 'off' }, LIGHT).svg;
      expect(b).toBe(a); expect(a).not.toContain(`opacity="${RING.shoulderOpacity}"`);
    }
  });
  it('`replace` retire le reflet longitudinal et ajoute la bande ; `add` garde les deux', () => {
    const i = all().find((x) => x)?.p; expect(i).toBeDefined(); const idx = specs.indexOf(i!.spec);
    const base = paintLockPro(H, specs[idx] as never, V0, INK_PRO, LIGHT).svg; const rep = lock(idx).svg; const add2 = paintLockPro(H, specs[idx] as never, V0, { ...INK_PRO, ring: 'add' }, LIGHT).svg;
    expect(rep.length).not.toBe(base.length); expect(add2.length).toBeGreaterThan(rep.length);
  });
});

describe('reflet transversal : géométrie', () => {
  const found = all();
  it('reflet ni nulle part ni partout à la lumière par défaut (entre 15 % et 85 % des mèches ; mesuré : 38 %)', () => { expect(found.length).toBeGreaterThanOrEqual(Math.ceil(0.15 * specs.length)); expect(found.length).toBeLessThanOrEqual(Math.floor(0.85 * specs.length)); });
  it('la bande est TRANSVERSE : ses bords font plus de 65° avec la tangente de la mèche', () => {
    for (const { p, r } of found) {
      const m = RING.teeth + 1; const a = r.highlight[0] as V2; const b = r.highlight[m - 1] as V2; // bord côté racine, d'un bout à l'autre de la largeur
      const ex = b.x - a.x; const ey = b.y - a.y; const el = Math.hypot(ex, ey) || 1; const t = p.geom.tangent[nearest(arcFracs(p), r.at)] as V2;
      expect(Math.abs((ex * t.x + ey * t.y) / el / (Math.hypot(t.x, t.y) || 1))).toBeLessThan(0.43);
    }
  });
  it('le centre est l\'argmax de N·H ÉCLAIRÉ sur le CORPS de la mèche (à un pas d\'échantillon + la demi-bande près, en abscisse curviligne)', () => {
    const Hv = norm(add(LIGHT.dir, viewRayInHead(V0)));
    for (const { p, r } of found) {
      const lit = (n: V3): number => { const t = Math.max(0, Math.min(1, (dot(n, LIGHT.dir) - 0.02) / 0.28)); return t * t * (3 - 2 * t); };
      const mh = Math.max(...p.blade.half); const nh = p.geom.normal3.map((n, i) => (p.geom.backface[i] || (p.blade.half[i] as number) < RING.bodyWidth * mh ? 0 : Math.max(0, dot(n as V3, Hv)) * lit(n as V3) * (1 - 0.5 * (p.geom.occlusion[i] as number))));
      const k = nh.indexOf(Math.max(...nh)); const f = arcFracs(p);
      const gap = Math.max((f[Math.min(f.length - 1, k + 1)] as number) - (f[k] as number), (f[k] as number) - (f[Math.max(0, k - 1)] as number));
      expect(Math.abs(r.at - (f[k] as number))).toBeLessThanOrEqual(gap + r.extent / 2 + 1e-9);
    }
  });
  it('jamais sur la pointe ni sur la racine : la bande entière tient dans le corps (largeur ≥ 40 % du maximum)', () => {
    for (const { p, r } of found) {
      const f = arcFracs(p); const mh = Math.max(...p.blade.half); const bodyIdx = p.blade.half.map((h, i) => (h >= RING.bodyWidth * mh ? i : -1)).filter((i) => i >= 0);
      expect(r.at - r.extent / 2).toBeGreaterThanOrEqual((f[bodyIdx[0] as number] as number) - 1e-9); expect(r.at + r.extent / 2).toBeLessThanOrEqual((f[bodyIdx[bodyIdx.length - 1] as number] as number) + 1e-9);
    }
  });
  it('étendue et couverture restent dans la plage MESURÉE sur la référence 60 (0,047–0,071 L ; 0,67–0,91)', () => {
    for (const { p, r } of found) { expect(r.extent).toBeGreaterThanOrEqual(0.042 - 1e-9); expect(r.extent).toBeLessThanOrEqual(0.078 + 1e-9); expect(r.coverage).toBeGreaterThanOrEqual(0.67); expect(r.coverage).toBeLessThanOrEqual(0.91); expect(arcLen(p.blade.spine)).toBeGreaterThan(0); }
  });
  it('trois paliers d\'ombre aval, du côté `side` de la bande le long de la mèche', () => {
    for (const { p, r } of found) {
      expect(r.shoulder).toHaveLength(RING.shoulderSteps.length); const f = arcFracs(p);
      const arcOf = (poly: readonly V2[]): number => { const c = poly.reduce((a, q) => ({ x: a.x + q.x / poly.length, y: a.y + q.y / poly.length }), { x: 0, y: 0 }); let bi = 0; let bd = Infinity; p.blade.spine.forEach((s, i) => { const d = Math.hypot(s.x - c.x, s.y - c.y); if (d < bd) { bd = d; bi = i; } }); return f[bi] as number; };
      for (const q of r.shoulder) expect(Math.sign(arcOf(q) - r.at)).toBe(r.side);
    }
  });
  it('et c\'est le côté le moins exposé à la lumière (exposition interpolée par abscisse curviligne)', () => {
    for (const { p, r } of found) {
      const f = arcFracs(p); const ex = (at: number): number => { const a = Math.max(0, Math.min(1, at)); let i = 0; while (i < f.length - 2 && (f[i + 1] as number) < a) i++; const u = (a - (f[i] as number)) / (((f[i + 1] as number) - (f[i] as number)) || 1); return (p.geom.exposure[i] as number) * (1 - u) + (p.geom.exposure[i + 1] as number) * u; };
      expect(ex(r.at + r.side * RING.shoulderLen)).toBeLessThanOrEqual(ex(r.at - r.side * RING.shoulderLen) + 1e-9);
    }
  });
  it('déterministe, fini', () => { const a = bands(2).r; const b = bands(2).r; expect(JSON.stringify(a)).toBe(JSON.stringify(b)); for (const { r } of found) for (const q of [...r.highlight, ...r.shoulder.flat()]) { expect(Number.isFinite(q.x) && Number.isFinite(q.y)).toBe(true); } });
});

describe('reflet transversal : il suit la lumière', () => {
  it('lumière exactement en face de la caméra (médian nul) : aucune bande, jamais NaN', () => { const L = { dir: norm({ ...(viewRayInHead(V0)), x: -viewRayInHead(V0).x, y: -viewRayInHead(V0).y, z: -viewRayInHead(V0).z }) }; expect(all(L)).toHaveLength(0); });
  it('lumière derrière la tête : très peu de reflets visibles', () => { expect(all(light(0, -0.3, -0.9)).length).toBeLessThan(all().length); });
  it('changer la lumière change QUELLES mèches s\'allument (mesuré : 12 seulement à gauche, 3 seulement à droite) et décale la bande des autres', () => {
    const a = all(light(-0.7, -0.3, 0.6)); const b = all(light(0.7, -0.3, 0.6)); const inB = new Set(b.map((y) => y.p.spec)); const inA = new Set(a.map((y) => y.p.spec));
    const differ = a.filter((x) => !inB.has(x.p.spec)).length + b.filter((y) => !inA.has(y.p.spec)).length;
    expect(differ / Math.max(1, a.length + b.length)).toBeGreaterThanOrEqual(0.2);
    const common = a.filter((x) => inB.has(x.p.spec)); expect(common.length).toBeGreaterThan(3);
    const shifted = common.filter((x) => Math.abs(x.r.at - (b.find((q) => q.p.spec === x.p.spec) as Found).r.at) > 0.002).length;
    expect(shifted / common.length).toBeGreaterThanOrEqual(0.5);
  });
  it('lumière de face : au moins un reflet, tout fini et dans [0, 1]', () => { const f = all(light(0, 0, 1)); expect(f.length).toBeGreaterThan(0); for (const { r } of f) { expect(r.strength).toBeGreaterThanOrEqual(0); expect(r.strength).toBeLessThanOrEqual(1); expect(r.at).toBeGreaterThan(0); expect(r.at).toBeLessThan(1); } });
});

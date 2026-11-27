import { describe, expect, it } from 'vitest';
import { ARCHETYPES, type BodyInput } from '../src/body';
import { bodyVolumes, type VolumeSet } from '../src/body/volume';
import { finishRelief, type Shape } from '../src/body/volume/back-relief';
import { verifyBack, verifyJunctions } from '../src/verify';
import { armBodyChecks, latTrapChecks } from '../src/verify/body-09';
import { bodyHost } from '../scripts/lib/body-host';

const H = bodyHost(), ALL = Object.keys(ARCHETYPES) as (keyof typeof ARCHETYPES)[];
type R = Record<string, { ok: boolean; detail: string }>;
const lt = (set: VolumeSet, raw: BodyInput): R => Object.fromEntries(latTrapChecks(set, raw, H.a).map((c) => [c.id, { ok: c.ok, detail: c.detail }]));
const arm = (set: VolumeSet, raw: BodyInput): R => Object.fromEntries(armBodyChecks(set, raw, H.a).map((c) => [c.id, { ok: c.ok, detail: c.detail }]));
const withShapes = (set: VolumeSet, f: (s: Shape[]) => Shape[]): VolumeSet => ({ ...set, relief: finishRelief(f([...set.relief!.shapes]), set.relief!.H) });
const swap = (set: VolumeSet, f: (v: VolumeSet['volumes'][number]) => VolumeSet['volumes'][number] | null): VolumeSet => { const vs = set.volumes.map(f).filter((v): v is VolumeSet['volumes'][number] => v !== null); return { ...set, volumes: vs, byId: new Map(vs.map((v) => [v.id, v])) }; };
const adult = (): { raw: BodyInput; set: VolumeSet; u: number } => { const raw = ARCHETYPES.adultMale as BodyInput, set = bodyVolumes(raw, H.a, {}), m = set.measures; return { raw, set, u: ((m.t12Y as number) - (m.c7Y as number)) / 12 }; };

describe('itération 09 — grand dorsal, losange du trapèze, enveloppe du deltoïde, mains : 3 couches', () => {
  it.each(ALL)('%s : les contrôles du dos (grand dorsal, losange) passent', (n) => {
    const raw = ARCHETYPES[n] as BodyInput, r = lt(bodyVolumes(raw, H.a, {}), raw);
    expect(Object.keys(r).length).toBe(5);
    for (const k of Object.keys(r)) expect(r[k]!.ok, `${k}: ${r[k]!.detail}`).toBe(true);
  });
  it.each(ALL)('%s : les contrôles de l’épaule et de la main passent', (n) => {
    const raw = ARCHETYPES[n] as BodyInput, r = arm(bodyVolumes(raw, H.a, {}), raw);
    expect(Object.keys(r).length).toBe(6);
    for (const k of Object.keys(r)) expect(r[k]!.ok, `${k}: ${r[k]!.detail}`).toBe(true);
  });
  it.each(['baby', 'toddler', 'child', 'thin', 'obese'] as const)('%s : l’enveloppe du deltoïde (palier 2) est déclarée NON APPLICABLE, pas prouvée visuellement', (n) => {
    const raw = ARCHETYPES[n] as BodyInput, r = arm(bodyVolumes(raw, H.a, {}), raw);
    expect(r['junction.sty.deltoid-wrap-visible']!.detail).toContain('non applicable');
  });
  it.each(['adultMale', 'adultFemale', 'muscular', 'veryMuscular'] as const)('%s : l’enveloppe du deltoïde est prouvée visible (pas « non applicable »)', (n) => {
    const raw = ARCHETYPES[n] as BodyInput, r = arm(bodyVolumes(raw, H.a, {}), raw);
    expect(r['junction.sty.deltoid-wrap-visible']!.detail).not.toContain('non applicable');
  });
  it('verifyBack et verifyJunctions embarquent les nouveaux contrôles et baby passe le dos (ligne avant : bande de l’âge)', () => {
    const raw = ARCHETYPES.baby as BodyInput, set = bodyVolumes(raw, H.a, {}), b = verifyBack(set, raw, H.a);
    expect(b.checks.some((c) => c.id === 'back.ana.lat-over-angle')).toBe(true);
    expect(b.failures.map((c) => `${c.id}: ${c.detail}`)).toEqual([]);
    expect(verifyJunctions(set, raw, H.a).checks.some((c) => c.id === 'junction.geo.hand-webs-attached')).toBe(true);
  });
  it('l’angle inférieur de l’omoplate de l’adulte est à T7–T8 (≤ 8,6 vertèbres sous C7 ; avant l’itération : 8,7–9,3)', () => {
    const { raw, set } = adult(), c = verifyBack(set, raw, H.a).checks.find((q) => q.id === 'back.ana.inferior-angle-level')!, v = Number(/à ([0-9.]+) vertèbres/.exec(c.detail)![1]);
    expect(c.ok, c.detail).toBe(true); expect(v).toBeLessThan(8.6); expect(v).toBeGreaterThan(7);
  });
  it('contrôle négatif front-line : un adulte à 9° n’a PAS la bande élargie du nourrisson', () => {
    const { raw, set } = adult(), bad = { ...set, measures: { ...set.measures, frontLineDeg: 9 } }, c = verifyBack(bad, raw, H.a).checks.find((q) => q.id === 'back.ana.front-line-vertical')!;
    expect(c.ok, c.detail).toBe(false);
  });
  it('les palmures gauche/droite restent symétriques à la variation des doigts près (exemptées du miroir strict comme les doigts dont elles dérivent)', () => {
    const { set } = adult();
    for (let k = 0; k < 4; k++) { const l = set.byId.get(`web.${k}.L`)!, r = set.byId.get(`web.${k}.R`)!;
      l.stations.forEach((q, i) => { const o = r.stations[i]!; expect(Math.abs(q.c.x + o.c.x), `web.${k}[${i}].x`).toBeLessThan(0.08 * H.a.h); expect(Math.abs(q.c.y - o.c.y), `web.${k}[${i}].y`).toBeLessThan(0.08 * H.a.h); }); }
  });
  it('négatif géométrie : un bord latéral du grand dorsal décalé de 0,3 h échoue', () => {
    const { raw, set } = adult(), r = lt(withShapes(set, (s) => s.map((q) => (q.kind === 'line' && q.id.startsWith('latissimus-border') ? { ...q, pts: q.pts.map((p) => [p[0], p[1] + 0.3 * set.relief!.H] as const) } : q))), raw);
    expect(r['back.geo.lat-border-span']!.ok, r['back.geo.lat-border-span']!.detail).toBe(false);
  });
  it('négatif anatomie : un bord supérieur du grand dorsal descendu de 2 vertèbres ne recouvre plus l’angle de l’omoplate', () => {
    const { raw, set, u } = adult(), r = lt(withShapes(set, (s) => s.map((q) => (q.kind === 'poly' && q.id === 'latissimus.L' ? { ...q, pts: q.pts.map((p) => [p[0], p[1] + 2 * u] as const) } : q))), raw);
    expect(r['back.ana.lat-over-angle']!.ok, r['back.ana.lat-over-angle']!.detail).toBe(false);
  });
  it('négatif anatomie : une pointe de losange remontée de 3 vertèbres n’est plus à T12', () => {
    const { raw, set, u } = adult(), r = lt(withShapes(set, (s) => s.map((q) => (q.kind === 'poly' && q.id === 'trapezius-diamond' ? { ...q, pts: q.pts.map((p) => [p[0], p[1] - 3 * u] as const) } : q))), raw);
    expect(r['back.ana.trap-diamond']!.ok, r['back.ana.trap-diamond']!.detail).toBe(false);
  });
  it('négatif style : une nappe et un losange d’amplitude ×0,02 sont invisibles → échec sur l’image', () => {
    const { raw, set } = adult(), r = lt(withShapes(set, (s) => s.map((q) => (/^(latissimus|trapezius-)/.test(q.id) ? { ...q, amp: q.amp * 0.02 } : q))), raw);
    expect(r['back.sty.lat-trap-visible']!.ok, r['back.sty.lat-trap-visible']!.detail).toBe(false);
  });
  it('négatif géométrie : des enveloppes du deltoïde décalées de 0,2 h vers l’extérieur ne finissent plus sur l’humérus', () => {
    const { raw, set } = adult(), r = arm(swap(set, (v) => (v.id.startsWith('deltoid-wrap.') && v.id.endsWith('.L') ? { ...v, stations: v.stations.map((s) => ({ ...s, c: { ...s.c, x: s.c.x + 0.2 * H.a.h } })) } : v)), raw);
    expect(r['junction.geo.deltoid-wrap-attached']!.ok, r['junction.geo.deltoid-wrap-attached']!.detail).toBe(false);
  });
  it('négatif anatomie : un chef postérieur placé du même côté que l’antérieur échoue', () => {
    const { raw, set } = adult(), ant = set.byId.get('deltoid-wrap.ant.L')!, r = arm(swap(set, (v) => (v.id === 'deltoid-wrap.post.L' ? { ...v, stations: v.stations.map((s, i) => ({ ...s, c: { ...s.c, z: ant.stations[i]!.c.z } })) } : v)), raw);
    expect(r['junction.ana.deltoid-heads-opposed']!.ok, r['junction.ana.deltoid-heads-opposed']!.detail).toBe(false);
  });
  it('négatif style : des enveloppes de section ×0,05 ne changent rien à l’image → échec', () => {
    const { raw, set } = adult(), r = arm(swap(set, (v) => (v.id.startsWith('deltoid-wrap.') ? { ...v, stations: v.stations.map((s) => ({ ...s, a: s.a * 0.05, b: s.b * 0.05 })) } : v)), raw);
    expect(r['junction.sty.deltoid-wrap-visible']!.ok, r['junction.sty.deltoid-wrap-visible']!.detail).toBe(false);
  });
  it('négatif géométrie + style : sans palmures, la main échoue (non attachées, rien ne change à l’image)', () => {
    const { raw, set } = adult(), r = arm(swap(set, (v) => (v.id.startsWith('web.') ? null : v)), raw);
    expect(r['junction.geo.hand-webs-attached']!.ok).toBe(false);
    expect(r['junction.sty.hand-webs-visible']!.ok, r['junction.sty.hand-webs-visible']!.detail).toBe(false);
  });
  it('négatif anatomie : un médius raccourci (phalange distale retirée) n’est plus le doigt le plus long', () => {
    const { raw, set } = adult(), r = arm(swap(set, (v) => (v.id === 'finger.2.3.L' ? null : v)), raw);
    expect(r['junction.ana.finger-order']!.ok, r['junction.ana.finger-order']!.detail).toBe(false);
  });
});

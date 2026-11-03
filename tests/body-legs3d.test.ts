import { describe, expect, it } from 'vitest';
import { ARCHETYPES, legGeometry, type BodyInput } from '../src/body';
import { LEG_LANDMARKS, LEG_MUSCLES } from '../src/body/lower/leg-spec';
import { bodyVolumes, type VolumeSet } from '../src/body/volume';
import { PORTED_2D, verifyLegs3D } from '../src/verify';
import { referenceAnchor } from './body-helpers';

const A = referenceAnchor(), raw = ARCHETYPES.veryMuscular as BodyInput;
const swap = (set: VolumeSet, f: (v: VolumeSet['volumes'][number]) => VolumeSet['volumes'][number]): VolumeSet => { const vs = set.volumes.map(f); return { ...set, volumes: vs, byId: new Map(vs.map((v) => [v.id, v])) }; };

describe('jambes 3D (itération 06) — une seule source avec le module 2D', () => {
  it('chaque atome 2D (muscle, os, repère, orteil, ongle, tendon du pied) a un volume 3D de même identifiant', () => {
    const set = bodyVolumes(raw, A, {}), need = legGeometry(raw, {}, A).atoms.filter(PORTED_2D).map((q) => q.id);
    expect(need.length).toBeGreaterThan(140);
    expect(need.filter((id) => !set.byId.has(id))).toEqual([]);
  });
  it('les tables LEG_MUSCLES et LEG_LANDMARKS pilotent les deux rendus : autant de volumes 3D que d\'entrées par côté', () => {
    const set = bodyVolumes(raw, A, {});
    for (const q of LEG_MUSCLES) for (const s of ['L', 'R']) expect(set.byId.get(`${q.id}.${s}`)?.kind, q.id).toBe('muscle');
    for (const q of LEG_LANDMARKS) for (const s of ['L', 'R']) expect(set.byId.has(`${q.id}.${s}`), q.id).toBe(true);
  });
  it('les cotes 3D sont celles de legGeometry : allonger la cuisse (params.legs.limbs.thigh) allonge le fémur 3D de la même proportion', () => {
    const len = (s: VolumeSet): number => { const v = s.byId.get('bone.tibia.L')!, a = v.stations[0]!.c, b = v.stations[v.stations.length - 1]!.c; const f = s.byId.get('bone.femur.L')!, c = f.stations[0]!.c, d = f.stations[f.stations.length - 1]!.c; return Math.hypot(d.x - c.x, d.y - c.y, d.z - c.z) + 0 * Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); };
    const base = len(bodyVolumes(raw, A, {})), long = len(bodyVolumes(raw, A, { legs: { limbs: { thigh: 0.5 } } })), lf0 = legGeometry(raw, {}, A).frame, lf1 = legGeometry(raw, { limbs: { thigh: 0.5 } }, A).frame;
    expect((long - 0.22 * lf1.body.h) / (base - 0.22 * lf0.body.h)).toBeCloseTo(lf1.len.thigh / lf0.len.thigh, 2);
    expect(lf1.len.thigh).toBeGreaterThan(lf0.len.thigh * 1.05);
  });
  it('flexion du genou : la cheville recule (z décroît) et la jambe reste de même longueur', () => {
    const z = (s: VolumeSet): { z: number; l: number } => { const k = s.byId.get('joint.knee.L')!.stations[1]!.c, an = s.byId.get('joint.ankle.L')!.stations[1]!.c; return { z: an.z - k.z, l: Math.hypot(an.x - k.x, an.y - k.y, an.z - k.z) }; };
    const s0 = z(bodyVolumes(raw, A, {})), s1 = z(bodyVolumes(raw, A, { legs: { pose: { left: { kneeFlex: 50 } } } }));
    expect(s1.z).toBeLessThan(s0.z - 0.2 * s0.l);
    expect(s1.l / s0.l).toBeCloseTo(1, 2);
  });
  it('pose du pied : footTurnout fait tourner l\'avant du pied vers l\'extérieur de chaque côté (symétrique)', () => {
    const tip = (s: VolumeSet, side: 'L' | 'R'): number => { const v = s.byId.get(`foot.toe.1.${side}`)!; return v.stations[v.stations.length - 1]!.c.x; };
    const s0 = bodyVolumes(raw, A, { legs: { pose: { left: { footTurnout: 0 }, right: { footTurnout: 0 } } } }), s1 = bodyVolumes(raw, A, { legs: { pose: { left: { footTurnout: 40 }, right: { footTurnout: 40 } } } });
    expect(tip(s1, 'L') - tip(s0, 'L')).toBeGreaterThan(0.02 * 400);
    expect(tip(s1, 'R') - tip(s0, 'R')).toBeLessThan(-0.02 * 400);
  });
});

describe('vérification des jambes 3D — 3 couches', () => {
  it.each(Object.keys(ARCHETYPES))('%s : aucun échec, 3 couches présentes', (n) => {
    const r0 = ARCHETYPES[n as keyof typeof ARCHETYPES] as BodyInput, r = verifyLegs3D(bodyVolumes(r0, A, {}), r0, A);
    expect(r.failures.map((q) => `${q.id}: ${q.detail}`)).toEqual([]);
    expect(new Set(r.checks.map((c) => c.layer)).size).toBe(3);
  });
  it('contrôle négatif : un mollet gonflé de 60 % sort de la coque de peau', () => {
    const bad = swap(bodyVolumes(raw, A, {}), (v) => (v.id === 'gastrocnemius.medial.L' ? { ...v, stations: v.stations.map((s) => ({ ...s, a: s.a * 3, b: s.b * 3 })) } : v));
    expect(verifyLegs3D(bad, raw, A).failures.map((f) => f.id)).toContain('legs3d.geo.muscles-in-shell');
  });
  it('contrôle négatif : un quadriceps passé derrière le fémur casse les loges', () => {
    const set = bodyVolumes(raw, A, {}), bad = swap(set, (v) => (v.id === 'rectus-femoris.L' ? { ...v, stations: v.stations.map((s) => ({ ...s, c: { ...s.c, z: s.c.z - 400 } })) } : v));
    expect(verifyLegs3D(bad, raw, A).failures.map((f) => f.id)).toContain('legs3d.ana.compartments');
  });
  it('contrôle négatif : un volume du module 2D sans équivalent 3D casse la parité', () => {
    const set = bodyVolumes(raw, A, {}), vs = set.volumes.filter((v) => v.id !== 'soleus.R'), bad = { ...set, volumes: vs, byId: new Map(vs.map((v) => [v.id, v])) };
    expect(verifyLegs3D(bad, raw, A).failures.map((f) => f.id)).toContain('legs3d.geo.parity-2d');
  });
});

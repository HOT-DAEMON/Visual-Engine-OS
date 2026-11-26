import { describe, expect, it } from 'vitest';
import { ARCHETYPES, type BodyInput } from '../src/body';
import { bodyVolumes, type VolumeSet } from '../src/body/volume';
import { verifyJunctions } from '../src/verify';
import { bodyHost } from '../scripts/lib/body-host';

const H = bodyHost();
const swap = (set: VolumeSet, f: (v: VolumeSet['volumes'][number]) => VolumeSet['volumes'][number]): VolumeSet => { const vs = set.volumes.map(f); return { ...set, volumes: vs, byId: new Map(vs.map((v) => [v.id, v])) }; };
const sym = (n: keyof typeof ARCHETYPES, vp = {}, mutate?: (set: VolumeSet) => VolumeSet): { ok: boolean; detail: string } => {
  const raw = ARCHETYPES[n] as BodyInput, set = bodyVolumes(raw, H.a, vp), c = verifyJunctions(mutate ? mutate(set) : set, raw, H.a).checks.find((q) => q.id === 'junction.geo.shoulder-symmetry')!;
  return { ok: c.ok, detail: c.detail };
};

describe('itération 08 — symétrie d’épaule invariante à la pose', () => {
  it('baby passe (0,030 h compensé ; 0,058 h en mesure brute à hauteur absolue)', () => {
    const r = sym('baby');
    expect(r.ok, r.detail).toBe(true);
    expect(r.detail).toContain('mesure brute');
  });
  it.each(['adultMale', 'adultFemale', 'muscular', 'veryMuscular', 'child', 'toddler', 'obese', 'thin', 'elderFemale'] as const)('%s passe aussi (aucune régression)', (n) => {
    const r = sym(n); expect(r.ok, r.detail).toBe(true);
  });
  it('cause établie : sans contrapposto, la peau et les muscles de baby sont exactement symétriques', () => {
    const set = bodyVolumes(ARCHETYPES.baby as BodyInput, H.a, { contrapposto: { amount: 0, side: 1, twist: 0 } }), L = set.byId.get('trapezius.upper.L')!, R = set.byId.get('trapezius.upper.R')!;
    L.stations.forEach((s, i) => { expect(s.c.x).toBeCloseTo(-R.stations[i]!.c.x, 6); expect(s.c.y).toBeCloseTo(R.stations[i]!.c.y, 6); });
  });
  it('contrôle négatif : un trapèze gauche décalé de 0,12 h vers l’extérieur fait échouer la symétrie', () => {
    const r = sym('adultMale', {}, (set) => swap(set, (v) => (v.id === 'trapezius.upper.L' ? { ...v, stations: v.stations.map((s) => ({ ...s, c: { ...s.c, x: s.c.x + 0.12 * (set.measures.h as number) } })) } : v)));
    expect(r.ok, r.detail).toBe(false);
  });
});

const pec = (n: keyof typeof ARCHETYPES, mutate?: (v: VolumeSet['volumes'][number], h: number) => VolumeSet['volumes'][number]): Record<string, { ok: boolean; detail: string }> => {
  const raw = ARCHETYPES[n] as BodyInput, set = bodyVolumes(raw, H.a, {}), h = set.measures.h as number, m = mutate ? swap(set, (v) => (v.id === 'pectoralis.insertion.L' ? mutate(v, h) : v)) : set;
  return Object.fromEntries(verifyJunctions(m, raw, H.a).checks.filter((c) => c.id.includes('pec-')).map((c) => [c.id.split('.').pop()!, { ok: c.ok, detail: c.detail }]));
};
describe('itération 08 — insertion du grand pectoral : 3 couches, avec contrôles négatifs', () => {
  it.each(['adultMale', 'veryMuscular', 'muscular', 'teenMale', 'adultFemale', 'obese', 'elderMale'] as const)('%s : attaché, par-dessus le deltoïde, visible dans l’image', (n) => {
    const r = pec(n);
    for (const k of ['pec-insertion-attached', 'pec-over-deltoid', 'pec-insertion-visible']) expect(r[k]!.ok, `${k}: ${r[k]!.detail}`).toBe(true);
    expect(r['pec-insertion-visible']!.detail).not.toContain('non applicable');
  });
  it('baby : contrôle de style déclaré NON APPLICABLE (chef sterno-costal invisible, 0 pixel), géométrie et anatomie contrôlées', () => {
    const r = pec('baby');
    expect(r['pec-insertion-visible']!.detail).toContain('non applicable');
    expect(r['pec-insertion-attached']!.ok && r['pec-over-deltoid']!.ok).toBe(true);
  });
  it('négatif géométrie : une insertion décalée de 0,15 h vers l’extérieur n’est plus attachée', () => {
    expect(pec('adultMale', (v, h) => ({ ...v, stations: v.stations.map((s) => ({ ...s, c: { ...s.c, x: s.c.x + 0.15 * h } })) }))['pec-insertion-attached']!.ok).toBe(false);
  });
  it('négatif anatomie : une insertion sous la couche du deltoïde échoue', () => {
    expect(pec('adultMale', (v) => ({ ...v, layer: 3 }))['pec-over-deltoid']!.ok).toBe(false);
  });
  it('négatif style : une insertion de section quasi nulle (invisible) échoue sur l’image', () => {
    expect(pec('adultMale', (v) => ({ ...v, stations: v.stations.map((s) => ({ ...s, a: 1e-3, b: 1e-3 })) }))['pec-insertion-visible']!.ok).toBe(false);
  });
});

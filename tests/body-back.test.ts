import { describe, expect, it } from 'vitest';
import { ARCHETYPES, type BodyInput } from '../src/body';
import { bodyVolumes, renderVolumes } from '../src/body/volume';
import { verifyBack } from '../src/verify';
import { bodyHost } from '../scripts/lib/body-host';
import { profileBands } from '../scripts/body-refs/profile-edges';
import { profileFit } from '../scripts/body-refs/profile-iou';
import { backRows } from '../scripts/body-refs/back-measure';

const H = bodyHost();
describe('dos : omoplate, colonne, tronc (itération 04) — vérification 3 couches', () => {
  it.each(['adultMale', 'adultFemale', 'veryMuscular', 'muscular', 'child'] as const)('%s : aucun échec', (n) => {
    const set = bodyVolumes(ARCHETYPES[n] as BodyInput, H.a, {});
    const r = verifyBack(set, ARCHETYPES[n] as BodyInput, H.a);
    expect(r.failures.map((f) => `${f.id}: ${f.detail}`)).toEqual([]);
    expect(new Set(r.checks.map((c) => c.layer)).size).toBe(3);
  });
  it('contrôle négatif : une omoplate collée à la ligne médiane fait échouer la géométrie', () => {
    const set = bodyVolumes(ARCHETYPES.veryMuscular as BodyInput, H.a, {});
    const bad = set.volumes.map((v) => (v.id === 'scapula.L' || v.id === 'scapula.R' ? { ...v, stations: v.stations.map((s) => ({ ...s, c: { ...s.c, x: 0 } })) } : v));
    const r = verifyBack({ ...set, volumes: bad, byId: new Map(bad.map((v) => [v.id, v])) }, ARCHETYPES.veryMuscular as BodyInput, H.a);
    expect(r.failures.map((f) => f.id)).toContain('back.geo.scapula-lateral');
  });
  it('contrôle négatif : une lame de 2 vertèbres de haut fait échouer l’anatomie', () => {
    const set = bodyVolumes(ARCHETYPES.veryMuscular as BodyInput, H.a, {});
    const bad = set.volumes.map((v) => (v.id === 'scapula.L' ? { ...v, stations: v.stations.map((s, i) => ({ ...s, c: { ...s.c, y: v.stations[0]!.c.y + i * 2 } })) } : v));
    const r = verifyBack({ ...set, volumes: bad, byId: new Map(bad.map((v) => [v.id, v])) }, ARCHETYPES.veryMuscular as BodyInput, H.a);
    expect(r.failures.map((f) => f.id)).toContain('back.ana.scapula-height');
  });
  it('la lame est un atome caché : absente du rendu par défaut, présente avec showHidden', () => {
    const set = bodyVolumes(ARCHETYPES.veryMuscular as BodyInput, H.a, {});
    expect(renderVolumes(set, { skin: H.skin, uid: 't1' }).ids).not.toContain('scapula.L');
    expect(renderVolumes(set, { skin: H.skin, uid: 't2', showHidden: true }).ids).toContain('scapula.L');
  });
  it('profil de ref-04 : IoU ≥ 0,83 et erreur de profondeur ≤ 9 % (avant l’itération : 0,80 / 12,9 %)', () => {
    const r = profileFit(ARCHETYPES.adultMale as BodyInput, 90, H);
    expect(r.iou).toBeGreaterThan(0.83);
    expect(r.rowErr).toBeLessThan(0.09);
  });
  it('profil : le bord avant et le bord arrière restent à ≤ 0,15 h de ref-04 sur les bandes thorax→taille', () => {
    const { bands } = profileBands();
    for (const b of bands.slice(1, 7)) { expect(Math.abs(b.dos)).toBeLessThan(0.15); expect(Math.abs(b.avant)).toBeLessThan(0.15); }
  });
  it('vue de dos de ref-01 : largeur d’épaules à 0,5 h sous le cou à ±10 % de la référence', () => {
    const r = backRows()[0]!;
    expect(Math.abs(r.ecart)).toBeLessThan(0.1);
  });
});

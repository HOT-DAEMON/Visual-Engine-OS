import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { generateRandomProfile } from '../src/generation/random-skull';
import { FaceParams } from '../src/schema';
import { skullGeometry } from '../src/skull/geometry';
import { renderProfile } from '../src/skull/render';
import { SkullParams } from '../src/skull/types';
import { checkProfileGeometry, verifyProfile } from '../src/verify/skull';

const face = FaceParams.parse({ anatomyEngine: 'structured' });

describe('moteur de crâne en profil — géométrie', () => {
  const g = skullGeometry(face, {}, 420);
  it('est déterministe et mémoïsée (même objet pour même contenu)', () => {
    expect(skullGeometry(face, {}, 420)).toBe(g);
    expect(JSON.stringify(skullGeometry(FaceParams.parse({ anatomyEngine: 'structured' }), SkullParams.parse({}), 420).sil)).toBe(JSON.stringify(g.sil));
  });
  it('partage les hauteurs de la vue de face', () => {
    const r = checkProfileGeometry(g, face).find((c) => c.id === 'heights-match-front');
    expect(r?.ok).toBe(true);
  });
  it("résout l'angle gonial sur celui du visage de face", () => {
    expect(Math.abs(g.bone.gonialDeg - g.bone.gonialRequestedDeg)).toBeLessThan(0.5);
  });
  it('place chaque repère osseux sous la peau et ordonne le profil du front au menton', () => {
    const rep = checkProfileGeometry(g, face);
    for (const id of ['bone-inside-skin', 'tissue-positive', 'landmark-vertical-order', 'profile-no-self-intersection']) expect(rep.find((c) => c.id === id)?.ok, id).toBe(true);
  });
  it("la nuque (C7 → inion) est derrière la gorge et le cou s'élargit vers la base", () => {
    const { neck } = g;
    expect(neck.xBack(neck.yC7)).toBeLessThan(neck.throat.x);
    expect(neck.xFront(neck.yBase) - neck.xBack(neck.yBase)).toBeGreaterThan(neck.xFront(neck.throat.y) - neck.xBack(neck.throat.y));
  });
  it('rejette un axe hors bornes (schéma strict)', () => {
    expect(() => SkullParams.parse({ occiput: 2 })).toThrow();
    expect(() => SkullParams.parse({ inconnu: 1 })).toThrow();
  });
  it('un cou court est ramené à la longueur minimale et consigné', () => {
    const short = skullGeometry(FaceParams.parse({ anatomyEngine: 'structured', neck: { length: 0.06 } }), {}, 420);
    expect(short.neck.yBase).toBeGreaterThanOrEqual(short.neck.throat.y + 0.18 * 420 - 1e-6);
  });
});

describe('vérification du profil — détecte les défauts', () => {
  const g = skullGeometry(face, {}, 420);
  it("signale un os qui sort de la peau (corruption d'un repère)", () => {
    const bad = { ...g, bone: { ...g.bone, lm: { ...g.bone.lm, 'inion:bone': { x: 900, y: 0 } } } };
    expect(checkProfileGeometry(bad, face).find((c) => c.id === 'bone-inside-skin')?.ok).toBe(false);
  });
  it('signale un contour qui se coupe', () => {
    const bad = { ...g, poly: [...g.poly.slice(0, 50), ...g.poly.slice(50, 100).reverse(), ...g.poly.slice(100)] };
    expect(checkProfileGeometry(bad, face).find((c) => c.id === 'profile-no-self-intersection')?.ok).toBe(false);
  });
  it('signale un angle gonial incohérent avec la face', () => {
    const bad = { ...g, bone: { ...g.bone, gonialDeg: g.bone.gonialRequestedDeg + 9 } };
    expect(checkProfileGeometry(bad, face).find((c) => c.id === 'gonial-matches-front')?.ok).toBe(false);
  });
});

describe('rendu du profil', () => {
  it('ne contient ni filtre ni bruit, et reste déterministe', () => {
    const a = renderProfile(face, { hair: 'short' }, {});
    expect(a.svg).not.toMatch(/<filter/);
    expect(renderProfile(face, { hair: 'short' }, {}).svg).toBe(a.svg);
  });
  it('le mode anatomie émet les marqueurs de profondeur, le mode peau non', () => {
    const an = renderProfile(face, {}, { mode: 'anatomy' }).svg;
    const sk = renderProfile(face, {}, { mode: 'skin' }).svg;
    expect(an.length).toBeLessThan(sk.length);
    expect(an).toContain('stroke-dasharray');
    expect(sk).not.toContain('stroke-dasharray');
  });
  it('la coiffure change le rendu sans changer la géométrie de peau', () => {
    const a = renderProfile(face, { hair: 'none' }, {});
    const b = renderProfile(face, { hair: 'updo' }, {});
    expect(a.svg).not.toBe(b.svg);
    expect(a.geo.sil).toEqual(b.geo.sil);
  });
});

describe('génération aléatoire de profils', () => {
  it('même graine → même tête ; le visage de face est inchangé par le crâne', () => {
    const a = generateRandomProfile(321), b = generateRandomProfile(321);
    expect(a.skull).toEqual(b.skull);
    expect(JSON.stringify(a.face.params)).toBe(JSON.stringify(generateRandomFace(321, { structure: true }).params));
  });
  it('40 têtes tirées passent toute la vérification (aucune erreur)', () => {
    for (let s = 1; s <= 40; s++) {
      const p = generateRandomProfile(s * 53);
      const r = verifyProfile(p.face.params, p.skull, { skin: p.skin, hair: p.hair });
      expect(r.failures.map((c) => c.id), `graine ${s * 53}`).toEqual([]);
    }
  });
});

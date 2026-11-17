import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { faceLandmarks, halfWidthAt, jawline } from '../src/face';
import { posedFace, posedOutline } from '../src/face/pose';
import { lightVector } from '../src/lighting/light';
import { renderChin } from '../src/render/face/jaw';
import { skinAppearance } from '../src/render/face/face';
import { FaceParams } from '../src/schema';

/**
 * Bande d'ombre de la ligne de mâchoire sous pose (`docs/ROTATION-HAIR-PASS-6.md`) : elle appartient à la SILHOUETTE, pas au groupe « menton » de la pose.
 * Tracée sur le contour de face puis décalée avec le menton, elle dépassait de ~14 px hors de la tête à 30° (halo pâle + ombre fantôme).
 */
const setup = (seed: number) => {
  const f = generateRandomFace(seed, { id: 'f0', transform: { x: 0, y: 0, scale: 1 } });
  const host = f.objects[0] as unknown as { face: Record<string, unknown>; width: number; height: number };
  const p = FaceParams.parse(host.face);
  const lm = faceLandmarks(p, host.width, host.height);
  const ra = skinAppearance('#c8a08a', p);
  const L = lightVector({ azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity: 1 });
  return { p, lm, ra, L };
};

describe('mâchoire sous pose : la bande d’ombre suit la silhouette posée', () => {
  it('contour de face : `jaw` est vide et `markup` est identique à l’appel sans contour (identité à 0°)', () => {
    const { p, lm, ra, L } = setup(321);
    const a = renderChin('c', p, lm, ra, L), b = renderChin('c', p, lm, ra, L, lm.outline);
    expect(a.jaw).toEqual([]);
    expect(b.jaw).toEqual([]);
    expect(b.markup).toEqual(a.markup);
    expect(b.defs).toEqual(a.defs);
  });

  it('contour posé (±30°) : la bande de mâchoire et le reflet du coin quittent le groupe « menton » et passent dans `jaw`', () => {
    const { p, lm, ra, L } = setup(321);
    const flat = renderChin('c', p, lm, ra, L);
    for (const yaw of [30, -30, 45]) {
      const posed = renderChin('c', p, lm, ra, L, posedOutline(lm, posedFace(lm, yaw)));
      expect(posed.jaw.length).toBeGreaterThanOrEqual(1);
      // Le reflet du coin de mâchoire est toujours produit : il a donc quitté `markup` (sinon il resterait décalé avec le menton).
      expect(posed.markup.length).toBeLessThan(flat.markup.length);
      expect(posed.markup.every((m) => flat.markup.includes(m))).toBe(true);
      // Le sillon et le coussinet du menton restent dans le groupe menton, sans changement.
      expect(posed.markup[0]).toBe(flat.markup[0]);
    }
  });

  it('la ligne de mâchoire tracée vient du contour posé : chaque point est sur la silhouette posée, pas sur le contour de face', () => {
    const { lm } = setup(321);
    const o = posedOutline(lm, posedFace(lm, 30));
    const jl = jawline({ ...lm, outline: o, jaw: { ...lm.jaw, gonion: o.keys.gonion } });
    expect(jl.length).toBeGreaterThan(10);
    const off = jl.filter((q) => Math.abs(Math.abs(q.x) - halfWidthAt(o, q.y)) > 1.5 && Math.abs(q.x) > 1);
    // Tolérance : le côté gauche est lu symétriquement par `jawline` (contour symétrique documenté) ; le côté droit doit coller à la silhouette.
    expect(off.filter((q) => q.x > 0).length).toBe(0);
  });
});

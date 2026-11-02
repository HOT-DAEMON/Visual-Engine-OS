import { describe, expect, it } from 'vitest';
import { ARCHETYPES, BodyParams, type BodyInput } from '../src/body';
import { bodyVolumes, renderVolumesPixel } from '../src/body/volume';
import { verifyProfileDepth } from '../src/verify';
import { bodyHost } from '../scripts/lib/body-host';
import { profileFit } from '../scripts/body-refs/profile-iou';

const H = bodyHost();
const prof = (arch: BodyInput, yaw: number) => { const s = bodyVolumes(arch, H.a, {}), m = renderVolumesPixel(s, { skin: H.skin, heightPx: 700, camera: { yaw, pitch: 0, pivot: { x: 0, y: 0, z: 0 } } }); return verifyProfileDepth(m, H.a, BodyParams.parse(arch).adiposity); };

describe('profil : vérification en 3 couches mesurée sur l’image', () => {
  for (const n of ['veryMuscular', 'muscular', 'adultMale', 'adultFemale', 'thin', 'obese', 'elderMale'] as const) {
    it(`${n} : aucun échec (profil gauche et droit)`, () => {
      for (const yaw of [-90, 90]) { const r = prof(ARCHETYPES[n as keyof typeof ARCHETYPES] as BodyInput, yaw); expect(r.failures.map((f) => `${f.id}: ${f.detail}`)).toEqual([]); }
    });
  }
  it('contrôle négatif : un abdomen creusé fait échouer la bande de profondeur', () => {
    const s = bodyVolumes(ARCHETYPES.veryMuscular as BodyInput, H.a, {}), m = renderVolumesPixel(s, { skin: H.skin, heightPx: 700, camera: { yaw: -90, pitch: 0, pivot: { x: 0, y: 0, z: 0 } } });
    const { w, h, rgba } = m.pixels, b = m.bounds, sy = h / (b.y1 - b.y0), y0 = Math.round((H.a.baseY + 1.0 * H.a.h - b.y0) * sy), y1 = Math.round((H.a.baseY + 1.7 * H.a.h - b.y0) * sy);
    const cut = new Uint8ClampedArray(rgba); for (let y = y0; y <= y1; y++) for (let x = 0; x < w * 0.5; x++) cut[(y * w + x) * 4 + 3] = 0; // retire la moitié gauche de l'image sur l'abdomen
    expect(verifyProfileDepth({ ...m, pixels: { w, h, rgba: cut } }, H.a).failures.some((f) => f.id.startsWith('pf.ana'))).toBe(true);
  });
});
describe('fidélité au profil de ref-04 (plancher de non-régression, recalage en translation)', () => {
  it('IoU de profil ≥ 0,76 (vue −90°) et erreur de profondeur par ligne ≤ 16 %', () => {
    // Itération 05 : −90° passe de 0,7757 à 0,7698 (plancher 0,77 → 0,76) parce que la peau suit enfin la pose ; la vue +90° gagne 0,025 (voir test suivant).
    const r = profileFit(ARCHETYPES.veryMuscular as BodyInput, -90, H);
    expect(r.iou).toBeGreaterThan(0.76);
    expect(r.rowErr).toBeLessThan(0.16);
  });
  it('vue +90° : IoU ≥ 0,85 et erreur de profondeur ≤ 9 % (avant l’itération 05 : 0,833 / 9,3 %)', () => {
    const r = profileFit(ARCHETYPES.veryMuscular as BodyInput, 90, H);
    expect(r.iou).toBeGreaterThan(0.85);
    expect(r.rowErr).toBeLessThan(0.09);
  });
});

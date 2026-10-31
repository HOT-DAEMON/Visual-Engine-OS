import { describe, expect, it } from 'vitest';
import { ARCHETYPES, BodyParams, type BodyInput } from '../src/body';
import { bodyVolumes, renderVolumesPixel, type VolumeSet } from '../src/body/volume';
import { verifyShoulders } from '../src/verify';
import { bodyHost } from '../scripts/lib/body-host';
import { fitToRef, loadRef, silhouetteIou } from '../scripts/body-refs/iou';
import { outerWall, topContour } from '../scripts/body-refs/contour';

const H = bodyHost();
const posed = (pose: Record<string, number>): BodyInput => { const b: any = JSON.parse(JSON.stringify(BodyParams.parse(ARCHETYPES.veryMuscular))); for (const s of ['left', 'right']) Object.assign(b.pose[s], pose); return b; };
const POSE02 = { abduction: 11, forearmSwing: 1, elbowFlex: 23, pronation: -0.575 }, POSE04 = { abduction: 18, forearmSwing: -8, elbowFlex: 0, pronation: -0.35 };

describe('deltoïde et trapèze : masses continues', () => {
  const set = bodyVolumes(ARCHETYPES.veryMuscular as BodyInput, H.a, {});
  it('un seul volume deltoïdien par épaule (plus de fuseaux antérieur/moyen/postérieur)', () => {
    expect(set.byId.get('deltoid.L')?.mass).toBe('deltoid');
    expect(set.byId.get('deltoid.R')?.mass).toBe('deltoid');
    expect(set.volumes.filter((v) => /^deltoid\.(ant|mid|post)/.test(v.id))).toHaveLength(0);
    expect(set.volumes.filter((v) => v.id.startsWith('deltoid.groove'))).toHaveLength(4);
  });
  it('le trapèze (3 parties × 2 côtés) appartient à une seule masse', () => {
    const t = set.volumes.filter((v) => v.id.startsWith('trapezius.'));
    expect(t).toHaveLength(6);
    expect(t.every((v) => v.mass === 'trapezius')).toBe(true);
  });
  it('la chute de l’acromion suit la mesure des références (≈ 0,5 h sous le menton)', () => {
    const acr = set.landmarks.get('acromion.L')!;
    expect((acr.y - H.a.chinY) / H.a.h).toBeGreaterThan(0.42);
    expect((acr.y - H.a.chinY) / H.a.h).toBeLessThan(0.62);
  });
});
describe('vérification de l’épaule (3 couches, mesurée sur l’image)', () => {
  for (const [name, body] of [['pose par défaut', ARCHETYPES.veryMuscular as BodyInput], ['pose ref-02', posed(POSE02)], ['pose ref-04', posed(POSE04)]] as const) {
    it(`${name} : aucun échec`, () => {
      const s = bodyVolumes(body, H.a, {}), m = renderVolumesPixel(s, { skin: H.skin, heightPx: 700 }), r = verifyShoulders(m, s, H.a);
      expect(r.failures.map((f) => `${f.id}: ${f.detail}`)).toEqual([]);
      expect(r.checks.map((c) => c.layer)).toEqual(expect.arrayContaining(['geometry', 'anatomy', 'style']));
    });
  }
  it('contrôle négatif : un chef de deltoïde séparé fait échouer le contrôle « une seule masse »', () => {
    const s = bodyVolumes(ARCHETYPES.veryMuscular as BodyInput, H.a, {}), v = s.byId.get('deltoid.L')!, fake = { ...v, id: 'deltoid.ant.L' };
    const bad: VolumeSet = { ...s, volumes: [...s.volumes, fake], byId: new Map([...s.byId, [fake.id, fake]]) };
    const r = verifyShoulders(renderVolumesPixel(s, { skin: H.skin, heightPx: 420 }), bad, H.a);
    expect(r.failures.map((f) => f.id)).toContain('sh.ana.deltoid-single-mass');
  });
});
describe('fidélité aux deux masques de référence (planchers de non-régression)', () => {
  const r2 = loadRef('ref-02'), r4 = loadRef('ref-04');
  it('ref-04 : masque de face chargé (figure complète, bras droit tronqué par le cadre)', () => {
    let n = 0; for (let i = 0; i < r4.m.length; i++) n += r4.m[i]!;
    expect(n).toBeGreaterThan(100000); expect(r4.meas.head.height).toBe(93);
  });
  it('ref-02, pose ref-02 : IoU ≥ 0,77, écart de largeur ≤ 8 %', () => {
    const r = silhouetteIou(r2, fitToRef(r2, posed(POSE02), H.a, H.skin));
    expect(r.iou).toBeGreaterThanOrEqual(0.77); expect(r.rowErr).toBeLessThanOrEqual(0.08);
  });
  it('ref-04, pose ref-04 : IoU ≥ 0,77, écart de largeur ≤ 6 %', () => {
    const r = silhouetteIou(r4, fitToRef(r4, posed(POSE04), H.a, H.skin));
    expect(r.iou).toBeGreaterThanOrEqual(0.77); expect(r.rowErr).toBeLessThanOrEqual(0.06);
  });
  it('contour supérieur de l’épaule : écart moyen ≤ 0,06 h à ref-02 et ≤ 0,07 h à ref-04 (du cou au coin du deltoïde)', () => {
    for (const [ref, pose, lim] of [[r2, POSE02, 0.06], [r4, POSE04, 0.07]] as const) {
      const f = fitToRef(ref, posed(pose), H.a, H.skin), y0 = ref.meas.neckBaseY - 0.2 * ref.meas.head.height, y1 = ref.meas.neckBaseY + 1.5 * ref.meas.head.height;
      const a = topContour(ref.m, ref, y0, y1), b = topContour(f.mask, ref, y0, y1), n = Math.min(a.x.length, b.x.length, 9);
      let e = 0; for (let i = 0; i < n; i++) e += Math.abs(a.y[i]! - b.y[i]!);
      expect(e / n).toBeLessThanOrEqual(lim);
    }
  });
  it('paroi externe du bras : définie pour toute la hauteur comparée', () => {
    const f = fitToRef(r2, posed(POSE02), H.a, H.skin), w = outerWall(f.mask, r2, [0.8, 1.5, 2.0, 2.5, 3.0]);
    expect(w.every((x) => Number.isFinite(x))).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { ARCHETYPES, type BodyInput } from '../src/body';
import { bodyVolumes, renderVolumesPixel, type VolumeSet } from '../src/body/volume';
import { verifyJunctions } from '../src/verify';
import { junctionRenderChecks } from '../src/verify/junction-render';
import { bodyFrame } from '../src/body/frame';
import { BodyParams } from '../src/body/types';
import { bodyHost } from '../scripts/lib/body-host';

const H = bodyHost(), CAM = { yaw: 0, pitch: 0, pivot: { x: 0, y: 0, z: 0 } };
const swap = (set: VolumeSet, f: (v: VolumeSet['volumes'][number]) => VolumeSet['volumes'][number]): VolumeSet => { const vs = set.volumes.map(f); return { ...set, volumes: vs, byId: new Map(vs.map((v) => [v.id, v])) }; };

describe('raccords épaule ↔ bras et haut ↔ bas du corps (itération 05) — vérification 3 couches', () => {
  it.each(['adultMale', 'adultFemale', 'veryMuscular', 'muscular', 'child', 'toddler', 'teenFemale', 'teenMale', 'obese', 'thin', 'elderMale', 'elderFemale'] as const)('%s : aucun échec, 3 couches présentes', (n) => {
    const raw = ARCHETYPES[n] as BodyInput, r = verifyJunctions(bodyVolumes(raw, H.a, {}), raw, H.a);
    expect(r.failures.map((q) => `${q.id}: ${q.detail}`)).toEqual([]);
    expect(new Set(r.checks.map((c) => c.layer)).size).toBe(3);
  });
  it('contrôle négatif : un tronc dont la peau est 12 % plus étroite que la pente de référence fait échouer l’anatomie', () => {
    const raw = ARCHETYPES.veryMuscular as BodyInput, bad = swap(bodyVolumes(raw, H.a, {}), (v) => (v.id === 'trunk' ? { ...v, stations: v.stations.map((s) => ({ ...s, a: s.a * 0.72 })) } : v));
    expect(verifyJunctions(bad, raw, H.a).failures.map((q) => q.id)).toContain('junction.ana.slope-width');
  });
  it('contrôle négatif : des jambes absentes sont signalées (le bassin ne se raccorde à rien)', () => {
    const raw = ARCHETYPES.adultMale as BodyInput, set = bodyVolumes(raw, H.a, {}), vs = set.volumes.filter((v) => v.group !== 'leg');
    expect(() => verifyJunctions({ ...set, volumes: vs, byId: new Map(vs.map((v) => [v.id, v])) }, raw, H.a)).toThrow();
  });
  it('contrôle négatif : un muscle décalé de 0,2 h hors de la peau fait échouer le dépassement', () => {
    const raw = ARCHETYPES.adultMale as BodyInput, bad = swap(bodyVolumes(raw, H.a, {}), (v) => (v.id === 'trapezius.upper.L' ? { ...v, stations: v.stations.map((s) => ({ ...s, c: { ...s.c, x: s.c.x + 0.2 * H.a.h } })) } : v));
    expect(verifyJunctions(bad, raw, H.a).failures.map((q) => q.id)).toContain('junction.geo.no-floating-muscle');
  });
  it('les jambes sont de la peau de niveau 0 et se terminent à la cheville du module du bas', () => {
    const set = bodyVolumes(ARCHETYPES.adultMale as BodyInput, H.a, {}), L = set.byId.get('leg.env.L')!, R = set.byId.get('leg.env.R')!;
    expect([L.kind, L.level, R.kind, R.level]).toEqual(['skin', 0, 'skin', 0]);
    expect(L.stations.length).toBeGreaterThan(40);
    expect(L.stations[0]!.c.x).toBeGreaterThan(0);
    expect(R.stations[0]!.c.x).toBeLessThan(0);
  });
  it('rendu par pixel : un muscle de palier partiel se fond sur la peau, le fond ne transparaît jamais à l’intérieur du corps', () => {
    const m = renderVolumesPixel(bodyVolumes(ARCHETYPES.adultMale as BodyInput, H.a, {}), { skin: H.skin, heightPx: 360, camera: CAM, uid: 'tj' }), { w, h, rgba } = m.pixels;
    let solid = 0, bad = 0; const al = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? 0 : rgba[(y * w + x) * 4 + 3]! / 255);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const q = al(x, y); if (q >= 0.9) { solid++; continue; } if (q <= 0.04) continue; let e = false; for (let dy = -2; dy <= 2 && !e; dy++) for (let dx = -2; dx <= 2; dx++) if (al(x + dx, y + dy) <= 0.04) { e = true; break; } if (!e) bad++; }
    expect(bad / solid).toBeLessThan(0.001);
  });
});

describe('itération 07 — fondu des normales aux raccords peau/peau et arrondi de l’épaule', () => {
  const cam = { yaw: 0, pitch: 0, pivot: { x: 0, y: 0, z: 0 } };
  it.each(['adultMale', 'veryMuscular', 'child', 'obese'] as const)('%s : le fondu divise le saut moyen de normale aux raccords et change réellement l’image', (n) => {
    const set = bodyVolumes(ARCHETYPES[n] as BodyInput, H.a, {});
    const on = renderVolumesPixel(set, { skin: H.skin, heightPx: 460, camera: cam, uid: 'on' }), off = renderVolumesPixel(set, { skin: H.skin, heightPx: 460, camera: cam, uid: 'off', seamBlend: false });
    expect(on.seam.blended).toBeGreaterThan(500);
    expect(on.seam.jumpAfter).toBeLessThanOrEqual(0.65 * on.seam.jumpBefore);
    expect(off.seam).toMatchObject({ blended: 0, jumpAfter: off.seam.jumpBefore });
    expect(on.seam.jumpBefore).toBeCloseTo(off.seam.jumpBefore, 5); // même mesure avant fondu : le fondu ne change que l'après
    // EFFET SUR L'IMAGE (mesuré, faible mais réel) : 0,3–0,9 % des pixels du corps changent, de 1,6–2,5/255 en moyenne (max 13–23) à 460 px de haut ; aucune comparaison de perception : voir docs/BODY-JUNCTIONS-07.md.
    let diff = 0, n2 = 0, mx = 0; for (let i = 0; i < on.pixels.rgba.length; i += 4) { const d = Math.abs(on.pixels.rgba[i]! - off.pixels.rgba[i]!); if (d > 0) { diff += d; n2++; mx = Math.max(mx, d); } }
    expect(n2).toBeGreaterThan(120);
    expect(diff / n2).toBeGreaterThan(1.5);
    expect(mx).toBeGreaterThanOrEqual(10);
  });
  it('contrôle négatif : sans fondu, la vérification de style « seam-normal-jump » échoue', () => {
    const raw = ARCHETYPES.adultMale as BodyInput, set = bodyVolumes(raw, H.a, {});
    expect(junctionRenderChecks(set, raw, H.a).find((c) => c.id === 'junction.sty.seam-normal-jump')!.ok).toBe(true);
    expect(junctionRenderChecks(set, raw, H.a, { seamBlend: false }).find((c) => c.id === 'junction.sty.seam-normal-jump')!.ok).toBe(false);
  });
  it.each(['adultMale', 'veryMuscular', 'child', 'teenFemale'] as const)('%s : la paroi la plus large de la peau est SOUS l’acromion (plus de coin au niveau de l’acromion)', (n) => {
    const raw = ARCHETYPES[n] as BodyInput, set = bodyVolumes(raw, H.a, {}), f = bodyFrame(BodyParams.parse(raw), H.a), t = set.byId.get('trunk')!;
    const zone = t.stations.filter((s) => s.c.y >= f.y.base && s.c.y <= f.y.axilla), widest = zone.reduce((m, s) => (s.a > m.a ? s : m), zone[0]!);
    expect(widest.c.y).toBeGreaterThanOrEqual(f.y.acr + 0.2 * (f.y.axilla - f.y.acr));
  });
});

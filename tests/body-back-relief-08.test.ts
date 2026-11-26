import { describe, expect, it } from 'vitest';
import { ARCHETYPES, type BodyInput } from '../src/body';
import { bodyVolumes, renderVolumesPixel, type VolumeSet } from '../src/body/volume';
import { finishRelief, reliefHeight, type Shape } from '../src/body/volume/back-relief';
import { verifyBack } from '../src/verify';
import { bodyHost } from '../scripts/lib/body-host';

const H = bodyHost(), ALL = Object.keys(ARCHETYPES) as (keyof typeof ARCHETYPES)[];
const MINE = ['back.geo.relief-bounds', 'back.geo.relief-mirror', 'back.ana.scapula-span', 'back.ana.scapula-medial', 'back.ana.spine-inclined', 'back.ana.inferior-angle-level', 'back.sty.relief-silhouette', 'back.sty.relief-visible', 'back.sty.relief-soft', 'back.sty.relief-replaces-sticks'];
const mine = (set: VolumeSet, raw: BodyInput): Record<string, { ok: boolean; detail: string }> => Object.fromEntries(verifyBack(set, raw, H.a).checks.filter((c) => MINE.includes(c.id)).map((c) => [c.id.replace('back.', ''), { ok: c.ok, detail: c.detail }]));
const withShapes = (set: VolumeSet, f: (s: Shape[]) => Shape[]): VolumeSet => ({ ...set, relief: finishRelief(f([...set.relief!.shapes]), set.relief!.H) });
const hmax = (set: VolumeSet): number => { const r = set.relief!; let m = 0; for (let j = 0; j < 90; j++) for (let i = 1; i < 70; i++) m = Math.max(m, Math.abs(reliefHeight(r, i * 0.0145 * r.H, H.a.baseY + j * 0.012 * r.H))); return m / r.H; };
const share = (n: keyof typeof ARCHETYPES): number => {
  const set = bodyVolumes(ARCHETYPES[n] as BodyInput, H.a, {}), R = (b: boolean) => renderVolumesPixel(set, { skin: '#c99a76', heightPx: 460, camera: { yaw: 180, pitch: 0, pivot: { x: 0, y: 0, z: 0 } }, uid: 'q' + b, backRelief: b }).pixels.rgba, A = R(true), B = R(false);
  let ch = 0, body = 0; for (let i = 0; i < A.length; i += 4) { if (A[i + 3]! > 200) body++; if (Math.abs(A[i]! - B[i]!) > 6) ch++; } return (100 * ch) / body;
};

describe('itération 08 — relief du haut du dos : 3 couches', () => {
  it.each(ALL)('%s : géométrie, anatomie et style du relief passent', (n) => {
    const raw = ARCHETYPES[n] as BodyInput, r = mine(bodyVolumes(raw, H.a, {}), raw), ids = Object.keys(r);
    expect(ids.length).toBe(10);
    for (const k of ids) expect(r[k]!.ok, `${k}: ${r[k]!.detail}`).toBe(true);
  });
  it('les paramètres produisent des différences visibles ET ordonnées : amplitude du champ et part de l’image modifiée suivent la musculature (veryMuscular > adultMale > thin > obese)', () => {
    const sets = (['veryMuscular', 'adultMale', 'thin', 'obese'] as const).map((n) => bodyVolumes(ARCHETYPES[n] as BodyInput, H.a, {})), h = sets.map(hmax);
    expect(h[0]).toBeGreaterThan(h[1]! * 1.3); expect(h[1]).toBeGreaterThan(h[2]! * 1.25); expect(h[2]).toBeGreaterThan(h[3]! * 1.15);
    const s = (['veryMuscular', 'adultMale', 'thin', 'obese'] as const).map(share);
    expect(s[0]).toBeGreaterThan(s[1]!); expect(s[1]).toBeGreaterThan(s[2]! * 2); expect(s[2]).toBeGreaterThan(s[3]! * 1.5);
  });
  it('la silhouette est strictement la même avec et sans relief (adultMale, de dos)', () => {
    const set = bodyVolumes(ARCHETYPES.adultMale as BodyInput, H.a, {}), R = (b: boolean) => renderVolumesPixel(set, { skin: '#c99a76', heightPx: 300, camera: { yaw: 180, pitch: 0, pivot: { x: 0, y: 0, z: 0 } }, uid: 's' + b, backRelief: b }).pixels.rgba, A = R(true), B = R(false);
    let d = 0; for (let i = 3; i < A.length; i += 4) if (Math.abs(A[i]! - B[i]!) > 8) d++;
    expect(d).toBe(0);
  });
  it('de face, le relief du dos ne change aucun pixel (poids nul pour une peau tournée vers l’avant)', () => {
    const set = bodyVolumes(ARCHETYPES.adultMale as BodyInput, H.a, {}), R = (b: boolean) => renderVolumesPixel(set, { skin: '#c99a76', heightPx: 300, camera: { yaw: 0, pitch: 0, pivot: { x: 0, y: 0, z: 0 } }, uid: 'f' + b, backRelief: b }).pixels.rgba, A = R(true), B = R(false);
    let d = 0; for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) d++;
    expect(d).toBe(0);
  });
  it('négatif géométrie : des formes décalées de 0,5 h vers le bas sortent du tronc', () => {
    const raw = ARCHETYPES.adultMale as BodyInput, set = bodyVolumes(raw, H.a, {}), r = mine(withShapes(set, (sh) => sh.map((s) => (s.kind === 'blob' ? { ...s, c: [s.c[0], s.c[1] + 0.5 * set.relief!.H] as const } : { ...s, pts: s.pts.map((p) => [p[0], p[1] + 0.5 * set.relief!.H] as const) }) as Shape)), raw);
    expect(r['geo.relief-bounds']!.ok).toBe(false);
  });
  it('négatif géométrie : sans les formes du côté droit, la symétrie du champ échoue', () => {
    const raw = ARCHETYPES.adultMale as BodyInput;
    expect(mine(withShapes(bodyVolumes(raw, H.a, {}), (sh) => sh.filter((s) => !s.id.endsWith('.R'))), raw)['geo.relief-mirror']!.ok).toBe(false);
  });
  it('négatif anatomie : une lame réduite de moitié en hauteur n’a plus la portée de 5–6 vertèbres', () => {
    const raw = ARCHETYPES.adultMale as BodyInput, set = bodyVolumes(raw, H.a, {}), r = mine(withShapes(set, (sh) => sh.map((s) => { if (s.kind !== 'poly' || !s.id.startsWith('blade')) return s; const y0 = Math.min(...s.pts.map((p) => p[1])); return { ...s, pts: s.pts.map((p) => [p[0], y0 + (p[1] - y0) * 0.5] as const) }; })), raw);
    expect(r['ana.scapula-span']!.ok).toBe(false);
  });
  it('négatif anatomie : un bord médial collé à la ligne médiane échoue', () => {
    const raw = ARCHETYPES.adultMale as BodyInput, r = mine(withShapes(bodyVolumes(raw, H.a, {}), (sh) => sh.map((s) => (s.kind === 'poly' && s.id === 'blade.L' ? { ...s, pts: s.pts.map((p) => [p[0] * 0.4, p[1]] as const) } : s))), raw);
    expect(r['ana.scapula-medial']!.ok).toBe(false);
  });
  it('négatif style : sans volumes remplaçables dans les données, le contrôle « remplace les bâtonnets » échoue', () => {
    const raw = ARCHETYPES.adultMale as BodyInput, set = bodyVolumes(raw, H.a, {}), vs = set.volumes.filter((v) => !/^(rhomboid|infraspinatus|teres-major|scapular-spine)\./.test(v.id)), bad = { ...set, volumes: vs, byId: new Map(vs.map((v) => [v.id, v])) };
    expect(mine(bad, raw)['sty.relief-replaces-sticks']!.ok).toBe(false);
  });
});

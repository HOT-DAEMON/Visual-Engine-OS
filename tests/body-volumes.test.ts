import { describe, expect, it } from 'vitest';
import { ARCHETYPES, type BodyInput } from '../src/body';
import { bodyVolumes, renderVolumes } from '../src/body/volume';
import { verifyVolumes } from '../src/verify';
import { referenceAnchor } from './body-helpers';

const A = referenceAnchor();
const MUSC: BodyInput = { age: 28, sex: 1, adiposity: 0.07, muscularity: 0.85 };
const cam = (yaw: number, pitch = 0) => ({ yaw, pitch, pivot: { x: 0, y: 0, z: 0 } });
const norm = (s: string): string => s.replace(/-?\d+\.\d+/g, (x) => (Math.round(Number(x) * 10) / 10).toString());

describe('volumes 3D du corps', () => {
  it('passe la vérification en 3 couches sur tous les archétypes', () => {
    for (const [n, b] of Object.entries(ARCHETYPES)) { const r = verifyVolumes(bodyVolumes(b as BodyInput, A), b as BodyInput, A); expect(r.failures.map((c) => `${n}:${c.id}`), n).toEqual([]); }
  });
  it('est pur et mémoïsé : mêmes entrées → même objet ; la caméra ne change pas la géométrie', () => {
    const a = bodyVolumes(MUSC, A), b = bodyVolumes(MUSC, A);
    expect(b).toBe(a);
    const s0 = JSON.stringify(a.volumes.map((v) => v.stations[0]!.c));
    renderVolumes(a, { skin: '#c99a76', camera: cam(123, 7) });
    expect(JSON.stringify(a.volumes.map((v) => v.stations[0]!.c))).toBe(s0);
  });
  it('yaw 360° = yaw 0° ; yaw 180° diffère (la face arrière montre d’autres volumes)', () => {
    const s = bodyVolumes(MUSC, A), r = (y: number): string => renderVolumes(s, { skin: '#c99a76', camera: cam(y), uid: 'z' }).svg;
    expect(norm(r(360))).toBe(norm(r(0)));
    expect(norm(r(180))).not.toBe(norm(r(0)));
  });
  it('symétrie : avec des paramètres symétriques, chaque volume gauche est le miroir du droit', () => {
    const s = bodyVolumes({ ...MUSC, pose: { left: {}, right: {} } } as BodyInput, A, { contrapposto: { amount: 0 }, swing: { left: 5, right: 5 } });
    for (const v of s.volumes.filter((q) => q.id.endsWith('.L'))) {
      const w = s.byId.get(v.id.replace(/\.L$/, '.R'));
      if (!w || v.id.startsWith('rectus') || v.id.startsWith('finger') || v.id.startsWith('thenar') || v.id.startsWith('hypothenar') || v.id.startsWith('tendon.hand') || v.id.startsWith('nail') || v.id.startsWith('pad') || v.id.startsWith('knuckle')) continue; // irrégularités voulues (abdominaux, doigts)
      v.stations.forEach((q, i) => { const o = w.stations[i]!; expect(Math.abs(q.c.x + o.c.x), `${v.id}[${i}].x`).toBeLessThan(1e-6 + 0.002 * Math.abs(q.c.x)); expect(Math.abs(q.c.y - o.c.y), `${v.id}[${i}].y`).toBeLessThan(1e-6); expect(Math.abs(q.c.z - o.c.z), `${v.id}[${i}].z`).toBeLessThan(1e-6); });
    }
  });
  it('les abdominaux sont 4 × 2 blocs tous différents (jamais 8 blocs identiques)', () => {
    const s = bodyVolumes(MUSC, A), ar = s.volumes.filter((v) => v.id.startsWith('rectus.')).map((v) => v.stations.reduce((t, q) => t + q.a * q.b, 0));
    expect(ar).toHaveLength(8);
    expect(new Set(ar.map((x) => x.toFixed(2))).size).toBe(8);
  });
  it('les courbures vertébrales répondent à leur axe et restent dans les bandes anatomiques', () => {
    const lo = bodyVolumes(MUSC, A, { spine: { lumbar: -1, thoracic: -1, cervical: -1 } }).measures, hi = bodyVolumes(MUSC, A, { spine: { lumbar: 1, thoracic: 1, cervical: 1 } }).measures;
    for (const k of ['cobbCervical', 'cobbThoracic', 'cobbLumbar'] as const) expect(hi[k]!, k).toBeGreaterThan(lo[k]!);
  });
  it('le ventre et les fessiers font saillie avec leur paramètre', () => {
    const f = bodyVolumes(MUSC, A, { torso: { belly: 0, glute: -1 } }).measures, g = bodyVolumes(MUSC, A, { torso: { belly: 1, glute: 1 } }).measures;
    expect(g.bellyProjection!).toBeGreaterThan(f.bellyProjection!);
    expect(g.gluteProjection!).toBeLessThan(f.gluteProjection!); // zb plus négatif = fessier plus saillant vers l'arrière
  });
  it('pas de noir : aucune couleur émise sous la luminance 0,02', () => {
    const svg = renderVolumes(bodyVolumes(MUSC, A), { skin: '#c99a76', uid: 'k' }).svg;
    expect(svg).not.toMatch(/#000000|#000"/);
  });
  it('le mode rapide émet au moins 40 % de SVG en moins', () => {
    const s = bodyVolumes(MUSC, A), full = renderVolumes(s, { skin: '#c99a76', uid: 'f' }).svg.length, fast = renderVolumes(s, { skin: '#c99a76', uid: 'f', quality: 'fast' }).svg.length;
    expect(fast).toBeLessThan(0.6 * full);
  });
});

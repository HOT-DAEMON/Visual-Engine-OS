import { describe, expect, it } from 'vitest';
import { applyStylization, relationsOf } from '../src/face/stylize';
import { faceLandmarks } from '../src/face';
import { generateRandomFace } from '../src/generation/random-face';
import { geometryDigest } from '../src/verify';
import { bundle, face, H, W } from './helpers-structure';

const MAX = { chinProjection: 1, jawWidth: 1, angularity: 1, jawNeckContrast: 1, mouthSize: 1, cornerAsymmetry: 1, simplify: 1, outline: 1, detail: 1 };

describe('profil de stylisation (T13)', () => {
  it('neutre : les paramètres ne sont pas touchés (les visages d\'avant restent identiques)', () => {
    const p = face();
    expect(applyStylization(p)).toBe(p);
    // `outline` et `detail` règlent le rendu, pas la géométrie : ils ne comptent pas comme exagération.
    const q = face({ stylization: { outline: 0.8, detail: 0.2 } });
    expect(applyStylization(q)).toBe(q);
  });

  it('idempotent : le profil n\'est appliqué qu\'une fois', () => {
    const once = applyStylization(face({ stylization: MAX }));
    expect(once.stylization.baked).toBe(true);
    expect(applyStylization(once)).toBe(once);
  });

  it('chaque contrôle agit sur son trait', () => {
    const at = (s: object) => applyStylization(face({ stylization: s }));
    const base = face();
    expect(at({ chinProjection: 1 }).chin.projection).toBeGreaterThan(base.chin.projection);
    expect(at({ jawWidth: 1 }).jawWidth).toBeGreaterThan(base.jawWidth);
    expect(at({ angularity: 1 }).jaw.angle).toBeLessThan(base.jaw.angle);
    expect(at({ angularity: 1 }).mandible.bodyCurve).toBeLessThan(base.mandible.bodyCurve);
    expect(at({ angularity: 1 }).chin.form).toBeGreaterThan(0.5);
    expect(at({ jawNeckContrast: 1 }).neck.width).toBeLessThan(base.neck.width);
    expect(at({ mouthSize: 1 }).mouth.width).toBeGreaterThan(base.mouth.width);
    expect(at({ mouthSize: -1 }).mouth.width).toBeLessThan(base.mouth.width);
    expect(at({ cornerAsymmetry: 1 }).mouth.cornerAsym).toBeGreaterThan(0.9);
    expect(at({ simplify: 1 }).chin.lateralBlend).toBe(0);
  });

  it('l\'exagération garde le SENS du trait : un menton fuyant devient plus fuyant, pas proéminent', () => {
    const receding = applyStylization(face({ chin: { projection: 0.2 }, stylization: { chinProjection: 1 } }));
    expect(receding.chin.projection).toBeLessThan(0.2);
    const narrow = applyStylization(face({ jawWidth: 0.65, stylization: { jawWidth: 1 } }));
    expect(narrow.jawWidth).toBeLessThan(0.65);
  });

  it('les relations essentielles survivent à l\'exagération maximale sur 150 visages', () => {
    let worst = Infinity;
    for (let s = 1; s <= 150; s++) {
      const f = generateRandomFace(s * 104729, { structure: { patch: { stylization: MAX } } });
      const lm = faceLandmarks(f.params, f.width, f.height);
      for (const r of relationsOf(lm)) {
        worst = Math.min(worst, r.margin);
        expect(r.margin, `seed ${s} : ${r.id}`).toBeGreaterThanOrEqual(0);
      }
    }
    expect(Number.isFinite(worst)).toBe(true);
  });
});

describe('le mode de rendu n\'est pas la stylisation (T13)', () => {
  it('même géométrie en rendu réaliste, anime et encrage : empreinte géométrique identique', () => {
    const base = face({ stylization: { ...MAX, baked: false } });
    const styled = applyStylization(base);
    const digests = (['realistic', 'anime', 'ink'] as const).map((m) => geometryDigest({ ...styled, renderMode: m }, W, H));
    expect(new Set(digests).size).toBe(1);
  });

  it('les contours et le détail ne reconstruisent pas l\'anatomie', () => {
    const p = applyStylization(face({ stylization: MAX }));
    const a = geometryDigest(p, W, H);
    expect(geometryDigest({ ...p, stylization: { ...p.stylization, outline: 0, detail: 0 } }, W, H)).toBe(a);
  });

  it('la stylisation, elle, change la géométrie (sinon le test précédent serait vide)', () => {
    expect(geometryDigest(applyStylization(face({ stylization: MAX })), W, H)).not.toBe(geometryDigest(face(), W, H));
    expect(bundle().p.stylization.baked).toBe(false);
  });
});

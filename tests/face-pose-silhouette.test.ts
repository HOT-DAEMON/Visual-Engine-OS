import { describe, expect, it } from 'vitest';
import { compileScene, generateRandomFace, type SceneInput } from '../src';
import { faceLandmarks, halfWidthAt, outlinePath } from '../src/face';
import { posedFace, posedOutline } from '../src/face/pose';
import { DEPTH_RATIO } from '../src/face/pose/skull';
import { FaceParams } from '../src/schema';

/** Étape 2 de la rotation (`docs/ROTATION-STEP-02-SVG-SILHOUETTE.md`) : la pose de tête atteint le DESSIN SVG de la silhouette du crâne. Les traits internes sont testés dans `face-pose-features.test.ts`. */
const make = (seed: number, yaw: number | null) => {
  const f = generateRandomFace(seed, { id: 'f0', transform: { x: 0, y: 0, scale: 1 } });
  const host = f.objects[0] as unknown as { face: Record<string, unknown>; width: number; height: number };
  if (yaw !== null) host.face = { ...host.face, headPose: { yawDeg: yaw } };
  const parsed = FaceParams.parse(host.face);
  const lm = faceLandmarks(parsed, host.width, host.height);
  const r = compileScene({ width: 500, height: 500, background: '#ffffff', objects: f.objects } as SceneInput);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return { svg: r.svg, lm };
};

describe('pose de tête → silhouette SVG du crâne', () => {
  it('yaw = 0 : explicite ou par défaut, le SVG est identique à l’octet près et dessine le contour frontal', () => {
    const a = make(321, null), b = make(321, 0);
    expect(b.svg === a.svg).toBe(true);
    expect(a.svg.includes(outlinePath(a.lm.outline))).toBe(true);
    expect(posedOutline(a.lm, posedFace(a.lm, 0))).toBe(a.lm.outline);
  });

  it('yaw ±30° : le SVG change, dessine le contour posé et plus le contour frontal ; +θ et −θ sont des contours identiques (crâne symétrique, limite documentée)', () => {
    const f = make(321, 0), p = make(321, 30), m = make(321, -30);
    const posed = outlinePath(posedOutline(f.lm, posedFace(f.lm, 30)));
    expect(p.svg === f.svg).toBe(false);
    expect(p.svg.includes(posed)).toBe(true);
    expect(p.svg.includes(outlinePath(f.lm.outline))).toBe(false);
    expect(m.svg.includes(posed)).toBe(true);
    expect(outlinePath(posedOutline(f.lm, posedFace(f.lm, -30)))).toBe(posed);
  });

  it('yaw 30° : silhouette finie, fermée, sans NaN ; largeur = contour de face × ρ(lacet), entre cos(lacet) et le rapport de profondeur mesuré (une tête de 1,03 de profondeur relative n’est PAS plus étroite de profil)', () => {
    for (const seed of [321, 4000, 9001]) {
      const f = make(seed, null), lm = f.lm, o30 = posedOutline(lm, posedFace(lm, 30)), o60 = posedOutline(lm, posedFace(lm, 60));
      const d = outlinePath(o30);
      expect(d).not.toMatch(/NaN|Infinity|undefined/);
      expect(d.endsWith('Z')).toBe(true);
      for (const c of o30.right) for (const q of [c.p0, c.p1, c.p2, c.p3]) { expect(Number.isFinite(q.x)).toBe(true); expect(Number.isFinite(q.y)).toBe(true); }
      for (const y of [lm.eyeY, lm.mouthY, lm.jawY]) {
        const w0 = halfWidthAt(lm.outline, y), w30 = halfWidthAt(o30, y), w60 = halfWidthAt(o60, y);
        for (const [w, yaw] of [[w30, 30], [w60, 60]] as const) {
          expect(w / w0).toBeGreaterThanOrEqual(Math.cos((yaw * Math.PI) / 180) - 1e-3);
          expect(w / w0).toBeLessThanOrEqual(DEPTH_RATIO + 1e-3);
        }
        expect(w30 / w0).toBeCloseTo(posedFace(lm, 30).skullHalf(y) / w0, 2);
      }
      // Raccord des cubiques : l'extrémité d'un segment est le départ du suivant (contour continu), ordonnées inchangées.
      o30.right.forEach((c, i) => { if (i) expect(c.p0).toEqual(o30.right[i - 1]!.p3); });
      expect(o30.right.at(-1)!.p3.y).toBeCloseTo(lm.outline.right.at(-1)!.p3.y, 6);
      // Le sommet reste sur l'axe.
      expect(o30.right[0]!.p0.x).toBe(0);
    }
  });

  it('facteur de silhouette continu et ≤ rapport de profondeur à toutes les hauteurs (pas de marche à la mâchoire, pas d’élargissement du menton), pour tous les lacets', () => {
    for (const seed of [321, 4000, 9001]) {
      const lm = make(seed, null).lm;
      for (const yaw of [15, 30, 45, 60, 75]) {
        const P = posedFace(lm, yaw);
        let prev = NaN;
        for (let y = -lm.H / 2 + 0.03 * lm.H; y < lm.chinY - 0.03 * lm.H; y += 0.5) {
          const s = P.skullHalf(y) / halfWidthAt(lm.outline, y);
          expect(s).toBeLessThanOrEqual(DEPTH_RATIO + 1e-9);
          expect(s).toBeGreaterThan(Math.cos((yaw * Math.PI) / 180) - 1e-9);
          if (Number.isFinite(prev)) expect(Math.abs(s - prev)).toBeLessThan(0.01);
          prev = s;
        }
      }
    }
  });

  it('déterminisme (même graine, même pose → même SVG) et pose bornée par le schéma', () => {
    expect(make(4000, 35).svg === make(4000, 35).svg).toBe(true);
    expect(() => FaceParams.parse({ headPose: { yawDeg: 80 } })).toThrow();
    expect(() => FaceParams.parse({ headPose: { pitchDeg: 10 } })).toThrow();
    expect(FaceParams.parse({}).headPose.yawDeg).toBe(0);
  });
});

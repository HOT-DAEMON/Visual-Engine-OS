import { describe, expect, it } from 'vitest';
import { generateRandomFace, SceneSpec } from '../src';
import { faceLandmarks } from '../src/face';
import { applyNeckPreset, frontSilhouette, neckModelFor, NECK_PRESETS } from '../src/neck';
import { FaceParams } from '../src/schema';
import { checkNeckModel } from '../src/verify/neck';

function build(id: string, overrides: Record<string, unknown> = {}) {
  const f = generateRandomFace(321, { id: 'f', neck: { visible: true } } as never);
  const host = (SceneSpec.parse({ width: 800, height: 800, background: null, objects: f.objects }) as { objects: { face?: Record<string, unknown> }[] }).objects[0]!;
  const p = FaceParams.parse({ ...(host.face as object), neck: applyNeckPreset(id, overrides) });
  const lm = faceLandmarks(p, 400, 520);
  return { p, lm, m: neckModelFor(p, lm) };
}
/** Signature de silhouette de face : demi-largeur à 12 hauteurs de la zone visible (menton → base), en fraction de H, + longueur visible. */
function signature(id: string): number[] {
  const { m, lm } = build(id), { left, right } = frontSilhouette(m), top = lm.chinY, bot = lm.neck.bottomY;
  const at = (a: readonly { x: number; y: number }[], y: number) => { let b = a[0]!; for (const q of a) if (Math.abs(q.y - y) < Math.abs(b.y - y)) b = q; return b.x; };
  const half = Array.from({ length: 12 }, (_, i) => { const y = top + ((i + 0.5) / 12) * (bot - top); return (at(right, y) - at(left, y)) / 2 / lm.H; });
  return [...half, (bot - top) / lm.H];
}

describe('presets du cou', () => {
  it('chaque preset est valide (schéma), produit un modèle sans erreur de vérification, et les presets humains sans correction', () => {
    for (const pr of NECK_PRESETS) {
      const { m } = build(pr.id);
      expect(checkNeckModel(m).filter((c) => !c.ok && c.severity === 'error').map((c) => c.id), pr.id).toEqual([]);
      if (pr.family === 'human') expect(m.corrections.map((c) => c.id), pr.id).toEqual([]);
    }
  });
  it('les presets sont DISTINCTS deux à deux : silhouette de face (écart moyen de demi-largeur ≥ 0,8 % de H ou longueur visible ≥ 3 % de H)', () => {
    const sig = new Map(NECK_PRESETS.map((p) => [p.id, signature(p.id)]));
    const bad: string[] = [];
    for (let i = 0; i < NECK_PRESETS.length; i++) for (let j = i + 1; j < NECK_PRESETS.length; j++) {
      const a = sig.get(NECK_PRESETS[i]!.id)!, b = sig.get(NECK_PRESETS[j]!.id)!;
      const w = a.slice(0, 12).reduce((s, v, k) => s + Math.abs(v - b[k]!), 0) / 12, l = Math.abs(a[12]! - b[12]!);
      if (w < 0.008 && l < 0.03) bad.push(`${NECK_PRESETS[i]!.id} ≈ ${NECK_PRESETS[j]!.id} (Δw ${w.toFixed(4)}, Δl ${l.toFixed(3)})`);
    }
    expect(bad).toEqual([]);
  });
  it('un override gagne sur le preset, un preset inconnu est une erreur explicite', () => {
    expect(applyNeckPreset('human-slender', { width: 0.5 }).width).toBe(0.5);
    expect(applyNeckPreset('human-slender', { system: { modifiers: { mass: 0.9 } } }).system.modifiers.mass).toBe(0.9);
    expect(applyNeckPreset('human-slender', { system: { modifiers: { mass: 0.9 } } }).system.musculature.trapezius).toBe(0.15);
    expect(() => applyNeckPreset('nope')).toThrow(/inconnu/);
  });
});

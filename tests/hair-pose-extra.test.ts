import { describe, expect, it } from 'vitest';
import type { Vec } from '../src/geometry/eye/primitives';
import { faceLandmarks } from '../src/face';
import { hairGeometry } from '../src/face/hair';
import { poseHair, skullOf } from '../src/face/pose';
import { FaceParams } from '../src/schema';
import { checkHairPose, spanAt } from '../src/verify/hair-pose';
import { checkHairPoseExtra, peakTurn, windowTurn } from '../src/verify/hair-pose-extra';
import { hairFace, type CleanStyle } from '../scripts/lib/hair-faces';

/** Règles ajoutées à la couche de vérification des cheveux sous pose : `docs/ROTATION-HAIR-VERIFY-2.md`. Contrôles négatifs : un défaut injecté doit être vu. */
const setup = (style: CleanStyle, seed: number) => {
  const f = hairFace(style, 1, { seed }), host = f.objects[0] as unknown as { face: Record<string, unknown>; width: number; height: number };
  const params = FaceParams.parse(host.face), lm = faceLandmarks(params, host.width, host.height), g0 = hairGeometry(params, lm)!;
  return { face: { params, width: host.width, height: host.height }, lm, g0, skull: skullOf(lm) };
};
const ids = (cs: { id: string; ok: boolean }[]): string[] => cs.filter((c) => !c.ok).map((c) => c.id);

describe('windowTurn : mesure indépendante de la densité de sommets', () => {
  const arc = (n: number): Vec[] => Array.from({ length: n }, (_, i) => ({ x: 100 * Math.cos((i / (n - 1)) * Math.PI), y: -100 * Math.sin((i / (n - 1)) * Math.PI) }));
  const vertexTurn = (l: Vec[]) => Math.max(...l.slice(1, -1).map((p, i) => Math.abs(Math.atan2((l[i + 2]!.y - p.y) * (p.x - l[i]!.x) - (l[i + 2]!.x - p.x) * (p.y - l[i]!.y), (l[i + 2]!.x - p.x) * (p.x - l[i]!.x) + (l[i + 2]!.y - p.y) * (p.y - l[i]!.y)))));
  it('un même arc de cercle déjà résolu, 200 ou 800 sommets : même virage sur fenêtre fixe (à 15 % près)', () => {
    const a = windowTurn(arc(200), 3.7), b = windowTurn(arc(800), 3.7);
    expect(Math.abs(a - b) / b).toBeLessThan(0.15);
  });
  it('le virage par sommet, lui, est divisé par ≈ 4 : échantillonner plus fin le fait passer sous un seuil sans changer la courbe', () => {
    expect(vertexTurn(arc(200)) / vertexTurn(arc(800))).toBeGreaterThan(3);
  });
});

describe('pose.hairline-front-peak', () => {
  it('lisière de face : aucun sommet au-dessus du seuil de rabotage (3 graines × 4 coiffures)', () => {
    for (const style of ['short', 'long', 'afro', 'buzz'] as CleanStyle[]) for (const seed of [9000, 9004, 9005]) {
      const { face } = setup(style, seed);
      expect(ids(checkHairPose(face, 0))).toEqual([]);
    }
  });
  it('contrôle négatif : un sommet à angle vif injecté dans la ligne de face est vu, à 0° comme sous pose', () => {
    const { lm, g0, skull } = setup('short', 9001), i = 32, h = g0.hairline.map((q) => ({ ...q }));
    h[i] = { x: h[i]!.x, y: h[i]!.y - 30 };   // pointe de 30 px : virage proche de π
    const bad = { ...g0, hairline: h };
    expect(peakTurn(bad.hairline)).toBeGreaterThan(1.5);
    for (const yaw of [0, 30]) expect(ids(checkHairPoseExtra(bad, poseHair(g0, skull, yaw, lm.W), lm, skull, yaw, spanAt))).toContain('pose.hairline-front-peak');
  });
});

describe('pose.hairline-corner', () => {
  it('contrôle négatif : un crochet injecté dans la ligne posée est vu (même à pas de sommets très fin)', () => {
    const { face, lm, g0, skull } = setup('short', 9004), g = poseHair(g0, skull, 45, lm.W);
    const h = g.hairline.map((q) => ({ ...q })), i = Math.floor(h.length / 2);
    for (let k = -1; k <= 1; k++) h[i + k] = { x: h[i + k]!.x, y: h[i + k]!.y - (k === 0 ? 14 : 6) };   // pointe étroite : 3 sommets à 2,2 px
    expect(ids(checkHairPose(face, 45, { ...g, hairline: h }))).toContain('pose.hairline-corner');
  });
  it('corpus : aucune alerte sur 4 graines × 4 lacets (±45°, ±60° compris : tempe cachée coupée à l\'horizon)', () => {
    for (const seed of [9000, 9002, 9004, 9005]) {
      const { face } = setup('short', seed);
      for (const yaw of [-60, -45, 45, 60]) expect(ids(checkHairPose(face, yaw)).filter((x) => x.startsWith('pose.hairline'))).toEqual([]);
    }
  });
});

describe('pose.mass-thickness', () => {
  it('contrôle négatif : une masse d\'étage gonflée de 20 px est vue', () => {
    for (const style of ['short', 'afro', 'curly', 'long'] as CleanStyle[]) {
      const { face, lm, g0, skull } = setup(style, 9000), g = poseHair(g0, skull, 30, lm.W);
      if (!g.tierMasses.length && !g.simMass) continue;
      const grow = (p: readonly Vec[]) => p.map((q) => ({ x: q.x + Math.sign(q.x) * 20, y: q.y }));
      const bad = { ...g, tierMasses: g.tierMasses.map((m) => ({ ...m, poly: grow(m.poly) })), simMass: g.simMass ? grow(g.simMass) : g.simMass };
      expect(ids(checkHairPose(face, 30, bad))).toContain('pose.mass-thickness');
      return;
    }
    throw new Error('aucune coiffure de l\'échantillon n\'a de masse d\'étage : contrôle négatif impossible');
  });
});

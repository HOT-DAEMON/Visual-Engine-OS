import { describe, expect, it } from 'vitest';
import { generateRandomFace, SceneSpec } from '../src';
import { faceRelations } from '../src/anatomy/face-relations';
import { COMPONENTS } from '../src/anatomy/components';
import { publishedOrbits } from '../src/anatomy/orbit';
import { placedEyesByHost } from '../src/anatomy/placed';
import { hostFace } from '../src/render/face';
import { noseGeometry, type FaceLandmarks } from '../src/face';
import type { HostSpec } from '../src/schema';

/** Relations explicites nez / bouche / oreille / mâchoire / cheveux (docs/FACE-RELATIONS.md). */
const setup = (seed: number) => {
  const sc = SceneSpec.parse({ width: 640, height: 900, objects: generateRandomFace(seed, { id: 'f0', transform: { x: 0, y: 0, scale: 1 } }).objects });
  const { params, lm } = hostFace(sc.objects.find((o) => o.kind === 'host') as HostSpec);
  return { params, lm, nose: noseGeometry(params, lm), pub: publishedOrbits(lm, placedEyesByHost(sc).get('f0') ?? []) };
};
const fails = (rs: ReturnType<typeof faceRelations>) => rs.filter((r) => !Number.isFinite(r.value) || (r.cmp === '<=' ? r.value > r.limit : r.value < r.limit));
const ids = new Set(COMPONENTS.map((c) => c.id));

describe('relations explicites du visage', () => {
  it('200 visages : valeurs finies, ids uniques, composants canoniques, AUCUNE erreur ; dette des avertissements bornée', () => {
    const warn = new Map<string, number>();
    for (let seed = 1; seed <= 200; seed++) {
      const { params, lm, nose, pub } = setup(seed);
      const rs = faceRelations(params, lm, nose, pub);
      expect(new Set(rs.map((r) => r.id)).size, `seed ${seed} : ids dupliqués`).toBe(rs.length);
      for (const r of rs) { expect(ids.has(r.between[0]) && ids.has(r.between[1]), `${r.id} : composant non canonique`).toBe(true); expect(Number.isFinite(r.value), `seed ${seed} ${r.id}`).toBe(true); }
      expect(fails(rs).filter((r) => r.severity === 'error').map((r) => `seed ${seed} ${r.id}=${r.value.toFixed(3)}`)).toEqual([]);
      for (const r of fails(rs)) warn.set(r.id.replace(/\.(left|right)$/, ''), (warn.get(r.id.replace(/\.(left|right)$/, '')) ?? 0) + 1);
    }
    // Dettes MESURÉES le 4 nov. 2026 (sur 200 visages) ; elles ne doivent pas dériver en silence.
    const max: Record<string, number> = { 'ear.top-below-eye-line': 60, 'mouth.lower-face-share.high': 50, 'mouth.vs-nose-width': 8, 'nose.alar-vs-intercanthal.narrow': 15, 'jaw.gonion-vs-mouth-line': 10, 'jaw.gonion-below-nose-base': 20 };
    for (const [id, n] of warn) expect(n, `${id} : ${n} échecs`).toBeLessThanOrEqual(max[id] ?? 0);
  });

  it('chaque composant demandé porte au moins une relation géométrique ET une anatomique', () => {
    const { params, lm, nose, pub } = setup(11);
    const rs = faceRelations(params, lm, nose, pub);
    for (const c of ['nose', 'mouth', 'ear', 'mandible', 'hair']) {
      const mine = rs.filter((r) => r.between.includes(c));
      expect(new Set(mine.map((r) => r.kind)).has('anatomical'), `${c} anatomique`).toBe(true);
      expect(mine.length, c).toBeGreaterThanOrEqual(3);
    }
    for (const c of ['nose', 'mouth', 'ear', 'mandible', 'hair']) expect(rs.some((r) => r.between.includes(c) && (r.kind === 'geometric' || r.kind === 'visual')), `${c} géométrique/visuelle`).toBe(true);
  });

  it('contrôles négatifs : chaque défaut fabriqué est DÉTECTÉ par la relation qui le concerne', () => {
    const { params, lm, nose, pub } = setup(11);
    const broken = (patch: Partial<FaceLandmarks>) => fails(faceRelations(params, { ...lm, ...patch } as FaceLandmarks, nose, pub)).map((r) => r.id);
    expect(broken({ hair: { ...lm.hair, centerY: lm.browLimitY + 10 } })).toContain('hair.hairline-above-brow');
    expect(broken({ hair: { ...lm.hair, centerY: pub.left.cy } })).toContain('hair.hairline-clear-of-orbit.left'); // les cheveux couvriraient l'œil
    expect(broken({ lips: { ...lm.lips, topY: nose.baseY - 5 } })).toContain('mouth.below-nose');
    expect(broken({ lips: { ...lm.lips, topY: nose.tip.c.y } })).toContain('nose.tip-above-lips');
    expect(broken({ jaw: { ...lm.jaw, gonion: { x: lm.jaw.gonion.x, y: nose.baseY - 20 } } })).toContain('jaw.gonion-below-nose-base'); // avertissement : détecté, non bloquant
    expect(broken({ jaw: { ...lm.jaw, gonion: { x: lm.jaw.gonion.x * 0.5, y: lm.jaw.gonion.y } } })).toContain('jaw.gonion-on-outline');
    expect(broken({ chin: { ...lm.chin, half: Math.abs(lm.jaw.gonion.x) + 5 } })).toContain('jaw.chin-narrower-than-jaw');
    expect(broken({ chin: { ...lm.chin, sulcusY: lm.lips.bottomY - 4 } })).toContain('mouth.above-chin-sulcus');
    expect(broken({ lips: { ...lm.lips, half: lm.W } })).toContain('mouth.within-face');
  });
});

import { describe, expect, it } from 'vitest';
import { generateRandomFace, SceneSpec } from '../src';
import { faceLandmarks } from '../src/face';
import { neckModelFor, frontSilhouette } from '../src/neck';
import { FaceParams } from '../src/schema';
import { NeckSystem } from '../src/schema/neck-system';
import { checkNeckModel } from '../src/verify/neck';

/** Reste du cou (docs/NECK-REMAINING.md) : un test par fonctionnalité de cette passe. Les preuves visuelles sont dans artefacts/neck-remaining. */
function build(neck: Record<string, unknown> = {}, sex = 0, seed = 321) {
  const f = generateRandomFace(seed, { id: 'f', neck: { visible: true } } as never);
  const host = (SceneSpec.parse({ width: 800, height: 800, background: null, objects: f.objects }) as { objects: { face?: Record<string, unknown> }[] }).objects[0]!;
  const raw = host.face as Record<string, unknown>;
  const p = FaceParams.parse({ ...raw, neck: { ...(raw.neck as object), visible: true, ...neck } });
  const lm = faceLandmarks(p, 400, 520);
  return { p, lm, m: neckModelFor(p, lm, 0, sex) };
}
const sys = (s: Record<string, unknown>) => ({ system: s });
const collar = (at: number) => ({ kind: 'collar', at, size: 0.5, count: 1, color: '#884422' });

describe('non-collision accessoire / mâchoire', () => {
  it('un collier demandé au-dessus du menton est ramené SOUS le menton, la correction est consignée, le cou ne bouge pas', () => {
    const ref = build(sys({ attachments: [collar(0.9)] }));
    const high = build(sys({ attachments: [collar(0.0)] }));
    const a = high.m.composition.graph.attachments[0]!, m = high.m.composition.morphology;
    const chinU = (high.m.ctx.chinY - m.topY) / m.lengthPx;
    expect(a.at).toBeGreaterThan(chinU);
    expect(high.m.corrections.some((c) => c.id === 'attachment-jaw')).toBe(true);
    expect(ref.m.corrections.some((c) => c.id === 'attachment-jaw')).toBe(false);
    expect(JSON.stringify(high.m.stations.map((s) => s.y))).toBe(JSON.stringify(ref.m.stations.map((s) => s.y)));
  });
  it('plusieurs bandes : aucune ne passe au-dessus du menton, même après la séparation accessoire/accessoire', () => {
    const { m } = build(sys({ attachments: [collar(0.0), { ...collar(0.0), kind: 'scarf' }, { ...collar(0.02), kind: 'spikes' }] }));
    const top = (m.ctx.chinY - m.composition.morphology.topY) / m.composition.morphology.lengthPx;
    for (const a of m.composition.graph.attachments) expect(a.at).toBeGreaterThan(top);
    expect(checkNeckModel(m).filter((c) => !c.ok && c.severity === 'error')).toEqual([]);
  });
});

describe('dimorphisme du larynx par body.sex', () => {
  it('la visibilité du larynx croît avec le sexe exprimé, sans modifier la géométrie du cou', () => {
    const f = build({}, -1), n = build({}, 0), mas = build({}, 1);
    const vis = (m: typeof n.m) => m.composition.structures.find((s) => s.id === 'larynx')!.visibility;
    expect(vis(f.m)).toBeLessThan(vis(n.m));
    expect(vis(n.m)).toBeLessThan(vis(mas.m));
    expect(JSON.stringify(f.m.stations)).toBe(JSON.stringify(mas.m.stations));
    expect(JSON.stringify(frontSilhouette(f.m))).toBe(JSON.stringify(frontSilhouette(mas.m)));
  });
});

describe('intégration au générateur aléatoire', () => {
  const faceOf = (seed: number, o: Record<string, unknown> = {}) => (SceneSpec.parse({ width: 800, height: 800, background: null, objects: generateRandomFace(seed, o as never).objects }) as { objects: { face?: { neck: { system: Record<string, unknown> } & Record<string, unknown> } }[] }).objects[0]!.face!;
  const strip = (f: ReturnType<typeof faceOf>) => JSON.stringify({ ...f, neck: { ...f.neck, system: undefined } });
  it('par défaut (neckVariety 0) aucun visage existant ne bouge ; activé, le tirage ne déplace RIEN d\'autre : tout le visage (et les paramètres plats du cou) est identique à neckVariety = 0', () => {
    const neutral = JSON.stringify(NeckSystem.parse({}));
    for (const seed of [3, 11, 42, 77, 105]) {
      expect(JSON.stringify(faceOf(seed).neck.system), `graine ${seed} : système par défaut = neutre`).toBe(neutral);
      expect(JSON.stringify(faceOf(seed))).toBe(JSON.stringify(faceOf(seed, { neckVariety: 0 })));
      expect(strip(faceOf(seed, { neckVariety: 1 }))).toBe(strip(faceOf(seed, { neckVariety: 0 })));
      expect(JSON.stringify(faceOf(seed, { neckVariety: 1 }).neck.system)).not.toBe(neutral);
    }
  });
  it('le système varie d\'une graine à l\'autre, est déterministe, et reste humain (aucune espèce hors humain)', () => {
    const sys = (seed: number) => JSON.stringify(faceOf(seed, { neckVariety: 1 }).neck.system);
    expect(sys(3)).toBe(sys(3));
    expect(new Set([3, 11, 42, 77, 105, 120].map(sys)).size).toBe(6);
    for (const seed of [3, 11, 42, 77]) expect(faceOf(seed, { neckVariety: 1 }).neck.system.species).toBe('human');
  });
  it('priorité : tirage < preset < neck imposé ; un preset donne le cou voulu', () => {
    const f = faceOf(42, { neckPreset: 'human-slender', neck: { width: 0.5 } });
    expect(f.neck.width).toBe(0.5);
    expect(f.neck.length).toBe(0.4);
    expect((f.neck.system.modifiers as { mass: number }).mass).toBe(0.1);
  });
});

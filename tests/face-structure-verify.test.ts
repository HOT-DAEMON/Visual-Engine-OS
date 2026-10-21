import { describe, expect, it } from 'vitest';
import { checkRenderImage } from '../scripts/lib/verify-render';
import { generateRandomFace } from '../src/generation/random-face';
import { relationsOf } from '../src/face/stylize';
import { checkStructure, verifyFace } from '../src/verify';
import { structureAnatomyChecks, structureContext, structureGeometryChecks } from '../src/verify/structure';

const EXPR = ['neutral', 'smiling', 'angry', 'surprised', 'sad', 'joyful'] as const;
const MAX = { chinProjection: 1, jawWidth: 1, angularity: 1, jawNeckContrast: 1, mouthSize: 1, cornerAsymmetry: 1, simplify: 1, outline: 1 };

describe('vérification de la structure — géométrie, anatomie, style (T14)', () => {
  it('100 visages structurés, expressions variées : aucune des couches ne signale d\'erreur', () => {
    let total = 0;
    for (let s = 1; s <= 100; s++) {
      const f = generateRandomFace(s * 7919, { structure: true, expression: { kind: EXPR[s % EXPR.length] as never, intensity: 0.8 } });
      const cs = checkStructure(f);
      total += cs.length;
      for (const c of cs) expect(c.ok, `seed ${s * 7919} ${c.layer}:${c.id} (${c.value.toFixed(3)} vs ${c.limit.toFixed(3)}) ${c.message}`).toBe(true);
    }
    expect(total).toBeGreaterThan(2000);
  });

  it('exagération maximale de la stylisation : les trois couches tiennent encore (60 visages)', () => {
    for (let s = 1; s <= 60; s++) {
      const f = generateRandomFace(s * 104729, { structure: { patch: { stylization: MAX } } });
      for (const c of checkStructure(f)) expect(c.ok, `seed ${s * 104729} ${c.id}: ${c.message}`).toBe(true);
    }
  });

  it('les trois couches sont toutes représentées', () => {
    const layers = new Set(checkStructure(generateRandomFace(5, { structure: true })).map((c) => c.layer));
    expect([...layers].sort()).toEqual(['anatomy', 'geometry', 'style']);
  });

  it('un visage `classic` n\'a aucun contrôle de structure (rien ne change pour l\'existant)', () => {
    expect(checkStructure(generateRandomFace(5))).toEqual([]);
  });

  it('la vérification globale d\'un visage structuré passe (aucune erreur)', () => {
    for (let s = 1; s <= 12; s++) {
      const r = verifyFace(generateRandomFace(s * 31, { structure: true }));
      expect(r.failures.map((c) => `${c.id}: ${c.message}`), `seed ${s * 31}`).toEqual([]);
      expect(r.ok).toBe(true);
    }
  });
});

/** Tests « mutation » : on CASSE volontairement la géométrie, la vérification doit devenir rouge (une vérification qui ne peut pas échouer ne prouve rien). */
describe('la vérification sait échouer (mutations)', () => {
  const f = generateRandomFace(5, { structure: true });
  const c = structureContext(f);
  const failed = (cs: ReturnType<typeof structureGeometryChecks>): string[] => cs.filter((x) => !x.ok).map((x) => x.id);

  it('géométrie : un philtrum de longueur nulle, une ligne de fermeture repliée, un polygone non fini', () => {
    const R = c.nose.regions;
    const squashed = { ...c, nose: { ...c.nose, regions: { ...R, philtrum: { ...R.philtrum, lengthPx: 0 } } } };
    expect(failed(structureGeometryChecks(squashed))).toContain('structure-philtrum-length');
    const folded = { ...c, mouth: { ...c.mouth, closure: [...c.mouth.closure].reverse() } };
    expect(failed(structureGeometryChecks(folded))).toContain('structure-closure-monotone-x');
    const nan = { ...c, nose: { ...c.nose, regions: { ...R, base: { ...R.base, poly: [{ x: NaN, y: 0 }, ...R.base.poly] } } } };
    expect(failed(structureGeometryChecks(nan))).toContain('structure-nose-finite');
  });

  it('anatomie : un masséter au-dessus de la pommette, une silhouette plus étroite que l\'os, une lèvre non liée à la mandibule', () => {
    const g = c.g;
    const mass = { ...g.mandible.masseter.right, c: { ...g.mandible.masseter.right.c, y: g.tissue.cheeks.right.zygoma.c.y - 20 } };
    const high = { ...c, g: { ...g, mandible: { ...g.mandible, masseter: { ...g.mandible.masseter, right: mass } } } };
    expect(failed(structureAnatomyChecks(high))).toContain('structure-masseter-between-zygoma-and-gonion');
    const thin = { ...c, g: { ...g, mandible: { ...g.mandible, silhouette: { ...g.mandible.silhouette, outerHalf: g.mandible.silhouette.boneHalf - 5 } } } };
    expect(failed(structureAnatomyChecks(thin))).toEqual(expect.arrayContaining(['structure-silhouette-covers-bone', 'structure-jaw-width-decomposition']));
    const open = structureContext(generateRandomFace(5, { structure: { patch: { mouth: { open: 0.9 } } } }));
    const rigid = { ...open, mouth: { ...open.mouth, lowerLip: open.mouth.lowerLip.map((q, i, a) => ({ x: q.x, y: i < a.length / 2 ? (open.mouth.closure[i] as { y: number }).y + 10 : q.y })) } };
    expect(failed(structureAnatomyChecks(rigid))).toContain('structure-lower-lip-skinned-to-jaw');
  });

  it('style : un menton plus large que la mâchoire casse la relation essentielle', () => {
    const lm = c.lm;
    const bad = { ...lm, outline: { ...lm.outline, chinHalf: lm.jaw.gonion.x + 5 } };
    const rel = relationsOf(bad as never).find((r) => r.id === 'chin-narrower-than-jaw');
    expect(rel?.margin).toBeLessThan(0);
  });
});

describe('vérification de rendu sur l\'image (T14)', () => {
  it('silhouette, narine, côté éclairé, lèvres, encrage, modes, contours : tous mesurés sur les pixels', () => {
    const r = checkRenderImage({ seed: 321, patch: { anatomyEngine: 'structured', mouth: { open: 0.3 } }, label: '' } as never, 260, 320);
    expect(r.map((c) => c.layer).sort().filter((v, i, a) => a.indexOf(v) === i)).toEqual(['anatomy', 'geometry', 'style']);
    for (const c of r) expect(c.ok, `${c.id}: ${c.message} (${c.value.toFixed(2)} vs ${c.limit.toFixed(2)})`).toBe(true);
  }, 300_000);
});

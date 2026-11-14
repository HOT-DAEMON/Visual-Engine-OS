import { describe, expect, it } from 'vitest';
import { faceLandmarks, noseGeometry, noseArchetype } from '../src/face';
import { FaceParams } from '../src/schema';
import { underviewRelief } from '../src/relief/underview';
import { noseLitReliefChecks, noseLitStyleChecks, silhouetteOf, NOSE_LIT_LIMITS } from '../src/verify/nose-lit';
import { underviewReliefV1 } from './helpers-nose-underview-v1';

const noses = [['défaut', {}], ['pyramide', noseArchetype('pyramide' as never)], ['cloche-ailes', noseArchetype('cloche-ailes' as never)]] as const;
const geo = (patch: object) => { const p = FaceParams.parse({ anatomyEngine: 'structured', ...patch }); return noseGeometry(p, faceLandmarks(p, 300, 380)); };

describe('règles de vérification du rendu éclairé du nez (src/verify/nose-lit.ts)', () => {
  it('le moteur actuel passe toutes les règles de relief à 20°, 40° et 60° (3 nez)', () => {
    for (const [lab, patch] of noses) for (const pitch of [20, 40, 60]) {
      const bad = noseLitReliefChecks(underviewRelief(geo(patch), { pitchDeg: pitch }, 2), pitch).filter((c) => !c.ok);
      expect(bad.map((c) => `${lab} ${pitch}° ${c.id}=${c.value}`), 'règles en échec').toEqual([]);
    }
  }, 120_000);

  it('DÉTECTE le défaut « champignon » : la carte v1 (plaques + tige) échoue le col à 40° et la masse unique + le col à 60°', () => {
    for (const [lab, patch] of noses) for (const pitch of [40, 60]) {
      const failed = noseLitReliefChecks(underviewReliefV1(geo(patch), { pitchDeg: pitch }, 2), pitch).filter((c) => !c.ok).map((c) => c.id);
      // le col (tige) est détecté dès 40° ; la solidité (plaques séparées) l'est à 60° (à 40° le défaut v1 a une solidité de 0,78–0,80, au-dessus de la borne 0,75 : voir NOSE_LIT_LIMITS)
      expect(failed, `${lab} ${pitch}°`).toEqual(expect.arrayContaining(pitch === 60 ? ['nose-lit-single-mass', 'nose-lit-no-stalk'] : ['nose-lit-no-stalk']));
    }
  }, 120_000);

  it('le col sépare nettement les deux (marge ≥ 0,2 de chaque côté de la borne) et la solidité à 60° aussi', () => {
    for (const [, patch] of noses) {
      const n = silhouetteOf(underviewRelief(geo(patch), { pitchDeg: 40 }, 2)), o = silhouetteOf(underviewReliefV1(geo(patch), { pitchDeg: 40 }, 2));
      expect(n.neck - NOSE_LIT_LIMITS.neckMin).toBeGreaterThan(0.2);
      expect(NOSE_LIT_LIMITS.neckMin - o.neck).toBeGreaterThan(0.2);
      const n60 = silhouetteOf(underviewRelief(geo(patch), { pitchDeg: 60 }, 2)), o60 = silhouetteOf(underviewReliefV1(geo(patch), { pitchDeg: 60 }, 2));
      expect(n60.solidity - NOSE_LIT_LIMITS.solidityMin).toBeGreaterThan(0.1);
      expect(NOSE_LIT_LIMITS.solidityMin - o60.solidity).toBeGreaterThan(0.03);
    }
  }, 60_000);

  it('les règles de style signalent un aplat et une ombre qui noie le nez (rendus injectés)', () => {
    const r = underviewRelief(geo({}), { pitchDeg: 40 }, 2), N = r.grid.w * r.grid.h, flat = new Uint8ClampedArray(N * 4).fill(180), black = new Uint8ClampedArray(N * 4).fill(5);
    expect(noseLitStyleChecks({ ...r, rgba: flat }, 170).find((c) => c.id === 'nose-lit-not-flat')!.ok).toBe(false);
    expect(noseLitStyleChecks({ ...r, rgba: black }, 170).find((c) => c.id === 'nose-lit-shadow-not-black')!.ok).toBe(false);
  }, 30_000);
});

describe('mesures 03/05 branchées dans le moteur (src/face/nose/refs.generated.ts)', () => {
  it('le fichier généré reflète exactement les résumés des JSON (rien de recopié à la main)', async () => {
    const { readFileSync } = await import('node:fs'), { NOSE_REFS } = await import('../src/face/nose/refs.generated');
    for (const [k, f] of [['r03', 'measures-03.json'], ['r05', 'measures-05.json']] as const) expect(NOSE_REFS[k]).toEqual(JSON.parse(readFileSync(`references/nez/${f}`, 'utf8')).summary);
  });
  it('séparation des narines : le nez par défaut est DANS la plage de la réf. 03 (règle de style) ; le mauvais écart de l\'ancienne loi (0,300) est toujours DÉTECTÉ', async () => {
    const { noseSeparationCheck } = await import('../src/verify/nose-lit'), sep = (col: number) => {
      const p = FaceParams.parse({ anatomyEngine: 'structured', nose: { nostrils: { columella: col } } } as never), n = noseGeometry(p, faceLandmarks(p, 300, 380));
      const r = underviewRelief(n, { pitchDeg: 40 }, 2);
      return { ok: noseSeparationCheck(r, n.nostrils.right.c.x - n.nostrils.left.c.x, 2).ok, old: noseSeparationCheck(r, (0.300 / 0.432) * (n.nostrils.right.c.x - n.nostrils.left.c.x), 2).ok };
    };
    for (const col of [0, 0.5, 1]) expect(sep(col).ok, `columella ${col}`).toBe(true);
    expect(sep(0.5).old, 'contrôle négatif : l\'écart de l\'ancienne loi (0,300 / 0,432 de l\'écart actuel) doit rester hors plage').toBe(false);
  }, 30_000);
});

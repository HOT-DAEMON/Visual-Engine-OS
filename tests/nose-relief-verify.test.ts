import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { faceLandmarks, noseGeometry } from '../src/face';
import { noseRelief, noseTipHeight } from '../src/relief/nose';
import { checkNoseRelief, noseReliefChecks, verifyFace } from '../src/verify';

/** Vérification du relief du nez : passe sur de vrais visages ET détecte des défauts injectés (sinon la couche ne prouverait rien). */
const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 321];
const setup = (seed: number) => { const f = generateRandomFace(seed, {}), lm = faceLandmarks(f.params, f.width, f.height), nose = noseGeometry(f.params, lm); return { f, lm, nose, tipH: noseTipHeight(lm, nose), base: noseRelief(f.params, lm, nose, noseTipHeight(lm, nose)) }; };
const failed = (cs: { ok: boolean; id: string; severity: string }[]) => cs.filter((c) => !c.ok && c.severity === 'error').map((c) => c.id);

describe('vérification du relief du nez', () => {
  it('12 visages aléatoires : aucun contrôle ne tombe (géométrie, anatomie, style)', () => {
    for (const s of SEEDS) { const c = checkNoseRelief(setup(s).f); expect(c.length).toBe(7); expect(c.filter((k) => !k.ok), `seed ${s}`).toEqual([]); }
  });
  it('est branchée dans verifyFace (même rapport que les autres couches)', () => {
    const r = verifyFace(setup(7).f);
    for (const id of ['nose-relief-finite', 'nose-relief-edge-zero', 'nose-relief-slope', 'nose-peak-lower-half', 'nostril-below-tip', 'nose-relief-bounded', 'nose-relief-not-flat']) expect(r.checks.some((c) => c.id === id), id).toBe(true);
  });
  it('détecte une MARCHE dans le relief (le défaut de la ligne d\'ombre sous le nez)', () => {
    const { f, lm, nose, tipH, base } = setup(3);
    const stepped = (x: number, y: number): number => base(x, y) + (y > nose.baseY + 0.05 * lm.H ? 0.4 * tipH : 0);
    void f;
    expect(failed(noseReliefChecks(stepped, lm, nose))).toContain('nose-relief-edge-zero');
    // Une marche franche (1,5 × la projection) dépasse en plus la pente maximale ; une marche de 0,4 n'est vue que par le contrôle de bord (résolution de la grille).
    const cliff = (x: number, y: number): number => base(x, y) + (y > nose.baseY + 0.05 * lm.H ? 1.5 * tipH : 0);
    expect(failed(noseReliefChecks(cliff, lm, nose))).toContain('nose-relief-slope');
  });
  it('détecte une valeur non finie, un nez plat, un nez qui culmine à la racine et une narine plus haute que la pointe', () => {
    const { lm, nose, tipH, base } = setup(3);
    expect(failed(noseReliefChecks((x, y) => (Math.abs(x) < 1 && Math.abs(y - nose.tip.c.y) < 1 ? NaN : base(x, y)), lm, nose))).toContain('nose-relief-finite');
    expect(noseReliefChecks((x, y) => base(x, y) * 0.1, lm, nose).find((c) => c.id === 'nose-relief-not-flat')!.ok).toBe(false);
    expect(failed(noseReliefChecks((x, y) => base(x, y) + 3 * tipH * Math.exp(-0.5 * ((x / 12) ** 2 + ((y - nose.root.y) / 8) ** 2)), lm, nose))).toContain('nose-peak-lower-half');
    const nl = nose.nostrils.left;
    expect(failed(noseReliefChecks((x, y) => base(x, y) + 4 * tipH * Math.exp(-0.5 * (((x - nl.c.x) / 3) ** 2 + ((y - nl.c.y) / 3) ** 2)), lm, nose))).toContain('nostril-below-tip');
  });
});

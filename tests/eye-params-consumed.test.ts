import { describe, expect, it } from 'vitest';
import { SWEEPS, sweepResult } from '../scripts/lib/eye-param-sweeps';

/**
 * Chaque paramètre exposé par l'œil (parents : shape/canthi ; enfants : iris/pupille/reflets/cils ; frères : sourcil/regard/expression) doit CHANGER les pixels
 * rendus quand on le fait varier de sa valeur basse à sa valeur haute (rastérisation réelle, pas seulement la géométrie). Seuil par défaut : 150 pixels.
 */
describe('consommation visible des paramètres de l’œil (rendu resvg)', () => {
  for (const s of SWEEPS) {
    it(`${s.path} : ${String(s.lo)} -> ${String(s.hi)} modifie ${s.region}`, () => {
      const { changed } = sweepResult(s);
      expect(changed).toBeGreaterThanOrEqual(s.minPixels ?? 150);
    }, 20000);
  }
});

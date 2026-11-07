import { describe, expect, it } from 'vitest';
import { CASES, measure, schemaLeaves } from '../scripts/lib/neck-cases';

/**
 * PREUVE DE VISIBILITÉ (exigence : « chaque fonctionnalité doit avoir une preuve visuelle », jamais une collection de fonctionnalités théoriques).
 * Chaque paramètre du schéma `NeckSystem` est changé SEUL, avec une valeur forte, et doit produire un écart MESURÉ : ≥ 0,6 % des pixels de la boîte du cou différents
 * de face, OU ≥ 1 % de H sur la silhouette de face, OU ≥ 1 % de H sur le profil. La vue qui le prouve est consignée dans docs/NECK-PROOF.md.
 */
const covered = (leaf: string): boolean => CASES.some((c) => c.id === leaf || leaf.startsWith(`${c.id}.`) || leaf.startsWith(`${c.id}[`) || c.id.startsWith(`${leaf}.`));

describe('cou — preuve visuelle par paramètre', () => {
  it('chaque feuille du schéma NeckSystem est couverte par un cas (aucun paramètre sans preuve)', () => {
    const missing = schemaLeaves().filter((l) => !covered(l));
    expect(missing).toEqual([]);
  });

  for (const c of CASES) {
    it(`${c.id} — ${c.label} : écart mesuré`, () => {
      const m = measure(c.base ?? {}, c.patch, c.yaw ?? 0);
      expect(m.view, `${c.id}: pixels=${(100 * m.pixels).toFixed(2)} % · face=${(100 * m.front).toFixed(2)} % · profil=${(100 * m.profile).toFixed(2)} %`).not.toBe('aucune');
    }, 20000);
  }
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { holdout } from '../scripts/eye-refs/almond-holdout';

/** Validation hors échantillon de l'almond (passe 9) : réfs 03 et 05 tracées par `extract.py`, JAMAIS utilisées par `fit-almond.ts` (04, 07, 11). Les bornes consignent l'état mesuré : une dérive de l'enveloppe les franchit. */
describe('almond : validation hors échantillon sur les réfs 03 et 05', () => {
  const H = holdout(['04', '07', '11', '03', '05']);
  it('les mesures de 03 et 05 existent et les 5 anciennes sont inchangées (les yeux ajoutés ne déplacent pas l’ajustement)', () => {
    const M = JSON.parse(readFileSync('references/eyes/measures.json', 'utf8')).eyes as Record<string, { aspect: number }>;
    for (const k of ['04', '10a', '10b', '07', '11', '03', '05']) expect(M[k]).toBeDefined();
    expect(M['04']!.aspect).toBeCloseTo(0.5466, 3); expect(M['07']!.aspect).toBeCloseTo(0.5452, 3); expect(M['11']!.aspect).toBeCloseTo(0.4729, 3);
  });
  it('contrat de hauteur : l’aspect obtenu est l’aspect demandé (|écart| < 0,01) sur les 5 yeux, entraînés ou non', () => {
    for (const v of Object.values(H)) expect(Math.abs(v.dAspect!)).toBeLessThan(0.01);
  });
  it('paupière haute : l’almond généralise (RMS hors échantillon ≤ 0,04, 0,033 pour 03 et 0,018 pour 05 ; entraînés 0,007–0,024)', () => {
    for (const k of ['03', '05']) expect(H[k]!.rmsUp).toBeLessThanOrEqual(0.04);
  });
  it('paupière basse : écart CONSIGNÉ, pas masqué (0,051 pour 03 et 0,058 pour 05 contre 0,013–0,033 sur les entraînés) ; borne 0,065, et strictement pire que l’entraînement', () => {
    for (const k of ['03', '05']) { expect(H[k]!.rmsLo).toBeLessThanOrEqual(0.065); expect(H[k]!.rmsLo).toBeGreaterThan(Math.max(H['04']!.rmsLo!, H['07']!.rmsLo!, H['11']!.rmsLo!)); }
  });
  it('les sommets de la paupière basse mesurés varient de 0,40 à 0,65 d’un œil à l’autre : l’almond (0,55–0,65) ne peut pas les suivre sans paramètre exposé (cause du reste à faire)', () => {
    const ref = ['04', '07', '11', '03', '05'].map((k) => H[k]!.lowerPeakRef!);
    expect(Math.max(...ref) - Math.min(...ref)).toBeGreaterThanOrEqual(0.2);
  });
});

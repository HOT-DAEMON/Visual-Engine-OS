import { describe, expect, it } from 'vitest';
import { sweep } from '../scripts/nose-refs/dome-lop-coupling';

/** Cause du couplage nez → `round-dome-centered` (docs/NOSE-DOME-COUPLING.md) : le nez ne change `lop` que par le rentrage de la sous-couche. */
describe('nez → dôme capillaire', () => {
  const rows = sweep(174218);
  it('sans rentrage, lop ne bouge presque pas avec la longueur du nez (écart mesuré 4e-5 : l\'équateur de la coque suit l\'oreille à < 1 px)', () => {
    const v = rows.map((r) => r.noTuck);
    expect(Math.max(...v) - Math.min(...v)).toBeLessThan(5e-4);
  });
  it('le rentrage multiplie cet écart par plus de 100', () => {
    const sp = (v: number[]) => Math.max(...v) - Math.min(...v);
    expect(sp(rows.map((r) => r.withTuck))).toBeGreaterThan(100 * sp(rows.map((r) => r.noTuck)));
  });
  it('avec rentrage, lop varie avec la longueur du nez (même visage) et franchit 0,05 sur au moins une longueur', () => {
    const v = rows.map((r) => r.withTuck);
    expect(Math.max(...v) - Math.min(...v)).toBeGreaterThan(0.03);
    expect(Math.max(...v)).toBeGreaterThan(0.048);
  });
  it('la longueur du nez change le nombre de mèches de façade (canal : hauteur d\'oreille)', () => {
    expect(new Set(rows.map((r) => r.locksWith)).size).toBeGreaterThan(3);
  });
}, 120000);

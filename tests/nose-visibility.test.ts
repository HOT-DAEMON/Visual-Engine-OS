import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { diffShots, headShot } from '../scripts/nose-audit/visibility-lib';

/**
 * Preuve de visibilité des paramètres du nez (docs/NOSE-VISIBILITY-AUDIT.md) : sur une tête de 600 px de large (peau seule), pousser UN axe de son bas à son haut
 * doit changer un nombre mesurable de pixels. Les planchers sont 60 % des valeurs MESURÉES sur la graine 77 (la graine 11 répond moins : voir §Dispersion de la doc), pas des seuils choisis pour passer.
 */
const px = (path: string, lo: unknown, hi: unknown, engine: 'structured' | 'classic' = 'structured'): number =>
  diffShots(headShot(77, engine, { [path]: lo }), headShot(77, engine, { [path]: hi })).zonePixels;

describe('nez : chaque axe renforcé produit une différence mesurable sur tête complète', () => {
  it.each([
    ['philtrum.depth', 0.1, 0.9, 300], ['philtrum.width', 0.1, 0.9, 130], ['domes.prominence', 0.1, 0.9, 220], ['groove.depth', 0.1, 0.9, 350],
    ['base.depth', 0.1, 0.9, 220], ['sidewall.concavity', 0.1, 0.9, 600], ['alae.flare', 0.1, 0.9, 1000],
  ] as const)('%s : %d → %d change ≥ %d px', (path, lo, hi, floor) => {
    expect(px(path, lo, hi)).toBeGreaterThanOrEqual(floor);
  }, 60_000);

  it('le moteur classic ignore les axes de région (comportement documenté, pas un oubli)', () => {
    expect(px('philtrum.depth', 0.1, 0.9, 'classic')).toBe(0);
  }, 60_000);

  it('garde-fou du pivot : au défaut, le SVG est identique octet pour octet à celui d\'avant le renforcement', () => {
    const h = createHash('sha256').update(headShot(11, 'structured', {}).svg).digest('hex');
    expect(h).toBe('d4f1ee64b40f0cc1c4c039c2a86db42bb354b22445dbc724834d924a8a6991d0');
  }, 60_000);
});

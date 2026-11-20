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
    // PASSE 10 (yeux) : hash recalé — le contrat de hauteur s'applique désormais aux yeux GAUCHES sharp / drooping (docs/EYES-PASS-10.md § 1). Vérifié : avec l'ancien height-contract.ts
    // le hash d'avant (d4f1ee64…91d0) est retrouvé exactement ; l'axe du nez n'y est pour rien.
    expect(h).toBe('995eb7f48600ab5f75685c5213332c19af620dbf3f42608649c190e78fcf5c74');
  }, 60_000);
});

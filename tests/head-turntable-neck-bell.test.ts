import { describe, expect, it } from 'vitest';
import { variedHead } from '../src/head-turntable/engines/from-face';
import { neckSection, SHOULDER } from '../src/head-turntable/engines/neck3d';
import { smooth } from '../src/head-turntable/math';
import { REF_SPEC } from '../src/head-turntable';

/** Jonction cou → trapèzes en cloche (docs/HEAD-TURNTABLE-NECK-BELL.md). Profil mesuré sur references/rotation-3d/07.jpg (vue de dos). */
describe('cou en cloche vers les trapèzes', () => {
  // Largeur normalisée de la silhouette mesurée (cellule de dos de 07.jpg, lignes 120 → 176 par pas de 8 px, cou le plus étroit = 0, coupe = 1).
  const MEASURED = [0, 0.05, 0.19, 0.41, 0.63, 0.82, 0.97, 1];
  it('la courbe mesurée suit la loi du moteur (smooth) à 0,05 près', () => {
    MEASURED.forEach((m, i) => expect(Math.abs(m - smooth(i / 7))).toBeLessThan(0.05));
  });
  it('40 graines : rapport coupe / sous-crâne dans [1,6 ; 2,4], largeur croissante vers le bas, profondeur moins amplifiée que la largeur', () => {
    for (let s = 1; s <= 40; s++) {
      const h = variedHead(s), n = h.spec.neck, e = h.spec.engine!, top = neckSection(e, n.y0, n.y1), bot = neckSection(e, n.y1, n.y1);
      const R = bot.a / top.a, K = bot.b / top.b;
      expect(R).toBeGreaterThan(1.6); expect(R).toBeLessThan(2.4);
      expect(K).toBeLessThan(R);
      for (let y = n.y0 + 0.01; y <= n.y1; y += 0.01) expect(neckSection(e, y, n.y1).a).toBeGreaterThanOrEqual(neckSection(e, y - 0.01, n.y1).a - 1e-9);
    }
  });
  it('l\'évasement commence à y1 − len et pas avant : le haut du cou reste un cou', () => {
    const h = variedHead(3), n = h.spec.neck, e = h.spec.engine!, a0 = neckSection(e, n.y0, n.y1).a;
    expect(neckSection(e, n.y1 - SHOULDER.len - 0.001, n.y1).a).toBeCloseTo(a0, 3);
  });
  it('la planche de référence garde son évasement mesuré de 10 % (inchangée)', () => {
    const e = REF_SPEC.engine!, y1 = REF_SPEC.neck.y1;
    expect(neckSection(e, y1, y1).a / neckSection(e, y1 - 0.2, y1).a).toBeCloseTo(1.1, 2);
  });
});

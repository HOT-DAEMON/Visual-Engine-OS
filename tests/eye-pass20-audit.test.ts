import { describe, expect, it } from 'vitest';
import { auditEyeParams, EXEMPT } from '../scripts/lib/eye-param-audit';

/**
 * PASSE 20 — aucun paramètre orphelin sur l'œil. Pour chacune des 268 feuilles du schéma `EyeSpec`, au moins un contexte (ou un paramètre voisin allumé) fait CHANGER le SVG compilé.
 * Avant la passe : 6 orphelins (`appearance.opacity`, `reflection.intensity`, `reflection.size`, `shading.mode`, `shading.castShadow`, `shading.highlightBand`).
 * Un paramètre ajouté demain au schéma sans être lu par le rendu fait échouer ce test : il faut le brancher (ou le justifier dans `EXEMPT`).
 */
describe('audit des paramètres orphelins de l’œil', () => {
  const report = auditEyeParams();
  it('couvre toutes les feuilles du schéma (≥ 268) et rend un verdict pour chacune', () => {
    expect(report.leaves).toBeGreaterThanOrEqual(268);
    expect(Object.keys(report.verdict)).toHaveLength(report.leaves);
  });
  it('0 paramètre orphelin', () => { expect(report.orphans).toEqual([]); });
  it('les seules exemptions sont l’identifiant et la pose sur hôte (documentées)', () => {
    const exempt = Object.entries(report.verdict).filter(([, v]) => v === 'exempt').map(([k]) => k).sort();
    expect(exempt).toEqual(Object.keys(EXEMPT).sort());
  });
  it('les paramètres conditionnels sont rattachés à leur interrupteur (preuve de la dépendance)', () => {
    expect(report.gatedBy['iris.detail.facets.shard']).toBeUndefined();   // allumé par une galerie qui a déjà des facettes taillées
    expect(report.gatedBy['appearance.glow.radius']).toBe('appearance.glow.intensity=1');
    expect(report.gatedBy['appearance.texture.scale']).toBe('appearance.texture.kind=grain');
  });
}, 300000);

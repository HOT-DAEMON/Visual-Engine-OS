import { describe, expect, it } from 'vitest';
import { cellSvg } from '../scripts/lib/board';

/** Rendus : le moteur `structured` ajoute des calques, le moteur `classic` est inchangé, les modes de rendu changent le traitement. */
const svgOf = (patch: Record<string, unknown>): string => cellSvg({ seed: 321, patch, focus: 'lower', label: '' }, 300, 380).svg;

describe('rendu du moteur de structure', () => {
  const classic = svgOf({});
  const neutral = svgOf({ mandible: {}, softTissue: {}, cheek: {}, stylization: {}, renderMode: 'realistic' });

  it('les nouveaux champs à leur valeur neutre ne changent pas un octet du rendu classique', () => {
    expect(neutral).toBe(classic);
  });

  it('`structured` ajoute des calques (le SVG change et grossit)', () => {
    const s = svgOf({ anatomyEngine: 'structured' });
    expect(s).not.toBe(classic);
    expect(s.length).toBeGreaterThan(classic.length);
  });

  it('chaque famille de calque réagit à son contrat', () => {
    const base = svgOf({ anatomyEngine: 'structured' });
    for (const patch of [{ cheek: { hollow: 1 } }, { softTissue: { masseter: { volume: 1, relief: 1 } } }, { chin: { dimple: 1 } }, { nose: { groove: { depth: 1 } } }, { neck: { thickness: 1 } }, { mouth: { open: 0.8 } }]) {
      expect(svgOf({ anatomyEngine: 'structured', ...patch }), JSON.stringify(patch)).not.toBe(base);
    }
  });

  it('le rendu est déterministe', () => {
    expect(svgOf({ anatomyEngine: 'structured', deform: { expression: { smile: 1 } } })).toBe(svgOf({ anatomyEngine: 'structured', deform: { expression: { smile: 1 } } }));
  });

  it('l\'encrage ajoute un filtre (niveaux de gris + seuil) ; les autres modes n\'en ont pas', () => {
    expect(svgOf({ anatomyEngine: 'structured', renderMode: 'ink' })).toContain('feComponentTransfer');
    expect(svgOf({ anatomyEngine: 'structured', renderMode: 'anime' })).not.toContain('feComponentTransfer');
    expect(svgOf({ anatomyEngine: 'structured' })).not.toContain('feComponentTransfer');
  });

  it('les contours dessinés n\'apparaissent que si on les demande', () => {
    const none = svgOf({ anatomyEngine: 'structured' });
    const lines = svgOf({ anatomyEngine: 'structured', stylization: { outline: 1 } });
    expect((lines.match(/stroke="#15101a"/g) ?? []).length).toBeGreaterThan(5);
    expect(none).not.toContain('#15101a');
  });
});

import { describe, expect, it } from 'vitest';
import { verifyEye } from '../src/verify/eye';
import { checkEyeAppearance } from '../src/verify/eye-appearance';
import { EyeSpec } from '../src/schema';

/** PASSE 20 — couche de vérification des leviers d'apparence : géométrie (bande hors pupille), anatomie (opacité lisible, reflets bornés), style (levier visible à la taille de rendu). */
const eye = (ap?: Record<string, unknown>, extra: Record<string, unknown> = {}): Record<string, unknown> => ({ kind: 'eye', id: 'e', shape: { width: 240, height: 130 }, ...extra, ...(ap ? { appearance: ap } : {}) });
const ids = (input: Record<string, unknown>): string[] => verifyEye(input).checks.map((c) => c.id);
const find = (input: Record<string, unknown>, id: string) => verifyEye(input).checks.find((c) => c.id === id);

describe('vérification des leviers d’apparence', () => {
  it('silencieuse pour un œil sans apparence ou à leviers neutres (aucun contrôle ajouté)', () => {
    for (const e of [eye(), eye({}), eye({ reflection: { intensity: 0.5, size: 0.5 } })]) expect(ids(e).filter((i) => /band|cast-shadow|opacity-readable|reflection-(scale|visible)/.test(i))).toEqual([]);
  });
  it('bande de lumière : visible et hors de la pupille à taille normale ; l’œil reste valide', () => {
    const r = verifyEye(eye({ shading: { highlightBand: 0.5 } }));
    expect(r.ok).toBe(true);
    expect(find(eye({ shading: { highlightBand: 0.5 } }), 'band-visible')?.ok).toBe(true);
    expect(find(eye({ shading: { highlightBand: 0.5 } }), 'band-clear-of-pupil')?.ok).toBe(true);
  });
  it('bande trop large pour une grande pupille : signalée (avertissement, jamais erreur)', () => {
    const e = eye({ shading: { highlightBand: 1 } }, { pupil: { size: 0.7 } });
    const c = find(e, 'band-clear-of-pupil'); expect(c?.ok).toBe(false); expect(c?.severity).toBe('warn'); expect(verifyEye(e).ok).toBe(true);
  });
  it('un œil minuscule rend la bande et l’ombre invisibles : paramètres orphelins signalés au LOD courant', () => {
    const tiny = eye({ shading: { highlightBand: 0.2, castShadow: 0.1 } }, { shape: { width: 24, height: 10 } });
    expect(find(tiny, 'band-visible')?.ok).toBe(false); expect(find(tiny, 'cast-shadow-visible')?.ok).toBe(false);
  });
  it('opacité presque nulle : œil illisible (anatomie, avertissement) ; reflets trop agrandis : borné', () => {
    expect(find(eye({ opacity: 0.1 }), 'eye-opacity-readable')?.ok).toBe(false);
    expect(find(eye({ opacity: 0.6 }), 'eye-opacity-readable')?.ok).toBe(true);
    expect(find(eye({ reflection: { size: 1 } }), 'reflection-scale-bounded')?.ok).toBe(true);   // 0,6 + 0,8 = 1,4 : la borne
  });
  it('le module lit l’œil BRUT : un œil `flat` (appearance mise à null à la résolution) est quand même vérifié', () => {
    const raw = EyeSpec.parse(eye({ shading: { highlightBand: 0.6 } }, { finish: 'flat' }));
    expect(checkEyeAppearance(raw, 40, 60, 1).map((c) => c.id)).toContain('band-visible');
    expect(find(eye({ shading: { highlightBand: 0.6 } }, { finish: 'flat' }), 'band-visible')).toBeDefined();
  });
});

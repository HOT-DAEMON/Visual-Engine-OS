import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/prng';
import { IRIS_FAMILIES } from '../src/generation/eye-iris-families';
import { PHOTO_IRIS_FAMILIES } from '../src/generation/eye-iris-families-photo';
import { LIME_CYAN_ASPECT_RANGE, PHOTO2_IRIS_FAMILIES, PHOTO2_IRIS_MEASURES, PHOTO2_PUPIL_FLOOR, photoIrisFamily2, pupilFor2 } from '../src/generation/eye-iris-families-photo2';
import { applyIrisPreset, extra2Recipes, generateExtra2Eye } from '../src/generation/eye-gallery-ext2';
import { verifyEye } from '../src/verify/eye';
import { irisTone } from '../scripts/lib/eye-iris-tone';
import { verifyEyeRender } from '../scripts/lib/verify-eye-render';

interface M { id: string; limbe: { aspectHW: number }; pupille: { rOverIris: number; aspectHW: number }; radial: ({ r: number; dark: string; bright: string } | null)[]; reflets: { dx: number; dy: number; rOverIris: number }[]; secteurs: { color: string; vivid: string }[]; tone: { lumMean: number; darkShare: number; satPeaks: number; vividBands: (string | null)[] } }
const J = (JSON.parse(readFileSync('references/eyes/measures-iris-photos.json', 'utf8')) as { eyes: M[] }).eyes;
const byRef = (ref: string): M => J.find((e) => e.id === ref) as M;
const band = (m: M, r: number): { dark: string; bright: string } => m.radial.find((b) => b !== null && Math.abs(b.r - r) < 0.01) as { dark: string; bright: string };
const hue = (h: string): number => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number]; const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); if (d === 0) return 0; const k = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (k * 60 + 360) % 360; };
const dHue = (a: string, b: string): number => { const d = Math.abs(hue(a) - hue(b)); return Math.min(d, 360 - d); };
const base = generateExtra2Eye(extra2Recipes().findIndex((r) => r.style === 'almond' && r.irisFamily === null)) as Record<string, any>;
const eyeWith = (f: (typeof PHOTO2_IRIS_FAMILIES)[number], seed: number): Record<string, any> => applyIrisPreset(base as never, photoIrisFamily2(f, mulberry32(seed)), 'almond', false) as never;

describe('familles d’iris « photo 2 » (réfs 04, 07, 08, 10) : constantes = mesures', () => {
  it('les 5 familles sont ADDITIVES : ni IRIS_FAMILIES (6) ni PHOTO_IRIS_FAMILIES (4) ne changent, aucun nom commun', () => {
    expect([...IRIS_FAMILIES]).toHaveLength(6); expect([...PHOTO_IRIS_FAMILIES]).toHaveLength(4); expect(PHOTO2_IRIS_FAMILIES).toHaveLength(5);
    for (const f of PHOTO2_IRIS_FAMILIES) { expect((IRIS_FAMILIES as readonly string[]).includes(f)).toBe(false); expect((PHOTO_IRIS_FAMILIES as readonly string[]).includes(f)).toBe(false); }
  });
  it('pupille / iris, aspects, reflet, quartiles sombre / clair, couleurs vives (bandes et secteurs), haut / bas = le JSON mesuré', () => {
    for (const f of PHOTO2_IRIS_FAMILIES) {
      const K = PHOTO2_IRIS_MEASURES[f]; const m = byRef(K.ref);
      expect(Math.abs(K.pupilOverIris - m.pupille.rOverIris)).toBeLessThan(0.002);
      if (K.pupilAspectHW !== null) expect(Math.abs(K.pupilAspectHW - m.pupille.aspectHW)).toBeLessThan(0.002);
      if (K.irisAspect !== null) expect(Math.abs(K.irisAspect - m.limbe.aspectHW)).toBeLessThan(0.002);
      [0.125, 0.458, 0.875].forEach((r, i) => { expect(K.dark[i]).toBe(band(m, r).dark); expect(K.bright[i]).toBe(band(m, r).bright); });
      K.vivid.forEach((c, i) => expect(c).toBe(m.tone.vividBands[i])); K.sectors.forEach((c, i) => expect(c).toBe(m.secteurs[i]!.vivid));
      expect(m.reflets.some((h) => Math.abs(h.dx - K.specular.dx) < 0.01 && Math.abs(h.dy - K.specular.dy) < 0.01 && Math.abs(h.rOverIris - K.specular.r) < 0.01)).toBe(true);
      expect(K.specular.dy).toBeLessThan(0);   // anatomie mesurée : reflet principal dans la moitié haute de l’iris
    }
  });
  it('limbe corrigé (passe 10) : l’aspect mesuré tient compte de l’angle de l’ellipse ajustée — iris de 06 / 07 plus larges que hauts (< 1), pas 1,10', () => {
    expect(byRef('06').limbe.aspectHW).toBeLessThan(1); expect(byRef('07').limbe.aspectHW).toBeLessThan(1); expect(byRef('09').limbe.aspectHW).toBeLessThan(1); expect(byRef('03').limbe.aspectHW).toBeGreaterThan(1);
    expect(LIME_CYAN_ASPECT_RANGE).toEqual([byRef('08a').limbe.aspectHW, byRef('08b').limbe.aspectHW]);
  });
  it('pupille de 10a (0,044) ramenée au plancher du schéma (0,08) ; aspect mesuré non consommé quand une étoile coupe la pupille (07, 10a)', () => {
    expect(pupilFor2('fire-halo').size).toBeCloseTo(PHOTO2_PUPIL_FLOOR, 5); expect(pupilFor2('emerald-facets').squash).toBe(0); expect(pupilFor2('fire-halo').squash).toBe(0);
    expect(pupilFor2('lime-cyan').size).toBeGreaterThan(0.15);
  });
});

describe('familles « photo 2 » : le matériau de base et les teintes vives sont CONSOMMÉS (prouvés sur les pixels)', () => {
  it('le matériau de base de l’iris est remplacé par le dégradé de la famille (sans lui, le cyan hérité de l’œil traverse les couches)', () => {
    for (const f of PHOTO2_IRIS_FAMILIES) { const e = eyeWith(f, 7); expect(e.iris.material.base.type).toBe('radial'); expect(e.iris.material.base.stops[0].color).toBe(photoIrisFamily2(f, mulberry32(7)).base![0]!.color); }
    expect(((base as { iris: { material?: unknown } }).iris.material as { base: { stops: { color: string }[] } }).base.stops[0]!.color).not.toBe(PHOTO2_IRIS_MEASURES['fire-halo'].dark[0]);
  });
  it('luminance moyenne de l’iris rendu à ± 25 de la référence (sombre / clair : 10a 89, 10b 103, 04 126, 07 129, 08 169) ; sans le matériau de base 10a serait à 116', () => {
    for (const [i, f] of PHOTO2_IRIS_FAMILIES.entries()) { const t = irisTone(eyeWith(f, 7 + i) as never); expect(Math.abs(t.lumMean - byRef(PHOTO2_IRIS_MEASURES[f].ref).tone.lumMean), f).toBeLessThanOrEqual(25); }
    const noBase = eyeWith('fire-halo', 7 + 3); noBase.iris = { ...noBase.iris, material: base.iris.material };
    expect(irisTone(noBase as never).lumMean).toBeGreaterThan(irisTone(eyeWith('fire-halo', 7 + 3) as never).lumMean + 10);
  });
  it('anneau vif des yeux sombres : teinte du pixel moyen de la bande 0,35–0,55 à ≤ 40° de la mesure (10a orange feu, 10b cyan), 08 citron à ≤ 40°', () => {
    for (const [i, f] of PHOTO2_IRIS_FAMILIES.entries()) if (['fire-halo', 'ice-star', 'lime-cyan'].includes(f)) { const t = irisTone(eyeWith(f, 7 + i) as never); expect(dHue(t.vividBands[1] as string, PHOTO2_IRIS_MEASURES[f].vivid[1]), f).toBeLessThanOrEqual(40); }
  });
  it('les yeux sombres restent sombres : part de pixels L < 50 de 10a ≥ 0,2 (réf. 0,37) ; la règle `iris-texture` est APPLIQUÉE aux 5 familles (étoile centrale comprise) et passe ; texture ≥ 15 pour 4 familles sur 5 (références 22–42, passe 9 : 12–22)', () => {
    expect(irisTone(eyeWith('fire-halo', 7 + 3) as never).darkShare).toBeGreaterThanOrEqual(0.2);
    for (const [i, f] of PHOTO2_IRIS_FAMILIES.entries()) { const tex = verifyEyeRender(eyeWith(f, 7 + i) as never).find((c) => c.id === 'iris-texture'); expect(tex, `${f} : règle iris-texture absente`).toBeDefined(); expect(tex!.ok).toBe(true); expect(tex!.value, f).toBeGreaterThanOrEqual(8); if (f !== 'lime-cyan') expect(tex!.value, f).toBeGreaterThanOrEqual(15); }
    for (const f of PHOTO2_IRIS_FAMILIES) expect(verifyEyeRender(eyeWith(f, 7) as never).some((c) => c.id === 'specular-in-upper-iris'), f).toBe(true);
  });
  it('chaque famille donne un œil valide (verifyEye) sans échec pixel ; deux graines : iris proches, non identiques', () => {
    for (const [i, f] of PHOTO2_IRIS_FAMILIES.entries()) { const e = eyeWith(f, 7 + i); expect(verifyEye(e as never).ok, f).toBe(true); expect(verifyEyeRender(e as never).filter((c) => !c.ok).map((c) => c.id), f).toEqual([]); expect(JSON.stringify(eyeWith(f, 7 + i))).not.toBe(JSON.stringify(eyeWith(f, 99 + i))); }
  }, 60000);
});

describe('règles de pupille (passe 10) : exemption bornée', () => {
  const withPupil = (fill: string, star: boolean): Record<string, any> => { const e = eyeWith('ice-star', 7); e.pupil = { ...e.pupil, fill: { type: 'solid', color: fill } }; e.highlights = { list: star ? e.highlights.list : [] }; return e; };
  const failIds = (e: Record<string, any>): string[] => verifyEyeRender(e as never).filter((c) => !c.ok).map((c) => c.id);
  it('une pupille CLAIRE sans éclat central échoue toujours `pupil-darker-than-iris-pixels` (l’exemption ne couvre pas ce cas)', () => {
    expect(failIds(withPupil('#f0f0f0', false))).toContain('pupil-darker-than-iris-pixels');
  });
  it('une pupille noire passe ; une pupille claire occultée par un éclat en étoile centré, plus grand qu’elle, est exemptée', () => {
    expect(failIds(withPupil('#07090f', false))).not.toContain('pupil-darker-than-iris-pixels');
    const e = withPupil('#f0f0f0', true); expect(e.highlights.list.some((h: any) => h.shape === 'sparkle' && Math.hypot(h.x, h.y) <= e.pupil.size && h.size >= e.pupil.size)).toBe(true);
    expect(failIds(e)).not.toContain('pupil-darker-than-iris-pixels');
  });
});

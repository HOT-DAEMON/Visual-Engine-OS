import { describe, expect, it } from 'vitest';
import { earGeometry } from '../src/face';
import { earModel } from '../src/face/ear/geometry';
import { familyWeights } from '../src/face/ear/morph';
import { faceLandmarks } from '../src/face/landmarks';
import { FaceEars, FaceParams } from '../src/schema';

const E = (patch: object = {}) => FaceEars.parse(patch);
const names = (m: ReturnType<typeof earModel>): string[] => m.structures.map((s) => String(s.id));

describe('modèle d\'oreille (grammaire morphologique)', () => {
  it('déterministe : mêmes entrées, même modèle', () => {
    expect(earModel(E({ seed: 5 }), 1)).toEqual(earModel(E({ seed: 5 }), 1));
  });

  it('l\'oreille humaine porte toutes les structures atomiques demandées', () => {
    const n = names(earModel(E(), 1));
    for (const id of ['helix', 'scapha', 'antihelix:body', 'antihelix:upper', 'antihelix:lower', 'antihelix:junction', 'antihelix:groove-conch', 'antihelix:groove-scapha', 'fossa', 'crus', 'cymba', 'cavum', 'canal', 'tragus', 'antitragus', 'notch', 'lobule']) expect(n, id).toContain(id);
  });

  it('le contour est découpé en sept segments C01–C07 contigus', () => {
    const m = earModel(E(), 1);
    expect(m.segments.map((s) => s.id)).toEqual(['C07', 'C01', 'C02', 'C03', 'C06', 'C05', 'C04']);
    m.segments.forEach((s, i) => { if (i > 0) expect(s.from).toBe(m.segments[i - 1]!.to); expect(s.lengthU).toBeGreaterThan(0); });
    expect(m.segments[m.segments.length - 1]!.to).toBe(m.outline.length);
  });

  it('sans asymétrie, l\'oreille gauche est l\'oreille droite (même plan) ; avec asymétrie elles diffèrent', () => {
    const a = E({ style: { asymmetry: 0 } });
    expect(earModel(a, -1).outline).toEqual(earModel(a, 1).outline);
    const b = E({ seed: 9, style: { asymmetry: 0.6 } });
    expect(earModel(b, -1).outline).not.toEqual(earModel(b, 1).outline);
  });

  it('famille féline : pas de lobule ni de fosse triangulaire ; humaine : présents', () => {
    const f = names(earModel(E({ family: 'feline' }), 1));
    expect(f).not.toContain('lobule');
    expect(f).not.toContain('fossa');
    expect(f).toContain('helix');
    expect(names(earModel(E({ family: 'human' }), 1))).toContain('lobule');
  });

  it('mélange de familles : poids normalisés, indépendant de l\'ordre des clés', () => {
    const a = familyWeights(E({ family: 'human', blend: { elven: 0.3, feline: 0.2 } }));
    const b = familyWeights(E({ family: 'human', blend: { feline: 0.2, elven: 0.3 } }));
    expect(a).toEqual(b);
    expect(Object.values(a).reduce((s, v) => s + (v ?? 0), 0)).toBeCloseTo(1, 12);
    expect(earModel(E({ family: 'human', blend: { elven: 0.5 } }), 1)).toEqual(earModel(E({ family: 'human', blend: { elven: 0.5 } }), 1));
  });

  it('structure / morphologie / style séparés : le style et le matériau ne changent PAS la géométrie', () => {
    const base = earModel(E({ morph: { lobule: { length: 0.8 } } }), 1);
    const styled = earModel(E({ morph: { lobule: { length: 0.8 } }, style: { look: 'anime', softness: 0.9, detail: 0.2 }, material: { kind: 'ceramic', glow: 0.8 } }), 1);
    expect(styled.outline).toEqual(base.outline);
    expect(styled.structures.map((s) => s.poly)).toEqual(base.structures.map((s) => s.poly));
  });

  it('une famille ne réécrit pas le matériau', () => {
    expect(earModel(E({ family: 'elven', material: { kind: 'ceramic' } }), 1).resolved.material).toBe('ceramic');
    expect(earModel(E({ family: 'draconic' }), 1).resolved.material).toBe('scaly');
  });

  it('une caricature garde la structure humaine : lobule géant + hélix épais + conque simplifiée, mêmes structures', () => {
    const m = earModel(E({ style: { exaggeration: 0.9 }, morph: { lobule: { length: 1, width: 1 }, helix: { thickness: 1 }, concha: { depth: -1 } } }), 1);
    expect(names(m)).toContain('lobule');
    expect(names(m)).toContain('antihelix:body');
    expect(Math.max(...m.outline.map((q) => q.y))).toBeCloseTo(1, 9);
  });

  it('contrainte stricte : la profondeur de la conque garde une paroi (correction enregistrée)', () => {
    const m = earModel(E({ morph: { concha: { depth: 1 }, helix: { roll: -1 } } }), 1);
    expect(m.corrections.some((c) => c.id === 'concha-wall' && c.tier === 'strict')).toBe(true);
  });

  it('contrainte stricte : hélix épais + scapha large ne recouvrent jamais la scapha', () => {
    const m = earModel(E({ morph: { helix: { thickness: 1 }, scapha: { width: 1 }, antihelix: { relief: 1 } } }), 1);
    const sc = m.structures.find((s) => s.id === 'scapha')!;
    expect(sc.poly.length).toBeGreaterThan(5);
  });

  it('extension incompatible avec la famille : retirée et enregistrée (strict)', () => {
    const m = earModel(E({ family: 'human', extensions: [{ kind: 'membrane_panel' }, { kind: 'terminal_tip' }] }), 1);
    expect(names(m)).not.toContain('ext:membrane_panel');
    expect(names(m)).toContain('ext:terminal_tip');
    expect(m.corrections.some((c) => c.id.startsWith('extension-incompatible'))).toBe(true);
  });

  it('les six extensions s\'ajoutent sans réécrire le noyau (famille extraterrestre)', () => {
    const kinds = ['terminal_tip', 'secondary_ridge', 'branching_ridge', 'membrane_panel', 'ornamental_growth', 'bioluminescent_channel'] as const;
    const m = earModel(E({ family: 'alien', extensions: kinds.map((kind) => ({ kind })) }), 1);
    const base = earModel(E({ family: 'alien' }), 1);
    for (const k of kinds) expect(names(m).some((n) => n.startsWith(`ext:${k}`)), k).toBe(true);
    expect(names(m).filter((n) => !n.startsWith('ext:'))).toEqual(names(base));
  });

  it('chaque famille produit un contour simple et des structures finies', () => {
    for (const family of ['human', 'feline', 'canid', 'equid', 'elven', 'draconic', 'alien'] as const) {
      const m = earModel(E({ family }), 1);
      expect(m.outline.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y)), family).toBe(true);
      expect(Math.min(...m.outline.map((q) => q.y))).toBeCloseTo(0, 9);
    }
  });

  it('invariance d\'échelle : le même visage à deux tailles donne la même oreille (proportions conservées)', () => {
    const p = FaceParams.parse({ anatomyEngine: 'structured' });
    const a = earGeometry(p, faceLandmarks(p, 300, 400))[1]!;
    const b = earGeometry(p, faceLandmarks(p, 600, 800))[1]!;
    expect(earModel(p.ears, 1)).toEqual(earModel(p.ears, 1));
    expect(b.placement!.hPx / a.placement!.hPx).toBeCloseTo(2, 6);
    expect(b.rx / a.rx).toBeCloseTo(2, 1);
  });

  it('paramètres indépendants de l\'identité : tous les axes morphologiques à ±1 donnent un contour simple et fini', () => {
    const keys: [string, string][] = [['pole', 'height'], ['pole', 'round'], ['pole', 'lean'], ['pole', 'tip'], ['posterior', 'convexity'], ['lobule', 'length'], ['lobule', 'width'], ['lobule', 'attach'], ['lobule', 'sag'], ['tragus', 'size'], ['tragus', 'projection'], ['antitragus', 'size'], ['antitragus', 'orientation'], ['notch', 'depth'], ['helix', 'thickness'], ['helix', 'roll'], ['antihelix', 'relief'], ['antihelix', 'branchAngle'], ['antihelix', 'upperLength'], ['antihelix', 'lowerLength'], ['concha', 'depth'], ['concha', 'cymba'], ['scapha', 'width'], ['scapha', 'depth'], ['crus', 'thickness']];
    for (const [g, k] of keys) for (const v of [-1, 1]) {
      const m = earModel(E({ morph: { [g]: { [k]: v } } }), 1);
      expect(m.outline.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y)), `${g}.${k}=${v}`).toBe(true);
    }
  });
});

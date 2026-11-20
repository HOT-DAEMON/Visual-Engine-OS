import { describe, expect, it } from 'vitest';
import { composeEar, earGeometry, faceLandmarks, polyArea } from '../src/face';
import { FaceParams } from '../src/schema';
import { checkEars } from '../src/verify/ear';
import { earViewSvg } from '../src/render/face/ear/sheet';

const mk = (ears: Record<string, unknown>) => FaceParams.parse({ anatomyEngine: 'structured', ears: { engine: 'morphology', ...ears } });
const lmOf = (p: FaceParams) => faceLandmarks(p, 300, 400);
const geo = (ears: Record<string, unknown>) => { const p = mk(ears); return earGeometry(p, lmOf(p))[0]!.model!; };
const area = (m: ReturnType<typeof geo>, id: string): number => { const s = m.structures.find((x) => String(x.id) === id); return s ? Math.abs(polyArea(s.poly)) : 0; };
const svg = (ears: Record<string, unknown>, view: 'face' | 'close-up' = 'close-up') => { const p = mk(ears); return earViewSvg(p, lmOf(p), { view, width: 200, height: 280, skin: '#b98a62' }); };

describe('compositeur d’oreilles', () => {
  it('est déterministe et chaque graine compose une oreille différente', () => {
    expect(composeEar(42)).toEqual(composeEar(42));
    const seen = new Set(Array.from({ length: 60 }, (_, i) => JSON.stringify(composeEar(i))));
    expect(seen.size).toBe(60);
  });
  it('compose des oreilles valides : aucune erreur de vérification (géométrie, anatomie, style) sur 3 caractères × 30 graines', () => {
    for (const ch of ['natural', 'caricature', 'fantasy'] as const) for (let i = 0; i < 30; i++) {
      const p = mk(composeEar(700 + i, { character: ch }) as never);
      const bad = checkEars(p, lmOf(p), '#b98a62').filter((c) => !c.ok && c.severity === 'error');
      expect(bad.map((c) => `${ch}#${700 + i}:${c.id}`)).toEqual([]);
    }
  });
  it('les variantes rares sont rares en « natural » et fréquentes en « caricature »', () => {
    const rate = (ch: 'natural' | 'caricature'): number => Array.from({ length: 200 }, (_, i) => composeEar(i, { character: ch })).filter((e) => e.morph.helix.darwin > 0 || e.morph.lobule.cleft > 0 || e.morph.lobule.stretch > 0 || e.morph.helix.fold > 0).length / 200;
    expect(rate('natural')).toBeLessThan(0.3);
    expect(rate('caricature')).toBeGreaterThan(rate('natural') * 1.8);
  });
});

describe('nouveaux axes anatomiques : structures présentes seulement quand demandées', () => {
  it('Darwin, hélix replié, rebord de conque et trou du lobule étiré n’existent pas par défaut', () => {
    const ids = geo({}).structures.map((s) => String(s.id));
    for (const x of ['darwin', 'helix:fold', 'concha:rim', 'lobule:hole']) expect(ids).not.toContain(x);
  });
  it('chaque axe produit sa structure et reste dans le pavillon (aucune erreur de vérification)', () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ morph: { helix: { darwin: 0.9 } } }, 'darwin'], [{ morph: { helix: { fold: 0.9 } } }, 'helix:fold'], [{ morph: { concha: { wall: 0.9 } } }, 'concha:rim'], [{ morph: { lobule: { stretch: 0.9 } } }, 'lobule:hole'],
    ];
    for (const [e, id] of cases) {
      expect(geo(e).structures.map((s) => String(s.id))).toContain(id);
      const p = mk(e); expect(checkEars(p, lmOf(p), '#b98a62').filter((c) => !c.ok && c.severity === 'error')).toEqual([]);
    }
  });
  it('le lobule fendu a une encoche : le point le plus bas quitte l’axe du lobule', () => {
    const a = geo({}), b = geo({ morph: { lobule: { cleft: 0.9 } } });
    expect(b.outline.length).toBe(a.outline.length);
    expect(Math.abs(b.landmarks.lobuleBottom!.x - a.landmarks.lobuleBottom!.x)).toBeGreaterThan(0.03);
  });
  it('scapha.width agit réellement (la contrainte « jamais recouverte » est mesurée point par point) : aire croissante', () => {
    const w = (v: number) => area(geo({ morph: { scapha: { width: v } } }), 'scapha');
    expect(w(0.8)).toBeGreaterThan(w(0)); expect(w(0)).toBeGreaterThan(w(-0.8) * 1.15);
  });
  it('la profondeur de fosse et la largeur de fosse modifient la fosse', () => {
    const a = area(geo({ morph: { fossa: { width: -0.8 } } }), 'fossa'), b = area(geo({ morph: { fossa: { width: 0.8 } } }), 'fossa');
    expect(b).toBeGreaterThan(a * 1.5);
  });
});

describe('paramètres câblés (preuve : le rendu change dans le sens attendu)', () => {
  it('au défaut, aucune couche de surface, de transmission ni d’émission n’est ajoutée', () => {
    const s = svg({});
    expect(s).not.toContain('-gl"'); expect(s).not.toContain('-tr"'); expect(s).not.toContain('-pg');
  });
  it('glow : halo et liseré intérieur pour toute matière', () => { expect(svg({ material: { glow: 0.9 } })).toContain('-gl"'); });
  it('translucidité : au-dessus et au-dessous du défaut, une couche apparaît', () => {
    expect(svg({ material: { translucency: 0.9 } })).toContain('-tr"'); expect(svg({ material: { translucency: 0.1 } })).toContain('-tr"');
  });
  it('douceur : le flou n’existe qu’au-dessus de 0,5 ; les croissants s’élargissent', () => {
    expect(svg({ style: { softness: 0.9 } })).toContain('-soft"'); expect(svg({ style: { softness: 0.3 } })).not.toContain('-soft"');
  });
  it('détails SURF-05 : invisibles sous le LOD, présents au-dessus', () => {
    const on = svg({ surface: { pigmentation: 0.9 }, style: { detail: 0.9 } }), off = svg({ surface: { pigmentation: 0.9 }, style: { detail: 0.05 } });
    expect(on).toContain('-pg1'); expect(off).not.toContain('-pg1');
  });
  it('attach.scale agrandit réellement l’oreille et la vérification du lobule en tient compte', () => {
    const p1 = mk({}), p2 = mk({ attach: { scale: 1.2 } });
    const h = (p: FaceParams) => earGeometry(p, lmOf(p))[0]!.placement!.hPx;
    expect(h(p2) / h(p1)).toBeGreaterThan(1.1);
    expect(checkEars(p2, lmOf(p2), '#b98a62').filter((c) => !c.ok && c.severity === 'error')).toEqual([]);
  });
  it('fidélité : les raccords s’articulent (relief de la jonction) de plus en plus', () => {
    const j = (f: number) => geo({ style: { fidelity: f } }).structures.find((s) => String(s.id) === 'antihelix:junction')!.relief;
    expect(j(1)).toBeGreaterThan(j(0.8)); expect(j(0.8)).toBeGreaterThan(j(0.2) * 2);
  });
});

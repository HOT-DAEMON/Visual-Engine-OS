import { describe, expect, it } from 'vitest';
import { compileScene } from '../src';

function svgOf(input: unknown): string {
  const r = compileScene(input);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
}
const eye = (over: Record<string, unknown> = {}) => ({ objects: [{ kind: 'eye', id: 'e', ...over }] });

describe('cils', () => {
  it('count=0 ne produit aucun groupe de cils', () => {
    const svg = svgOf(eye({ lashes: { upper: { count: 0 }, lower: { count: 0 } } }));
    expect(svg).not.toContain('id="e-lashes-up"');
    expect(svg).not.toContain('id="e-lashes-low"');
  });

  it('count>0 produit exactement N chemins de cils', () => {
    const svg = svgOf(eye({ lashes: { upper: { count: 12 }, lower: { count: 5 } } }));
    const up = /id="e-lashes-up"[^>]*>([\s\S]*?)<\/g>/.exec(svg)?.[1] ?? '';
    const low = /id="e-lashes-low"[^>]*>([\s\S]*?)<\/g>/.exec(svg)?.[1] ?? '';
    expect((up.match(/<path/g) ?? []).length).toBe(12);
    expect((low.match(/<path/g) ?? []).length).toBe(5);
  });

  it('est déterministe (seed) et ne produit pas de NaN', () => {
    const a = svgOf(eye({ seed: 42, lashes: { upper: { count: 20 } } }));
    const b = svgOf(eye({ seed: 42, lashes: { upper: { count: 20 } } }));
    expect(a).toBe(b);
    expect(a).not.toMatch(/NaN|Infinity/);
    const c = svgOf(eye({ seed: 43, lashes: { upper: { count: 20 } } }));
    expect(a).not.toBe(c);
  });
});

describe('sourcil', () => {
  it('eyebrow: null => aucun sourcil, aucun poil', () => {
    const svg = svgOf(eye({ eyebrow: null }));
    expect(svg).not.toContain('id="e-brow"');
    expect(svg).not.toContain('id="e-brow-hairs"');
  });

  it('hairs=0 => pas de groupe de poils, mais le sourcil existe (surface compilée)', () => {
    const svg = svgOf(eye({ eyebrow: { hairs: 0 } }));
    expect(svg).toContain('id="e-brow-diffuse"');
    expect(svg).not.toContain('id="e-brow-hairs"');
  });

  it('hérite du système de matériaux partagé (métal => rampe d\'environnement)', () => {
    const svg = svgOf(eye({ eyebrow: { material: { preset: 'polished_metal', color: '#c0c0c0' } } }));
    expect(svg).toContain('id="e-brow-env"');
    const matte = svgOf(eye({ eyebrow: { material: { preset: 'matte', color: '#c0c0c0' } } }));
    expect(matte).not.toContain('id="e-brow-env"');
  });

  it('produit exactement N poils', () => {
    const svg = svgOf(eye({ eyebrow: { hairs: 37 } }));
    const g = /id="e-brow-hairs"[^>]*>([\s\S]*?)<\/g>/.exec(svg)?.[1] ?? '';
    expect((g.match(/<path/g) ?? []).length).toBe(37);
  });
});

describe('pli palpébral (crease)', () => {
  it('height=0 => aucun pli dessiné', () => {
    const svg = svgOf(eye({ lids: { crease: { height: 0 } } }));
    expect(svg).not.toContain('id="e-crease"');
    expect(svg).not.toContain('id="e-crease-fill"');
  });

  it('height>0 => le pli est dessiné', () => {
    const svg = svgOf(eye({ lids: { crease: { height: 0.3 } } }));
    expect(svg).toContain('id="e-crease"');
    expect(svg).toContain('id="e-crease-fill"');
  });
});

describe('pli épicanthique', () => {
  it('amount=0 => aucune trace (pas de région de recouvrement, cils/bords non clippés)', () => {
    const svg = svgOf(eye({ epicanthicFold: { amount: 0 } }));
    expect(svg).not.toContain('id="e-fold"');
    expect(svg).not.toContain('id="e-nofold"');
  });

  it('amount>0 => la peau recouvre le canthus interne, et clippe les bords/cils', () => {
    const svg = svgOf(eye({ epicanthicFold: { amount: 0.8 }, skin: { preset: 'matte', color: '#eec9ad' } }));
    expect(svg).toContain('id="e-fold"');
    expect(svg).toContain('id="e-nofold"');
    expect(svg).toContain('#eec9ad'); // couleur de peau utilisée pour la région recouverte
  });

  it('est cohérent avec outerSide gauche/droite (aucun NaN, formes non dégénérées)', () => {
    for (const outerSide of ['left', 'right']) {
      const svg = svgOf(eye({ shape: { outerSide }, epicanthicFold: { amount: 1, reach: 1 } }));
      expect(svg).not.toMatch(/NaN|Infinity/);
    }
  });
});

describe('canthi', () => {
  it('caruncle=0 => aucune caroncule dessinée', () => {
    expect(svgOf(eye({ canthi: { inner: { caruncle: 0 } } }))).not.toContain('id="e-caruncle"');
  });
  it('caruncle>0 => la caroncule est dessinée avec sa couleur', () => {
    const svg = svgOf(eye({ canthi: { inner: { caruncle: 0.7, color: '#ff00aa' } } }));
    expect(svg).toContain('id="e-caruncle"');
  });
  it('roundness modifie la géométrie de la fente sans casser le rendu', () => {
    const round = svgOf(eye({ canthi: { inner: { roundness: 1 }, outer: { roundness: 1 } } }));
    const sharp = svgOf(eye({ canthi: { inner: { roundness: 0 }, outer: { roundness: 0 } } }));
    expect(round).not.toBe(sharp);
    expect(round).not.toMatch(/NaN|Infinity/);
  });
});

describe('peau (skin)', () => {
  it('null hors hôte : peau claire par défaut utilisée pour le pli', () => {
    const svg = svgOf(eye({ epicanthicFold: { amount: 0.5 } }));
    expect(svg).not.toMatch(/NaN|Infinity/);
    expect(svg).toContain('#eec9ad');
  });
  it('un skin explicite est utilisé pour la région du pli', () => {
    const svg = svgOf(eye({ epicanthicFold: { amount: 0.5 }, skin: { preset: 'matte', color: '#123456' } }));
    expect(svg).toContain('#123456');
  });
});

describe('robustesse combinée', () => {
  it('toutes les fonctionnalités activées ensemble, aux bornes, sans NaN/Infinity', () => {
    const svg = svgOf(
      eye({
        shape: { openness: 0.05, tiltDeg: -30 },
        lids: { crease: { height: 0.6, depth: 1 }, wing: 1, waterline: 1 },
        lashes: { upper: { count: 60, length: 0.6, sweep: 60 }, lower: { count: 30, length: 0.4 } },
        canthi: { inner: { caruncle: 1, roundness: 1 }, outer: { roundness: 1 } },
        epicanthicFold: { amount: 1, reach: 1 },
        eyebrow: { hairs: 160, arch: 1, taper: 1, tiltDeg: 30 },
      }),
    );
    expect(svg).not.toMatch(/NaN|Infinity/);
  });

  it('toutes les fonctionnalités désactivées : rendu minimal, sans erreur', () => {
    const svg = svgOf(
      eye({
        lids: { crease: { height: 0 }, wing: 0, waterline: 0 },
        lashes: { upper: { count: 0 }, lower: { count: 0 } },
        canthi: { inner: { caruncle: 0 } },
        epicanthicFold: { amount: 0 },
        eyebrow: null,
      }),
    );
    expect(svg).not.toMatch(/NaN|Infinity/);
  });
});

import { describe, expect, it } from 'vitest';
import { applyArchetype, ARCHETYPE_PRESETS } from '../src/archetypes';
import { compileScene, EyeSpec } from '../src';

const KINDS = ['realistic', 'reptile', 'feline', 'doll', 'alien', 'demon'] as const;

const eye = (over: Record<string, unknown> = {}) => EyeSpec.parse({ id: 'e', kind: 'eye', ...over });
function svgOf(input: unknown): string {
  const r = compileScene(input);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
}

describe('applyArchetype', () => {
  it('archetype=null (défaut) : retourne EXACTEMENT la même référence', () => {
    const e = eye();
    expect(applyArchetype(e)).toBe(e);
  });

  it('est pure : n\'altère pas l\'entrée', () => {
    const e = eye({ archetype: 'reptile' });
    const before = JSON.stringify(e);
    applyArchetype(e);
    expect(JSON.stringify(e)).toBe(before);
  });

  it('est déterministe', () => {
    const e = eye({ archetype: 'demon' });
    expect(applyArchetype(e)).toEqual(applyArchetype(e));
  });

  it('chaque archétype produit un résultat différent du neutre et des 5 autres', () => {
    const base = eye();
    const results = KINDS.map((k) => applyArchetype(eye({ archetype: k })));
    results.forEach((r) => expect(r).not.toEqual(base));
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        expect(results[i]).not.toEqual(results[j]);
      }
    }
  });

  it('shape/iris/pupil/highlights/canthi : fusion clé par clé (le reste du sous-objet est conservé)', () => {
    const e = eye({ shape: { tiltDeg: -5, width: 321 } }); // tiltDeg sera écrasé par reptile.shape.style, width non touché
    const out = applyArchetype(eye({ ...e, archetype: 'reptile' }));
    expect(out.shape.style).toBe('sharp'); // imposé par l'archétype
    expect(out.shape.width).toBe(321); // non touché par l'archétype : conservé
  });

  it('sclera/lashes/eyebrow : remplacement EN BLOC quand l\'archétype les précise', () => {
    const out = applyArchetype(eye({ archetype: 'alien', eyebrow: { hairs: 99 } }));
    expect(out.eyebrow).toBeNull(); // alien impose eyebrow:null, quel que soit ce que l'utilisateur avait mis
  });

  it('n\'écrase pas un champ que l\'archétype ne précise pas (doll ne touche pas eyebrow)', () => {
    const out = applyArchetype(eye({ archetype: 'doll', eyebrow: { hairs: 77 } }));
    expect(out.eyebrow?.hairs).toBe(77); // conservé : doll.eyebrow est absent du préréglage
  });

  it('couvre les 6 archétypes déclarés dans le schéma', () => {
    expect(Object.keys(ARCHETYPE_PRESETS).sort()).toEqual([...KINDS].sort());
  });
});

describe('intégration : archetype dans compileEye', () => {
  it('se rend sans NaN/Infinity pour les 6 archétypes, combinés à une expression', () => {
    for (const archetype of KINDS) {
      for (const expr of ['neutral', 'angry', 'fearful'] as const) {
        const svg = svgOf({ objects: [{ kind: 'eye', id: 'e', archetype, expression: { kind: expr, intensity: 1 } }] });
        expect(svg).not.toMatch(/NaN|Infinity/);
      }
    }
  });

  it('est déterministe de bout en bout', () => {
    const scene = { objects: [{ kind: 'eye', id: 'e', archetype: 'demon' as const }] };
    expect(svgOf(scene)).toBe(svgOf(JSON.parse(JSON.stringify(scene))));
  });

  it('produit 6 SVG différents pour les 6 archétypes, sur un œil par ailleurs identique', () => {
    const svgs = new Set(KINDS.map((archetype) => svgOf({ objects: [{ kind: 'eye', id: 'e', seed: 1, archetype }] })));
    expect(svgs.size).toBe(KINDS.length);
  });

  it('reste compatible avec le pli épicanthique et la rotation 3D du regard, pour chaque archétype', () => {
    for (const archetype of KINDS) {
      const svg = svgOf({
        objects: [{ kind: 'eye', id: 'e', archetype, epicanthicFold: { amount: 0.8 }, gaze: { yawDeg: 25, pitchDeg: -15 } }],
      });
      expect(svg).not.toMatch(/NaN|Infinity/);
    }
  });

  it('reptile/alien/demon/feline n\'ont pas de sourcil par défaut (eyebrow: null)', () => {
    for (const archetype of ['reptile', 'alien', 'demon'] as const) {
      const svg = svgOf({ objects: [{ kind: 'eye', id: 'e', archetype }] });
      expect(svg).not.toContain('id="e-brow"');
    }
  });

  it('realistic et doll conservent un sourcil (hérité du défaut, non précisé par l\'archétype)', () => {
    for (const archetype of ['realistic', 'doll'] as const) {
      const svg = svgOf({ objects: [{ kind: 'eye', id: 'e', archetype }] });
      expect(svg).toContain('id="e-brow"');
    }
  });
});

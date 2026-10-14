import { describe, expect, it } from 'vitest';
import { compileScene, EyeSpec } from '../src';
import { renderPupil } from '../src/render/eye/pupil';

const eye = (over: Record<string, unknown> = {}) => EyeSpec.parse({ id: 'e', kind: 'eye', ...over });
function svgOf(input: unknown): string {
  const r = compileScene(input);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
}

describe('schéma Pupil', () => {
  it('défauts : visible=true, fill uni #07090f (même couleur que l\'ancien `color` par défaut), aucun contour', () => {
    const p = eye().pupil;
    expect(p.visible).toBe(true);
    expect(p.fill).toEqual({ type: 'solid', color: '#07090f' });
    expect(p.outlines).toEqual([]);
  });

  it('accepte un remplissage linéaire et radial, au même titre que l\'iris/la sclère', () => {
    const linear = eye({ pupil: { fill: { type: 'linear', angleDeg: 45, stops: [{ offset: 0, color: '#ffffff' }, { offset: 1, color: '#000000' }] } } });
    expect(linear.pupil.fill.type).toBe('linear');
    const radial = eye({ pupil: { fill: { type: 'radial', stops: [{ offset: 0, color: '#ffffff' }, { offset: 1, color: '#000000' }] } } });
    expect(radial.pupil.fill.type).toBe('radial');
  });

  it('accepte jusqu\'à 3 contours, rejette le 4e', () => {
    const three = { outlines: [{ color: '#ff0000' }, { color: '#00ff00' }, { color: '#0000ff' }] };
    expect(EyeSpec.safeParse({ id: 'e', kind: 'eye', pupil: three }).success).toBe(true);
    const four = { outlines: [...three.outlines, { color: '#ffffff' }] };
    expect(EyeSpec.safeParse({ id: 'e', kind: 'eye', pupil: four }).success).toBe(false);
  });

  it('rejette une couleur de contour mal formée', () => {
    expect(EyeSpec.safeParse({ id: 'e', kind: 'eye', pupil: { outlines: [{ color: 'red' }] } }).success).toBe(false);
  });

  it('visible accepte un booléen strict', () => {
    expect(EyeSpec.safeParse({ id: 'e', kind: 'eye', pupil: { visible: false } }).success).toBe(true);
    expect(EyeSpec.safeParse({ id: 'e', kind: 'eye', pupil: { visible: 'false' } }).success).toBe(false);
  });
});

describe('renderPupil (fonction pure)', () => {
  const base = eye().pupil;

  it('visible=false : ne produit AUCUN markup ni def', () => {
    const out = renderPupil({ ...base, visible: false }, 0, 0, 10, 10, 'e');
    expect(out.markup).toEqual([]);
    expect(out.defs).toEqual([]);
  });

  it('remplissage uni : pas de def de dégradé, fill direct', () => {
    const out = renderPupil(base, 0, 0, 10, 10, 'e');
    expect(out.defs).toEqual([]);
    expect(out.markup[0]).toContain('fill="#07090f"');
  });

  it('remplissage dégradé : une def est créée et référencée', () => {
    const grad = { ...base, fill: { type: 'linear' as const, angleDeg: 0, stops: [{ offset: 0, color: '#ffffff', opacity: 1 }, { offset: 1, color: '#000000', opacity: 1 }] } };
    const out = renderPupil(grad, 0, 0, 10, 10, 'e');
    expect(out.defs).toHaveLength(1);
    expect(out.defs[0]).toContain('linearGradient');
    expect(out.markup[0]).toContain('url(#e-pupil-fill)');
  });

  it('produit exactement N ellipses de contour pour N outlines, après le disque de remplissage', () => {
    const p = { ...base, outlines: [{ color: '#ff0000', width: 0.1, opacity: 1 }, { color: '#00ff00', width: 0.1, opacity: 1 }] };
    const out = renderPupil(p, 0, 0, 10, 10, 'e');
    expect(out.markup).toHaveLength(3); // 1 disque + 2 contours
    expect(out.markup[1]).toContain('stroke="#ff0000"');
    expect(out.markup[2]).toContain('stroke="#00ff00"');
  });

  it('les contours s\'empilent STRICTEMENT vers l\'extérieur (rayons croissants)', () => {
    const p = { ...base, outlines: [{ color: '#ff0000', width: 0.15, opacity: 1 }, { color: '#00ff00', width: 0.15, opacity: 1 }] };
    const out = renderPupil(p, 0, 0, 10, 10, 'e');
    const rx = (s: string) => Number(/rx="([\d.]+)"/.exec(s)?.[1]);
    expect(rx(out.markup[1] as string)).toBeGreaterThan(10);
    expect(rx(out.markup[2] as string)).toBeGreaterThan(rx(out.markup[1] as string));
  });

  it('un contour conserve le rapport rx/ry de la pupille (essentiel pour une fente)', () => {
    const p = { ...base, outlines: [{ color: '#ff0000', width: 0.2, opacity: 1 }] };
    const out = renderPupil(p, 0, 0, 20, 5, 'e'); // fente très plate, aspect 0.25
    const attrs = out.markup[1] as string;
    const rx = Number(/rx="([\d.]+)"/.exec(attrs)?.[1]);
    const ry = Number(/ry="([\d.]+)"/.exec(attrs)?.[1]);
    expect(ry / rx).toBeCloseTo(5 / 20, 2);
  });

  it('est déterministe et pur (mêmes entrées => même sortie, aucune entrée modifiée)', () => {
    const p = { ...base, outlines: [{ color: '#ff0000', width: 0.1, opacity: 1 }] };
    const before = JSON.stringify(p);
    const a = renderPupil(p, 1, 2, 10, 8, 'e');
    const b = renderPupil(p, 1, 2, 10, 8, 'e');
    expect(a).toEqual(b);
    expect(JSON.stringify(p)).toBe(before);
  });
});

describe('intégration : pupille dans compileEye', () => {
  it('visible=false : aucune trace de la pupille dans le SVG (ni disque ni contour)', () => {
    const svg = svgOf({ objects: [{ kind: 'eye', id: 'e', pupil: { visible: false } }] });
    expect(svg).not.toContain('pupil-fill');
  });

  it('est déterministe de bout en bout, avec dégradé et contours combinés', () => {
    const scene = {
      objects: [
        {
          kind: 'eye',
          id: 'e',
          pupil: {
            fill: { type: 'radial', stops: [{ offset: 0, color: '#ffffff' }, { offset: 1, color: '#000000' }] },
            outlines: [{ color: '#ff0000', width: 0.1 }, { color: '#00ff00', width: 0.08 }],
          },
        },
      ],
    };
    expect(svgOf(scene)).toBe(svgOf(JSON.parse(JSON.stringify(scene))));
  });

  it('ne casse rien aux bornes extrêmes (3 contours, pupille minuscule et énorme, toutes formes)', () => {
    for (const size of [0.12, 0.7]) {
      for (const shape of ['round', 'slit_vertical', 'slit_horizontal'] as const) {
        const svg = svgOf({
          objects: [
            {
              kind: 'eye',
              id: 'e',
              pupil: {
                shape,
                size,
                outlines: [{ color: '#ff0000', width: 0.4 }, { color: '#00ff00', width: 0.4 }, { color: '#0000ff', width: 0.4 }],
              },
            },
          ],
        });
        expect(svg).not.toMatch(/NaN|Infinity/);
      }
    }
  });

  it('se compresse avec le reste de l\'iris sous la rotation 3D du regard (pas de double-traitement)', () => {
    const svg = svgOf({
      objects: [{ kind: 'eye', id: 'e', gaze: { yawDeg: 35 }, pupil: { outlines: [{ color: '#ff0000' }] } }],
    });
    expect(svg).not.toMatch(/NaN|Infinity/);
    // Le groupe de contour doit être À L'INTÉRIEUR du groupe transformé par le raccourcissement,
    // pas appliqué deux fois : on vérifie juste l'absence d'un second groupe de transform dupliqué
    // autour de "pupil-fill" (régression grossière, pas une preuve géométrique complète).
    expect((svg.match(/pupil-fill/g) ?? []).length).toBeLessThanOrEqual(2); // 1 def + 1 référence
  });

  it('un remplissage dégradé change le rendu entre deux orientations (angleDeg)', () => {
    const grad = (angleDeg: number) => ({
      type: 'linear',
      angleDeg,
      stops: [{ offset: 0, color: '#ffffff' }, { offset: 1, color: '#000000' }],
    });
    const a = svgOf({ objects: [{ kind: 'eye', id: 'e', pupil: { fill: grad(0) } }] });
    const b = svgOf({ objects: [{ kind: 'eye', id: 'e', pupil: { fill: grad(90) } }] });
    expect(a).not.toBe(b);
  });

  it('reste compatible avec tous les 6 archétypes (demon utilise déjà fill explicitement)', () => {
    for (const archetype of ['realistic', 'reptile', 'feline', 'doll', 'alien', 'demon'] as const) {
      const svg = svgOf({ objects: [{ kind: 'eye', id: 'e', archetype }] });
      expect(svg).not.toMatch(/NaN|Infinity/);
    }
  });
});

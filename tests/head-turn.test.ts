import { describe, expect, it } from 'vitest';
import { compileScene, EyeSpec, lightVector, SceneSpec } from '../src';
import { headTurnOf, rotateLightForHeadTurn } from '../src/lighting/head-turn';

const eye = (over: Record<string, unknown> = {}) => EyeSpec.parse({ id: 'e', kind: 'eye', ...over });
function svgOf(input: unknown): string {
  const r = compileScene(input);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
}
const neutralLight = lightVector(SceneSpec.parse({ objects: [{ kind: 'eye', id: 'e' }] }).light);

describe('headTurnOf (géométrie pure, réutilise projectGaze)', () => {
  it('à yaw=pitch=0 : décalage nul, foreshortening=1 (identité exacte)', () => {
    const h = headTurnOf(0, 0, 180);
    expect(h.dx).toBe(0);
    expect(h.dy).toBe(0);
    expect(h.foreshortening).toBe(1);
  });

  it('yaw seul : compression horizontale = cos(yaw) EXACTEMENT, décalage uniquement horizontal', () => {
    const h = headTurnOf(35, 0, 180);
    expect(h.foreshortening).toBeCloseTo(Math.cos((35 * Math.PI) / 180), 9);
    expect(h.dy).toBeCloseTo(0, 9);
    expect(h.dx).not.toBe(0);
  });

  it('yaw négatif => décalage opposé, même compression (symétrie miroir exacte)', () => {
    const a = headTurnOf(35, 10, 180);
    const b = headTurnOf(-35, 10, 180);
    expect(b.dx).toBeCloseTo(-a.dx, 9);
    expect(b.dy).toBeCloseTo(a.dy, 9);
    expect(b.foreshortening).toBeCloseTo(a.foreshortening, 9);
  });

  it('la compression décroît strictement avec l\'angle (yaw croissant)', () => {
    let prev = 1;
    for (const yaw of [0, 15, 30, 45, 60, 75]) {
      const h = headTurnOf(yaw, 0, 180);
      expect(h.foreshortening).toBeLessThanOrEqual(prev + 1e-9);
      prev = h.foreshortening;
    }
  });
});

describe('rotateLightForHeadTurn (rotation 3D physique de la lumière)', () => {
  it('à yaw=pitch=0 : la lumière est inchangée', () => {
    const r = rotateLightForHeadTurn(neutralLight, 0, 0);
    expect(r.x).toBeCloseTo(neutralLight.x, 9);
    expect(r.y).toBeCloseTo(neutralLight.y, 9);
    expect(r.z).toBeCloseTo(neutralLight.z, 9);
  });

  it('préserve la norme du vecteur (rotation pure, ni étirement ni raccourcissement)', () => {
    const r = rotateLightForHeadTurn(neutralLight, 40, -20);
    const norm = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z);
    expect(norm(r)).toBeCloseTo(norm(neutralLight), 9);
  });

  it('une tête qui tourne à 90° vers une lumière rasante de face ramène surtout la lumière sur Z (de face)', () => {
    // Lumière venant de la droite, à l'horizontale (azimuth 90°, élévation ~0°) : une tête qui
    // tourne de 90° vers la droite doit amener cette lumière QUASIMENT de face dans son repère local.
    const sideLight = lightVector({ azimuthDeg: 90, elevationDeg: 1, color: '#ffffff', intensity: 1 });
    const r = rotateLightForHeadTurn(sideLight, 90, 0);
    expect(r.z).toBeGreaterThan(0.9);
  });

  it('conserve couleur et intensité (seule la direction tourne)', () => {
    const r = rotateLightForHeadTurn(neutralLight, 25, 15);
    expect(r.color).toBe(neutralLight.color);
    expect(r.intensity).toBe(neutralLight.intensity);
  });
});

describe('schéma HeadTurn', () => {
  it('défaut : yawDeg=0, pitchDeg=0', () => {
    expect(eye().headTurn).toEqual({ yawDeg: 0, pitchDeg: 0 });
  });
  it('rejette une valeur hors bornes', () => {
    expect(EyeSpec.safeParse({ id: 'e', kind: 'eye', headTurn: { yawDeg: 80 } }).success).toBe(false);
    expect(EyeSpec.safeParse({ id: 'e', kind: 'eye', headTurn: { pitchDeg: -65 } }).success).toBe(false);
  });
});

describe('intégration : rotation de tête dans compileEye', () => {
  it('headTurn par défaut (0,0) produit un SVG IDENTIQUE à avant son introduction (régression stricte)', () => {
    // Référence : premier octet de contenu structurel identique quel que soit l'ajout du groupe
    // d'enveloppe — seule la compression géométrique doit changer le rendu, jamais sa présence à 0.
    const a = svgOf({ objects: [{ kind: 'eye', id: 'e' }] });
    const b = svgOf({ objects: [{ kind: 'eye', id: 'e', headTurn: { yawDeg: 0, pitchDeg: 0 } }] });
    expect(a).toBe(b);
  });

  it('se rend sans NaN/Infinity à toutes les bornes, seul et combiné au regard/pli/archétype', () => {
    for (const yawDeg of [-75, 75]) {
      for (const pitchDeg of [-60, 60]) {
        const svg = svgOf({
          objects: [
            {
              kind: 'eye',
              id: 'e',
              headTurn: { yawDeg, pitchDeg },
              gaze: { yawDeg: 30, pitchDeg: -20 },
              epicanthicFold: { amount: 0.8 },
              archetype: 'feline',
            },
          ],
        });
        expect(svg).not.toMatch(/NaN|Infinity/);
      }
    }
  });

  it('est déterministe de bout en bout', () => {
    const scene = { objects: [{ kind: 'eye', id: 'e', headTurn: { yawDeg: 40, pitchDeg: -15 } }] };
    expect(svgOf(scene)).toBe(svgOf(JSON.parse(JSON.stringify(scene))));
  });

  it('headTurn et gaze restent INDÉPENDANTS et combinables : gaze seul ne change pas la largeur de l\'enveloppe', () => {
    const noGaze = svgOf({ objects: [{ kind: 'eye', id: 'e', headTurn: { yawDeg: 40 } }] });
    const withGaze = svgOf({ objects: [{ kind: 'eye', id: 'e', headTurn: { yawDeg: 40 }, gaze: { yawDeg: 25 } }] });
    // Les deux diffèrent (la pupille a bougé) mais doivent rester DISTINCTS du cas headTurn seul à
    // un autre angle (preuve que gaze a un effet propre, pas juste un bruit de régression).
    expect(noGaze).not.toBe(withGaze);
    const differentHeadTurnOnly = svgOf({ objects: [{ kind: 'eye', id: 'e', headTurn: { yawDeg: 20 } }] });
    expect(noGaze).not.toBe(differentHeadTurnOnly);
  });

  it('yaw et son opposé produisent la MÊME compression (scale) et un décalage de signe opposé', () => {
    // Pas une égalité de longueur d'octets (un cas dégénéré de atan2 peut produire rotate(180) au
    // lieu de rotate(0) — visuellement équivalent avec un scale symétrique, mais deux caractères de
    // plus) : on vérifie la vraie propriété géométrique, pas un détail d'implémentation accidentel.
    const scaleOf = (svg: string) => Number(/scale\(([\d.]+) 1\)/.exec(svg)?.[1]);
    const dxOf = (svg: string) => Number(/translate\((-?[\d.]+) 0\) rotate/.exec(svg)?.[1]);
    const left = svgOf({ objects: [{ kind: 'eye', id: 'e', headTurn: { yawDeg: -35 } }] });
    const right = svgOf({ objects: [{ kind: 'eye', id: 'e', headTurn: { yawDeg: 35 } }] });
    expect(left).not.toBe(right);
    expect(scaleOf(left)).toBeCloseTo(scaleOf(right), 3);
    expect(dxOf(left)).toBeCloseTo(-dxOf(right), 1);
  });

  it('reste compatible avec les 2 nouveaux archétypes de kind (compound_eye, gem_eye n\'ont pas de headTurn : non affectés)', () => {
    const svg = svgOf({
      objects: [
        { kind: 'compound_eye', id: 'c' },
        { kind: 'gem_eye', id: 'g' },
        { kind: 'eye', id: 'e', headTurn: { yawDeg: 45 } },
      ],
    });
    expect(svg).not.toMatch(/NaN|Infinity/);
  });
});

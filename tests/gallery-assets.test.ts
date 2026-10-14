import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compileScene } from '../src';

/**
 * Valide les scènes d'ASSEMBLAGE générées par scripts/gallery.ts, gallery-pairs.ts, gaze-sheet.ts —
 * sans passer par resvg (ces fichiers sont volumineux ; un aller-retour SVG seul suffit, la
 * correction de chaque œil individuel est déjà couverte ailleurs par les autres suites de tests).
 */
function load(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../examples/${name}.json`, import.meta.url), 'utf8'));
}
function svgOf(input: unknown): string {
  const r = compileScene(input);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
}

describe('galerie : 48 identités distinctes', () => {
  it('compile sans NaN/Infinity et contient exactement 48 yeux', () => {
    const scene = load('gallery');
    const svg = svgOf(scene);
    expect(svg).not.toMatch(/NaN|Infinity/);
    expect((scene as { objects: unknown[] }).objects).toHaveLength(48);
  });

  it('les 48 identités sont toutes structurellement distinctes (aucun doublon JSON)', () => {
    const scene = load('gallery') as { objects: Record<string, unknown>[] };
    const withoutId = scene.objects.map((o) => JSON.stringify({ ...o, id: undefined, transform: undefined }));
    expect(new Set(withoutId).size).toBe(48);
  });
});

describe('galerie : 48 paires œil gauche/droit', () => {
  it('compile sans NaN/Infinity et contient exactement 96 yeux (48 × 2)', () => {
    const scene = load('gallery-pairs');
    const svg = svgOf(scene);
    expect(svg).not.toMatch(/NaN|Infinity/);
    expect((scene as { objects: unknown[] }).objects).toHaveLength(96);
  });

  it('chaque paire est un VRAI miroir : même identité, outerSide opposé', () => {
    const scene = load('gallery-pairs') as {
      objects: { id: string; shape?: { outerSide?: string } }[];
    };
    for (let i = 0; i < scene.objects.length; i += 2) {
      const left = scene.objects[i] as { id: string; shape?: { outerSide?: string } };
      const right = scene.objects[i + 1] as { id: string; shape?: { outerSide?: string } };
      expect(left.shape?.outerSide).toBe('left');
      expect(right.shape?.outerSide).toBe('right');
      // Même identité : hors id/transform/outerSide, les deux objets doivent être identiques.
      const strip = (o: typeof left) => JSON.stringify({ ...o, id: undefined, transform: undefined, shape: { ...o.shape, outerSide: undefined } });
      expect(strip(left)).toBe(strip(right));
    }
  });
});

describe('galeries : rotation de tête, les 48 identités en paires, 2 angles 3/4', () => {
  for (const file of ['gallery-head-left34', 'gallery-head-right34']) {
    it(`${file} : compile sans NaN/Infinity, 96 yeux (48 × 2), vrai miroir`, () => {
      const scene = load(file) as { objects: { id: string; shape?: { outerSide?: string } }[] };
      const svg = svgOf(scene);
      expect(svg).not.toMatch(/NaN|Infinity/);
      expect(scene.objects).toHaveLength(96);
      for (let i = 0; i < scene.objects.length; i += 2) {
        expect(scene.objects[i]?.shape?.outerSide).toBe('left');
        expect(scene.objects[i + 1]?.shape?.outerSide).toBe('right');
      }
    });
  }

  it('gauche et droite utilisent des yawDeg de signe opposé (vrais 3/4 miroir, pas la même rotation)', () => {
    const left = load('gallery-head-left34') as { objects: { headTurn?: { yawDeg: number } }[] };
    const right = load('gallery-head-right34') as { objects: { headTurn?: { yawDeg: number } }[] };
    expect(left.objects[0]?.headTurn?.yawDeg).toBeLessThan(0);
    expect(right.objects[0]?.headTurn?.yawDeg).toBeGreaterThan(0);
  });
});

describe('galeries : les 48 identités sous 13 expressions, une émotion par fichier', () => {
  const EXPRESSIONS = [
    'angry',
    'sad',
    'fearful',
    'anguished',
    'melancholic',
    'drowsy',
    'surprised',
    'sulky',
    'furious',
    'joyful',
    'smiling',
    'fierce',
    'stressed',
  ] as const;

  for (const kind of EXPRESSIONS) {
    it(`gallery-expr-${kind} : compile sans NaN/Infinity, 48 yeux, tous à l'expression "${kind}"`, () => {
      const scene = load(`gallery-expr-${kind}`) as { objects: { expression?: { kind: string } }[] };
      const svg = svgOf(scene);
      expect(svg).not.toMatch(/NaN|Infinity/);
      expect(scene.objects).toHaveLength(48);
      expect(scene.objects.every((o) => o.expression?.kind === kind)).toBe(true);
    });
  }

  it('les 13 fichiers d\'expression produisent 13 rendus deux à deux distincts pour la MÊME identité', () => {
    const svgs = new Set(
      EXPRESSIONS.map((kind) => {
        const scene = load(`gallery-expr-${kind}`) as { objects: unknown[] };
        const r = compileScene({ objects: [scene.objects[0]] });
        if (!r.ok) throw new Error(r.issues.join('\n'));
        return r.svg;
      }),
    );
    expect(svgs.size).toBe(EXPRESSIONS.length);
  });
});

describe('feuille de regard : 6 identités × paire × 5 directions', () => {
  it('compile sans NaN/Infinity et contient exactement 60 yeux (6 × 2 × 5)', () => {
    const scene = load('gaze-sheet');
    const svg = svgOf(scene);
    expect(svg).not.toMatch(/NaN|Infinity/);
    expect((scene as { objects: unknown[] }).objects).toHaveLength(60);
  });

  it('les 5 directions de regard par identité/côté sont bien distinctes (yaw/pitch différents)', () => {
    const scene = load('gaze-sheet') as { objects: { gaze?: { yawDeg: number; pitchDeg: number } }[] };
    const firstFive = scene.objects.slice(0, 5).map((o) => `${o.gaze?.yawDeg},${o.gaze?.pitchDeg}`);
    expect(new Set(firstFive).size).toBe(5);
  });

  it('"haut" et "bas" ont des pitchDeg de signe opposé ; "gauche" et "droite" des yawDeg de signe opposé', () => {
    const scene = load('gaze-sheet') as { objects: { id: string; gaze?: { yawDeg: number; pitchDeg: number } }[] };
    const byLabel = (label: string) => scene.objects.find((o) => o.id.endsWith(`-${label}`))?.gaze;
    const haut = byLabel('haut');
    const bas = byLabel('bas');
    const gauche = byLabel('gauche');
    const droite = byLabel('droite');
    expect(haut?.pitchDeg).toBeLessThan(0);
    expect(bas?.pitchDeg).toBeGreaterThan(0);
    expect(gauche?.yawDeg).toBeLessThan(0);
    expect(droite?.yawDeg).toBeGreaterThan(0);
  });
});

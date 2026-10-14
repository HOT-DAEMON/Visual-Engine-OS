import { describe, expect, it } from 'vitest';
import { compileScene, SceneSpec } from '../src';

function svgOf(input: unknown): string {
  const r = compileScene(input);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
}

const robot = (over: Record<string, unknown> = {}) => ({ kind: 'robot_eye', id: 'r', ...over });
const scene = (objects: unknown[], over: Record<string, unknown> = {}) => ({ objects, ...over });

/** Attributs de la première balise portant l'attribut donné (id ou fill). */
function attrsOf(svg: string, needle: string): Record<string, string> {
  const tag = new RegExp(`<[a-zA-Z]+ [^>]*${needle.replace(/[()#]/g, '\\$&')}[^>]*>`).exec(svg)?.[0];
  if (!tag) throw new Error(`balise introuvable : ${needle}`);
  return Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1] as string, m[2] as string]));
}

const rotate = (v: { x: number; y: number }, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) };
};

describe('schéma robot_eye', () => {
  it('une entrée minimale reçoit tous les défauts', () => {
    const s = SceneSpec.parse(scene([robot()]));
    const r = s.objects[0];
    if (r?.kind !== 'robot_eye') throw new Error('robot attendu');
    expect(r.size).toBe(200);
    expect(r.housing.bolts).toBe(4);
    expect(r.housing.material.metallic).toBe(1); // preset polished_metal résolu
    expect(r.sensor.color).toBe('#3ee0ff');
    expect(r.lens.reticle).toBe(true);
  });

  it('est strict et borné', () => {
    expect(SceneSpec.safeParse(scene([robot({ inconnu: 1 })])).success).toBe(false);
    expect(SceneSpec.safeParse(scene([robot({ housing: { bolts: 13 } })])).success).toBe(false);
    expect(SceneSpec.safeParse(scene([robot({ housing: { bolts: 2.5 } })])).success).toBe(false);
    expect(SceneSpec.safeParse(scene([robot({ gaze: { x: 2 } })])).success).toBe(false);
    expect(SceneSpec.safeParse(scene([robot({ sensor: { color: 'cyan' } })])).success).toBe(false);
  });

  it('refuse un capteur plus grand que l\'ouverture, avec le bon chemin', () => {
    const r = SceneSpec.safeParse(scene([robot({ lens: { aperture: 0.3 }, sensor: { size: 0.4 } })]));
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path.join('.') === 'objects.0.sensor.size');
      expect(issue?.message).toContain('ouverture');
    }
  });

  it('accepte un capteur exactement égal à l\'ouverture', () => {
    expect(SceneSpec.safeParse(scene([robot({ lens: { aperture: 0.4 }, sensor: { size: 0.4 } })])).success).toBe(true);
  });
});

describe('compilation robot_eye', () => {
  it('est déterministe (aucun hasard)', () => {
    expect(svgOf(scene([robot()]))).toBe(svgOf(scene([robot()])));
  });

  it('ne produit ni NaN ni Infinity, même aux bornes', () => {
    const svg = svgOf(
      scene([
        robot({
          size: 20,
          housing: { ringWidth: 0.4, bolts: 12 },
          lens: { aperture: 0.75, rings: 5 },
          sensor: { size: 0.5 },
          gaze: { x: 1, y: -1 },
        }),
      ]),
    );
    expect(svg).not.toMatch(/NaN|Infinity/);
  });

  it('les 12 vis et les anneaux sont bien dessinés ; 0 vis => pas de dégradé de vis', () => {
    const with12 = svgOf(scene([robot({ housing: { bolts: 12 }, lens: { rings: 5 } })]));
    expect(with12.match(/fill="url\(#r-bolt\)"/g)?.length).toBe(12);
    const none = svgOf(scene([robot({ housing: { bolts: 0 } })]));
    expect(none).not.toContain('id="r-bolt"');
  });

  it('le capteur émet un halo, sauf intensité nulle', () => {
    expect(svgOf(scene([robot()]))).toContain('id="r-sensor-halo"');
    expect(svgOf(scene([robot({ sensor: { intensity: 0 } })]))).not.toContain('id="r-sensor-halo"');
  });

  it('le boîtier hérite du système de matériaux : métal => rampe d\'environnement, mat => aucune', () => {
    expect(svgOf(scene([robot()]))).toContain('id="r-bezel-env"');
    const matte = svgOf(scene([robot({ housing: { material: { preset: 'matte', color: '#5a5f68' } } })]));
    expect(matte).not.toContain('id="r-bezel-env"');
    const waxed = svgOf(scene([robot({ housing: { material: { preset: 'waxed_metal', color: '#8e969f' } } })]));
    expect(waxed).toContain('id="r-bezel-coat"'); // le vernis du « métal ciré » est bien appliqué
  });

  it('le verre utilise la couche de brillance partagée', () => {
    const svg = svgOf(scene([robot()]));
    expect(svg).toContain('id="r-glass-spec"');
    expect(svg).toContain('id="r-glass-coat"');
    expect(svg).not.toContain('id="r-glass-base"'); // pas de couleur de base : c'est une couche transparente
  });
});

describe('lumière cohérente : robot', () => {
  const light = { azimuthDeg: 300, elevationDeg: 50 };

  it('le reflet du verre garde la même direction dans le monde quelle que soit la rotation', () => {
    const worldSpot = (rotationDeg: number) => {
      const svg = svgOf(scene([robot({ transform: { rotationDeg } })], { light }));
      const a = attrsOf(svg, 'fill="url(#r-glass-spec)"');
      return rotate({ x: Number(a.cx), y: Number(a.cy) }, rotationDeg);
    };
    const ref = worldSpot(0);
    for (const rot of [37, 90, -120, 180]) {
      const w = worldSpot(rot);
      expect(w.x).toBeCloseTo(ref.x, 2);
      expect(w.y).toBeCloseTo(ref.y, 2);
    }
    expect(ref.x).toBeLessThan(0); // lumière en haut à gauche => reflet en haut à gauche
    expect(ref.y).toBeLessThan(0);
  });

  it('la rampe d\'environnement du métal reste alignée sur le monde (ciel en haut) quand l\'objet tourne', () => {
    for (const rot of [0, 37, 90, -120, 180]) {
      const svg = svgOf(
        scene([{ kind: 'panel', id: 'p', transform: { rotationDeg: rot }, material: { preset: 'polished_metal', color: '#c9d1d9' } }]),
      );
      const g = attrsOf(svg, 'id="p-surface-env"');
      const local = { x: Number(g.x2) - Number(g.x1), y: Number(g.y2) - Number(g.y1) };
      const world = rotate(local, rot);
      expect(world.x).toBeCloseTo(0, 2);
      expect(world.y).toBeGreaterThan(0); // du ciel (haut) vers le sol (bas)
    }
  });

  it('le boîtier robot suit la même règle', () => {
    const svg = svgOf(scene([robot({ transform: { rotationDeg: 60 } })]));
    const g = attrsOf(svg, 'id="r-bezel-env"');
    const world = rotate({ x: Number(g.x2) - Number(g.x1), y: Number(g.y2) - Number(g.y1) }, 60);
    expect(world.x).toBeCloseTo(0, 2);
    expect(world.y).toBeGreaterThan(0);
  });
});

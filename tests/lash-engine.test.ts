import { describe, expect, it } from 'vitest';
import { compileScene, EyeSpec } from '../src';
import { upperLashes, openingGeometry } from '../src/geometry/eye';
import { renderLashGroup } from '../src/render/eye/lashes-render';
import { applyArchetype } from '../src/archetypes';

const eye = (over: Record<string, unknown> = {}) => EyeSpec.parse({ id: 'e', kind: 'eye', ...over });
function svgOf(input: unknown): string {
  const r = compileScene(input);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
}
function upperOf(lashesOverride: Record<string, unknown>, seed = 1) {
  const e = eye({ lashes: { upper: lashesOverride } });
  const g = openingGeometry(e.shape, e.canthi);
  return upperLashes(g, e.lashes.upper, e.shape.height * e.lids.thickness, seed);
}

describe('schéma Lashes : défauts et bornes', () => {
  it('les défauts reproduisent les anciennes constantes (arche pic=0.72, largeur=0.32)', () => {
    const p = eye().lashes.upper;
    expect(p.arch).toEqual({ peak: 0.72, width: 0.32, strength: 0.6 });
    expect(p.angleDeg).toBe(0);
    expect(p.material).toBeNull();
    expect(p.gloss).toBe(0);
  });

  it('"haut" et "bas" partagent le même schéma riche (morphologie/fibres/apparence complètes)', () => {
    const lower = eye().lashes.lower;
    expect(lower).toHaveProperty('arch');
    expect(lower).toHaveProperty('orientationVariation');
    expect(lower).toHaveProperty('gloss');
  });

  it('rejette une valeur hors bornes (ex. count négatif, angleDeg > 45)', () => {
    expect(EyeSpec.safeParse({ id: 'e', kind: 'eye', lashes: { upper: { count: -1 } } }).success).toBe(false);
    expect(EyeSpec.safeParse({ id: 'e', kind: 'eye', lashes: { upper: { angleDeg: 50 } } }).success).toBe(false);
  });
});

describe('géométrie pure (upperLashes/lowerLashes)', () => {
  it('est déterministe (même seed => mêmes cils)', () => {
    expect(upperOf({ count: 10 }, 7)).toEqual(upperOf({ count: 10 }, 7));
  });

  it('une seed différente change le résultat', () => {
    expect(upperOf({ count: 10 }, 1)).not.toEqual(upperOf({ count: 10 }, 2));
  });

  it('positionDispersion=0 : les cils sont répartis strictement régulièrement (aucun jitter de position)', () => {
    const a = upperOf({ count: 8, positionDispersion: 0 }, 1);
    const b = upperOf({ count: 8, positionDispersion: 0 }, 2);
    // Avec dispersion nulle, le tirage de position (jPos) est toujours multiplié par 0 : deux
    // seeds différentes doivent donc produire des bases QUASI identiques (même répartition le
    // long du bord), seules les autres variations (longueur, épaisseur…) diffèrent.
    for (let i = 0; i < a.length; i++) {
      expect(a[i]?.base.x).toBeCloseTo(b[i]?.base.x as number, 4);
      expect(a[i]?.base.y).toBeCloseTo(b[i]?.base.y as number, 4);
    }
  });

  // Pour isoler UN axe de variation, toutes les AUTRES sources de dispersion doivent être
  // neutralisées : la courbure (curl) et l'orientation déplacent elles aussi la pointe, donc
  // affectent la distance base→pointe même quand seule `lengthVariation` nous intéresse ici.
  const NO_OTHER_VARIATION = { curlVariation: 0, orientationVariation: 0, positionDispersion: 0 };

  it('lengthVariation=0 : tous les cils suivent exactement le même profil de longueur (pas de jitter)', () => {
    const a = upperOf({ count: 8, lengthVariation: 0, ...NO_OTHER_VARIATION }, 1);
    const b = upperOf({ count: 8, lengthVariation: 0, ...NO_OTHER_VARIATION }, 2);
    const len = (l: (typeof a)[number]) => Math.hypot(l.tip.x - l.base.x, l.tip.y - l.base.y);
    for (let i = 0; i < a.length; i++) expect(len(a[i]!)).toBeCloseTo(len(b[i]!), 2);
  });

  it('archStrength=0 : longueur uniforme le long du bord (le pic n\'a plus d\'effet)', () => {
    // curl=0 et sweep=0 en plus : avec une courbure ou un éventail non nuls, la DIRECTION de
    // chaque cil change selon sa position, donc même une longueur scalaire constante donnerait des
    // distances pointe-base différentes — ce serait un artefact de direction, pas de longueur.
    const lashes = upperOf(
      { count: 12, lengthVariation: 0, curl: 0, sweep: 0, ...NO_OTHER_VARIATION, arch: { peak: 0.72, width: 0.32, strength: 0 } },
      1,
    );
    const len = (l: (typeof lashes)[number]) => Math.hypot(l.tip.x - l.base.x, l.tip.y - l.base.y);
    const lens = lashes.map(len);
    const min = Math.min(...lens);
    const max = Math.max(...lens);
    expect(max - min).toBeLessThan(0.5); // toutes quasi égales, aux arrondis px près
  });

  it('lengthVariation>0 : produit RÉELLEMENT des longueurs différentes entre cils (effet positif, pas seulement l\'absence d\'effet à 0)', () => {
    const lashes = upperOf({ count: 12, curl: 0, sweep: 0, lengthVariation: 1, arch: { peak: 0.72, width: 0.32, strength: 0 } }, 1);
    const len = (l: (typeof lashes)[number]) => Math.hypot(l.tip.x - l.base.x, l.tip.y - l.base.y);
    const lens = lashes.map(len);
    expect(Math.max(...lens) - Math.min(...lens)).toBeGreaterThan(1);
  });

  it('archStrength=1 : contraste marqué entre le pic et la base (très différent de archStrength=0)', () => {
    const flat = upperOf({ count: 12, lengthVariation: 0, arch: { peak: 0.72, width: 0.32, strength: 0 } }, 1);
    const peaked = upperOf({ count: 12, lengthVariation: 0, arch: { peak: 0.72, width: 0.32, strength: 1 } }, 1);
    const len = (l: { base: { x: number; y: number }; tip: { x: number; y: number } }) => Math.hypot(l.tip.x - l.base.x, l.tip.y - l.base.y);
    const flatSpread = Math.max(...flat.map(len)) - Math.min(...flat.map(len));
    const peakedSpread = Math.max(...peaked.map(len)) - Math.min(...peaked.map(len));
    expect(peakedSpread).toBeGreaterThan(flatSpread);
  });

  it('angleDeg incline TOUS les cils uniformément, indépendamment de sweep', () => {
    const base = upperOf({ count: 10, sweep: 0, lengthVariation: 0, orientationVariation: 0, positionDispersion: 0 }, 1);
    const tilted = upperOf({ count: 10, sweep: 0, angleDeg: 20, lengthVariation: 0, orientationVariation: 0, positionDispersion: 0 }, 1);
    const dirAngle = (l: { base: Vec; tip: Vec }) => Math.atan2(l.tip.y - l.base.y, l.tip.x - l.base.x);
    type Vec = { x: number; y: number };
    for (let i = 0; i < base.length; i++) {
      const diff = ((dirAngle(tilted[i]!) - dirAngle(base[i]!)) * 180) / Math.PI;
      expect(Math.abs(diff)).toBeGreaterThan(5); // rotation nette et cohérente pour chaque cil
    }
  });

  it('tipSharpness est transmis tel quel à chaque cil (pour le rendu)', () => {
    const lashes = upperOf({ count: 5, tipSharpness: 0.9 }, 1);
    for (const l of lashes) expect(l.tipSharpness).toBe(0.9);
  });

  it('ne casse rien aux bornes extrêmes combinées (toutes variations à 1, arche extrême, count max)', () => {
    const lashes = upperOf(
      {
        count: 60,
        lengthVariation: 1,
        thicknessVariation: 1,
        orientationVariation: 20,
        curlVariation: 1,
        positionDispersion: 1,
        arch: { peak: 0, width: 0.1, strength: 1 },
        tipSharpness: 1,
        curl: 1,
      },
      1,
    );
    expect(lashes).toHaveLength(60);
    for (const l of lashes) {
      for (const p of [l.base, l.ctrl, l.tip]) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }
    }
  });

  it('count=0 ne produit aucun cil (indépendamment des autres paramètres)', () => {
    expect(upperOf({ count: 0, lengthVariation: 1 }, 1)).toEqual([]);
  });
});

describe('renderLashGroup (fonction pure)', () => {
  const lash = (over: Record<string, unknown> = {}) => ({
    base: { x: 0, y: 0 },
    ctrl: { x: 5, y: -5 },
    tip: { x: 10, y: -10 },
    baseWidth: 2,
    tipSharpness: 0.6,
    colorJitter: 0,
    ...over,
  });

  it('gloss=0 : aucun liseré, uniquement les remplissages (1 <path> par cil)', () => {
    const out = renderLashGroup([lash(), lash()], '#000000', 1, 0, { x: 0, y: -1 });
    expect(out).toHaveLength(2);
    expect(out.every((m) => m.includes('fill="#000000"'))).toBe(true);
  });

  it('gloss>0 : un liseré supplémentaire par cil, APRÈS tous les remplissages', () => {
    const out = renderLashGroup([lash(), lash()], '#000000', 1, 0.5, { x: 0, y: -1 });
    expect(out).toHaveLength(4);
    expect(out.slice(2).every((m) => m.includes('stroke='))).toBe(true);
  });

  it('colorJitter=0 => couleur de base inchangée ; positif => plus clair ; négatif => plus sombre', () => {
    const base = '#808080';
    const [flat] = renderLashGroup([lash({ colorJitter: 0 })], base, 1, 0, { x: 0, y: -1 });
    const [lighter] = renderLashGroup([lash({ colorJitter: 0.5 })], base, 1, 0, { x: 0, y: -1 });
    const [darker] = renderLashGroup([lash({ colorJitter: -0.5 })], base, 1, 0, { x: 0, y: -1 });
    expect(flat).toContain(`fill="${base}"`);
    expect(lighter).not.toContain(`fill="${base}"`);
    expect(darker).not.toContain(`fill="${base}"`);
    expect(lighter).not.toBe(darker);
  });

  it('est pur (n\'altère pas le tableau de cils fourni)', () => {
    const lashes = [lash()];
    const before = JSON.stringify(lashes);
    renderLashGroup(lashes, '#000000', 1, 0.5, { x: 1, y: 0 });
    expect(JSON.stringify(lashes)).toBe(before);
  });
});

describe('intégration : cils dans compileEye', () => {
  it('se rend sans NaN/Infinity pour toutes les combinaisons extrêmes', () => {
    const svg = svgOf({
      objects: [
        {
          kind: 'eye',
          id: 'e',
          lashes: {
            upper: {
              count: 60,
              lengthVariation: 1,
              thicknessVariation: 1,
              orientationVariation: 20,
              curlVariation: 1,
              positionDispersion: 1,
              gloss: 1,
              colorVariation: 1,
              material: { preset: 'matte', color: '#3a1a8f' },
            },
            lower: { count: 30, gloss: 1, colorVariation: 1 },
          },
        },
      ],
    });
    expect(svg).not.toMatch(/NaN|Infinity/);
  });

  it('est déterministe de bout en bout', () => {
    const scene = { objects: [{ kind: 'eye', id: 'e', lashes: { upper: { gloss: 0.7, colorVariation: 0.4 } } }] };
    expect(svgOf(scene)).toBe(svgOf(JSON.parse(JSON.stringify(scene))));
  });

  it('un matériau de cils propre l\'emporte sur la couleur de la paupière', () => {
    const svg = svgOf({
      objects: [
        { kind: 'eye', id: 'e', lids: { material: { preset: 'matte', color: '#111111' } }, lashes: { upper: { material: { preset: 'matte', color: '#ff00ff' } } } },
      ],
    });
    expect(svg).toContain('#ff00ff');
  });

  it('material=null (défaut) : hérite de la couleur de la paupière, comme avant cette session', () => {
    const svg = svgOf({ objects: [{ kind: 'eye', id: 'e', lids: { material: { preset: 'matte', color: '#123456' } } }] });
    expect(svg).toContain('#123456');
  });

  it('reste compatible avec les 6 archétypes (certains imposent déjà des cils via overlay partiel)', () => {
    for (const archetype of ['realistic', 'reptile', 'feline', 'doll', 'alien', 'demon'] as const) {
      const svg = svgOf({ objects: [{ kind: 'eye', id: 'e', archetype }] });
      expect(svg).not.toMatch(/NaN|Infinity/);
    }
  });

  it('un archétype ne fixant QUE count/length laisse les autres champs de cils à leur valeur par défaut (fusion partielle, pas remplacement en bloc)', () => {
    // reptile fixe upper.count=0 et lower.count=0 ; les champs non précisés (ex. arch.strength)
    // doivent rester ceux du schéma, pas disparaître.
    const e = EyeSpec.parse({ id: 'e', kind: 'eye', archetype: 'reptile' });
    const resolved = applyArchetype(e);
    expect(resolved.lashes.upper.arch.strength).toBe(0.6); // valeur par défaut du schéma, non écrasée
  });
});

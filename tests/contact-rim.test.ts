import { describe, expect, it } from 'vitest';
import { resolveAppearance } from '../src/appearance';
import { compileContact, MAX_PEAK, MIN_CONTACT, relations, renderRim, resolveRims, sideVector, type FaceComponent } from '../src/contact';
import { faceLandmarks, noseGeometry } from '../src/face';
import { direction2D, lightVector } from '../src/lighting/light';
import { faceComponents } from '../src/render/face/components';
import { softKit } from '../src/render/face/soft';
import { Appearance, ContactSpec, FaceParams, RimSpec } from '../src/schema';
import { generateRandomFace } from '../src';

const L = lightVector({ azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity: 1 });
const ra = resolveAppearance('#c99a7e', Appearance.parse({}));
const setup = (over: object = {}) => {
  const p = FaceParams.parse(over);
  const lm = faceLandmarks(p, 320, 420);
  return { p, lm, ...faceComponents(p, lm, noseGeometry(p, lm)) };
};
const rim = (o: object = {}) => RimSpec.parse(o);
const ct = (o: object = {}) => ContactSpec.parse(o);

describe('arbre des composants', () => {
  it('parents, enfants et frères : le nez est enfant de la tête, ses parties sont ses enfants, les ailes sont frères', () => {
    const { components } = setup();
    const r = relations(components);
    expect(r.get('nose')?.parent).toBe('head');
    expect(r.get('nose')?.children.sort()).toEqual(['alaL', 'alaR', 'tip']);
    expect(r.get('alaL')?.siblings.sort()).toEqual(['alaR', 'tip']);
    expect(r.get('nose')?.siblings).toContain('mouth');
    expect(r.get('head')?.parent).toBeNull();
  });

  it('un parent inconnu est traité comme une racine : retirer un composant ne casse pas les autres', () => {
    const { components } = setup();
    const r = relations(components.filter((c) => c.id !== 'nose'));
    expect(r.get('tip')?.parent).toBeNull();
  });

  it('couvre visage, ailes, yeux (orbites), oreilles, menton, joue/bouche, cheveux, cou', () => {
    const ids = setup({ neck: { visible: true }, hair: { style: 'short' } }).components.map((c) => c.id);
    for (const id of ['head', 'nose', 'tip', 'alaL', 'alaR', 'orbitL', 'orbitR', 'earL', 'earR', 'mouth', 'chin', 'neck']) expect(ids).toContain(id);
  });
});

describe('lumières de contour : réglages séparés et propagation parent / enfants / frères', () => {
  it('chaque réglage est indépendant : couleur, intensité, largeur, côté, influence', () => {
    const { components } = setup();
    const base = resolveRims(components, { nose: rim({ intensity: 0.4 }) }, ra).get('nose')!;
    const color = resolveRims(components, { nose: rim({ intensity: 0.4, color: '#ff0000' }) }, ra).get('nose')!;
    const width = resolveRims(components, { nose: rim({ intensity: 0.4, width: 0.9 }) }, ra).get('nose')!;
    const side = resolveRims(components, { nose: rim({ intensity: 0.4, side: 'left' }) }, ra).get('nose')!;
    expect(color.color).toBe('#ff0000');
    expect(color.intensity).toBe(base.intensity);
    expect(width.width).toBe(0.9);
    expect(width.color).toBe(base.color);
    expect(side.side).toBe('left');
    expect(side.intensity).toBe(base.intensity);
  });

  it('côté éclairé : `auto` est l\'opposé de la lumière principale ; left/right/top/bottom fixes ; all = pas de direction', () => {
    const d = direction2D(L);
    expect(sideVector('auto', L)).toEqual({ x: -d.x, y: -d.y });
    expect(sideVector('left', L)).toEqual({ x: -1, y: 0 });
    expect(sideVector('bottom', L)).toEqual({ x: 0, y: 1 });
    expect(sideVector('all', L)).toBeNull();
  });

  it('propagation : le nez éclaire ses enfants (pointe, ailes), son parent (tête) et ses frères (oreilles), d\'après `influence`', () => {
    const { components } = setup();
    // Intensité 0,3 : les parts reçues (0,3 / 0,15 / 0,075) restent sous le plafond des composants sans réglage propre (0,25), l'ordre se lit donc.
    const specs = { nose: rim({ intensity: 0.3, influence: { parent: 0.5, children: 1, siblings: 0.25 } }) };
    const r = resolveRims(components, specs, ra);
    expect(r.get('alaL')!.received).toBeGreaterThan(0.2);
    expect(r.get('tip')!.received).toBeGreaterThan(0.2);
    expect(r.get('head')!.received).toBeGreaterThan(0.1);
    expect(r.get('earL')!.received).toBeGreaterThan(0.05);
    expect(r.get('alaL')!.received).toBeGreaterThan(r.get('head')!.received); // enfants (1) > parent (0,5)
    expect(r.get('head')!.received).toBeGreaterThan(r.get('earL')!.received); // parent (0,5) > frères (0,25)
  });

  it('influence nulle : aucun voisin n\'est touché ; pas de cascade (un seul saut)', () => {
    const { components } = setup();
    const none = resolveRims(components, { nose: rim({ intensity: 0.8, influence: { parent: 0, children: 0, siblings: 0 } }) }, ra);
    for (const [id, v] of none) if (id !== 'nose') expect(v.received).toBe(0);
    // Les ailes ne reçoivent que de la pointe/du nez : la lumière du nez n'arrive jamais « deux fois » à un composant.
    const one = resolveRims(components, { nose: rim({ intensity: 0.8, influence: { parent: 0, children: 1, siblings: 0 } }) }, ra);
    expect(one.get('earL')!.received).toBe(0);
    expect(one.get('mouth')!.received).toBe(0);
  });

  it('le reçu est borné : un voisin ne « vole » pas la lumière de contour, le total reste dans [0, 1]', () => {
    const { components } = setup();
    const all = Object.fromEntries(['head', 'nose', 'tip', 'alae', 'ears', 'chin', 'mouth', 'neck'].map((k) => [k, rim({ intensity: 1, influence: { parent: 1, children: 1, siblings: 1 } })]));
    for (const v of resolveRims(components, all, ra).values()) {
      expect(v.intensity).toBeLessThanOrEqual(1);
      expect(v.intensity).toBeGreaterThanOrEqual(0);
      expect(v.received).toBeLessThanOrEqual(0.5 + 1e-9);
    }
  });

  it('le liseré se dessine : couleur voulue, flou, découpé à la silhouette ; intensité nulle = rien', () => {
    const { components } = setup();
    const r = resolveRims(components, { nose: rim({ intensity: 0.6, color: '#ff8800' }) }, ra).get('nose')!;
    const c = components.find((x) => x.id === 'nose')!;
    const out = renderRim('t', c, r, L, 1, softKit('t', 320, 420));
    expect(out.markup).toContain('clip-path');
    expect(out.markup).toContain('filter');
    expect(out.defs.join('')).toContain('#ff8800');
    expect(renderRim('t', c, { ...r, intensity: 0 }, L, 1, softKit('t', 320, 420)).markup).toBe('');
  });
});

describe('ombres de contact : ni flottantes ni collées', () => {
  const run = (spec: object, light = L, over: object = {}) => {
    const { components, receivers } = setup(over);
    return compileContact('t', components, { nose: ct(spec), alae: ct(spec), orbits: ct(spec), ears: ct(spec), jaw: ct(spec), mouth: ct(spec), hair: ct(spec) }, 1, light, '#3a2a28', receivers, 1);
  };

  it('opacité plafonnée : même à force maximale, jamais plus de MAX_PEAK (pas de pièce collée)', () => {
    for (const m of run({ strength: 1 }).metrics) expect(m.peak).toBeLessThanOrEqual(MAX_PEAK + 1e-9);
  });

  it('toujours une part d\'occlusion au contact, même en directionnalité maximale (pas d\'objet flottant)', () => {
    for (const m of run({ strength: 0.6, directionality: 1 }).metrics) expect(m.contactShare).toBeGreaterThanOrEqual(MIN_CONTACT - 1e-9);
    for (const m of run({ strength: 0.6, directionality: 0 }).metrics) expect(m.contactShare).toBeCloseTo(1, 9);
  });

  it('décalage : croît avec la hauteur du composant et avec l\'inclinaison de la lumière ; flou : croît avec la douceur et la taille de la source', () => {
    const high = lightVector({ azimuthDeg: 330, elevationDeg: 85, color: '#ffffff', intensity: 1 });
    const low = lightVector({ azimuthDeg: 330, elevationDeg: 20, color: '#ffffff', intensity: 1 });
    const off = (l: typeof L) => run({}, l).metrics.find((m) => m.id === 'head')!.offsetPx;
    expect(off(low)).toBeGreaterThan(off(high));
    const nose = run({}).metrics.find((m) => m.id === 'nose')!;
    const head = run({}).metrics.find((m) => m.id === 'head')!;
    expect(head.offsetPx).toBeGreaterThan(nose.offsetPx); // le menton est plus « haut » que le nez au-dessus du cou
    expect(run({ softness: 1 }).metrics[0]!.blurPx).toBeGreaterThan(run({ softness: 0 }).metrics[0]!.blurPx);
    const big = lightVector({ azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity: 1, sourceSize: 1, shadowHardness: 0 });
    const small = lightVector({ azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity: 1, sourceSize: 0, shadowHardness: 1 });
    expect(run({}, big).metrics[0]!.blurPx).toBeGreaterThan(run({}, small).metrics[0]!.blurPx);
  });

  it('master = 0 supprime toutes les ombres ; strength = 0 supprime celles du composant', () => {
    const { components, receivers } = setup();
    expect(compileContact('t', components, { nose: ct({}) }, 0, L, '#000', receivers, 1).metrics).toHaveLength(0);
    expect(run({ strength: 0 }).metrics).toHaveLength(0);
  });

  it('un composant futur s\'ajoute en le déclarant : il reçoit une ombre sans autre modification', () => {
    const { receivers } = setup();
    const earring: FaceComponent = { id: 'earring', parent: 'earL', kind: 'caster', polys: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]], depth: 4, receivers: ['head'], contact: 'ears' };
    const out = compileContact('t', [earring], { ears: ct({ strength: 0.7 }) }, 1, L, '#000', receivers, 1);
    expect(out.markup.get('earring')).toContain('clip-path');
    expect(out.metrics[0]!.id).toBe('earring');
  });

  it('les ombres sont déterministes et les visages aléatoires n\'en produisent aucune hors bornes', () => {
    for (let s = 1; s <= 20; s++) {
      const f = generateRandomFace(s * 211);
      const lm = faceLandmarks(f.params, f.width, f.height);
      const { components, receivers } = faceComponents(f.params, lm, noseGeometry(f.params, lm));
      const { master, ...specs } = f.params.lighting.contacts;
      const a = compileContact('t', components, specs, master, L, '#000', receivers, 1);
      const b = compileContact('t', components, specs, master, L, '#000', receivers, 1);
      expect(JSON.stringify([...a.markup])).toBe(JSON.stringify([...b.markup]));
      for (const m of a.metrics) { expect(m.peak).toBeLessThanOrEqual(MAX_PEAK + 1e-9); expect(Number.isFinite(m.blurPx + m.offsetPx)).toBe(true); }
    }
  });
});

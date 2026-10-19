import { describe, expect, it } from 'vitest';
import { faceLandmarks, noseFrame, noseGeometry, noseProfile } from '../src/face';
import { DORSUM_SHAPES, FaceParams, type FaceParamsInput } from '../src/schema';
import { inPoly } from '../src/face/poly';
import { DORSUM_SAMPLES } from '../src/face/nose/dorsum';
import { generateRandomFace } from '../src';

const W = 320;
const H = 420;
const build = (nose: FaceParamsInput['nose'] = {}, rest: FaceParamsInput = {}) => {
  const p = FaceParams.parse({ ...rest, nose });
  const lm = faceLandmarks(p, W, H);
  return { p, lm, g: noseGeometry(p, lm) };
};

describe('moteur de nez : géométrie pure', () => {
  it('est déterministe et ne produit que des nombres finis', () => {
    const a = build().g;
    const b = build().g;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    for (const q of [...a.silhouette, ...a.tip.poly, ...a.alae.left.poly, ...a.nostrils.right.poly, ...a.profile]) expect(Number.isFinite(q.x + q.y)).toBe(true);
  });

  it('la racine ne dépend que de sa hauteur : la pointe et les ailes ne bougent pas', () => {
    const lo = build({ root: { height: 0.1 } }).g;
    const hi = build({ root: { height: 0.9 } }).g;
    expect(hi.root.y).toBeLessThan(lo.root.y); // racine plus haute = ordonnée plus petite
    expect(hi.tip.c.y).toBeCloseTo(lo.tip.c.y, 9);
    expect(hi.alae.right.outerX).toBeCloseTo(lo.alae.right.outerX, 9);
  });

  it('la largeur de la pointe élargit la pointe sans toucher la largeur des ailes', () => {
    const a = build({ tip: { width: 0.1 } }).g;
    const b = build({ tip: { width: 0.9 } }).g;
    expect(b.tip.rx).toBeGreaterThan(a.tip.rx * 1.3);
    expect(b.alae.right.outerX).toBeCloseTo(a.alae.right.outerX, 9);
  });

  it('rondeur : pointue = plus haute que large, bulbeuse = presque ronde', () => {
    const sharp = build({ tip: { roundness: 0 } }).g.tip;
    const round = build({ tip: { roundness: 1 } }).g.tip;
    expect(sharp.ry / sharp.rx).toBeGreaterThan(round.ry / round.rx);
  });

  it('orientation : une pointe relevée est plus haute et montre des narines plus grandes', () => {
    const down = build({ tip: { rotation: -1 } }).g;
    const up = build({ tip: { rotation: 1 } }).g;
    expect(up.tip.c.y).toBeLessThan(down.tip.c.y);
    expect(up.nostrils.right.a).toBeGreaterThan(down.nostrils.right.a);
  });

  it('profil du dorsum : concave < droit < convexe à mi-arête (même racine, même pointe)', () => {
    const mid = Math.floor(DORSUM_SAMPLES / 2);
    const z = (shape: (typeof DORSUM_SHAPES)[number]): number => {
      const { p, lm } = build({ dorsum: { shape, curvature: 0.8 } });
      const F = noseFrame(p, lm);
      return noseProfile(p, F, DORSUM_SAMPLES, 5).ridge[mid] as number;
    };
    expect(z('concave')).toBeLessThan(z('straight'));
    expect(z('straight')).toBeLessThan(z('convex'));
    // Aux deux bouts l'écart est nul : le profil se raccorde à la racine et à la pointe.
    const { p, lm } = build({ dorsum: { shape: 'convex', curvature: 1 } });
    const r = noseProfile(p, noseFrame(p, lm), DORSUM_SAMPLES, 5).ridge;
    const s = noseProfile(...(() => { const b = build({ dorsum: { shape: 'straight' } }); return [b.p, noseFrame(b.p, b.lm), DORSUM_SAMPLES, 5] as const; })()).ridge;
    expect(r[0]).toBeCloseTo(s[0] as number, 9);
    expect(r[DORSUM_SAMPLES - 1]).toBeCloseTo(s[DORSUM_SAMPLES - 1] as number, 9);
  });

  it('dorsum asymétrique : l\'axe dévie ; droit : l\'axe reste sur la ligne médiane', () => {
    const dev = (g: ReturnType<typeof build>['g']): number => Math.max(...g.dorsum.axis.map((q) => Math.abs(q.x)));
    expect(dev(build({ dorsum: { shape: 'straight', deviation: 1 } }).g)).toBe(0);
    expect(dev(build({ dorsum: { shape: 'asymmetric', deviation: 0.8 } }).g)).toBeGreaterThan(2);
    // Le signe de la déviation inverse le S.
    const a = build({ dorsum: { shape: 'asymmetric', deviation: 0.8 } }).g.dorsum.axis[5] as { x: number };
    const b = build({ dorsum: { shape: 'asymmetric', deviation: -0.8 } }).g.dorsum.axis[5] as { x: number };
    expect(a.x * b.x).toBeLessThan(0);
  });

  it('projection de la pointe : plus elle croît, plus la pointe avance en profil (sans bouger de face)', () => {
    const a = build({ tip: { projection: 0.1 } }).g;
    const b = build({ tip: { projection: 0.9 } }).g;
    expect(b.tip.projectionPx).toBeGreaterThan(a.tip.projectionPx * 1.4);
    expect(b.tip.c.y).toBeCloseTo(a.tip.c.y, 9);
  });

  it('ailes : l\'épaisseur grandit avec `thickness`, l\'écartement avec `flare`', () => {
    expect(build({ alae: { thickness: 1 } }).g.alae.right.thicknessPx).toBeGreaterThan(build({ alae: { thickness: 0 } }).g.alae.right.thicknessPx * 1.5);
    expect(build({ alae: { flare: 1 } }).g.alae.right.outerX).toBeGreaterThan(build({ alae: { flare: 0 } }).g.alae.right.outerX);
  });

  it('narines : contenues dans leur aile, sous la pointe, axe convergent, quelles que soient les combinaisons', () => {
    for (const shape of [0, 1]) for (const tilt of [0, 24, 50]) for (const rotation of [-1, 0, 1]) for (const flare of [0, 1]) for (const nostril of [0.2, 1]) {
      const { g } = build({ nostril, nostrils: { shape, tiltDeg: tilt }, tip: { rotation }, alae: { flare } });
      for (const side of ['left', 'right'] as const) {
        const n = g.nostrils[side];
        expect(n.poly.filter((q) => inPoly(g.alae[side].poly, q.x, q.y)).length / n.poly.length).toBeGreaterThanOrEqual(0.95);
        expect(n.c.y).toBeGreaterThan(g.tip.c.y);
        if (tilt > 3) {
          // Convergence mesurée le long de l'AXE de la narine : les points de l'extrémité haute sont plus près de la ligne médiane que ceux de l'extrémité basse.
          const t = (n.tiltDeg * Math.PI) / 180;
          const u = { x: -n.side * Math.sin(t), y: -Math.cos(t) };
          const along = n.poly.map((q) => ({ x: Math.abs(q.x), k: (q.x - n.c.x) * u.x + (q.y - n.c.y) * u.y }));
          const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
          expect(mean(along.filter((q) => q.k > 0.5 * n.a).map((q) => q.x))).toBeLessThan(mean(along.filter((q) => q.k < -0.5 * n.a).map((q) => q.x)));
        }
      }
    }
  });

  it('asymétrie des narines : un côté plus grand que l\'autre', () => {
    const g = build({ nostrils: { asymmetry: 0.8 } }).g;
    expect(g.nostrils.right.a).toBeGreaterThan(g.nostrils.left.a);
  });

  it('le nez est un ENFANT du visage : il suit la ligne des yeux et reste entre les canthi', () => {
    const hi = build({}, { eyeLine: 0.42 });
    const lo = build({}, { eyeLine: 0.56 });
    expect(lo.g.root.y).toBeGreaterThan(hi.g.root.y);
    expect(lo.g.baseY).toBeGreaterThan(hi.g.baseY);
    for (const b of [hi, lo]) expect(b.g.root.half).toBeLessThanOrEqual(Math.abs(b.lm.innerCanthus.right.x) * 0.85 + 1e-9);
  });

  it('raccords : glabelle, creux naso-jugal, sillon alaire et pli naso-génien existent ; le pli se creuse quand la bouche s\'ouvre', () => {
    const closed = build({}, { mouth: { open: 0 } }).g.junctions;
    const open = build({}, { mouth: { open: 1 }, jaw: { tissue: 1 } }).g.junctions;
    expect(closed.glabella.depth).toBeGreaterThan(0);
    for (const k of ['orbital', 'alarGroove', 'nasolabial'] as const) expect(closed[k].left.length).toBeGreaterThan(3);
    expect(open.nasolabial.depth).toBeGreaterThan(closed.nasolabial.depth);
  });

  it('visages aléatoires : toutes les structures du nez sont non vides et cohérentes', () => {
    for (let s = 1; s <= 40; s++) {
      const f = generateRandomFace(s * 131);
      const lm = faceLandmarks(f.params, f.width, f.height);
      const g = noseGeometry(f.params, lm);
      expect(g.dorsum.axis).toHaveLength(DORSUM_SAMPLES);
      expect(g.root.y).toBeLessThan(g.tip.c.y);
      expect(g.tip.c.y).toBeLessThan(g.baseY);
      expect(g.baseY).toBeLessThan(lm.lips.topY);
    }
  });
});

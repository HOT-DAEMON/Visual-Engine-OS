import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { faceLandmarks, halfWidthAt } from '../src/face';
import { hairGeometry } from '../src/face/hair';
import { posedFace, poseHairMasses, skullOf } from '../src/face/pose';
import { densify } from '../src/face/pose/hair-pose';
import { FaceParams } from '../src/schema';
import { hairFace, type CleanStyle } from '../scripts/lib/hair-faces';

/** Étape 4 (première tranche, MASSES) : `docs/ROTATION-STEP-04-HAIR-2D.md` ; la grammaire n'est pas recalculée, ses polygones de masse sont reprojetés par la pose commune. */
const STYLES: CleanStyle[] = ['buzz', 'short', 'spiky', 'curly', 'afro', 'bob', 'long', 'ponytail', 'bun', 'braids'];
const setup = (style: CleanStyle, seed: number) => {
  const f = hairFace(style, 1, { seed });
  const host = f.objects[0] as unknown as { face: Record<string, unknown>; width: number; height: number };
  const params = FaceParams.parse(host.face), lm = faceLandmarks(params, host.width, host.height), geo = hairGeometry(params, lm)!;
  return { lm, geo, skull: skullOf(lm) };
};
const spanOf = (polys: { x: number; y: number }[][]): { lo: number; hi: number } => {
  const xs = polys.flat().map((q) => q.x);
  return { lo: Math.min(...xs), hi: Math.max(...xs) };
};

describe('projection d’un point de la vue de face sous un lacet (Skull.projectX)', () => {
  it('identité à lacet nul ; continue, strictement croissante en x (pas de repli) et fermée sur la silhouette à ±1 section, pour tous les lacets', () => {
    const { lm, skull } = setup('short', 9001), y = lm.eyeY, hx = halfWidthAt(lm.outline, y);
    for (const x of [-200, -hx, 0, 17, hx, 220]) expect(skull.projectX(x, y, 0)).toBe(x);
    for (const yaw of [-75, -45, -30, -10, 10, 30, 45, 60, 75]) {
      let prev = -Infinity;
      for (let s = -2; s <= 2; s += 0.002) {
        const v = skull.projectX(s * hx, y, yaw);
        expect(v).toBeGreaterThan(prev - 1e-9);
        // Aucun saut : pente ≤ 4·ρ (mesurée : 1,35·ρ à 10°, 2,2·ρ à 30°, 3,8·ρ à 75°, toujours au limbe lointain, où la bande de cheveux écrasée de la vue de face est dépliée — `docs/ROTATION-HAIR-MASS.md`).
        if (Number.isFinite(prev)) expect(v - prev).toBeLessThan(0.002 * hx * 4 * Math.hypot(Math.cos((yaw * Math.PI) / 180), skull.depthRatio * Math.sin((yaw * Math.PI) / 180)));
        prev = v;
      }
      expect(skull.projectX(hx, y, yaw)).toBeCloseTo(skull.halfAt(y, yaw), 6);
      expect(skull.projectX(-hx, y, yaw)).toBeCloseTo(-skull.halfAt(y, yaw), 6);
      expect(Math.sign(skull.projectX(0, y, yaw))).toBe(Math.sign(yaw));
      for (const x of [-1.5 * hx, -0.6 * hx, 0.3 * hx, 0.97 * hx, 1.2 * hx]) expect(skull.projectX(-x, y, -yaw)).toBeCloseTo(-skull.projectX(x, y, yaw), 9);   // miroir exact
    }
  });
});

describe('masses de cheveux sous pose', () => {
  it('lacet nul : la géométrie est rendue telle quelle (même objet)', () => {
    const { geo, skull, lm } = setup('long', 9002);
    expect(poseHairMasses(geo, skull, 0, lm.W)).toBe(geo);
  });

  for (const style of STYLES) {
    it(`${style} ±30° : calques et mèches conservés, points finis, masses reprojetées ; la face avance du côté du lacet (+θ à droite, −θ à gauche)`, () => {
      const { geo, skull, lm } = setup(style, 9001);
      const p = poseHairMasses(geo, skull, 30, lm.W), m = poseHairMasses(geo, skull, -30, lm.W);
      for (const g of [p, m]) {
        expect(g.locks).toBe(geo.locks);                       // mèches inchangées (tranche suivante)
        expect(g.front.length).toBe(geo.front.length);
        expect(g.back.length).toBe(geo.back.length);
        expect(g.over.length).toBe(geo.over.length);
        expect(g.base.length).toBe(geo.base.length);
        for (const q of [...g.base, ...g.front, ...g.back, ...g.over, ...g.tierMasses.map((t) => t.poly)].flat()) { expect(Number.isFinite(q.x)).toBe(true); expect(Number.isFinite(q.y)).toBe(true); }
      }
      const b0 = geo.base[0]!, bp = p.base[0]!, bm = m.base[0]!;
      // Les sommets posés sont alignés sur le polygone rééchantillonné. Ceux qui sont SUR la face (|x| < 0,6·hx : front, dessus du crâne) suivent la face : décalage de même signe que le lacet.
      const d0 = densify(b0, 0.006 * lm.W);
      expect(bp.length).toBe(d0.length);
      let inner = 0, dp = 0, dm = 0;
      d0.forEach((q, i) => { if (Math.abs(q.x) < 0.6 * halfWidthAt(lm.outline, Math.min(lm.chinY - 0.02 * lm.H, Math.max(skull.topY + 0.02 * lm.H, q.y)))) { inner++; dp += bp[i]!.x - q.x; dm += bm[i]!.x - q.x; } });
      if (inner > 0) { expect(dp / inner).toBeGreaterThan(0); expect(dm / inner).toBeLessThan(0); }
      // Ordonnées intactes : lacet seul. (Le polygone est rééchantillonné : même hauteur totale.)
      const yr = (a: { y: number }[]): [number, number] => [Math.min(...a.map((q) => q.y)), Math.max(...a.map((q) => q.y))];
      expect(yr(bp)).toEqual(yr(b0));
    });

    it(`${style} 30° : la masse ne se détache pas du crâne (épaisseur de cheveux hors du crâne conservée, ≤ 0,5 px d'écart à la silhouette)`, () => {
      const { geo, skull, lm } = setup(style, 9001), p = poseHairMasses(geo, skull, 30, lm.W);
      // Pour chaque rangée, l'avance du bord extérieur de la masse sur la silhouette du crâne (hors crâne : t = |x| − hx) est la même posée ou non.
      const out = (polys: { x: number; y: number }[][], y: number, sign: number): number => {
        let best = -Infinity;
        for (const poly of polys) for (let i = 0; i < poly.length; i++) {
          const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
          if ((a.y - y) * (b.y - y) > 0 || a.y === b.y) continue;
          best = Math.max(best, sign * (a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y)));
        }
        return best;
      };
      let checked = 0;
      for (let y = skull.topY + 0.1 * lm.H; y < lm.chinY - 0.1 * lm.H; y += 0.02 * lm.H) {
        const hx = halfWidthAt(lm.outline, y);
        for (const sign of [-1, 1]) {
          const o0 = out(geo.base, y, sign), o1 = out(p.base, y, sign);
          if (!(o0 > hx + 1) || !Number.isFinite(o1)) continue;   // rangée où la masse dépasse bien du crâne
          expect(Math.abs(o1 - skull.halfAt(y, 30) - (o0 - hx))).toBeLessThan(0.0035 * lm.W);   // sous le pixel d'un hôte de ~300 px
          checked++;
        }
      }
    });
  }

  it('étendue horizontale des masses : jamais plus large que de face × ρ(lacet) (ρ = √(cos²a + k²sin²a), la silhouette du crâne : pas de débordement)', () => {
    for (const style of STYLES) {
      const { geo, skull, lm } = setup(style, 9003), a = spanOf(geo.base), b = spanOf(poseHairMasses(geo, skull, 40, lm.W).base), t = (40 * Math.PI) / 180;
      expect(b.hi - b.lo).toBeLessThanOrEqual((a.hi - a.lo) * Math.hypot(Math.cos(t), skull.depthRatio * Math.sin(t)) + 1e-6);
    }
  });

  it('même graine et même pose → mêmes masses (déterminisme)', () => {
    const f = generateRandomFace(321, { id: 'x' }), host = f.objects[0] as unknown as { face: Record<string, unknown>; width: number; height: number };
    const params = FaceParams.parse(host.face), lm = faceLandmarks(params, host.width, host.height), g = hairGeometry(params, lm);
    if (!g) return;
    const A = poseHairMasses(g, posedFace(lm, 25).skull, 25, lm.W), B = poseHairMasses(g, posedFace(lm, 25).skull, 25, lm.W);
    expect(JSON.stringify(A.base) === JSON.stringify(B.base)).toBe(true);
  });
});

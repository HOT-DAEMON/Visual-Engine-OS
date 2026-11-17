import { describe, expect, it } from 'vitest';
import { faceLandmarks, halfWidthAt } from '../src/face';
import { hairGeometry, type HairLock } from '../src/face/hair';
import { FACING, STRAND_SCALE, facing, poseHair, poseLock, rootOf, rowCache, skullOf } from '../src/face/pose';
import { FaceParams } from '../src/schema';
import { WIDTH_SLACK, widthBounds } from '../src/verify/hair-pose';
import { hairFace, type CleanStyle } from '../scripts/lib/hair-faces';

/** Étape 4, tranches 2 (MÈCHES) et 3 (éléments liés), 5 et 6 (attaches) : `docs/ROTATION-HAIR-STRANDS.md`, `docs/ROTATION-HAIR-LINKED.md`. */
const STYLES: CleanStyle[] = ['buzz', 'short', 'spiky', 'curly', 'afro', 'bob', 'long', 'ponytail', 'bun', 'braids'];
const setup = (style: CleanStyle, seed = 9001) => {
  const f = hairFace(style, 1, { seed }), host = f.objects[0] as unknown as { face: Record<string, unknown>; width: number; height: number };
  const params = FaceParams.parse(host.face), lm = faceLandmarks(params, host.width, host.height), geo = hairGeometry(params, lm)!;
  return { lm, geo, skull: skullOf(lm) };
};
const mirrorLock = (l: HairLock): HairLock => ({ ...l, poly: l.poly.map((q) => ({ x: -q.x, y: q.y })), spine: l.spine?.map((q) => ({ x: -q.x, y: q.y })) });
const finite = (a: { x: number; y: number }[]): boolean => a.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y));
const ext = (a: { x: number }[]): number => Math.max(...a.map((q) => q.x)) - Math.min(...a.map((q) => q.x));

describe('chevelure complète sous pose (poseHair)', () => {
  it('lacet nul : la géométrie est rendue telle quelle (même objet)', () => {
    const { geo, skull, lm } = setup('long', 9002);
    expect(poseHair(geo, skull, 0, lm.W)).toBe(geo);
  });

  for (const style of STYLES) for (const yaw of [-45, -30, 30, 45]) {
    it(`${style} ${yaw}° : tout fini, mêmes nombres de mèches et de calques, mêmes polygones de mèche dans les mêmes calques`, () => {
      const { geo, skull, lm } = setup(style), p = poseHair(geo, skull, yaw, lm.W);
      expect(p.locks.length).toBe(geo.locks.length);
      for (const k of ['front', 'back', 'over', 'base'] as const) expect(p[k].length).toBe(geo[k].length);
      for (const a of [p.hairline, p.scalp, p.bare.part ?? [], ...p.bare.thin, ...(p.shaved ?? []), ...(p.skinShadows ?? []), ...p.locks.flatMap((l) => [l.poly, l.spine ?? []]), p.ties.map((t) => t.at), p.fringeBottom ?? [], p.boundary.loop.map((q) => q.p), p.sides.left.earZone, p.sides.right.earZone]) expect(finite(a)).toBe(true);
      // Chaque mèche posée est dans le calque où était la mèche d'origine (le rendu lit `front` = [base, bases de frange, mèches]).
      geo.locks.forEach((l, i) => {
        for (const k of ['front', 'back', 'over'] as const) {
          const at = geo[k].indexOf(l.poly);
          if (at >= 0) expect(p[k][at]).toBe(p.locks[i]!.poly);
        }
      });
    });
  }

  it('mèche ordinaire : racine EXACTEMENT sur la projection de la masse ; largeur à chaque ordonnée multipliée par un facteur dans [0,45 ; 1] (jamais étirée) ; ordonnées intactes', () => {
    let checked = 0, rows = 0, worstMax = 0, worstMin = Infinity;
    for (const style of STYLES) for (const yaw of [-45, -30, 30, 45]) {
      const { geo, skull, lm } = setup(style), cache = rowCache(skull, yaw);
      for (const l of geo.locks) {
        if (l.part === 'tail' || l.part === 'bun' || ext(l.poly) < 0.008 * lm.W) continue;
        const q = poseLock(l, skull, yaw, lm.W, geo.ties, cache), r0 = rootOf(l), r1 = rootOf(q);
        if (l.spine?.length) { expect(r1.x).toBeCloseTo(skull.projectX(r0.x, r0.y, yaw), 6); expect(r1.y).toBe(r0.y); }   // racine = début de la ligne médiane ; sans ligne médiane la racine est le centre de la forme (non conservé par une carte non affine)
        expect(Math.min(...q.poly.map((v) => v.y))).toBeCloseTo(Math.min(...l.poly.map((v) => v.y)), 9);   // lacet seul : mêmes ordonnées (contour rééchantillonné)
        expect(Math.max(...q.poly.map((v) => v.y))).toBeCloseTo(Math.max(...l.poly.map((v) => v.y)), 9);
        const wb = widthBounds(l.poly, q.poly, 0.006 * lm.W, WIDTH_SLACK * lm.W);
        if (wb.n) { worstMax = Math.max(worstMax, wb.hi); worstMin = Math.min(worstMin, wb.lo); rows += wb.n; }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(500);
    expect(rows).toBeGreaterThan(2000);
    expect(worstMax).toBeLessThanOrEqual(STRAND_SCALE.max + 1e-6);
    expect(worstMin).toBeGreaterThanOrEqual(STRAND_SCALE.min - 1e-6);
  });

  it('pente analytique de la projection = différence finie ; la carte d’une mèche est monotone de pente bornée à chaque rangée', () => {
    const { skull, lm } = setup('long');
    for (const y of [skull.topY + 0.1 * lm.H, lm.eyeY, lm.jawY + 0.05 * lm.H]) for (const yaw of [-45, -30, 15, 30, 60]) {
      const R = skull.rowMap(y, yaw);
      for (let s = -1.6; s <= 1.6; s += 0.07) {
        if (Math.abs(Math.abs(s) - 1) < 0.02) continue;
        const x = s * R.hx, e = 1e-4 * R.hx;
        expect(R.slope(x)).toBeCloseTo((R.x(x + e) - R.x(x - e)) / (2 * e), 3);
        expect(R.x(x)).toBeCloseTo(skull.projectX(x, y, yaw), 9);
      }
    }
  });

  it('miroir exact : poser une mèche miroir à −θ = miroir de la mèche posée à +θ (mèches ordinaires et pièces attachées)', () => {
    for (const style of STYLES) {
      const { geo, skull, lm } = setup(style), tiesM = geo.ties.map((t) => ({ ...t, at: { x: -t.at.x, y: t.at.y } }));
      for (const l of geo.locks.slice(0, 80)) {
        const a = poseLock(l, skull, 30, lm.W, geo.ties), b = poseLock(mirrorLock(l), skull, -30, lm.W, tiesM);
        a.poly.forEach((q, i) => { expect(b.poly[i]!.x).toBeCloseTo(-q.x, 6); expect(b.poly[i]!.y).toBeCloseTo(q.y, 6); });
        expect(b.alpha ?? 1).toBeCloseTo(a.alpha ?? 1, 9);
      }
    }
  });

  it('mèche de devant : opaque face à la caméra, invisible dos à elle (formule de visibilité), jamais plus opaque que sa visibilité', () => {
    const { skull, lm } = setup('long'), y = lm.eyeY, hx = halfWidthAt(lm.outline, y);
    expect(facing(skull, 0, y, 0)).toBeCloseTo(1, 9);
    let prev = Infinity;
    for (let s = -0.5; s <= 1; s += 0.05) { const n = facing(skull, s * hx, y, 30); expect(n).toBeLessThanOrEqual(prev + 1e-9); prev = n; }   // du point de face au limbe proche (φ ≥ −30°) : la visibilité décroît
    expect(facing(skull, hx, y, 60)).toBeLessThan(0);                                   // limbe proche à 60° : dos à la caméra
    expect(facing(skull, -hx, y, 60)).toBeGreaterThan(FACING.full);                     // limbe lointain : de face
    for (const style of STYLES) for (const yaw of [-45, -30, 30, 45]) {
      const { geo, skull: sk, lm: m } = setup(style);
      geo.locks.forEach((l) => { const q = poseLock(l, sk, yaw, m.W, geo.ties); if (l.layer !== 'over') expect(q.alpha).toBeUndefined(); else expect(q.alpha ?? 1).toBeLessThanOrEqual(1); });
    }
  });

  it('implantation posée : strictement croissante, dans la silhouette posée du crâne, au-dessus des sourcils, lacet seul (ordonnées intactes aux points d\'origine)', () => {
    for (const style of STYLES) for (const yaw of [-45, -30, 30, 45]) {
      const { geo, skull, lm } = setup(style), p = poseHair(geo, skull, yaw, lm.W);
      p.hairline.forEach((q, i) => {
        if (i) expect(q.x).toBeGreaterThan(p.hairline[i - 1]!.x);
        expect(Math.abs(q.x)).toBeLessThanOrEqual(skull.halfAt(Math.min(lm.chinY - 0.02 * lm.H, Math.max(skull.topY + 0.02 * lm.H, q.y)), yaw) + 0.25);
        expect(q.y).toBeLessThanOrEqual(lm.browLimitY + 1e-9);
      });
      expect(Math.min(...p.hairline.map((q) => q.y))).toBeCloseTo(Math.min(...geo.hairline.map((q) => q.y)), 6);
      // yAt / at relisent la ligne posée.
      const mid = p.boundary.hairline.at(0);
      expect(p.boundary.hairline.yAt(mid.x)).toBeCloseTo(mid.y, 4);
    }
  });

  it('lisière posée = la lisière de face reprojetée point par point (tronçons relus sur la lisière posée)', () => {
    const { geo, skull, lm } = setup('short'), p = poseHair(geo, skull, 30, lm.W);
    expect(p.boundary.loop.length).toBe(geo.boundary.loop.length);
    geo.boundary.loop.forEach((q, i) => { expect(p.boundary.loop[i]!.p.x).toBeCloseTo(skull.projectX(q.p.x, q.p.y, 30), 9); expect(p.boundary.loop[i]!.p.y).toBe(q.p.y); });
    expect(p.boundary.segment('sideburn', 1).map((q) => q.p.x)).toEqual(geo.boundary.segment('sideburn', 1).map((q) => skull.projectX(q.p.x, q.p.y, 30)));
  });

  it('attaches : la queue / le chignon sont rigides (x·cos + z·sin) : à ±θ symétriques, et la racine reste collée à son attache', () => {
    for (const style of ['ponytail', 'bun'] as CleanStyle[]) for (const yaw of [-45, -30, 30, 45]) {
      const { geo, skull, lm } = setup(style), p = poseHair(geo, skull, yaw, lm.W);
      expect(p.ties.length).toBe(geo.ties.length);
      geo.locks.forEach((l, i) => {
        if (l.part !== 'tail' && l.part !== 'bun') return;
        const r0 = rootOf(l), r1 = rootOf(p.locks[i]!);
        let bd = Infinity, bt = 0;
        geo.ties.forEach((t, k) => { const d = Math.hypot(t.at.x - r0.x, t.at.y - r0.y); if (d < bd) { bd = d; bt = k; } });
        const t1 = p.ties[bt]!;
        expect(Math.hypot(t1.at.x - r1.x, t1.at.y - r1.y)).toBeLessThanOrEqual(bd + 1);
      });
    }
  });

  it('cheveux sous la mâchoire : la largeur de référence est continue à la mâchoire et ne se rétrécit pas avec le menton ; projection strictement croissante à toutes les hauteurs', () => {
    for (const style of ['bob', 'long'] as CleanStyle[]) {
      const { skull, lm } = setup(style);
      expect(skull.hangHalf(lm.jawY + 0.001)).toBeCloseTo(skull.hangHalf(lm.jawY - 0.001), 1);
      for (let y = skull.topY + 0.05 * lm.H; y < lm.chinY - 0.02 * lm.H; y += 0.03 * lm.H) {
        expect(skull.hangHalf(y)).toBeGreaterThanOrEqual(halfWidthAt(lm.outline, y) - 1e-9);
        if (y > lm.jawY) expect(skull.hangHalf(y)).toBeGreaterThanOrEqual(skull.jawHalf - 1e-9);
        for (const yaw of [-45, -20, 20, 45]) {
          let prev = -Infinity;
          for (let s = -1.8; s <= 1.8; s += 0.01) { const v = skull.projectX(s * skull.hangHalf(y), y, yaw); expect(v).toBeGreaterThan(prev - 1e-9); prev = v; }
        }
      }
    }
  });

  it('déterminisme : même graine, même pose → mêmes mèches posées', () => {
    const a = setup('long', 9002), b = setup('long', 9002);
    expect(JSON.stringify(poseHair(a.geo, a.skull, 33, a.lm.W))).toBe(JSON.stringify(poseHair(b.geo, b.skull, 33, b.lm.W)));
  });
});

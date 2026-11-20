import { describe, expect, it } from 'vitest';
import { openingGeometry, openingProfile } from '../src/geometry/eye';
import { lowerPeakPosition } from '../src/geometry/eye/lower-peak';
import { Shape } from '../src/schema/eye-shape';
import { Canthi } from '../src/schema/eye-canthi-fold';
import { evalLowerPeak } from '../scripts/eye-refs/lowerpeak-eval';

const STYLES = ['almond', 'round', 'sharp', 'drooping', 'chibi', 'angular', 'compressed', 'rounded_rect', 'triangle', 'circle', 'diamond', 'diamond_v2'] as const;
const geo = (style: string, lowerPeak?: number, extra: Record<string, unknown> = {}) => openingGeometry(Shape.parse({ style, width: 1000, height: 400, ...extra, ...(lowerPeak === undefined ? {} : { lowerPeak }) }), Canthi.parse({}));

describe('shape.lowerPeak : position du creux de la paupière basse (passe 10)', () => {
  it('le paramètre est CONSOMMÉ : le creux tombe à ± 0,01 de la valeur demandée pour les 12 enveloppes (0,40 · 0,55 · 0,65)', () => {
    for (const st of STYLES) for (const lp of [0.4, 0.55, 0.65]) expect(Math.abs(lowerPeakPosition(geo(st, lp)) - lp), `${st} ${lp}`).toBeLessThanOrEqual(0.01);
  });
  it('rien d’autre ne bouge : canthi, hauteur totale et fraction haute inchangés (|Δ| ≤ 1e-3), profil haut identique, pour les 12 enveloppes', () => {
    for (const st of STYLES) {
      const a = geo(st); const b = geo(st, 0.42); const pa = openingProfile(a); const pb = openingProfile(b);
      expect(b.pi).toEqual(a.pi); expect(b.po).toEqual(a.po); expect(b.u1).toEqual(a.u1);
      expect(Math.hypot(b.u2.x - a.u2.x, b.u2.y - a.u2.y), st).toBeLessThan(1e-6);   // le recalage d'apex repasse par un facteur ≈ 1 (1e-12)
      expect(Math.abs(pb.aspect - pa.aspect), st).toBeLessThanOrEqual(1e-3); expect(Math.abs(pb.upperFraction - pa.upperFraction), st).toBeLessThanOrEqual(1e-3);
      pb.upper.forEach((v, i) => expect(Math.abs(v - pa.upper[i]!), st).toBeLessThan(1e-6));
    }
  });
  it('absent = forme historique (aucune dérive des yeux existants) ; hors [0,3 ; 0,75] refusé par le schéma', () => {
    expect(JSON.stringify(geo('almond'))).toBe(JSON.stringify(openingGeometry(Shape.parse({ style: 'almond', width: 1000, height: 400 }), Canthi.parse({}))));
    expect(Shape.parse({}).lowerPeak).toBeUndefined();
    expect(() => Shape.parse({ lowerPeak: 0.2 })).toThrow(); expect(() => Shape.parse({ lowerPeak: 0.8 })).toThrow();
  });
  it('déplace réellement la paupière basse : deux valeurs donnent deux contours différents, le creux se déplace dans le sens demandé (interne → externe)', () => {
    const a = geo('almond', 0.4); const b = geo('almond', 0.65);
    expect(JSON.stringify([a.l1, a.l2])).not.toBe(JSON.stringify([b.l1, b.l2]));
    expect(openingProfile(b).lowerPeakAt).toBeGreaterThan(openingProfile(a).lowerPeakAt);
    const s = Shape.parse({ style: 'almond', outerSide: 'left', width: 1000, height: 400, lowerPeak: 0.4 }); expect(Math.abs(lowerPeakPosition(openingGeometry(s, Canthi.parse({}))) - 0.4)).toBeLessThanOrEqual(0.01);   // œil gauche : même convention (0 = interne)
  });
  it('sur les 5 références (04, 07, 11 ; 03, 05 HORS échantillon d’ajustement) : creux mesuré atteint, erreur du profil bas jamais dégradée, moyenne 0,036 → ≤ 0,025, profil haut inchangé', () => {
    const r = evalLowerPeak(['04', '07', '11', '03', '05']); let s0 = 0; let s1 = 0;
    for (const [k, v] of Object.entries(r)) {
      expect(Math.abs(v.peakAvec! - v.peakRef!), k).toBeLessThanOrEqual(0.03); expect(v.rmsLoAvec!, k).toBeLessThanOrEqual(v.rmsLoSans! + 1e-4);
      expect(Math.abs(v.rmsUpAvec! - v.rmsUpSans!), k).toBeLessThanOrEqual(1e-4); s0 += v.rmsLoSans!; s1 += v.rmsLoAvec!;
    }
    expect(s0 / 5).toBeGreaterThan(0.034); expect(s1 / 5).toBeLessThanOrEqual(0.025);
    expect(r['05']!.rmsLoAvec!).toBeLessThan(r['05']!.rmsLoSans! * 0.5);   // hors échantillon : 0,058 → 0,019
  });
});

describe('contrat de hauteur : symétrie gauche / droite (correction de la passe 10)', () => {
  it('un œil gauche a EXACTEMENT les apex et la hauteur de son homologue droit pour les 12 enveloppes (avant : sharp −25 %, drooping −23 % côté gauche)', () => {
    for (const st of STYLES) {
      const r = geo(st, undefined, { outerSide: 'right' }); const l = geo(st, undefined, { outerSide: 'left' });
      expect(l.bbox.h, st).toBeCloseTo(r.bbox.h, 6); expect(l.bbox.w, st).toBeCloseTo(r.bbox.w, 6);
      const pr = openingProfile(r); const pl = openingProfile(l);   // openingProfile miroite l'œil gauche : mêmes descripteurs que le droit
      expect(pl.aspect, st).toBeCloseTo(pr.aspect, 4); expect(pl.upperFraction, st).toBeCloseTo(pr.upperFraction, 4); expect(pl.lowerPeakAt, st).toBeCloseTo(pr.lowerPeakAt, 4); expect(pl.tiltDeg, st).toBeCloseTo(pr.tiltDeg, 3);
    }
  });
  it('sharp et drooping de GAUCHE tiennent la hauteur demandée (apex haut 248 / bas 152 pour height 400, upperFraction 0,62) à ± 3 %', () => {
    for (const st of ['sharp', 'drooping'] as const) { const p = openingProfile(geo(st, undefined, { outerSide: 'left' })); expect(Math.abs(p.aspect - 0.4) / 0.4, st).toBeLessThan(0.03); }
  });
});

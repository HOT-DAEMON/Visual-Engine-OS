import { describe, expect, it } from 'vitest';
import type { Vec } from '../src/geometry/eye/primitives';
import { curvatureCap, limbLine, maxCurvature, maxTurn, relaxCurvature, turnAt } from '../src/face/pose/hairline-limb';

/** Lisière sous pose consciente du limbe : `docs/ROTATION-HAIR-LIMB.md`. Cartes synthétiques (pas de visage) : chaque propriété est isolée. */
const gentle = (n = 40): Vec[] => Array.from({ length: n }, (_, i) => ({ x: -100 + (200 * i) / (n - 1), y: -120 + 14 * Math.sin((i / (n - 1)) * Math.PI * 2) }));
const dist = (p: Vec, a: Vec, b: Vec): number => { const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)) : 0; return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)); };
const toPoly = (p: Vec, L: Vec[]): number => Math.min(...L.slice(0, -1).map((a, i) => dist(p, a, L[i + 1] as Vec)));
const id = (q: Vec): Vec => q;

describe('limbLine', () => {
  it('courbe douce, carte identité : la ligne suit la courbe de face à 0,1 px près (seules les facettes de la polyligne sont arrondies), extrémités exactes', () => {
    const F = gentle(), r = limbLine(F, id, 2.2, curvatureCap(F));
    expect(r.pts[0]).toEqual(F[0]);
    expect(r.pts[r.pts.length - 1]).toEqual(F[F.length - 1]);
    for (const p of r.pts) expect(toPoly(p, F)).toBeLessThan(0.1);
    // Pas d'arc constant ≈ 2,2 px.
    const steps = r.pts.slice(1).map((p, i) => Math.hypot(p.x - (r.pts[i] as Vec).x, p.y - (r.pts[i] as Vec).y));
    expect(Math.max(...steps)).toBeLessThan(2.2 * 1.3);
  });

  it('indice continu u : croissant, de 0 à n − 1', () => {
    const F = gentle(), r = limbLine(F, id, 2.2, curvatureCap(F));
    expect(r.u[0]).toBe(0);
    expect(r.u[r.u.length - 1]).toBeCloseTo(F.length - 1, 9);
    for (let i = 1; i < r.u.length; i++) expect(r.u[i]!).toBeGreaterThanOrEqual(r.u[i - 1]! - 1e-9);
  });

  // Carte qui REPLIE la ligne au-delà de x = 70 (comme la bande écrasée du limbe proche : la projection brute revient sur elle-même). La ligne de face descend doucement (pente 0,17).
  const fold = (q: Vec): Vec => ({ x: q.x <= 70 ? q.x : 140 - q.x, y: q.y });
  const F = Array.from({ length: 60 }, (_, i) => { const x = -100 + (200 * i) / 59; return { x, y: -120 + 10 * Math.max(0, (x - 40) / 60) }; });

  it('contrôle négatif : la carte repliée donne, sans coupe, un virage de plus de 2,5 rad', () => {
    expect(maxTurn(F.map(fold))).toBeGreaterThan(2.5);
  });

  it('coupe à l\'horizon (carte identité) : au-delà de l\'horizon la ligne est la CORDE vers le coin de tempe ; en deçà elle suit la courbe de face ; extrémités exactes', () => {
    const r = limbLine(F, id, 2.2, curvatureCap(F), { hidden: (q) => q.x >= 70 });
    expect(r.pts[0]).toEqual(F[0]);
    expect(r.pts[r.pts.length - 1]).toEqual(F[F.length - 1]);
    for (const p of r.pts.filter((q) => q.x < 66)) expect(toPoly(p, F)).toBeLessThan(0.1);
    // Tronçon caché : points sur la corde entre le point d'émergence (x = 70) et F[n − 1].
    const a = r.pts.find((q) => q.x >= 70)!, b = F[F.length - 1]!;
    const onChord = r.pts.filter((q) => q.x > 76).map((q) => dist(q, { x: 70, y: a.y }, b));
    expect(Math.max(...onChord)).toBeLessThan(0.6);   // le coin entre la courbe et la corde est arrondi sur quelques pixels
  });

  it('tout caché : repli sur la ligne entière (pas d\'exception, extrémités exactes)', () => {
    const r = limbLine(F, fold, 2.2, curvatureCap(F), { hidden: () => true });
    expect(r.pts.length).toBeGreaterThan(2);
    expect(r.pts[0]).toEqual(fold(F[0] as Vec));
  });

  it('`inside` ramène les points dans la silhouette', () => {
    const r = limbLine(F, id, 2.2, curvatureCap(F), { hidden: (q) => q.x >= 70, inside: (q) => ({ x: Math.max(-65, Math.min(65, q.x)), y: q.y }) });
    for (const p of r.pts.slice(1, -1)) expect(Math.abs(p.x)).toBeLessThanOrEqual(65 + 1e-9);
  });
});

describe('relaxCurvature', () => {
  it('un coin aigu est arrondi jusqu\'à la courbure plafond, extrémités fixes', () => {
    const p: Vec[] = Array.from({ length: 41 }, (_, i) => ({ x: i * 2, y: -2 * (i <= 20 ? i : 40 - i) }));
    const a = { ...p[0] as Vec }, b = { ...p[40] as Vec }, kappa = 0.25;
    expect(maxCurvature(p)).toBeGreaterThan(kappa);
    relaxCurvature(p, kappa);
    expect(p[0]).toEqual(a);
    expect(p[40]).toEqual(b);
    for (let i = 1; i + 1 < p.length; i++) {
      const len = 0.5 * (Math.hypot(p[i]!.x - p[i - 1]!.x, p[i]!.y - p[i - 1]!.y) + Math.hypot(p[i + 1]!.x - p[i]!.x, p[i + 1]!.y - p[i]!.y));
      expect(turnAt(p[i - 1]!, p[i]!, p[i + 1]!)).toBeLessThanOrEqual(kappa * len * 1.0001 + 1e-9);
    }
  });

  it('une courbe sans coin n\'est pas touchée', () => {
    const p = gentle(80), q = p.map((v) => ({ ...v }));
    relaxCurvature(q, curvatureCap(p));
    expect(q).toEqual(p);
  });
});

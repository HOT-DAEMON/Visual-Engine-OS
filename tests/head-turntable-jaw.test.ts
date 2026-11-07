import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultFrame, REF_SPEC, refView, renderHead, sectionAt, sectionPoint, surfaceZ, halfWidthAtZ, type RotationMeasures } from '../src/head-turntable';
import { ENGINE_FIT } from '../src/head-turntable/engines/engine-fit';
import { fitFromProfile, variedHead } from '../src/head-turntable/engines/from-face';
import { JAW_SHAPE, borderZ, jawCtx, jawFields } from '../src/head-turntable/engines/jaw-model';
import { CHIN_CAP_Y, DENSE_YS, closeChin, engineRows } from '../src/head-turntable/engines/rows';
import { engineSpec } from '../src/head-turntable/engines/spec-engine';
import { MEASURED_SPEC } from '../src/head-turntable/spec';
import { silhouetteProfile } from '../src/head-turntable/silhouette';
import { concavityDepth, curvature, headEdges, resample, traceMask } from '../src/head-turntable/verify-contour';
import { HeadRenders, verifyHeadSubject } from '../src/head-turntable/verify-head';
import type { HeadTurnSpec } from '../src/head-turntable';

const measures = JSON.parse(readFileSync('references/face/rotation_head.measures.json', 'utf8')) as RotationMeasures & { views: Record<string, { silhouette: { t: number; left: number | null; right: number | null }[] }> };
const TS = Array.from({ length: 9 }, (_, i) => 0.8 + i * 0.025);

/** Écart moyen (U) et signé à gauche entre la silhouette rendue et la silhouette mesurée de la planche en bande mâchoire (t = 0,80 → 1,00). */
function jawBand(spec: HeadTurnSpec, yaw: number): { err: number; left: number } {
  const pr = silhouetteProfile(renderHead(refView(yaw), spec, { frame: defaultFrame(420), ss: 1 }), TS), ms = measures.views[String(yaw)]!.silhouette;
  let e = 0, c = 0, l = 0;
  for (const p of pr) { const q = ms.find((x) => Math.abs(x.t - p.t) < 1e-6); if (!q || q.left === null || q.right === null) continue; e += Math.abs(p.left - q.left) + Math.abs(p.right - q.right); c += 2; l += p.left - q.left; }
  return { err: e / c, left: l / pr.length };
}

describe('sections généralisées : ellipse par défaut, superellipse pour la mâchoire', () => {
  it('sans champs de forme, la section est l\'ellipse d\'origine (a, zc, b)', () => {
    const s = sectionAt({ ...REF_SPEC, rows: REF_SPEC.rows.map((r) => ({ y: r.y, a: r.a, zf: r.zf, zb: r.zb })) }, 0.5);
    for (const th of [0, 0.7, 1.9, 3.0, 4.4]) { const q = sectionPoint(s, th); expect(q.x).toBeCloseTo(s.a * Math.sin(th), 9); expect(q.z).toBeCloseTo(s.zc + s.b * Math.cos(th), 9); }
  });
  it('le contour passe par (a, zw), (0, zf) et (0, zb) ; surfaceZ et halfWidthAtZ sont réciproques', () => {
    const s = { y: 0.9, a: 0.2, zc: 0.2, b: 0.2, zf: 0.4, zb: 0, zw: 0.1, pf: 1.1, qf: 2.4 };
    expect(sectionPoint(s, Math.PI / 2)).toEqual({ x: s.a, z: s.zw });
    expect(sectionPoint(s, 0).z).toBeCloseTo(s.zf, 9); expect(sectionPoint(s, Math.PI).z).toBeCloseTo(s.zb, 9);
    for (const x of [0.03, 0.09, 0.15, 0.19]) expect(halfWidthAtZ(s, surfaceZ(s, x, true))).toBeCloseTo(x, 6);
    for (let th = 0.05; th < Math.PI / 2; th += 0.2) { const q = sectionPoint(s, th); expect(surfaceZ(s, q.x, true)).toBeCloseTo(q.z, 6); }
  });
  it('l\'interpolation Hermite à pas non uniforme est C¹ aux changements de pas (la table passe de 0,05 à 0,01 U au menton)', () => {
    for (const knot of [0.15, 0.6, 1.0, 1.025]) {
      const h = 1e-4, d = (y: number): number => (sectionAt(REF_SPEC, y + h).a - sectionAt(REF_SPEC, y - h).a) / (2 * h);
      expect(Math.abs(d(knot - 3e-4) - d(knot + 3e-4))).toBeLessThan(0.15);
    }
  });
});

describe('modèle de mâchoire : bordure mandibulaire, calotte du menton', () => {
  const ref = REF_SPEC.engine!;
  it('la bordure inférieure part du gonion 2D et croît jusqu\'au menton ; au-dessus du gonion elle suit le ramus', () => {
    const c = jawCtx(ref);
    expect(c.yG).toBeGreaterThan(0.78); expect(c.yG).toBeLessThan(c.yMen - 0.08);
    let prev = -Infinity;
    for (let y = c.yG - 0.1; y <= c.yMen; y += 0.01) { const z = borderZ(c, y); expect(z).toBeGreaterThanOrEqual(prev - 1e-9); prev = z; }
    expect(borderZ(c, c.yMen)).toBeCloseTo(c.zMen, 6);
  });
  it('au-dessus de la zone de mélange la section reste l\'ellipse ; en dessous le point large est entre l\'arrière et l\'avant', () => {
    expect(jawFields(ref, JAW_SHAPE.y0 - 0.01, 0.43, -0.2)).toBeNull();
    const f = jawFields(ref, 0.97, 0.43, 0.28)!;
    expect(f.zw).toBeGreaterThan(0.28); expect(f.zw).toBeLessThan(0.43); expect(f.pf).toBeLessThan(2);
  });
  it('la calotte du menton referme la profondeur sans toucher à la largeur et sans marche à son début', () => {
    const rows = closeChin(DENSE_YS.map((y) => ({ y, a: 0.1, zf: 0.43, zb: 0.3 })));
    const cap = rows.filter((r) => r.y >= CHIN_CAP_Y);
    expect(cap[0]!.zf - cap[0]!.zb).toBeCloseTo(0.13, 9);
    expect(cap[cap.length - 1]!.zf - cap[cap.length - 1]!.zb).toBeLessThan(0.005);
    expect(cap.every((r) => r.a === 0.1)).toBe(true);
    const d = cap.map((r) => r.zf - r.zb); for (let i = 1; i < d.length; i++) expect(d[i]!).toBeLessThanOrEqual(d[i - 1]! + 1e-9);
  });
  it('la table de la planche : point large monotone, jamais devant l\'avant, avant > arrière', () => {
    const rows = REF_SPEC.rows; rows.forEach((r, i) => { expect(r.zf).toBeGreaterThan(r.zb); if (r.y < CHIN_CAP_Y && r.zw !== undefined && rows[i - 1]?.zw !== undefined) expect(r.zw).toBeGreaterThanOrEqual(rows[i - 1]!.zw! - 1e-6); });
  });
});

describe('audit pixel du contour', () => {
  it('traceMask suit le bord d\'un disque : le rayon de courbure mesuré est le rayon du disque', () => {
    const w = 120, m = new Uint8Array(w * w); for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) if (Math.hypot(x - 60, y - 60) <= 40) m[y * w + x] = 1;
    const pts = resample(traceMask(m, w, w), 2), k = curvature(pts, 4, 2), mid = k.slice(8, -8).map(Math.abs).sort((a, b) => a - b)[Math.floor((k.length - 16) / 2)]!;
    expect(1 / mid).toBeGreaterThan(34); expect(1 / mid).toBeLessThan(46);
  });
  it('concavityDepth : nulle sur un arc convexe, égale à la profondeur d\'une encoche', () => {
    const arc = Array.from({ length: 40 }, (_, i) => ({ x: i, y: -((i - 20) ** 2) / 40 }));
    expect(concavityDepth(arc)).toBeLessThan(1e-6);
    expect(concavityDepth(arc.map((p, i) => (i === 20 ? { x: p.x, y: p.y - 3 } : p)))).toBeGreaterThan(2.5);
  });
  it('headEdges : bords de la tête seule, comparables à la demi-largeur de la section', () => {
    const r = renderHead({ yaw: 0, pitch: 0 }, REF_SPEC, { frame: defaultFrame(420), ss: 1 }), e = headEdges(r, [0.3, 0.5]);
    expect(e).toHaveLength(2); for (const p of e) expect(Math.abs((p.right - p.left) / 2 - sectionAt(REF_SPEC, p.t).a)).toBeLessThan(0.03);
  });
});

describe('planche : la mâchoire colle à la silhouette mesurée (corrigé)', () => {
  it('écart moyen en bande mâchoire sur les 9 lacets ≤ 0,0235 U (état d\'origine : 0,0249) et 45° nettement mieux (0,0302 → ≤ 0,022)', () => {
    const e = [0, 20, 45, 70, 90, 110, 135, 160, 180].map((yaw) => ({ yaw, ...jawBand(REF_SPEC, yaw) }));
    expect(e.reduce((a, b) => a + b.err, 0) / e.length).toBeLessThan(0.0235);
    expect(e.find((x) => x.yaw === 45)!.err).toBeLessThan(0.022);
    expect(Math.abs(e.find((x) => x.yaw === 45)!.left)).toBeLessThan(0.03);   // le bord avant de la mâchoire ne déborde plus de la planche (−0,043 avant)
  }, 120_000);
  it('la couche de vérification « tête quelconque » valide la planche', () => {
    const r = verifyHeadSubject({ id: 'planche', spec: REF_SPEC });
    expect(r.hardFailures.map((c) => `${c.id}=${c.value}`)).toEqual([]);
  }, 120_000);
});

describe('variété : le crâne et la mâchoire suivent le visage du moteur', () => {
  const seeds = [1, 2, 3, 4, 5, 6], heads = seeds.map(variedHead);
  const at = (h: HeadTurnSpec, y: number): ReturnType<typeof sectionAt> => sectionAt(h, y);
  const sd = (v: number[]): number => { const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); };
  it('déterministe : même graine, mêmes rangées', () => { expect(variedHead(3).spec.rows).toEqual(variedHead(3).spec.rows); });
  it('les têtes diffèrent réellement : longueur du crâne, largeur relative de la mâchoire, hauteur du gonion', () => {
    expect(sd(heads.map((h) => at(h.spec, 0.45).zf - at(h.spec, 0.45).zb))).toBeGreaterThan(0.025);
    expect(sd(heads.map((h) => at(h.spec, 0.95).a / Math.max(...h.spec.rows.map((r) => r.a))))).toBeGreaterThan(0.02);
    expect(sd(heads.map((h) => jawCtx(h.spec.engine!).yG))).toBeGreaterThan(0.01);
  });
  const L = (spec: HeadTurnSpec): number => Math.max(...[0.3, 0.4, 0.5].map((y) => at(spec, y).zf)) - Math.min(...[0.25, 0.3, 0.35, 0.4, 0.45].map((y) => at(spec, y).zb));
  it('couplage crâne ↔ visage : la longueur 3D du crâne retrouve la longueur dérivée par le moteur de crâne (écart ≤ 0,02 U) et suit la largeur du visage ; figée, elle ne bouge plus', () => {
    const wide = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(variedHead), a = wide.map((h) => h.profile.derivation.aspect), l = wide.map((h) => L(h.spec));
    wide.forEach((h, i) => expect(Math.abs(l[i]! - h.profile.derivation.lengthH)).toBeLessThan(0.02));
    const ma = a.reduce((x, y) => x + y, 0) / a.length, ml = l.reduce((x, y) => x + y, 0) / l.length;
    const corr = a.reduce((s2, v, i) => s2 + (v - ma) * (l[i]! - ml), 0) / Math.sqrt(a.reduce((s2, v) => s2 + (v - ma) ** 2, 0) * l.reduce((s2, v) => s2 + (v - ml) ** 2, 0));
    expect(corr).toBeGreaterThan(0.9); expect(Math.max(...l) - Math.min(...l)).toBeGreaterThan(0.08);
    const frozen = wide.map((h) => L(engineSpec({ ...fitFromProfile(h.profile), skull: ENGINE_FIT.skull }, MEASURED_SPEC, DENSE_YS)));
    expect(Math.max(...frozen) - Math.min(...frozen)).toBeLessThan(0.01);
  });
  it('les rangées de chaque tête sont saines (finies, monotones, avant > arrière)', () => {
    for (const h of heads) h.spec.rows.forEach((r, i, a) => { expect([r.a, r.zf, r.zb, r.zw ?? 0].every(Number.isFinite)).toBe(true); expect(r.zf).toBeGreaterThan(r.zb); if (i > 0 && r.y < CHIN_CAP_Y && r.zw !== undefined && a[i - 1]!.zw !== undefined) expect(r.zw).toBeGreaterThanOrEqual(a[i - 1]!.zw! - 1e-6); });
  });
  it('la ligne de mâchoire des têtes variées est continue : couche de vérification (géométrie, anatomie, style) sans échec bloquant', () => {
    for (const h of [heads[0]!, heads[3]!]) {
      const r = verifyHeadSubject({ id: `seed${h.seed}`, spec: h.spec, lengthH: h.profile.derivation.lengthH }, new HeadRenders(h.spec, 420));
      expect(r.hardFailures.map((c) => `${c.id}=${c.value}`)).toEqual([]);
    }
  }, 120_000);
  it('un crâne figé est détecté par la vérification (longueur 3D du crâne ≠ longueur dérivée du visage)', () => {
    const h = heads[0]!, spec = engineSpec({ ...fitFromProfile(h.profile), skull: ENGINE_FIT.skull }, MEASURED_SPEC, DENSE_YS);   // visage large (rapport 0,91) + crâne de la planche
    const r = verifyHeadSubject({ id: 'frozen', spec, lengthH: h.profile.derivation.lengthH }, new HeadRenders(spec, 420));
    expect(r.hardFailures.some((c) => c.id === 'head.anat.skull.length')).toBe(true);
  }, 120_000);
});

describe('engineRows reste comparable à la table de la planche', () => {
  it('la table par défaut garde ses 27 rangées (comparaison ligne à ligne avec REF_ROWS)', () => { expect(engineRows(REF_SPEC.engine!)).toHaveLength(REF_SPEC.rows.length); });
});

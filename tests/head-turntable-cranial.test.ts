import { describe, expect, it } from 'vitest';
import { REF_SPEC, sectionAt } from '../src/head-turntable';
import { variedHead } from '../src/head-turntable/engines/from-face';
import { engineSpec } from '../src/head-turntable/engines/spec-engine';
import { DENSE_YS } from '../src/head-turntable/engines/rows';
import { MEASURED_SPEC } from '../src/head-turntable/spec';
import { fitFromProfile } from '../src/head-turntable/engines/from-face';
import { CRANIAL, cranialBackShift, cranialLength } from '../src/head-turntable/engines/skull-model';
import { engineHead } from '../src/head-turntable/engines/face-model';
import { skullAnatomyChecks } from '../src/head-turntable/verify-skull';

const heads = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(variedHead);
const Y = [0.3, 0.4, 0.5], YB = [0.25, 0.3, 0.35, 0.4, 0.45];
const depth = (s: Parameters<typeof sectionAt>[0]): number => Math.max(...Y.map((y) => sectionAt(s, y).zf)) - Math.min(...YB.map((y) => sectionAt(s, y).zb));
const sd = (v: number[]): number => { const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); };

describe('forme crânienne (longueur amplifiée, arrière du crâne)', () => {
  it('cranialLength : croissante, bornée, fixe en LENGTH_REF', () => {
    let prev = -Infinity;
    for (let l = 0.6; l <= 1.0; l += 0.01) { const c = cranialLength(l); expect(c).toBeGreaterThanOrEqual(prev); expect(c).toBeGreaterThanOrEqual(CRANIAL.lMin); expect(c).toBeLessThanOrEqual(CRANIAL.lMax); prev = c; }
    expect(cranialLength(0.8)).toBeCloseTo(0.8, 12);
  });
  it('la planche ne bouge pas (pas de cranialL) : décalage nul à toutes les hauteurs', () => {
    for (const y of [0, 0.2, 0.4, 0.7, 1]) expect(cranialBackShift(REF_SPEC.engine!, y)).toBe(0);
  });
  it('le décalage ne touche que l\'arrière du crâne : largeur, avant (zf) et mâchoire identiques à la même tête sans amplification', () => {
    for (const h of [heads[0]!, heads[4]!]) {
      const plain = engineSpec({ ...fitFromProfile(h.profile), cranialL: undefined } as never, MEASURED_SPEC, DENSE_YS);
      h.spec.rows.forEach((r, i) => {
        const q = plain.rows[i]!;
        expect(r.a).toBeCloseTo(q.a, 12); expect(r.zf).toBeCloseTo(q.zf, 12);
        if (r.y >= 0.76) expect(r.zb).toBeCloseTo(q.zb, 12);
        if (r.y > 0.14 && r.y < 0.6) expect(Math.sign(r.zb - q.zb)).toBe(Math.sign(-(cranialLength(h.profile.derivation.lengthH) - h.profile.derivation.lengthH)) || 0);
      });
    }
  });
  it('un crâne long s\'allonge, un crâne court se raccourcit : l\'écart à LENGTH_REF est multiplié par le gain (hors bornes)', () => {
    const long = heads.reduce((a, b) => (b.profile.derivation.lengthH > a.profile.derivation.lengthH ? b : a)), short = heads.reduce((a, b) => (b.profile.derivation.lengthH < a.profile.derivation.lengthH ? b : a));
    expect(depth(long.spec)).toBeGreaterThan(long.profile.derivation.lengthH); expect(depth(short.spec)).toBeLessThan(short.profile.derivation.lengthH);
  });
  it('variété : étendue de la longueur 3D sur 12 graines ≥ 0,14 U (0,093 avant) et profondeur = longueur de forme à ≤ 0,02 U', () => {
    const L = heads.map((h) => depth(h.spec));
    expect(Math.max(...L) - Math.min(...L)).toBeGreaterThan(0.14); expect(sd(L)).toBeGreaterThan(0.045);
    heads.forEach((h, i) => expect(Math.abs(L[i]! - cranialLength(h.profile.derivation.lengthH))).toBeLessThan(0.02));
  });
  it('le contrôle d\'indice céphalique 3D est présent, en information, et fini', () => {
    for (const h of heads) { const c = skullAnatomyChecks(h.spec).find((k) => k.id === 'head.anat.skull.cephalic3d')!; expect(c).toBeDefined(); expect(c.kind).toBe('info'); expect(Number.isFinite(c.value)).toBe(true); }
  });
  it('le moteur de visage et sa mémoïsation ne sont pas perturbés : même graine → mêmes rangées', () => {
    expect(variedHead(3).spec.rows).toEqual(variedHead(3).spec.rows); expect(engineHead(heads[2]!.fit)).toBe(engineHead(heads[2]!.fit));
  });
});

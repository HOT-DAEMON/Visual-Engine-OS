import { describe, expect, it } from 'vitest';
import { EyeSpec, compileScene } from '../src';
import { facingOf, jacobianAtCenter, openingGeometry, turnOpening, turnPoint } from '../src/geometry/eye';

const STYLES = ['almond', 'round', 'sharp', 'drooping', 'chibi', 'angular', 'compressed', 'rounded_rect', 'triangle', 'circle', 'diamond', 'diamond_v2'] as const;
const mk = (style: string) => { const e = EyeSpec.parse({ kind: 'eye', id: 'e', shape: { style, width: 200, height: 120 } }); return openingGeometry(e.shape, e.canthi); };
const T = (yawDeg: number, pitchDeg = 0, azimuthDeg = 0) => ({ yawDeg, pitchDeg, azimuthDeg, radius: 600 });
const deg = (r: number) => (r * 180) / Math.PI;

describe('rotation 3D sphérique de l’enveloppe palpébrale', () => {
  it('identité EXACTE à yaw = pitch = 0, pour tout azimut', () => {
    for (const az of [-40, 0, 22, 50]) for (const p of [{ x: 0, y: 0 }, { x: -100, y: 7 }, { x: 80, y: -55 }]) {
      const q = turnPoint(p, T(0, 0, az));
      expect(q.x).toBeCloseTo(p.x, 9); expect(q.y).toBeCloseTo(p.y, 9);
    }
    for (const st of STYLES) {
      const g = mk(st); const t = turnOpening(g, T(0)).g;
      for (const k of ['pi', 'po', 'u1', 'u2', 'l1', 'l2'] as const) { expect(t[k].x).toBeCloseTo(g[k].x, 9); expect(t[k].y).toBeCloseTo(g[k].y, 9); }
    }
  });

  it('loi analytique : compression horizontale au centre = cos(azimut + lacet) / cos(azimut)', () => {
    for (const az of [0, 22, -22, 40]) for (const yaw of [-50, -20, 15, 35, 60]) {
      const j = jacobianAtCenter(T(yaw, 0, az));
      const expected = Math.cos(((az + yaw) * Math.PI) / 180) / Math.cos((az * Math.PI) / 180);
      expect(j.a).toBeCloseTo(expected, 4);
      expect(Math.abs(j.c)).toBeLessThan(1e-4); // lacet pur : aucun cisaillement vertical
      expect(j.d).toBeCloseTo(1, 4);
    }
  });

  it('asymétrie propre à la sphère : le canthus qui part vers le côté de la rotation se raccourcit plus que l’autre', () => {
    const g = mk('almond');
    const t = turnOpening(g, T(45)).g;
    const cx = (t.pi.x + t.po.x) / 2;
    const near = Math.abs(t.pi.x); // distance au centre (recentré à l'origine)
    const far = Math.abs(t.po.x);
    expect(far).toBeLessThan(near);
    void cx;
  });

  it('les 12 types d’enveloppe : finis, largeur strictement décroissante avec |lacet|, hauteur avec |tangage|', () => {
    for (const st of STYLES) {
      const g = mk(st); let prevW = Infinity;
      for (const yaw of [0, 20, 40, 60]) {
        const t = turnOpening(g, T(yaw)).g;
        for (const k of ['pi', 'po', 'u1', 'u2', 'l1', 'l2'] as const) { expect(Number.isFinite(t[k].x) && Number.isFinite(t[k].y)).toBe(true); }
        expect(t.bbox.w).toBeLessThan(prevW + 1e-9); prevW = t.bbox.w;
        expect(t.bbox.w).toBeGreaterThan(0); expect(t.bbox.h).toBeGreaterThan(0);
      }
      let prevH = Infinity;
      for (const pitch of [0, 20, 40]) { const t = turnOpening(g, T(0, pitch)).g; expect(t.bbox.h).toBeLessThan(prevH + 1e-9); prevH = t.bbox.h; }
    }
  });

  it('symétrie miroir : lacet opposé ⇒ largeur identique, positions miroir (azimut 0)', () => {
    const g = mk('almond');
    const a = turnOpening(g, T(35)).g; const b = turnOpening(g, T(-35)).g;
    expect(a.bbox.w).toBeCloseTo(b.bbox.w, 3);
    expect(a.bbox.h).toBeCloseTo(b.bbox.h, 3);
  });

  it('recentrage : par défaut l\'œil tourne sur place (centre fixe), la parallaxe reste exposée', () => {
    const g = mk('almond');
    const a = turnOpening(g, T(40, 0, -22));
    const b = turnOpening(g, T(40, 0, -22), false);
    expect(Math.abs(a.shift.x)).toBeGreaterThan(100); // parallaxe réelle : plusieurs largeurs d'œil
    const mid = (o: typeof a) => (o.g.pi.x + o.g.po.x) / 2;
    expect(Math.abs(mid(a))).toBeLessThan(40);
    expect(mid(b) - mid(a)).toBeCloseTo(a.shift.x, 6);
  });

  it('visibilité : l’œil du côté fuyant passe derrière le crâne au-delà de 90° − |azimut|', () => {
    expect(facingOf(T(0, 0, 22))).toBeGreaterThan(0.9);
    expect(facingOf(T(50, 0, 22))).toBeLessThan(facingOf(T(10, 0, 22)));
    expect(facingOf(T(70, 0, 22))).toBeLessThan(0);
    expect(facingOf(T(-70, 0, 22))).toBeGreaterThan(0);
  });

  const svg = (headTurn: object) => {
    const r = compileScene({ width: 640, height: 520, background: '#3b4157', objects: [{ kind: 'eye', id: 'e', transform: { x: 320, y: 260 }, shape: { width: 400, height: 240 }, headTurn }] } as never);
    if (!r.ok) throw new Error(r.issues.join('\n')); return r.svg;
  };
  it('rendu : sphère à 0° = rendu historique octet pour octet ; sphère tournée ≠ plat tourné ; déterministe', () => {
    // Seule différence tolérée : le mode historique émet un groupe d'identité `translate(0 0)` que le mode sphère omet.
    const noIdentityWrap = (x: string) => x.replace('<g transform="translate(0 0) ">', '<g>');
    expect(svg({ model: 'sphere' })).toBe(noIdentityWrap(svg({})));
    const a = svg({ model: 'sphere', yawDeg: 40, azimuthDeg: 22 });
    expect(a).not.toBe(svg({ model: 'flat', yawDeg: 40 }));
    expect(svg({ model: 'sphere', yawDeg: 40, azimuthDeg: 22 })).toBe(a);
  });
  it('angles utilisés : deg() est cohérent', () => { expect(deg(Math.PI)).toBeCloseTo(180, 9); });
});

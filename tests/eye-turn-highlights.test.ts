import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { compileScene, EyeSpec } from '../src';
import { jacobianAtCenter, openingGeometry, turnOpening } from '../src/geometry/eye';
import { irisCenter, irisRadii } from '../src/render/eye/helpers';

/**
 * Passe 15 — rotation 3D (modèle `sphere`) : les REFLETS suivent la matrice locale de la projection comme l'iris et la pupille.
 * Avant : positions et formes des reflets restaient dans le repère de face alors que l'iris se comprimait (reflet trop éloigné du centre, disque rond sur un iris étroit).
 */
const W = 600; const H = 400; const CX = 300; const CY = 200;
const eyeOf = (turn: { yawDeg: number; azimuthDeg: number } | null, hl: Record<string, unknown>): any => EyeSpec.parse({
  kind: 'eye', id: 'e', shape: { style: 'almond', width: 200, height: 120 }, transform: { x: CX, y: CY },
  highlights: { list: [{ kind: 'graphic', anchor: 'iris', confine: 'globe', color: '#00ff00', ...hl }] },
  ...(turn ? { headTurn: { model: 'sphere', yawDeg: turn.yawDeg, pitchDeg: 0, azimuthDeg: turn.azimuthDeg, parallax: false } } : {}),
});
const pngOf = (e: any): { w: number; h: number; px: Uint8Array } => {
  const r: any = compileScene({ width: W, height: H, background: '#ffffff', objects: [{ ...e }] } as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  const img = new Resvg(r.svg as string, { fitTo: { mode: 'width', value: W } }).render();
  return { w: img.width, h: img.height, px: img.pixels as unknown as Uint8Array };
};
/** Boîte et centre des pixels vert pur (le reflet). */
const green = (m: { w: number; h: number; px: Uint8Array }) => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, sx = 0, sy = 0, n = 0;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const i = (y * m.w + x) * 4; const r = m.px[i]!, g = m.px[i + 1]!, b = m.px[i + 2]!;
    if (g > 180 && r < 90 && b < 90) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); sx += x; sy += y; n++; }
  }
  return { n, w: x1 - x0 + 1, h: y1 - y0 + 1, cx: sx / n, cy: sy / n };
};

describe('reflets et rotation sphérique de la tête', () => {
  for (const [yaw, az] of [[35, 22], [-35, -22], [40, 0]] as const) {
    it(`lacet ${yaw}° / azimut ${az}° : le reflet est comprimé et rapproché du centre comme l’iris (loi cos(az+lacet)/cos(az))`, () => {
      const hl = { shape: 'circle', x: 0.5, y: 0, size: 0.2 };
      const base = green(pngOf(eyeOf(null, hl)));
      const turned = green(pngOf(eyeOf({ yawDeg: yaw, azimuthDeg: az }, hl)));
      const e = eyeOf({ yawDeg: yaw, azimuthDeg: az }, hl);
      const g0 = openingGeometry(e.shape, e.canthi);
      const t = turnOpening(g0, { yawDeg: yaw, pitchDeg: 0, azimuthDeg: az, radius: e.shape.width * e.headTurn.radiusFactor }, true);
      const a = jacobianAtCenter({ yawDeg: yaw, pitchDeg: 0, azimuthDeg: az, radius: e.shape.width * e.headTurn.radiusFactor }).a;
      expect(a).toBeLessThan(0.9);
      // forme : largeur / hauteur du reflet = compression horizontale
      expect(turned.w / turned.h).toBeCloseTo(a, 1);
      expect(Math.abs(turned.w / turned.h - a)).toBeLessThan(0.06);
      // position : décalage horizontal au centre de l'iris = a × décalage de face
      const c = irisCenter(e, t.g); const c0 = irisCenter(e, g0); void c; void c0;
      const { rx } = irisRadii(e);
      const off0 = base.cx - (CX + c0.x); const off = turned.cx - (CX + c.x);
      expect(off0).toBeGreaterThan(0.4 * rx * 0.8);
      expect(off / off0).toBeCloseTo(a, 1);
    });
  }
  it('sans rotation (modèle plat ou lacet 0) : identité exacte de la boîte du reflet', () => {
    const hl = { shape: 'circle', x: 0.5, y: 0, size: 0.2 };
    const a = green(pngOf(eyeOf(null, hl))); const b = green(pngOf(eyeOf({ yawDeg: 0, azimuthDeg: 0 }, hl)));
    expect(b.w).toBe(a.w); expect(b.h).toBe(a.h); expect(Math.abs(b.cx - a.cx)).toBeLessThan(0.01);
  });
});

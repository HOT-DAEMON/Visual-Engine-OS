import { earGeometry, halfWidthAt, rightSamples, type FaceLandmarks, type NoseGeometry } from '../face';
import type { FaceParams } from '../schema';
import { gridOf, normalsOf, REGION, type Grid, type ReliefField } from './field';

/**
 * RELIEF DE LA TÊTE ET DU COU, déduit des REPÈRES du visage (aucune coordonnée nouvelle : contour, nez, orbites, bouche, menton, oreilles, cou).
 * Base = crâne gonflé (superellipsoïde dont la largeur à chaque hauteur est celle du contour réel) ; puis arcade sourcilière, orbites creuses, pyramide
 * nasale (racine → pointe, ailes), pommettes, lèvres, sillon mentolabial, menton, oreilles (plaques), cou (cylindre elliptique qui s'évase).
 * Profondeur : `zc` = plan médian du crâne ; la face avance de `0,55 W` (face ≈ 8 cm devant le conduit auditif pour un crâne de 15 cm).
 * Le menton avance plus que le cou (≈ 0,23 W) : c'est ce surplomb qui projette l'ombre du menton sur le cou (planches 01 n°5, 09).
 */
export interface HeadReliefOpts { readonly grid: Grid; readonly zc: number; readonly neckAxisZ?: number }
const sm = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const g2 = (x: number, y: number, cx: number, cy: number, sx: number, sy: number): number => Math.exp(-0.5 * (((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));
export function headRelief(p: FaceParams, lm: FaceLandmarks, nose: NoseGeometry, o: HeadReliefOpts): ReliefField {
  const { grid: g, zc } = o, { W, H } = lm, D = 0.55 * W, samples = rightSamples(lm.outline), top = -H / 2, bot = lm.outline.bottomY, cyH = (top + bot) / 2, hh = (bot - top) / 2;
  const depth = new Float32Array(g.w * g.h).fill(-Infinity), region = new Uint8Array(g.w * g.h);
  const ears = earGeometry(p, lm), neck = lm.neck, flare = neck.half * p.neck.flare, y1 = lm.chinY + 0.35 * (neck.bottomY - lm.chinY), nz0 = o.neckAxisZ ?? zc - 0.05 * W;
  const nr = nose.tip.c, tipH = Math.max(0.05 * W, nose.tip.projectionPx), rootY = nose.root.y, eyeX = Math.abs(lm.innerCanthus.right.x), browY = lm.eyeY - 0.075 * H;
  for (let j = 0; j < g.h; j++) {
    const y = g.y0 + (j + 0.5) / g.ppu, hw = y >= top && y <= bot ? halfWidthAt(lm.outline, y, samples) : 0, ry = (y - cyH) / hh;
    const nh = y > neck.topY && y <= neck.bottomY ? neck.half + flare * sm(y1, neck.bottomY, y) : 0;
    for (let i = 0; i < g.w; i++) {
      const x = g.x0 + (i + 0.5) / g.ppu, k = j * g.w + i, ax = Math.abs(x);
      let z = -Infinity, rg: number = REGION.none;
      if (nh > 0 && ax < nh) { z = nz0 + 0.9 * nh * Math.sqrt(1 - (x / nh) ** 2); rg = REGION.neck; }
      if (hw > 1 && ax < hw && Math.abs(ry) < 1) {
        const rx = ax / hw, base = zc + D * Math.sqrt(Math.max(0, 1 - rx * rx)) * (1 - ry * ry) ** 0.28;
        let bump = 0;
        bump += 0.045 * W * g2(x, y, 0, browY, 0.62 * hw, 0.02 * H) * sm(0.15, 0.4, ax / hw + 0.3);          // arcade
        for (const s of [-1, 1]) bump -= 0.065 * W * g2(x, y, s * (eyeX + 0.22 * W), lm.eyeY + 0.005 * H, 0.1 * W, 0.045 * H); // orbites
        bump += 0.02 * W * g2(x, y, 0, rootY, 0.05 * W, 0.04 * H) * -1;                                       // nasion creux
        const ty = (y - rootY) / Math.max(1, nr.y - rootY), tw = nose.widthPx * (0.1 + 0.2 * Math.min(1, Math.max(0, ty)));
        if (ty > 0) bump += tipH * 0.95 * sm(0, 0.9, ty) ** 1.3 * (1 - sm(0.9, 1.15, ty)) * Math.exp(-0.5 * ((x - nr.x * ty) / tw) ** 2);   // dos du nez
        bump += tipH * 0.55 * g2(x, y, nr.x, nr.y, nose.tip.rx * 0.9, nose.tip.ry * 0.9);                      // pointe
        for (const s of [-1, 1]) bump += tipH * 0.32 * g2(x, y, s * nose.widthPx * 0.42, lm.noseBaseY - 0.012 * H, nose.widthPx * 0.13, 0.016 * H); // ailes
        for (const s of [-1, 1]) bump += 0.022 * W * g2(x, y, s * (eyeX + 0.3 * W), (lm.eyeY + lm.mouthY) / 2 - 0.02 * H, 0.1 * W, 0.06 * H); // pommettes
        bump += 0.026 * W * g2(x, y, 0, (lm.lips.topY + lm.lips.bottomY) / 2, lm.lips.half * 0.75, (lm.lips.bottomY - lm.lips.topY) * 0.55); // lèvres
        bump -= 0.016 * W * g2(x, y, 0, lm.noseBaseY + 0.4 * (lm.lips.topY - lm.noseBaseY), 0.05 * W, 0.012 * H);   // philtrum
        bump -= 0.02 * W * g2(x, y, 0, lm.chin.sulcusY, lm.chin.half * 0.9, 0.012 * H);                          // sillon mentolabial
        bump += (0.03 * W + lm.chin.projectionPx * 0.5) * g2(x, y, 0, (lm.chin.sulcusY + lm.chinY) / 2, lm.chin.half * 0.95, lm.chin.heightPx * 0.55); // menton
        const zz = base + bump;
        if (zz > z) { z = zz; rg = y < browY - 0.02 * H ? REGION.skull : y < lm.noseBaseY - 0.02 * H && ax < nose.widthPx * 0.7 && y > rootY ? REGION.nose : y < lm.noseBaseY + 0.1 * H ? (ax > eyeX + 0.08 * W && y > lm.eyeY + 0.03 * H ? REGION.cheek : REGION.orbit) : y < lm.chin.sulcusY - 0.01 * H ? (y > lm.lips.topY - 0.012 * H ? REGION.mouth : REGION.cheek) : REGION.chin; }
      }
      for (const e of ears) {
        const dx = (x - e.c.x) / (e.rx * 1.05), dy = (y - e.c.y) / (e.ry * 1.05), q = dx * dx + dy * dy;
        if (q < 1) { const zz = zc + 0.02 * W + 0.1 * W * Math.sqrt(1 - q) * (1 - 0.6 * Math.abs(dx)) - 0.04 * W * Math.max(0, 1 - Math.hypot(dx * 1.4, dy * 0.9) * 2.2); if (zz > z - 0.3 * W && (hw <= 1 || ax >= hw * 0.97)) { z = Math.max(z, zz); rg = REGION.ear; } }
      }
      depth[k] = z; region[k] = rg;
    }
  }
  return { ...g, depth, region, ...normalsOf(g, depth) };
}
export const headGrid = (lm: FaceLandmarks, ppu: number): Grid => gridOf({ x0: -lm.W * 0.62, y0: -lm.H / 2 - 0.03 * lm.H, x1: lm.W * 0.62, y1: lm.neck.bottomY + 0.02 * lm.H }, ppu);

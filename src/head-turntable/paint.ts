import { hex, mix, type RGB } from './color';
import { blushAlpha, browTex, eyeTex, mouthTex, nostrilTex, paletteOf, type Pal, type Tex } from './face-tex';
import { norm, rad, smooth, toCam, v3 } from './math';
import { earRig } from './engines/ear3d';
import { earColor } from './engines/ear-paint';
import { PART } from './mesh';
import type { GBuf } from './raster';
import { regionField, signedDistance } from './hair-region';
import { hairlineY, headPoint, sectionAt } from './sections';
import { REGION, type HeadTurnSpec, type View } from './types';

/** Lumière en repère CAMÉRA (haut-gauche, de face) : la lumière ne tourne pas avec la tête, comme sur la planche. */
const LIGHT = norm(v3(-0.25, -0.55, 0.8));
const NECK_CUT: RGB = [217, 169, 143];
/** Groupe de contour : les pièces d'un même groupe n'ont pas de trait entre elles (nez et lèvres font partie de la tête). */
const group = (id: number): number => (id === PART.head || id === PART.bump ? 1 : id === PART.neck ? 2 : id === PART.ear || id === PART.earBack ? 3 : id === PART.neckCut ? 4 : 0);

/** Tolérance verticale (repère tête) du trait de lisière pour qu'il garde 0,0055 U d'épaisseur À L'ÉCRAN : elle croît avec la pente de la lisière projetée. */
function hairTol(spec: HeadTurnSpec, view: View, az: number, hl: number, kw: number): number {
  const a0 = ((az - 1) * Math.PI) / 180, a1 = ((az + 1) * Math.PI) / 180, side = az < 0 ? -1 : 1;
  const q = (th: number) => { const pt = headPoint(spec, hairlineY(spec, Math.abs((th * 180) / Math.PI)), Math.abs(th) * side); return toCam(pt, view); };
  const c0 = q(a0), c1 = q(a1), tx = Math.abs(c1.x - c0.x), tl = Math.hypot(c1.x - c0.x, c1.y - c0.y);
  void hl;
  return Math.min(0.03, (0.0055 * kw * tl) / Math.max(tx, 1e-4) / Math.max(0.5, Math.cos((view.pitch * Math.PI) / 180)));
}

export interface Painted { readonly rgba: Float32Array; readonly region: Uint8Array }
export interface PaintOpts { readonly lineU: number; readonly ppuHi: number }

/** Peint le tampon géométrique : ombrage à deux tons (cel), lisière des cheveux, texture du visage, oreilles, ombre sous le menton, puis contours. */
export function paint(spec: HeadTurnSpec, g: GBuf, view: View, o: PaintOpts): Painted {
  const { w, h } = g, n = w * h, pal: Pal = paletteOf(spec);
  const rgba = new Float32Array(n * 4), region = new Uint8Array(n), hairShade = hex(spec.palette.hairShade);
  for (let k = 0; k < n; k++) {
    const id = g.id[k]!;
    if (!id) continue;
    const p = { x: g.P[3 * k]!, y: g.P[3 * k + 1]!, z: g.P[3 * k + 2]! }, nh = norm({ x: g.N[3 * k]!, y: g.N[3 * k + 1]!, z: g.N[3 * k + 2]! });
    const nc = toCam(nh, view), lam = nc.x * LIGHT.x + nc.y * LIGHT.y + nc.z * LIGHT.z, t = smooth((lam - 0.02) / 0.22);
    const kw = Math.min(1.4, 1 / Math.max(0.7, nc.z));                         // compensation du raccourcissement des traits sur les faces obliques
    let col = mix(pal.shade, pal.skin, t), reg: number = REGION.skin;
    if (id === PART.neckCut) { col = NECK_CUT; reg = REGION.neck; }
    else if (id === PART.neck) { col = mix(pal.shade, pal.skin, Math.min(t, smooth((p.y - 0.98) / 0.2))); reg = REGION.neck; }
    else if (id === PART.ear) {
      const rig = earRig(spec, p.x >= 0 ? 1 : -1), front = nh.x * (p.x >= 0 ? 1 : -1) * Math.cos(rad(rig.pl.openingDeg)) + nh.z * Math.sin(rad(rig.pl.openingDeg)) > -0.05;
      const tx = earColor(rig.field, g.uv[2 * k]!, g.uv[2 * k + 1]!, front, kw, pal, 0.0055 * 2, rig.pl.hPx);
      col = tx.ink ? tx.c : mix(tx.c, mix(pal.shade, tx.c, 0.55), 1 - t); reg = tx.region;
    }
    else {
      const s = sectionAt(spec, p.y), az = (Math.atan2(p.x, p.z - s.zc) * 180) / Math.PI;
      const R = spec.hairline.region, hl = hairlineY(spec, az), sd = R ? signedDistance(regionField(R), az, p.y) : 0, half = 0.0055 * kw * 0.5;
      if (id === PART.head && (R ? sd > 0 : p.y < hl)) {
        col = mix(hairShade, pal.hair, t); reg = REGION.hair;
        if (R ? sd < half : Math.abs(p.y - hl) < 0.03 && Math.abs(p.y - hl) < hairTol(spec, view, az, hl, kw)) col = pal.ink;
      } else if (id === PART.head && R && -sd < half && p.y < 0.98) {
        col = pal.ink;
      } else if (p.z > 0.2) {
        const tx = eyeTex(spec, p, kw, pal) ?? browTex(spec, p, kw, pal) ?? mouthTex(spec, p, kw, pal) ?? nostrilTex(spec, p, pal);
        if (tx) { col = tx.ink ? tx.c : mix(mix(tx.c, pal.shade, 0.35), tx.c, t); reg = tx.region; }
        else { const a = blushAlpha(p); if (a > 0) col = mix(col, pal.blush, a); }
      }
    }
    rgba[4 * k] = col[0]; rgba[4 * k + 1] = col[1]; rgba[4 * k + 2] = col[2]; rgba[4 * k + 3] = 1; region[k] = reg;
  }
  outline(g, rgba, pal.ink, o);
  return { rgba, region };
}

/** Contours : discontinuités de silhouette (fond), de groupe (côté proche) ou de profondeur (oreilles, > 0,045 U), élargies d'un disque. */
function outline(g: GBuf, rgba: Float32Array, ink: RGB, o: PaintOpts): void {
  const { w, h } = g, sil = new Uint8Array(w * h), earSil = new Uint8Array(w * h), inner = new Uint8Array(w * h), thin = new Uint8Array(w * h), r = Math.max(1, Math.round((o.lineU * o.ppuHi) / 2)), ri = Math.max(1, Math.round(r / 2));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x, gi = group(g.id[k]!);
    if (!gi) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) { sil[k] = 1; break; }
      const j = yy * w + xx, gj = group(g.id[j]!);
      if (gj === 0) { (gi === 3 ? earSil : sil)[k] = 1; break; }
      if (gj !== gi && g.depth[k]! > g.depth[j]! && (gi === 4 || gj === 4)) { thin[k] = 1; break; }   // plan de coupe du cou : trait fin, comme sur la planche
      if (gj !== gi && g.depth[k]! > g.depth[j]!) { inner[k] = 1; break; }
      if (gj === gi && gi === 3 && g.depth[k]! - g.depth[j]! > 0.07) { inner[k] = 1; break; }
    }
  }
  // Silhouette : disque de rayon r, grandit vers l'intérieur ; arête INTERNE : rayon r/2 de part et d'autre, pour la même épaisseur visible.
  const out = new Uint8Array(w * h), stamp = (m: Uint8Array, rr: number): void => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!m[y * w + x]) continue;
      for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
        const xx = x + dx, yy = y + dy;
        if (dx * dx + dy * dy <= rr * rr && xx >= 0 && yy >= 0 && xx < w && yy < h && g.id[yy * w + xx]) out[yy * w + xx] = 1;
      }
    }
  };
  stamp(sil, r); stamp(earSil, Math.max(1, Math.round(r * 0.6))); stamp(inner, ri); stamp(thin, Math.max(1, Math.round(ri / 2)));
  for (let k = 0; k < w * h; k++) if (out[k]) { rgba[4 * k] = ink[0]; rgba[4 * k + 1] = ink[1]; rgba[4 * k + 2] = ink[2]; }
}

export type { Tex };

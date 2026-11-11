import { hex, mix, type RGB } from './color';
import { blushAlpha, browTex, eyeTex, mouthTex, nostrilTex, paletteOf, type Pal, type Tex } from './face-tex';
import { dirToCam, norm, rad, smooth, toCam, v3 } from './math';
import { earRig } from './engines/ear3d';
import { earColor } from './engines/ear-paint';
import { markColor, neckMark } from './engines/neck-relief';
import { PART } from './mesh';
import type { GBuf } from './raster';
import { regionField, signedDistance } from './hair-region';
import { hairlineY, headPoint, sectionAt } from './sections';
import { REGION, type HeadTurnSpec, type View } from './types';
import { ambientOcclusion, castShadowScaled } from '../relief/cast';
import { bounceAt, shadeAt, tonesOf, type LightModel, type Shade, type Tones } from '../relief/model';
import { hairSheen, hairTones, sheenScreen } from './hair-light';
import { litDepth, softenedNormal } from './nose-light';
import { parseHex } from '../core/color';

/** Lumière de la PLANCHE DE RÉFÉRENCE (mode sans `light`), en repère CAMÉRA (haut-gauche, de face) : elle ne tourne pas avec la tête. Avec `PaintOpts.light`, c'est le `LightModel` de `src/relief` qui la remplace. */
const LIGHT = norm(v3(-0.25, -0.55, 0.8));
/** Coupe du cou : ombre de la peau × rapport de la planche (230,188,164 → 217,169,143), donc identique sur la planche et teintée par la peau des autres têtes. */
const NECK_CUT_K: RGB = [217 / 230, 169 / 188, 143 / 164];
/** Groupe de contour : les pièces d'un même groupe n'ont pas de trait entre elles (nez et lèvres font partie de la tête). */
const group = (id: number): number => (id === PART.head || id === PART.bump ? 1 : id === PART.neck ? 2 : id === PART.ear || id === PART.earBack ? 3 : id === PART.neckCut ? 4 : 0);

/** Tolérance verticale (repère tête) du trait de lisière pour qu'il garde 0,0055 U d'épaisseur À L'ÉCRAN : elle croît avec la pente de la lisière projetée. */
function hairTol(spec: HeadTurnSpec, view: View, az: number, hl: number, kw: number): number {
  const a0 = ((az - 1) * Math.PI) / 180, a1 = ((az + 1) * Math.PI) / 180, side = az < 0 ? -1 : 1;
  const q = (th: number) => { const pt = headPoint(spec, hairlineY(spec, Math.abs((th * 180) / Math.PI)), Math.abs(th) * side); return toCam(pt, view, 'head'); };
  const c0 = q(a0), c1 = q(a1), tx = Math.abs(c1.x - c0.x), tl = Math.hypot(c1.x - c0.x, c1.y - c0.y);
  void hl;
  return Math.min(0.03, (0.0055 * kw * tl) / Math.max(tx, 1e-4) / Math.max(0.5, Math.cos((view.pitch * Math.PI) / 180)));
}

export interface Painted { readonly rgba: Float32Array; readonly region: Uint8Array }
/** `light` : modèle d'éclairage UNIQUE du projet (`src/relief/model.ts`, celui de la tête de face et du corps). Absent = ombrage à deux tons de la planche de référence. */
export interface PaintOpts { readonly lineU: number; readonly ppuHi: number; readonly light?: LightModel; /** Teinte d'ombre IMPOSÉE par l'apparence de la peau de l'hôte (`skin.light.shadow`), lue comme sur la tête de face ; `null` = dérivée du modèle. */ readonly shadowTint?: string | null }

/** Éclairage par relief du tampon : ombres portées + occlusion par marche de rayon sur la PROFONDEUR du G-buffer (nez sur la joue, menton sur le cou, oreille), mêmes fonctions que la tête de face. */
export function reliefLight(spec: HeadTurnSpec, g: GBuf, o: PaintOpts, model: LightModel, view?: View): { cast: Float32Array; ao: Float32Array; tones: Tones; hair: Tones } {
  const W = 2 * Math.max(...spec.rows.map((r) => r.a)), grid = { x0: 0, y0: 0, ppu: o.ppuHi, w: g.w, h: g.h };
  const depth = view ? litDepth(spec, g, view) : g.depth;   // ailes du nez allégées (nose-light.ts) ; sans vue : profondeur brute
  const cast = castShadowScaled(grid, depth, model.dir, { reach: 0.42 * W, penumbra: 0.08 + 0.5 * model.soft }, 4);
  return { cast, ao: ambientOcclusion(grid, depth, 0.035 * W, 0.05 * W), tones: tonesOf(spec.palette.skin, model, { shadow: o.shadowTint ?? null }), hair: hairTones(spec, model) };
}
/** Couleur `c` (déjà « pleine lumière ») éclairée : multiplicateurs par canal ombre → lumière (`lit`) puis → cœur (`core`), comme la couche `multiply` de la tête de face. */
function lightMul(c: RGB, tones: Tones, s: Shade, litOverride?: number): RGB {
  const l = litOverride ?? s.lit, out: RGB = [0, 0, 0];
  for (let i = 0; i < 3; i++) { const m0 = tones.shadowMul[i]! + (tones.lightMul[i]! - tones.shadowMul[i]!) * l; out[i] = c[i]! * (m0 + (tones.coreMul[i]! - m0) * s.core); }
  return out;
}
/** Contour de lumière et reflet : fusion `screen` de la couleur du contour / de la source, pondérée comme `relief/overlay.ts`. */
function rimScreen(c: RGB, s: Shade, model: LightModel): RGB {
  const a = Math.min(1, s.rim * 0.9 + s.spec * 0.5); if (a <= 0) return c;
  const rc = parseHex(model.rimColor), lc = parseHex(model.color), w = s.rim * 0.9 + s.spec * 0.5, out: RGB = [0, 0, 0];
  for (let i = 0; i < 3; i++) { const sc = (rc[i]! * s.rim * 0.9 + lc[i]! * s.spec * 0.5) / Math.max(1e-3, w); out[i] = c[i]! + (255 - c[i]!) * (sc / 255) * a; }
  return out;
}

/** Peint le tampon géométrique : ombrage à deux tons (cel), lisière des cheveux, texture du visage, oreilles, ombre sous le menton, puis contours. */
export function paint(spec: HeadTurnSpec, g: GBuf, view: View, o: PaintOpts): Painted {
  const { w, h } = g, n = w * h, pal: Pal = paletteOf(spec);
  const rgba = new Float32Array(n * 4), region = new Uint8Array(n), hairShade = hex(spec.palette.hairShade), L = o.light, rl = L ? reliefLight(spec, g, o, L, view) : null;
  for (let k = 0; k < n; k++) {
    const id = g.id[k]!;
    if (!id) continue;
    const p = { x: g.P[3 * k]!, y: g.P[3 * k + 1]!, z: g.P[3 * k + 2]! }, nh = norm({ x: g.N[3 * k]!, y: g.N[3 * k + 1]!, z: g.N[3 * k + 2]! });
    const nc = dirToCam(nh, view, id === PART.neck || id === PART.neckCut ? 'neck' : 'head', p.y), lam = nc.x * LIGHT.x + nc.y * LIGHT.y + nc.z * LIGHT.z, t = smooth((lam - 0.02) / 0.22);
    const kw = Math.min(1.4, 1 / Math.max(0.7, nc.z));                         // compensation du raccourcissement des traits sur les faces obliques
    const ncL = L && id === PART.bump ? dirToCam(softenedNormal(spec, p, nh), view, 'head', p.y) : nc;   // ailes du nez : normale ramenée vers la face (pas de disque clair), éclairage seul
    const sh = L && rl ? shadeAt(L, ncL, rl.cast[k]!, rl.ao[k]!) : null, litB = sh && L && rl ? sh.lit + (1 - sh.lit) * bounceAt(L, ncL, rl.ao[k]!) : 0;   // litB : part éclairée AVEC la lumière de rebond (seconde lumière, par en dessous)
    const lightOf = (c: RGB, legacyShade: RGB): RGB => (sh && rl ? lightMul(c, rl.tones, sh, litB) : mix(legacyShade, c, t));
    let ink = false, col = lightOf(pal.skin, pal.shade), reg: number = REGION.skin;
    if (id === PART.neckCut) { const sd = rl ? hex(rl.tones.shadow) : pal.shade; col = [sd[0] * NECK_CUT_K[0], sd[1] * NECK_CUT_K[1], sd[2] * NECK_CUT_K[2]]; reg = REGION.neck; ink = true; }
    else if (id === PART.neck) {
      const fade = smooth((p.y - 0.98) / 0.2); col = sh && rl ? lightMul(pal.skin, rl.tones, sh, Math.min(litB, fade)) : mix(pal.shade, pal.skin, Math.min(t, fade)); reg = REGION.neck; ink = true;
      if (neckMark(spec, p)) col = sh && rl ? lightMul(markColor(pal), rl.tones, sh, Math.min(litB, fade)) : markColor(pal);   // creux des reliefs du cou (SCM, platysma, clavicule) lus du moteur de cou ; éclairés par le même modèle
    }
    else if (id === PART.ear) {
      const rig = earRig(spec, p.x >= 0 ? 1 : -1), front = nh.x * (p.x >= 0 ? 1 : -1) * Math.cos(rad(rig.pl.openingDeg)) + nh.z * Math.sin(rad(rig.pl.openingDeg)) > -0.05;
      const tx = earColor(rig.field, g.uv[2 * k]!, g.uv[2 * k + 1]!, front, kw, pal, 0.0055 * 2, rig.pl.hPx);
      col = tx.ink ? tx.c : lightOf(tx.c, mix(pal.shade, tx.c, 0.55)); ink = tx.ink; reg = tx.region;
    }
    else {
      const s = sectionAt(spec, p.y), az = (Math.atan2(p.x, p.z - s.zc) * 180) / Math.PI;
      const R = spec.hairline.region, hl = hairlineY(spec, az), sd = R ? signedDistance(regionField(R), az, p.y) : 0, half = 0.0055 * kw * 0.5;
      if (id === PART.head && (R ? sd > 0 : p.y < hl)) {
        col = sh && rl && L ? sheenScreen(lightMul(pal.hair, rl.hair, sh, litB), L, hairSheen(L, nh, p.y, view, sh)) : lightOf(pal.hair, hairShade); reg = REGION.hair;   // lit : tons des cheveux + bande de brillance (hair-light.ts)
        if (R ? sd < half : Math.abs(p.y - hl) < 0.03 && Math.abs(p.y - hl) < hairTol(spec, view, az, hl, kw)) { col = pal.ink; ink = true; }
      } else if (id === PART.head && R && -sd < half && p.y < 0.98) {
        col = pal.ink; ink = true;
      } else if (p.z > 0.2 && nh.z > 0.05) {   // le visage ne se peint que sur une surface tournée vers l'avant : sans cette condition la bouche et la rougeur débordaient sur le DESSOUS du menton (rectangle rose à 90° – 135°)
        const tx = eyeTex(spec, p, kw, pal) ?? browTex(spec, p, kw, pal) ?? mouthTex(spec, p, kw, pal) ?? nostrilTex(spec, p, pal);
        if (tx) { col = tx.ink ? tx.c : lightOf(tx.c, mix(tx.c, pal.shade, 0.35)); ink = tx.ink === true; reg = tx.region; }
        else { const a = blushAlpha(p, spec); if (a > 0) col = mix(col, pal.blush, a); }
      }
    }
    if (sh && L && !ink) col = rimScreen(col, sh, L);   // contour de lumière et reflet : jamais sur un trait d'encre, ni sur le cou (coupe)
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

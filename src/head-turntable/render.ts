import { encodePngRgba } from '../core/png';
import { buildParts } from './parts';
import { paint } from './paint';
import { rasterize, type Frame } from './raster';
import { REF_SPEC } from './spec';
import { REF_PITCH } from './ref-fit';
import type { HeadTurnSpec, TurnRender, View } from './types';

/** Cadre commun à toutes les vues d'une planche : la tête (+ cou) tient dans 1,5 U × 1,75 U, pivot à 0,75 U du bord gauche, sommet à 0,18 U du haut. */
export function defaultFrame(heightPx = 700): Frame {
  const ppu = heightPx / 1.75;
  return { w: Math.round(1.5 * ppu), h: heightPx, ppu, ox: 0.75 * ppu, oy: 0.2 * ppu };
}

/** `lineU` : largeur nominale du trait en U ; les silhouettes grandissent vers l'intérieur, la largeur visible vaut donc lineU / 2 (≈ 0,011 U ; la planche ≈ 0,013). */
export interface RenderOpts { readonly frame?: Frame; readonly ss?: number; readonly background?: string | null; readonly lineU?: number }

/** Rendu d'une vue de la tête : G-buffer sur-échantillonné → peinture → réduction → SVG autonome (PNG incrusté). Pur et déterministe. */
export function renderHead(view: View, spec: HeadTurnSpec = REF_SPEC, o: RenderOpts = {}): TurnRender {
  const f = o.frame ?? defaultFrame(), ss = o.ss ?? 2;
  const hi: Frame = { w: f.w * ss, h: f.h * ss, ppu: f.ppu * ss, ox: f.ox * ss, oy: f.oy * ss };
  const g = rasterize(buildParts(spec), view, hi);
  const pa = paint(spec, g, view, { lineU: o.lineU ?? 0.022, ppuHi: hi.ppu });
  const rgba = new Uint8ClampedArray(f.w * f.h * 4), ids = new Uint8Array(f.w * f.h), regions = new Uint8Array(f.w * f.h);
  const bg = o.background === undefined ? [255, 255, 255] : o.background === null ? null : [parseInt(o.background.slice(1, 3), 16), parseInt(o.background.slice(3, 5), 16), parseInt(o.background.slice(5, 7), 16)];
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    let r = 0, gg = 0, b = 0, cov = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const k = (y * ss + sy) * hi.w + x * ss + sx;
      if (g.id[k]) { r += pa.rgba[4 * k]!; gg += pa.rgba[4 * k + 1]!; b += pa.rgba[4 * k + 2]!; cov++; }
    }
    const o4 = 4 * (y * f.w + x), c = (Math.floor(ss / 2) * hi.w) + y * ss * hi.w + x * ss + Math.floor(ss / 2), a = cov / (ss * ss);
    ids[y * f.w + x] = g.id[c]!; regions[y * f.w + x] = pa.region[c]!;
    const bgc = bg ?? [0, 0, 0];
    rgba[o4] = cov ? (r / cov) * a + bgc[0]! * (1 - a) : bgc[0]!;
    rgba[o4 + 1] = cov ? (gg / cov) * a + bgc[1]! * (1 - a) : bgc[1]!;
    rgba[o4 + 2] = cov ? (b / cov) * a + bgc[2]! * (1 - a) : bgc[2]!;
    rgba[o4 + 3] = bg ? 255 : Math.round(255 * a);
  }
  const png = encodePngRgba(f.w, f.h, rgba).toString('base64');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${f.w}" height="${f.h}" viewBox="0 0 ${f.w} ${f.h}"><image width="${f.w}" height="${f.h}" href="data:image/png;base64,${png}"/></svg>`;
  return { w: f.w, h: f.h, rgba, svg, ids, regions, ppu: f.ppu, originX: f.ox, originY: f.oy };
}

/** Vue de la planche de référence : lacet donné, tangage de caméra ajusté sur les 9 vues. */
export const refView = (yaw: number): View => ({ yaw, pitch: REF_PITCH });

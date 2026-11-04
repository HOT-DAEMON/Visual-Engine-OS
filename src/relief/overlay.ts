import { encodePngRgba } from '../core/png';
import { parseHex } from '../core/color';
import type { FaceLandmarks, NoseGeometry } from '../face';
import type { FaceParams } from '../schema';
import { ambientOcclusion, castShadow } from './cast';
import { REGION, type Grid, type ReliefField } from './field';
import { headGrid, headRelief } from './head';
import { shadeAt, tonesOf, type LightModel, type Tones } from './model';
import { goboAt } from './patterns';

/**
 * COUCHE D'ÉCLAIRAGE DE LA TÊTE : relief → ombres portées + AO → éclairage par pixel → deux images posées PAR-DESSUS le visage déjà dessiné :
 *  · `multiply` : multiplicateur de couleur (lumière teintée côté éclairé, ombre / cœur d'ombre côté opposé). Multiplier, c'est colorier TOUT ce qui est dessiné dessous
 *    (peau, yeux, cheveux, cils) sans le recouvrir : les détails restent lisibles, l'ombre tombe sur eux comme dans les références (01 n°2 : l'œil dans l'ombre).
 *  · `screen`   : lumière de contour et reflet, ajoutés.
 * Le fondu du bas du cou raccorde cette couche à l'éclairage du corps (même `LightModel`, mêmes tons).
 */
export interface HeadLit {
  readonly svg: string; readonly field: ReliefField; readonly model: LightModel; readonly tones: Tones;
  /** Part éclairée par pixel (0 = ombre, 1 = lumière) et part d'ombre portée, même grille que `field`. */
  readonly lit: Float32Array; readonly cast: Float32Array;
}
export interface HeadLitOpts { readonly ppu?: number; readonly reach?: number; readonly zc?: number; readonly neckAxisZ?: number; readonly fadeNeck?: boolean; readonly ao?: number }
export function headLit(p: FaceParams, lm: FaceLandmarks, nose: NoseGeometry, skin: string, model: LightModel, o: HeadLitOpts = {}): HeadLit {
  const g: Grid = headGrid(lm, o.ppu ?? 2.4), field = headRelief(p, lm, nose, { grid: g, zc: o.zc ?? 0, ...(o.neckAxisZ === undefined ? {} : { neckAxisZ: o.neckAxisZ }) });
  const cast = castShadow(g, field.depth, model.dir, { reach: o.reach ?? 0.42 * lm.W, penumbra: 0.08 + 0.5 * model.soft }), ao = ambientOcclusion(g, field.depth, 0.035 * lm.W, 0.05 * lm.W), tones = tonesOf(skin, model, { shadow: p.skin.light.shadow });
  const N = g.w * g.h, mul = new Uint8ClampedArray(N * 4), scr = new Uint8ClampedArray(N * 4), lit = new Float32Array(N), aoK = o.ao ?? 0.5;
  const rc = parseHex(model.rimColor), lc = parseHex(model.color), fade0 = lm.neck.bottomY - 0.12 * lm.H;
  for (let j = 0; j < g.h; j++) {
    const y = g.y0 + (j + 0.5) / g.ppu, fade = o.fadeNeck === false ? 1 : 1 - Math.min(1, Math.max(0, (y - fade0) / (lm.neck.bottomY - fade0)));
    for (let i = 0; i < g.w; i++) {
      const k = j * g.w + i; if (field.depth[k] === -Infinity) continue;
      const x = g.x0 + (i + 0.5) / g.ppu, gb = model.gobo ? goboAt(model.gobo, x, y) : 1;
      const s = shadeAt(model, { x: field.nx[k]!, y: field.ny[k]!, z: field.nz[k]! }, cast[k]!, ao[k]! * aoK * (field.region[k] === REGION.orbit ? 1.3 : 1), gb);
      lit[k] = s.lit;
      for (let c = 0; c < 3; c++) {
        const m0 = tones.shadowMul[c]! + (tones.lightMul[c]! - tones.shadowMul[c]!) * s.lit, m1 = m0 + (tones.coreMul[c]! - m0) * s.core;
        mul[k * 4 + c] = 255 * (1 - (1 - m1) * fade);
      }
      mul[k * 4 + 3] = 255;
      const a = Math.min(1, s.rim * 0.9 + s.spec * 0.5) * fade;
      for (let c = 0; c < 3; c++) scr[k * 4 + c] = (rc[c]! * s.rim * 0.9 + lc[c]! * s.spec * 0.5) / Math.max(1e-3, s.rim * 0.9 + s.spec * 0.5);
      scr[k * 4 + 3] = 255 * a;
    }
  }
  const w = g.w / g.ppu, h = g.h / g.ppu, img = (rgba: Uint8ClampedArray, blend: string): string => `<image x="${g.x0.toFixed(2)}" y="${g.y0.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" preserveAspectRatio="none" style="mix-blend-mode:${blend}" href="data:image/png;base64,${encodePngRgba(g.w, g.h, rgba).toString('base64')}"/>`;
  return { svg: `<g>${img(mul, 'multiply')}${img(scr, 'screen')}</g>`, field, model, tones, lit, cast };
}

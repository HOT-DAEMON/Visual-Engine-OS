import { createHash } from 'node:crypto';
import { encodePngRgba } from '../core/png';
import { canonical } from '../perf/content-cache';
import { LayerCache } from '../perf/layers';
import { parseHex } from '../core/color';
import type { FaceLandmarks, NoseGeometry } from '../face';
import type { FaceParams } from '../schema';
import { ambientOcclusion, castShadow } from './cast';
import { REGION, type Grid, type ReliefField } from './field';
import { headGrid, headRelief } from './head';
import { shaderOf, tonesOf, type LightModel, type ShadeOut, type Tones } from './model';
import { goboAt } from './patterns';

/**
 * COUCHE D'ÉCLAIRAGE DE LA TÊTE : relief → ombres portées + AO → éclairage par pixel → deux images posées PAR-DESSUS le visage déjà dessiné :
 *  · `multiply` : multiplicateur de couleur (lumière teintée côté éclairé, ombre / cœur d'ombre côté opposé). Multiplier, c'est colorier TOUT ce qui est dessiné dessous
 *    (peau, yeux, cheveux, cils) sans le recouvrir : les détails restent lisibles, l'ombre tombe sur eux comme dans les références (01 n°2 : l'œil dans l'ombre).
 *  · `screen`   : lumière de contour et reflet, ajoutés.
 * Le fondu du bas du cou raccorde cette couche à l'éclairage du corps (même `LightModel`, mêmes tons).
 */
export interface HeadLit {
  /** Empreinte de CONTENU du champ de relief (visage, repères, nez, grille, profondeurs) : identifie l'occulteur « tête » pour le cache d'ombre du corps. */
  readonly key: string;
  readonly svg: string; readonly field: ReliefField; readonly model: LightModel; readonly tones: Tones;
  /** Part éclairée par pixel (0 = ombre, 1 = lumière) et part d'ombre portée, même grille que `field`. */
  readonly lit: Float32Array; readonly cast: Float32Array;
}
export interface HeadLitOpts { readonly ppu?: number; readonly reach?: number; readonly zc?: number; readonly neckAxisZ?: number; readonly fadeNeck?: boolean; readonly ao?: number }
/**
 * COUCHES de la tête, à clés de dépendance (docs/PERF-4.md) : le champ de relief et l'occlusion ambiante ne dépendent PAS de la lumière ; l'ombre portée ne dépend que
 * de la direction, de la portée et de la pénombre. Changer la lumière, la peau ou le style ne refait donc que ce qui en dépend. Les valeurs sont des tampons IMMUABLES.
 */
const FIELD = new LayerCache<ReliefField>('head.field', 3), AOL = new LayerCache<Float32Array>('head.ao', 3), CASTL = new LayerCache<Float32Array>('head.cast', 4);
export function headLit(p: FaceParams, lm: FaceLandmarks, nose: NoseGeometry, skin: string, model: LightModel, o: HeadLitOpts = {}): HeadLit {
  const g: Grid = headGrid(lm, o.ppu ?? 2.4), fkey = createHash('sha1').update(canonical([p, lm, nose, g, o.zc ?? 0, o.neckAxisZ ?? null])).digest('hex');
  const field = FIELD.get(fkey, () => headRelief(p, lm, nose, { grid: g, zc: o.zc ?? 0, ...(o.neckAxisZ === undefined ? {} : { neckAxisZ: o.neckAxisZ }) }));
  const reach = o.reach ?? 0.42 * lm.W, pen = 0.08 + 0.5 * model.soft, aoR = 0.035 * lm.W, aoG = 0.05 * lm.W;
  const cast = CASTL.get(`${fkey}|${JSON.stringify([model.dir, reach, pen])}`, () => castShadow(g, field.depth, model.dir, { reach, penumbra: pen }));
  const ao = AOL.get(`${fkey}|${aoR}|${aoG}`, () => ambientOcclusion(g, field.depth, aoR, aoG)), tones = tonesOf(skin, model, { shadow: p.skin.light.shadow });
  const N = g.w * g.h, mul = new Uint8ClampedArray(N * 4), scr = new Uint8ClampedArray(N * 4), lit = new Float32Array(N), aoK = o.ao ?? 0.5;
  const shader = shaderOf(model), s: ShadeOut = { lit: 0, core: 0, rim: 0, spec: 0 }, rc = parseHex(model.rimColor), lc = parseHex(model.color), fade0 = lm.neck.bottomY - 0.12 * lm.H;
  for (let j = 0; j < g.h; j++) {
    const y = g.y0 + (j + 0.5) / g.ppu, fade = o.fadeNeck === false ? 1 : 1 - Math.min(1, Math.max(0, (y - fade0) / (lm.neck.bottomY - fade0)));
    for (let i = 0; i < g.w; i++) {
      const k = j * g.w + i; if (field.depth[k] === -Infinity) continue;
      const x = g.x0 + (i + 0.5) / g.ppu, gb = model.gobo ? goboAt(model.gobo, x, y) : 1;
      shader(field.nx[k]!, field.ny[k]!, field.nz[k]!, cast[k]!, ao[k]! * aoK * (field.region[k] === REGION.orbit ? 1.3 : 1), gb, s);
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
  return { key: fkey, svg: `<g>${img(mul, 'multiply')}${img(scr, 'screen')}</g>`, field, model, tones, lit, cast };
}

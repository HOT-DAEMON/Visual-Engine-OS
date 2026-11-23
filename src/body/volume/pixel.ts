import { lightModelOf, type LightModel } from '../../relief/model';
import { LayerCache, idOf, timedLayer } from '../../perf/layers';
import { buildGBuffer, gbufferKeyOf, type GBuffer } from './gbuffer';
import { occlusionOf, type Occlusion } from './occlusion';
import type { VMarkup, VRenderOpts } from './render';
import { bodyCast, encodeFinal, shadePixels } from './shade-pixels';
import type { VolumeSet } from './types';

/**
 * RENDU PAR PIXEL des volumes : même géométrie, même sélection et même ordre de peinture que le rendu vectoriel, mais l'ombrage est calculé À CHAQUE PIXEL depuis
 * la normale interpolée (au lieu d'un dégradé par volume). Découpé en COUCHES à clés de dépendance (docs/PERF-4.md) :
 *   G-buffer ← (volumes, caméra, cadrage, sélection)            · indépendant de la lumière, de la peau et de l'ombrage
 *   occlusion + rainures ← G-buffer                              · idem
 *   ombre portée ← G-buffer + modèle de lumière + occulteur      · mise en cache si l'occulteur est nommé (`proxyKey`)
 *   ombrage par pixel + sur-échantillonnage + PNG ← tout         · jamais mis en cache (dépend de tout)
 * Changer la lumière ne refait donc que l'ombre portée et l'ombrage. Résultat IDENTIQUE octet pour octet à l'ancien rendu monolithique (tests/figure-layers.test.ts).
 */
export interface PixelOpts extends VRenderOpts {
  readonly heightPx?: number; readonly ss?: number; readonly ao?: number; readonly groove?: number;
  /** Modèle de lumière unique (`relief/model.ts`) : ombres portées, terminateur, tons en OKLab, styles cel. `undefined` = modèle par défaut (ombres visibles) ; `null` = ancien éclairage (comparaisons avant/après). */
  readonly lightModel?: LightModel | null;
  /** Occulteur sans surface visible (la tête, dessinée par le moteur de visage) : profondeur en un point du repère du corps, `-Infinity` = rien. Il PROJETTE son ombre (menton → cou, poitrine). */
  readonly proxy?: (x: number, y: number) => number;
  /** Identifiant DE CONTENU de l'occulteur (ex. clé du champ de relief de la tête) : s'il est donné, l'ombre portée est mise en cache ; sinon elle est recalculée à chaque rendu (une fonction ne se compare pas). */
  readonly proxyKey?: string;
  /** Portée de l'ombre portée, en unités du monde (défaut : 1,2 hauteur de tête). */
  readonly shadowReach?: number;
}
export interface VPixelMarkup extends VMarkup { readonly pixels: { readonly w: number; readonly h: number; readonly rgba: Uint8ClampedArray } }

const GBUF = new LayerCache<GBuffer>('body.gbuffer', 2), OCCL = new LayerCache<Occlusion>('body.occlusion', 2), CAST = new LayerCache<Float32Array>('body.cast', 4);
const DEFAULT_MODEL = lightModelOf({}, { style: 'soft' });

/** G-buffer d'un jeu de volumes (mis en cache : le jeu est IMMUABLE, désigné par son identité). */
export const gbufferOf = (set: VolumeSet, o: PixelOpts): GBuffer => GBUF.get(`${idOf(set)}|${gbufferKeyOf(o)}`, () => buildGBuffer(set, o));

/** Rendu pixel d'un VolumeSet → SVG (image PNG incrustée). Pur et déterministe. */
export function renderVolumesPixel(set: VolumeSet, o: PixelOpts): VPixelMarkup {
  const g = gbufferOf(set, o), gid = idOf(g), oc = OCCL.get(String(gid), () => occlusionOf(g));
  const M = o.lightModel === null ? null : (o.lightModel ?? DEFAULT_MODEL);
  let castArr: Float32Array | null = null;
  if (M) {
    const make = (): Float32Array => bodyCast(g, M, o);
    castArr = o.proxy && o.proxyKey === undefined ? timedLayer('body.cast', make) : CAST.get(`${gid}|${o.proxyKey ?? ''}|${JSON.stringify([M.dir, M.soft, o.shadowReach ?? null])}`, make);
  }
  const out = timedLayer('body.shade', () => shadePixels(g, oc, castArr, M, o));
  const fin = timedLayer('body.encode', () => encodeFinal(g, out));
  return { svg: fin.svg, bounds: { x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1 }, drawn: g.ids.length, ids: g.ids, pixels: { w: fin.w, h: fin.h, rgba: fin.rgba } };
}

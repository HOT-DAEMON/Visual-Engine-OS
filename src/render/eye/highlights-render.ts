import { halfVectorXY, type LightVector } from '../../lighting/light';
import { placeHighlights, pupilKeepOut, type OpeningGeometry, type PlacedHighlight, type Vec } from '../../geometry/eye';
import type { EyeSpec } from '../../schema';
import { el, urlRef } from '../../core/svg';
import { polygonPath, smoothClosed } from './helpers';
import { isFlat } from './flat-finish';
import { rayMarkup } from './highlight-rays';
import { NEUTRAL_LEVERS, type EyeLevers } from './appearance-levers';

/**
 * OPT-01/04 — Peinture des reflets détaillés (placement et règle d'occlusion : geometry/eye/highlights.ts).
 * Les reflets `light` suivent le vecteur médian de la lumière LOCALE (cause physique) ; `iris` et `globe` sont des choix de composition.
 * Chaque reflet : forme, rotation, couleur, opacité, douceur (flou), halo d'intensité (bloom). Confinement à l'iris par clipPath.
 */
export interface HighlightsRender {
  readonly defs: string[];
  readonly markup: string[];
}

function shapeMarkup(p: PlacedHighlight, attrs: Record<string, string | number>): string {
  const { item } = p;
  if (p.outline.length === 0) {
    return el('ellipse', { cx: p.cx, cy: p.cy, rx: p.rx, ry: p.ry, ...(item.rotationDeg ? { transform: `rotate(${item.rotationDeg} ${p.cx} ${p.cy})` } : {}), ...attrs });
  }
  const pts: Vec[] = p.outline.map((v) => ({ x: v.x + p.cx, y: v.y + p.cy }));
  return el('path', { d: item.shape === 'star' ? smoothClosed(pts) : polygonPath(pts), ...attrs });
}

/**
 * Un flou par valeur, pas un flou par éclat (passe 14). Les éclats d'une famille d'iris ont souvent la même taille : 12 filtres identiques à 1 px près
 * faisaient dépasser le budget SVG (ice 18, emerald 15, limite 14). L'écart de flou est quantifié par pas de 5 % (erreur maximale 2,5 %, invisible) ;
 * les régions de filtre sont relatives à la boîte de l'objet, donc le même filtre sert des éclats de tailles différentes.
 */
const BLUR_STEP = Math.log(1.05);
export const quantizeBlur = (std: number): number => (std <= 0 ? 0 : Math.exp(Math.round(Math.log(std) / BLUR_STEP) * BLUR_STEP));

export function renderHighlights(eye: EyeSpec, g: OpeningGeometry, c: Vec, localLight: LightVector, irisRx: number, irisRy: number, lightColor: string, id: string, levers: EyeLevers = NEUTRAL_LEVERS): HighlightsRender {
  const defs: string[] = [];
  const markup: string[] = [];
  const flat = isFlat(eye);   // fini flat : reflets nets (ni halo d'intensité ni flou de douceur)
  // Passe 20 : `appearance.reflection.{intensity,size}` (mêmes conventions que la peau, 0,5 = neutre) ; identité exacte aux valeurs neutres.
  const list = levers.reflectionGain === 1 && levers.reflectionScale === 1 ? eye.highlights.list : eye.highlights.list.map((h) => ({ ...h, size: h.size * levers.reflectionScale, opacity: Math.min(1, h.opacity * levers.reflectionGain) }));
  const placed = placeHighlights(list, { c, irisRx, irisRy, half: halfVectorXY(localLight), bbox: g.bbox, keepOut: pupilKeepOut(eye, irisRx, irisRy) });
  const blurIds = new Map<string, string>();   // clé « kind:écart » -> id du filtre déjà déclaré
  const blurFilter = (kind: 'glow' | 'soft', std: number): string => {
    const q = quantizeBlur(std); const key = `${kind}:${q.toFixed(3)}`; const known = blurIds.get(key);
    if (known) return known;
    const fid = `${id}-hl-${kind}${blurIds.size}`; blurIds.set(key, fid);
    defs.push(el('filter', { id: fid, x: kind === 'glow' ? '-100%' : '-50%', y: kind === 'glow' ? '-100%' : '-50%', width: kind === 'glow' ? '300%' : '200%', height: kind === 'glow' ? '300%' : '200%' }, [el('feGaussianBlur', { stdDeviation: q })]));
    return fid;
  };
  const needIrisClip = placed.some((p) => p.item.confine === 'iris');
  if (needIrisClip) defs.push(el('clipPath', { id: `${id}-hl-iris` }, [el('ellipse', { cx: c.x, cy: c.y, rx: irisRx, ry: irisRy })]));

  placed.forEach((p, i) => {
    const { item } = p;
    const color = item.color ?? lightColor;
    const out: string[] = [];
    // Teinte (passe 13) : l'aura prend la teinte ; le corps et les aiguilles vont du cœur (`color`) vers la teinte (dégradé radial) ; fini flat : teinte pleine, pas de dégradé.
    const reach = Math.max(p.rx, p.ry) * (1 + item.rays * 0.9); let fill = color;
    if (item.tint && !flat) {
      const rid = `${id}-hl${i}-tint`;
      defs.push(el('radialGradient', { id: rid, gradientUnits: 'userSpaceOnUse', cx: p.cx, cy: p.cy, r: reach }, [el('stop', { offset: 0.25, 'stop-color': color }), el('stop', { offset: 1, 'stop-color': item.tint })]));
      fill = urlRef(rid);
    }
    const auraColor = item.tint ?? color;
    if (item.intensity > 0 && !flat) {
      const gid = blurFilter('glow', Math.max(p.rx, p.ry) * (0.45 + 0.5 * item.intensity));
      out.push(shapeMarkup({ ...p, rx: p.rx * 1.35, ry: p.ry * 1.35, outline: p.outline.map((v) => ({ x: v.x * 1.35, y: v.y * 1.35 })) }, { fill: auraColor, 'fill-opacity': Math.min(1, item.opacity * item.intensity * 0.8), filter: urlRef(gid) }));
    }
    out.push(...rayMarkup(p, fill));
    const attrs: Record<string, string | number> = { fill, 'fill-opacity': item.opacity };
    if (item.softness > 0 && !flat) {
      const sid = blurFilter('soft', item.softness * 0.35 * Math.min(p.rx, p.ry));
      attrs.filter = urlRef(sid);
    }
    out.push(shapeMarkup(p, attrs));
    markup.push(item.confine === 'iris' ? el('g', { 'clip-path': urlRef(`${id}-hl-iris`) }, out) : out.length === 1 ? (out[0] as string) : el('g', {}, out));
  });
  return { defs, markup };
}

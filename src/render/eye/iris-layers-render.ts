import { angularCells, blendColor, polar, radialRange, zoneOutline } from '../../geometry/eye';
import { dominantColor, gradientStop as stop } from '../../materials';
import type { EyeSpec } from '../../schema';
import type { IrisLayer } from '../../schema/eye-iris-layers';
import { el, num, urlRef } from '../../core/svg';
import { polygonPath, smoothClosed } from './helpers';
import type { Vec } from '../../geometry/eye';

/**
 * EYE-04 — Peinture des couches de couleur de l'iris (géométrie : geometry/eye/iris-layers.ts).
 * Tout est dessiné dans un repère CIRCULAIRE (disque de rayon `irisRx`) puis écrasé par `scale(1, irisRy/irisRx)` :
 * les dégradés radiaux restent circulaires dans ce repère. Un clipPath à l'ellipse de l'iris termine chaque couche (bords nets au limbe).
 * Gradient radial/uni : UNE forme à dégradé radial (fondu `feather`) ; gradient angulaire : `steps` secteurs de couleurs interpolées.
 * `blur` adoucit les bords angulaires ; `glow` ajoute un halo flou plus clair sous la couche.
 */
export interface IrisLayersRender { readonly defs: string[]; readonly markup: string[]; }

/** Nombre de secteurs d'un gradient angulaire : 1 par ≈ 7,5° d'un tour complet, au moins 8. */
const stepsFor = (span: number): number => Math.max(8, Math.round(span / 7.5));

function layerMarkup(l: IrisLayer, i: number, eye: EyeSpec, R: number, id: string, defs: string[]): string[] {
  const out: string[] = [];
  const base = dominantColor(eye.iris.material.base);
  const c1 = blendColor(base, l.color, l.blend);
  const c2 = l.color2 ? blendColor(base, l.color2, l.blend) : c1;
  const { r0, r1 } = radialRange(l);
  const f = l.feather * 0.5;
  const gid = `${id}-il${i}`;

  if (l.mask === 'spot') {
    const mid = (r0 + r1) / 2;
    const p = polar(l.angleDeg, mid);
    defs.push(el('radialGradient', { id: gid, cx: 0.5, cy: 0.5, r: 0.5 }, [stop(0, c1, l.opacity), stop(Math.max(0.01, 1 - l.feather), c2, l.opacity * (1 - l.feather * 0.4)), stop(1, c2, 0)]));
    out.push(el('circle', { cx: p.x * R, cy: p.y * R, r: l.spotRadius * R, fill: urlRef(gid) }));
    return out;
  }
  const pts = (zoneOutline(l, eye.seed, i) as Vec[]).map((v) => ({ x: v.x * R, y: v.y * R }));
  const smooth = l.irregularity > 0 && l.mask !== 'sector' && l.mask !== 'half';
  const d = smooth ? smoothClosed(pts) : polygonPath(pts);

  if (l.gradient === 'angular') {
    const cells = angularCells(l, stepsFor(l.mask === 'full' || l.mask === 'ring' ? 360 : l.mask === 'half' ? 180 : l.span));
    const inner = r0 * R;
    const outer = r1 * R;
    for (const c of cells) {
      const a: Vec[] = [];
      for (let k = 0; k <= 2; k++) { const q = polar(c.a0 + ((c.a1 - c.a0 + 0.8) * k) / 2, 1); a.push({ x: q.x * outer, y: q.y * outer }); }
      const b: Vec[] = [];
      for (let k = 2; k >= 0; k--) { const q = polar(c.a0 + ((c.a1 - c.a0 + 0.8) * k) / 2, 1); b.push({ x: q.x * inner, y: q.y * inner }); }
      out.push(el('path', { d: polygonPath([...a, ...(inner > 0.001 ? b : [{ x: 0, y: 0 }])]), fill: c.color, 'fill-opacity': l.opacity }));
    }
    return out;
  }
  // Dégradé radial (ou uni) en repère utilisateur : r = R. Fondu intérieur/extérieur = `feather`.
  const o0 = Math.max(0, r0 - f);
  const stops = [stop(o0, c1, r0 > 0 ? 0 : l.opacity), stop(Math.max(o0, r0), c1, l.opacity), stop(Math.max(r0, Math.min(1, r1)), l.gradient === 'radial' ? c2 : c1, l.opacity), stop(Math.min(1, Math.max(r1, r1 + f)), l.gradient === 'radial' ? c2 : c1, r1 < 1 ? 0 : l.opacity)];
  defs.push(el('radialGradient', { id: gid, gradientUnits: 'userSpaceOnUse', cx: 0, cy: 0, r: R }, stops));
  out.push(el('path', { d, fill: urlRef(gid) }));
  return out;
}

export function renderIrisLayers(eye: EyeSpec, c: Vec, irisRx: number, irisRy: number, id: string): IrisLayersRender {
  const defs: string[] = [];
  const markup: string[] = [];
  if (eye.iris.layers.length === 0) return { defs, markup };
  defs.push(el('clipPath', { id: `${id}-il-clip` }, [el('ellipse', { cx: c.x, cy: c.y, rx: irisRx, ry: irisRy })]));
  const squash = `translate(${num(c.x)} ${num(c.y)}) scale(1 ${num(irisRy / irisRx)})`;
  eye.iris.layers.forEach((l, i) => {
    const body = layerMarkup(l, i, eye, irisRx, id, defs);
    const angular = l.gradient === 'angular';
    const softEdges = l.mask === 'sector' || l.mask === 'half' || angular || l.irregularity > 0;
    const blurSd = softEdges && l.feather > 0 ? l.feather * 0.05 * irisRx : 0;
    const wrap = (items: string[], extra: Record<string, string | number> = {}): string => el('g', { ...extra }, items);
    const parts: string[] = [];
    if (l.glow > 0) {
      const gf = `${id}-il${i}-glow`;
      defs.push(el('filter', { id: gf, x: '-30%', y: '-30%', width: '160%', height: '160%' }, [el('feGaussianBlur', { stdDeviation: irisRx * (0.05 + 0.09 * l.glow) })]));
      parts.push(wrap(body, { filter: urlRef(gf), opacity: Math.min(1, l.glow * 0.9) }));
    }
    if (blurSd > 0) {
      const bf = `${id}-il${i}-blur`;
      defs.push(el('filter', { id: bf, x: '-10%', y: '-10%', width: '120%', height: '120%' }, [el('feGaussianBlur', { stdDeviation: blurSd })]));
      parts.push(wrap(body, { filter: urlRef(bf) }));
    } else parts.push(wrap(body));
    markup.push(el('g', { 'clip-path': urlRef(`${id}-il-clip`) }, [el('g', { transform: squash }, parts)]));
  });
  return { defs, markup };
}

import { lighten } from '../../core/color';
import { microLod, scleraMarks, scleraVessels, type OpeningGeometry, type Vec } from '../../geometry/eye';
import { halfVectorXY, type LightVector } from '../../lighting/light';
import { gradientStop as stop } from '../../materials';
import type { EyeSpec } from '../../schema';
import { el, urlRef } from '../../core/svg';
import { P, smoothThrough } from './helpers';
import { softLine } from './soft-shadow';

/**
 * EYE-07 / EYE-01 — Peinture des microdétails (géométrie et LOD : geometry/eye/micro-detail.ts).
 *  `under` : se dessine SOUS l'iris (c'est la sclère) — variations chromatiques, vaisseaux, marques ;
 *  `over`  : se dessine PAR-DESSUS iris et sclère (c'est le film lacrymal et l'ombre de contact) — brillance humide, ménisque, occlusion.
 * Cause physique (film lacrymal, occlusion) et effet artistique ne sont jamais mélangés : chacun a son bloc de paramètres.
 */
export interface MicroRender { readonly defs: string[]; readonly under: string[]; readonly over: string[]; }

const lowerD = (g: OpeningGeometry, dy: number): string => `M${P({ x: g.po.x, y: g.po.y + dy })}C${P({ x: g.l1.x, y: g.l1.y + dy })} ${P({ x: g.l2.x, y: g.l2.y + dy })} ${P({ x: g.pi.x, y: g.pi.y + dy })}`;
const upperD = (g: OpeningGeometry, dy: number): string => `M${P({ x: g.pi.x, y: g.pi.y + dy })}C${P({ x: g.u1.x, y: g.u1.y + dy })} ${P({ x: g.u2.x, y: g.u2.y + dy })} ${P({ x: g.po.x, y: g.po.y + dy })}`;

export function renderMicrodetail(eye: EyeSpec, g: OpeningGeometry, c: Vec, localLight: LightVector, irisRx: number, irisRy: number, id: string): MicroRender {
  const defs: string[] = [];
  const under: string[] = [];
  const over: string[] = [];
  const m = eye.microdetail;
  if (!m) return { defs, under, over };
  const lod = microLod(m.lod.eyePixels);
  const b = g.bbox;
  const h = g.hEff;

  // EYE-07B — variations chromatiques : chaud près des canthi, froid sous la paupière haute.
  if (m.chroma) {
    if (m.chroma.warm > 0) {
      for (const [k, p] of [['in', g.pi], ['out', g.po]] as const) {
        const cx = p.x + (c.x - p.x) * 0.22;
        defs.push(el('radialGradient', { id: `${id}-warm-${k}`, cx: 0.5, cy: 0.5, r: 0.5 }, [stop(0, '#e8827c', m.chroma.warm * 0.34), stop(1, '#e8827c', 0)]));
        under.push(el('ellipse', { cx, cy: p.y, rx: b.w * 0.2, ry: h * 0.42, fill: urlRef(`${id}-warm-${k}`) }));
      }
    }
    if (m.chroma.cool > 0) {
      defs.push(el('linearGradient', { id: `${id}-cool`, x1: 0, y1: 0, x2: 0, y2: 1 }, [stop(0, '#5f74a6', m.chroma.cool * 0.3), stop(0.5, '#5f74a6', 0)]));
      under.push(el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, fill: urlRef(`${id}-cool`) }));
    }
  }

  // EYE-07A — vaisseaux (troncs + ramifications), hors de l'iris par construction.
  if (m.vessels && m.vessels.density > 0 && lod.vessels > 0) {
    const paths = scleraVessels(g, c, irisRx, irisRy, m.vessels, eye.seed, lod).map((v) => {
      const first = v.pts[0] as Vec;
      return el('path', { d: `M${P(first)}${smoothThrough(v.pts)}`, 'stroke-width': v.width, 'stroke-opacity': v.alpha });
    });
    if (paths.length) under.push(el('g', { fill: 'none', stroke: m.vessels.tint, 'stroke-linecap': 'round' }, paths));
  }

  // EYE-07F — petites marques.
  if (m.imperfections > 0 && lod.fine > 0) {
    const marks = scleraMarks(g, c, irisRx, irisRy, m.imperfections, eye.seed, lod.fine).map((k) => el('circle', { cx: k.x, cy: k.y, r: k.r }));
    if (marks.length) under.push(el('g', { fill: '#8c5b3d', 'fill-opacity': 0.28 }, marks));
  }

  // EYE-07H — occlusion locale : ombre de contact de la paupière haute sur le globe (trait doux sans filtre, ou flou de référence).
  if (m.occlusion > 0 && lod.fine > 0) {
    const alpha = m.occlusion * 0.42 * lod.fine;
    if (eye.renderQuality === 'reference') {
      defs.push(el('filter', { id: `${id}-occl`, x: '-10%', y: '-30%', width: '120%', height: '160%' }, [el('feGaussianBlur', { stdDeviation: h * 0.03 })]));
      over.push(el('path', { d: upperD(g, h * 0.02), fill: 'none', stroke: '#000000', 'stroke-width': h * 0.07, 'stroke-opacity': alpha, 'stroke-linecap': 'round', filter: urlRef(`${id}-occl`) }));
    } else over.push(...softLine(upperD(g, h * 0.02), h * 0.04, h * 0.03, '#000000', alpha));
  }

  // EYE-07C / EYE-01 — film lacrymal : reflet diffus sur le globe (côté de la lumière) + ménisque brillant le long du bord inférieur.
  const tf = m.tearFilm;
  if (tf && tf.wetness > 0) {
    const half = halfVectorXY(localLight);
    const sx = b.x + b.w / 2 + half.x * b.w * 0.2;
    const sy = b.y + b.h / 2 + half.y * h * 0.22;
    defs.push(el('radialGradient', { id: `${id}-sheen`, cx: 0.5, cy: 0.5, r: 0.5 }, [stop(0, '#ffffff', tf.wetness * 0.3), stop(0.6, '#ffffff', tf.wetness * 0.08), stop(1, '#ffffff', 0)]));
    over.push(el('ellipse', { cx: sx, cy: sy, rx: b.w * 0.26, ry: h * 0.2, fill: urlRef(`${id}-sheen`) }));
    const dy = -h * 0.012;
    const w0 = h * (0.016 + 0.03 * tf.meniscus);
    const col = lighten(eye.canthi.inner.color, 0.55);
    if (eye.renderQuality === 'reference') {
      defs.push(el('filter', { id: `${id}-wet`, x: '-5%', y: '-60%', width: '110%', height: '220%' }, [el('feGaussianBlur', { stdDeviation: h * 0.006 })]));
      over.push(el('path', { d: lowerD(g, dy), fill: 'none', stroke: col, 'stroke-width': w0, 'stroke-opacity': tf.wetness * 0.38, 'stroke-linecap': 'round', filter: urlRef(`${id}-wet`) }));
    } else over.push(...softLine(lowerD(g, dy), w0 * 0.7, h * 0.006, col, tf.wetness * 0.38));
    over.push(el('path', { d: lowerD(g, dy - w0 * 0.15), fill: 'none', stroke: '#ffffff', 'stroke-width': w0 * 0.28, 'stroke-opacity': tf.wetness * 0.62, 'stroke-linecap': 'round' }));
  }
  return { defs, under, over };
}

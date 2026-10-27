import { dominantColor, gradientDef } from '../../materials';
import type { EyeSpec } from '../../schema';
import { el, urlRef } from '../../core/svg';
import { isLegacyPupil, pupilContours, type Contour } from '../../geometry/eye';
import { smoothClosed, polygonPath } from './helpers';

export interface PupilRender {
  readonly defs: string[];
  readonly markup: string[];
}

/**
 * Pupille : état explicitement visible/invisible (rien n'est dessiné si `visible: false`),
 * remplissage `ColorSource` (uni/linéaire/radial, orientable — même richesse que l'iris ou la
 * sclère) et 0 à 3 contours concentriques empilés vers l'extérieur, chacun de sa propre couleur.
 * Volontairement SANS `compileSurface` : une pupille est un trou, pas une surface éclairée — ni
 * reflet spéculaire, ni rampe d'environnement.
 */
export function renderPupil(
  pupil: EyeSpec['pupil'],
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  id: string,
  profile?: PupilProfileCtx,
): PupilRender {
  const defs: string[] = [];
  const markup: string[] = [];
  if (!pupil.visible) return { defs, markup };
  if (profile && !isLegacyPupil(pupil)) return renderPupilProfile(pupil, cx, cy, id, profile);

  const fillId = `${id}-pupil-fill`;
  const grad = gradientDef(fillId, pupil.fill);
  if (grad) defs.push(grad);
  markup.push(el('ellipse', { cx, cy, rx, ry, fill: grad ? urlRef(fillId) : dominantColor(pupil.fill) }));

  // Contours concentriques : chacun est une ellipse en trait seul (fill:none), empilée vers
  // l'extérieur en conservant le rapport rx/ry de la pupille (essentiel pour une fente serrée).
  let ringRx = rx;
  let ringRy = ry;
  const aspect = ry / Math.max(rx, 1e-6);
  for (const outline of pupil.outlines) {
    const w = outline.width * rx;
    const midRx = ringRx + w / 2;
    const midRy = ringRy + (w / 2) * aspect;
    markup.push(
      el('ellipse', {
        cx,
        cy,
        rx: midRx,
        ry: midRy,
        fill: 'none',
        stroke: outline.color,
        'stroke-width': w,
        'stroke-opacity': outline.opacity,
      }),
    );
    ringRx += w;
    ringRy += w * aspect;
  }
  return { defs, markup };
}

/** Contexte nécessaire au chemin « profil » : rayons de l'iris, taille effective et graine de l'œil. */
export interface PupilProfileCtx {
  readonly irisRx: number;
  readonly irisRy: number;
  readonly size: number;
  readonly seed: number;
}

/** Tracé d'un contour : polygones à sommets vifs (étoile, losange…) en segments, formes lisses par quadratiques. */
const contourPath = (c: Contour, smooth: boolean): string => (smooth ? smoothClosed(c) : polygonPath(c));

/**
 * Chemin « profil » (EYE-05) : tout profil non historique. Géométrie = `pupilContours` (déformée, tournée, décalée,
 * multipliée, bornée à l'iris) ; ici seulement la peinture : liseré teinté (05F), contours concentriques, remplissage,
 * flou de bord (05F netteté). Les contours concentriques sont des traits centrés dessinés du plus large au plus étroit,
 * puis recouverts par le remplissage : la moitié intérieure disparaît, il reste la bande extérieure.
 */
function renderPupilProfile(pupil: EyeSpec['pupil'], cx: number, cy: number, id: string, ctx: PupilProfileCtx): PupilRender {
  const defs: string[] = [];
  const { contours } = pupilContours(pupil, ctx.size, ctx.irisRx, ctx.irisRy, ctx.seed);
  const smooth = pupil.shape === 'round' || pupil.shape === 'slit_vertical' || pupil.shape === 'slit_horizontal' || pupil.lobes.rounding > 0 || pupil.deform.irregularity > 0;
  const d = contours.map((c) => contourPath(c, smooth)).join('');
  const rMin = Math.min(ctx.irisRx, ctx.irisRy) * pupil.size;
  const body: string[] = [];

  const fillId = `${id}-pupil-fill`;
  const grad = gradientDef(fillId, pupil.fill);
  if (grad) defs.push(grad);

  if (pupil.edge.tint) body.push(el('path', { d, fill: 'none', stroke: pupil.edge.tint, 'stroke-width': rMin * 0.28, 'stroke-opacity': pupil.edge.tintOpacity, 'stroke-linejoin': 'round' }));
  let cum = 0;
  const bands = pupil.outlines.map((o) => (cum += o.width * rMin * 2));
  for (let i = pupil.outlines.length - 1; i >= 0; i--) {
    const o = pupil.outlines[i] as EyeSpec['pupil']['outlines'][number];
    body.push(el('path', { d, fill: 'none', stroke: o.color, 'stroke-width': bands[i] as number, 'stroke-opacity': o.opacity, 'stroke-linejoin': 'round' }));
  }
  body.push(el('path', { d, fill: grad ? urlRef(fillId) : dominantColor(pupil.fill), 'fill-rule': 'nonzero' }));

  const g: Record<string, string | number> = { transform: `translate(${cx} ${cy})` };
  if (pupil.edge.softness > 0) {
    defs.push(el('filter', { id: `${id}-pupil-soft`, x: '-30%', y: '-30%', width: '160%', height: '160%' }, [el('feGaussianBlur', { stdDeviation: pupil.edge.softness * 0.12 * rMin })]));
    g.filter = urlRef(`${id}-pupil-soft`);
  }
  return { defs, markup: [el('g', g, body)] };
}

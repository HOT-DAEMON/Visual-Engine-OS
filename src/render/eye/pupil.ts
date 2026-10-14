import { dominantColor, gradientDef } from '../../materials';
import type { EyeSpec } from '../../schema';
import { el, urlRef } from '../../core/svg';

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
): PupilRender {
  const defs: string[] = [];
  const markup: string[] = [];
  if (!pupil.visible) return { defs, markup };

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

import { darken, lighten } from '../../core/color';
import { caruncleOf, foldGeometry, type OpeningGeometry, type FoldGeometry, type Vec } from '../../geometry/eye';
import { direction2D, type LightVector } from '../../lighting/light';
import { foreshortenTransform, gazeOf } from '../../lighting/gaze3d';
import { compileSurface, gradientStop as stop, type Surface } from '../../materials';
import { renderPupil } from './pupil';
import { renderIrisDetail } from './iris-detail';
import { renderHighlights } from './highlights-render';
import type { EyeSpec } from '../../schema';
import { el, num, urlRef } from '../../core/svg';
import { P, highlightOffsets, irisFibers, limbalRing, openingPath, polygonPath, pupilRadii } from './helpers';

export interface GlobeInner {
  readonly defs: string[];
  readonly inner: string[];
  /** Transmis à `renderLidsAndFold` : la même géométrie de pli ne doit être calculée qu'une fois. */
  readonly fold: FoldGeometry | null;
}

/**
 * Tout ce qui se dessine À L'INTÉRIEUR du clip de l'ouverture palpébrale : iris, pupille (pupil.ts),
 * rotation 3D du globe, caroncule, ligne humide, ombre des paupières, vignettage, reflets « anime »,
 * et la peau du pli épicanthique qui recouvre le canthus interne.
 */
export function renderGlobeInner(
  eye: EyeSpec,
  g: OpeningGeometry,
  c: Vec,
  L: LightVector,
  rot: number,
  worldLight: LightVector,
  skin: string,
  id: string,
  irisRx: number,
  irisRy: number,
): GlobeInner {
  const defs: string[] = [];
  const inner: string[] = [];

  // Iris (matériau partagé)
  const irisSurface: Surface = {
    bbox: { x: c.x - irisRx, y: c.y - irisRy, w: 2 * irisRx, h: 2 * irisRy },
    curvature: 'sphere',
    draw: (a) => el('ellipse', { cx: c.x, cy: c.y, rx: irisRx, ry: irisRy, ...a }),
  };
  const iris = compileSurface(`${id}-iris`, irisSurface, eye.iris.material, L, rot);
  defs.push(...iris.defs);
  const irisGroup: string[] = [iris.markup, irisFibers(eye, c, irisRx, irisRy)];

  // Anneau limbique
  const ring = limbalRing(eye, c, irisRx, irisRy);
  if (ring) irisGroup.push(ring);

  // Iris détaillé (opt-in : vide si `iris.detail` est null) — couches sous la pupille, voir iris-detail.ts.
  const detail = renderIrisDetail(eye, c, irisRx, irisRy, id);
  defs.push(...detail.defs);
  irisGroup.push(...detail.markup);

  // Lueur de transillumination : côté de l'iris OPPOSÉ à la lumière.
  if (eye.iris.glow && eye.iris.glow.strength > 0) {
    const d = direction2D(L);
    const { color, strength } = eye.iris.glow;
    defs.push(
      el(
        'linearGradient',
        { id: `${id}-glow`, x1: 0.5 + d.x * 0.5, y1: 0.5 + d.y * 0.5, x2: 0.5 - d.x * 0.5, y2: 0.5 - d.y * 0.5 },
        [stop(0, color, 0), stop(0.45, color, 0), stop(1, color, 0.9 * strength)],
      ),
    );
    irisGroup.push(el('ellipse', { cx: c.x, cy: c.y, rx: irisRx, ry: irisRy, fill: urlRef(`${id}-glow`) }));
  }

  // Pupille (voir pupil.ts : visible/invisible, remplissage ColorSource, contours concentriques).
  const pr = pupilRadii(eye, irisRx, irisRy);
  const pupil = renderPupil(eye.pupil, c.x, c.y, pr.rx, pr.ry, id, { irisRx, irisRy, size: eye.pupil.size, seed: eye.seed });
  defs.push(...pupil.defs);
  irisGroup.push(...pupil.markup);

  // Rotation 3D du globe (yaw/pitch, voir gaze3d.ts) : l'iris, ses fibres, l'anneau limbique, la
  // lueur et la pupille se compressent ensemble le long de l'axe de bascule, comme un disque physique
  // vu de plus en plus de profil. Identité quand le regard est de face.
  const gazeT = foreshortenTransform(c.x, c.y, gazeOf(eye));
  inner.push(gazeT ? el('g', { transform: gazeT }, irisGroup) : el('g', {}, irisGroup));

  // Caroncule lacrymale (canthus interne)
  const car = caruncleOf(g, eye.canthi.inner.caruncle);
  if (car) {
    const col = eye.canthi.inner.color;
    defs.push(
      el('radialGradient', { id: `${id}-caruncle`, cx: 0.5, cy: 0.5, r: 0.5 }, [
        stop(0, lighten(col, 0.35)),
        stop(0.6, col),
        stop(1, darken(col, 0.35)),
      ]),
    );
    inner.push(el('ellipse', { cx: car.cx, cy: car.cy, rx: car.rx, ry: car.ry, fill: urlRef(`${id}-caruncle`) }));
  }

  // Ligne humide du bord inférieur
  if (eye.lids.waterline > 0.01) {
    inner.push(
      el('path', {
        d: `M${P({ x: g.po.x, y: g.po.y - g.h * 0.012 })}C${P({ x: g.l1.x, y: g.l1.y - g.h * 0.012 })} ${P({ x: g.l2.x, y: g.l2.y - g.h * 0.012 })} ${P({ x: g.pi.x, y: g.pi.y - g.h * 0.012 })}`,
        fill: 'none',
        stroke: lighten(eye.canthi.inner.color, 0.3),
        'stroke-opacity': 0.55 * eye.lids.waterline,
        'stroke-width': g.h * 0.014,
        'stroke-linecap': 'round',
      }),
    );
  }

  // Ombre portée des paupières : le contour de l'ouverture décalé À L'OPPOSÉ de la lumière ;
  // la partie de l'ouverture réelle non couverte par la copie décalée est le croissant d'ombre.
  const dist = g.hEff * 0.2;
  const margin = Math.max(g.bbox.w, g.bbox.h) * 0.25;
  const b = g.bbox;
  const outer = `M${num(b.x - margin)} ${num(b.y - margin)}H${num(b.x + b.w + margin)}V${num(b.y + b.h + margin)}H${num(b.x - margin)}Z`;
  defs.push(
    el('filter', { id: `${id}-lidblur`, x: '-20%', y: '-20%', width: '140%', height: '140%' }, [
      el('feGaussianBlur', { stdDeviation: g.hEff * 0.035 }),
    ]),
  );
  inner.push(
    el('path', {
      d: outer + openingPath(g, -L.x * dist, -L.y * dist),
      'fill-rule': 'evenodd',
      fill: '#000000',
      'fill-opacity': 0.38,
      filter: urlRef(`${id}-lidblur`),
    }),
  );

  // Vignettage aux coins (occlusion ambiante de l'orbite)
  defs.push(
    el('radialGradient', { id: `${id}-ao`, cx: 0.5, cy: 0.5, r: 0.5 }, [
      stop(0, '#000000', 0),
      stop(0.6, '#000000', 0),
      stop(1, '#000000', 0.22),
    ]),
  );
  inner.push(
    el('ellipse', {
      cx: b.x + b.w / 2,
      cy: b.y + b.h / 2,
      rx: b.w / 2,
      ry: (b.h / 2) * 1.1,
      fill: urlRef(`${id}-ao`),
    }),
  );

  // Reflets : liste détaillée (highlights-render.ts) ou, par défaut, les deux reflets « anime » historiques.
  if (eye.highlights.list.length > 0) {
    const hr = renderHighlights(eye, g, c, L, irisRx, irisRy, worldLight.color, id);
    defs.push(...hr.defs);
    inner.push(...hr.markup);
  } else {
    const off = highlightOffsets(eye, worldLight);
    const hl = eye.highlights;
    inner.push(
      el('circle', {
        cx: c.x + off.primary.x,
        cy: c.y + off.primary.y,
        r: hl.primary.size * irisRx,
        fill: worldLight.color,
        'fill-opacity': hl.primary.opacity,
      }),
    );
    if (hl.secondary) {
      inner.push(
        el('circle', {
          cx: c.x + off.secondary.x,
          cy: c.y + off.secondary.y,
          r: hl.secondary.size * irisRx,
          fill: worldLight.color,
          'fill-opacity': hl.secondary.opacity,
        }),
      );
    }
  }

  // Pli épicanthique : la peau recouvre une partie de la fente (recouvrement limité à l'ouverture)
  const fold = foldGeometry(g, eye.epicanthicFold);
  if (fold) {
    inner.push(el('path', { d: polygonPath(fold.region), fill: skin }));
    // Ombre douce de l'avancée de peau sur le globe, le long de la nouvelle bordure de la fente
    inner.push(
      el('path', {
        d: `M${P(fold.pu)}C${P(fold.c1)} ${P(fold.c2)} ${P(fold.pl)}`,
        fill: 'none',
        stroke: darken(skin, 0.6),
        'stroke-opacity': 0.14 * eye.epicanthicFold.amount,
        'stroke-width': g.h * 0.05,
        'stroke-linecap': 'round',
      }),
    );
  }

  return { defs, inner, fold };
}

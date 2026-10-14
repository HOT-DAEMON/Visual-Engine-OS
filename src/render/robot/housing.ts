import { darken, lighten } from '../../core/color';
import { type LightVector } from '../../lighting/light';
import { compileSurface, dominantColor, gradientStop as stop, SHADING, type Surface } from '../../materials';
import type { RobotEyeSpec } from '../../schema';
import { el, num, urlRef } from '../../core/svg';

/** Trace un cercle complet en chemin SVG (deux arcs) ; `ccw` inverse le sens de parcours, ce qui
 * permet de percer un trou par la règle du remplissage non-nul (nonzero winding). */
const circlePath = (cx: number, cy: number, r: number, ccw: boolean): string => {
  const sweep = ccw ? 0 : 1;
  return `M${num(cx - r)} ${num(cy)}A${num(r)} ${num(r)} 0 1 ${sweep} ${num(cx + r)} ${num(cy)}A${num(r)} ${num(r)} 0 1 ${sweep} ${num(cx - r)} ${num(cy)}Z`;
};

export interface HousingRender {
  readonly defs: string[];
  readonly body: string[];
}

/** Boîtier de l'œil de robot : anneau métallique (matériau partagé), biseau, vis, joint. */
export function renderHousing(r: RobotEyeSpec, L: LightVector, rot: number, id: string, R: number, Rin: number): HousingRender {
  const defs: string[] = [];
  const body: string[] = [];
  const ringColor = dominantColor(r.housing.material.base);

  // 1. Boîtier : anneau plat (extérieur horaire, intérieur antihoraire => trou)
  const bezelSurface: Surface = {
    bbox: { x: -R, y: -R, w: 2 * R, h: 2 * R },
    curvature: 'flat',
    draw: (a) => el('path', { d: circlePath(0, 0, R, false) + circlePath(0, 0, Rin, true), ...a }),
  };
  const bezel = compileSurface(`${id}-bezel`, bezelSurface, r.housing.material, L, rot);
  defs.push(...bezel.defs);
  body.push(bezel.markup);

  // 2. Biseau intérieur (occlusion ambiante : indépendant de la lumière)
  body.push(
    el('circle', {
      cx: 0,
      cy: 0,
      r: Rin - R * 0.006,
      fill: 'none',
      stroke: '#000000',
      'stroke-opacity': 0.5,
      'stroke-width': R * 0.012,
    }),
  );

  // 3. Vis : positions et fentes déterministes (aucun hasard)
  const nb = r.housing.bolts;
  if (nb > 0) {
    const rm = R * (1 - r.housing.ringWidth / 2);
    const rb = R * r.housing.ringWidth * 0.2;
    defs.push(
      el(
        'radialGradient',
        {
          id: `${id}-bolt`,
          cx: 0.5,
          cy: 0.5,
          r: 0.5,
          fx: 0.5 + L.x * SHADING.focalShift,
          fy: 0.5 + L.y * SHADING.focalShift,
        },
        [stop(0, lighten(ringColor, 0.3)), stop(1, darken(ringColor, 0.55))],
      ),
    );
    const bolts: string[] = [];
    for (let i = 0; i < nb; i++) {
      const a = (2 * Math.PI * i) / nb + Math.PI / 4;
      const bx = rm * Math.cos(a);
      const by = rm * Math.sin(a);
      const slot = (((i * 47) % 180) * Math.PI) / 180;
      const sx = Math.cos(slot) * rb * 0.8;
      const sy = Math.sin(slot) * rb * 0.8;
      bolts.push(
        el('circle', {
          cx: bx,
          cy: by,
          r: rb,
          fill: urlRef(`${id}-bolt`),
          stroke: darken(ringColor, 0.7),
          'stroke-opacity': 0.6,
          'stroke-width': rb * 0.12,
        }),
        el('path', {
          d: `M${num(bx - sx)} ${num(by - sy)}L${num(bx + sx)} ${num(by + sy)}`,
          fill: 'none',
          stroke: darken(ringColor, 0.8),
          'stroke-width': rb * 0.3,
          'stroke-linecap': 'round',
        }),
      );
    }
    body.push(el('g', {}, bolts));
  }

  // 4. Joint en caoutchouc
  body.push(el('circle', { cx: 0, cy: 0, r: Rin, fill: '#0b0d12' }));

  return { defs, body };
}

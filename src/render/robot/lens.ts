import { darken, lighten } from '../../core/color';
import { type LightVector } from '../../lighting/light';
import { clamp01 } from '../../core/math';
import { compileGloss, compileSurface, spotGradient, gradientStop as stop, type Surface } from '../../materials';
import type { MaterialDescriptor, RobotEyeSpec } from '../../schema';
import { el, num, urlRef } from '../../core/svg';

export interface LensRender {
  readonly defs: string[];
  readonly body: string[];
}

/**
 * Lentille de l'œil de robot : verre teinté, anneaux optiques, ouverture, réticule, capteur
 * émissif (matériau partagé), lueur diffusée, vignettage, et brillance du verre (`compileGloss`).
 */
export function renderLens(
  r: RobotEyeSpec,
  L: LightVector,
  H: { x: number; y: number },
  id: string,
  Rl: number,
  rot: number,
): LensRender {
  const defs: string[] = [];
  const body: string[] = [];

  // 5. Lentille (contenu clippé au disque)
  const tint = r.lens.tint;
  const sensorColor = r.sensor.color;
  const I = r.sensor.intensity;
  const ap = r.lens.aperture;
  const ac = { x: r.gaze.x * 0.1 * Rl, y: r.gaze.y * 0.1 * Rl };
  const parallax = (ap - r.sensor.size) * 0.85 * Rl;
  const sc = { x: ac.x + r.gaze.x * parallax, y: ac.y + r.gaze.y * parallax };
  const sR = Rl * r.sensor.size;
  const inner: string[] = [];

  defs.push(
    el('clipPath', { id: `${id}-lens` }, [el('circle', { cx: 0, cy: 0, r: Rl })]),
    el('radialGradient', { id: `${id}-lensbase`, cx: 0.5, cy: 0.5, r: 0.5 }, [
      stop(0, '#05070d'),
      stop(0.62, '#080b13'),
      stop(0.86, darken(tint, 0.6)),
      stop(1, tint),
    ]),
  );
  inner.push(el('circle', { cx: 0, cy: 0, r: Rl, fill: urlRef(`${id}-lensbase`) }));

  for (let i = 0; i < r.lens.rings; i++) {
    inner.push(
      el('circle', {
        cx: 0,
        cy: 0,
        r: Rl * (0.3 + (0.56 * (i + 1)) / (r.lens.rings + 1)),
        fill: 'none',
        stroke: lighten(tint, 0.35),
        'stroke-opacity': 0.2,
        'stroke-width': Rl * 0.012,
      }),
    );
  }

  inner.push(
    el('circle', {
      cx: ac.x,
      cy: ac.y,
      r: Rl * ap,
      fill: '#020408',
      stroke: lighten(tint, 0.4),
      'stroke-opacity': 0.55,
      'stroke-width': Rl * 0.015,
    }),
  );

  if (r.lens.reticle) {
    let d = '';
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      d += `M${num(ac.x + c * Rl * ap * 1.03)} ${num(ac.y + s * Rl * ap * 1.03)}L${num(ac.x + c * Rl * ap * 1.16)} ${num(ac.y + s * Rl * ap * 1.16)}`;
    }
    inner.push(
      el('path', {
        d,
        fill: 'none',
        stroke: sensorColor,
        'stroke-opacity': 0.7,
        'stroke-width': Rl * 0.02,
        'stroke-linecap': 'round',
      }),
    );
  }

  // Lueur du capteur diffusée sur le verre
  defs.push(
    el('radialGradient', { id: `${id}-bloom`, cx: 0.5, cy: 0.5, r: 0.5 }, [
      stop(0, sensorColor, 0.3 * I),
      stop(1, sensorColor, 0),
    ]),
  );
  inner.push(el('circle', { cx: sc.x, cy: sc.y, r: Rl * 0.95, fill: urlRef(`${id}-bloom`) }));

  // Capteur émissif (matériau dérivé de la couleur : cœur chaud -> couleur -> bord sombre)
  const sensorMaterial: MaterialDescriptor = {
    base: {
      type: 'radial',
      stops: [
        { offset: 0, color: lighten(sensorColor, 0.85), opacity: 1 },
        { offset: 0.35, color: sensorColor, opacity: 1 },
        { offset: 1, color: darken(sensorColor, 0.5), opacity: 1 },
      ],
    },
    metallic: 0,
    roughness: 0.35,
    clearcoat: 0,
    opacity: 1,
    emission: { color: sensorColor, intensity: I },
  };
  const sensorSurface: Surface = {
    bbox: { x: sc.x - sR, y: sc.y - sR, w: 2 * sR, h: 2 * sR },
    curvature: 'sphere',
    draw: (a) => el('circle', { cx: sc.x, cy: sc.y, r: sR, ...a }),
  };
  const sensor = compileSurface(`${id}-sensor`, sensorSurface, sensorMaterial, L, rot);
  defs.push(...sensor.defs);
  inner.push(sensor.markup);

  // Vignettage du bord de lentille
  defs.push(
    el('radialGradient', { id: `${id}-lensedge`, cx: 0.5, cy: 0.5, r: 0.5 }, [
      stop(0, '#000000', 0),
      stop(0.7, '#000000', 0),
      stop(1, '#000000', 0.4),
    ]),
  );
  inner.push(el('circle', { cx: 0, cy: 0, r: Rl, fill: urlRef(`${id}-lensedge`) }));

  // Verre : brillance partagée + reflet interne fantôme à l'opposé de la source
  const glassMaterial: MaterialDescriptor = {
    base: { type: 'solid', color: '#ffffff' },
    metallic: 0,
    roughness: 0.4 - 0.3 * r.lens.gloss,
    clearcoat: r.lens.gloss,
    opacity: 1,
  };
  const lensSurface: Surface = {
    bbox: { x: -Rl, y: -Rl, w: 2 * Rl, h: 2 * Rl },
    curvature: 'sphere',
    draw: (a) => el('circle', { cx: 0, cy: 0, r: Rl, ...a }),
  };
  const glass = compileGloss(`${id}-glass`, lensSurface, glassMaterial, L);
  defs.push(...glass.defs);
  inner.push(glass.markup);

  defs.push(spotGradient(`${id}-ghost`, L.color, clamp01(0.3 * r.lens.gloss * L.intensity), 0.6));
  inner.push(
    el('circle', { cx: -H.x * Rl * 0.55, cy: -H.y * Rl * 0.55, r: Rl * 0.14, fill: urlRef(`${id}-ghost`) }),
  );

  body.push(el('g', { 'clip-path': urlRef(`${id}-lens`) }, inner));
  body.push(
    el('circle', {
      cx: 0,
      cy: 0,
      r: Rl,
      fill: 'none',
      stroke: '#000000',
      'stroke-opacity': 0.6,
      'stroke-width': Rl * 0.02,
    }),
  );

  return { defs, body };
}

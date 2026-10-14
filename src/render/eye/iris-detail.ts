import { darken, lighten } from '../../core/color';
import { mulberry32 } from '../../core/prng';
import { el, urlRef } from '../../core/svg';
import type { Vec } from '../../geometry/eye';
import { gradientStop as stop } from '../../materials';
import type { EyeSpec } from '../../schema';
import { collarette, crypts, flames, irisFrame, irisPalette, sparkles, stromaFibers } from './iris-strands';

export interface IrisDetailRender {
  readonly defs: string[];
  readonly markup: string[];
}

const radial = (id: string, stops: string[]): string => el('radialGradient', { id, cx: 0.5, cy: 0.5, r: 0.5 }, stops);

/**
 * Iris détaillé, de l'intérieur vers l'extérieur (voir `IrisDetail`). Toutes les couches sont
 * découpées dans l'ellipse de l'iris et dessinées SOUS la pupille. Les dégradés radiaux sont
 * exprimés en fraction du rayon de l'iris (le bbox de l'ellipse = l'iris), donc suivent son aspect.
 */
export function renderIrisDetail(eye: EyeSpec, c: Vec, rx: number, ry: number, id: string): IrisDetailRender {
  const d = eye.iris.detail;
  if (!d) return { defs: [], markup: [] };
  const defs: string[] = [];
  const layers: string[] = [];
  const f = irisFrame(c, rx, ry);
  const pal = irisPalette(eye.iris.material.base);
  const rnd = mulberry32((eye.seed ^ 0x1f3d5b79) >>> 0);
  const rhoP = eye.pupil.shape === 'round' ? eye.pupil.size : Math.min(0.2, eye.pupil.size);
  const rhoC = d.collarette ? Math.max(d.collarette.radius, rhoP + 0.1) : rhoP + 0.2;
  const whole = { cx: c.x, cy: c.y, rx, ry };
  const rhoOf = (x: number): number => Math.min(0.999, Math.max(0, x));

  // 1. Zone pupillaire : anneau éclairci entre la pupille et la collerette.
  if (d.innerZone) {
    const col = d.innerZone.color ?? lighten(pal.center, 0.35);
    const s = d.innerZone.strength;
    defs.push(radial(`${id}-iz`, [stop(rhoOf(rhoP - 0.02), col, 0), stop(rhoOf(rhoP + 0.03), col, 0.7 * s), stop(rhoOf(rhoC), col, 0.28 * s), stop(rhoOf(rhoC + 0.07), col, 0)]));
    layers.push(el('ellipse', { ...whole, fill: urlRef(`${id}-iz`) }));
  }
  // 2. Lueur basse (la cornée concentre la lumière dans la partie basse de l'iris).
  if (d.bottomGlow && d.bottomGlow.strength > 0) {
    const col = d.bottomGlow.color ?? lighten(pal.center, 0.4);
    const s = d.bottomGlow.strength;
    defs.push(
      el('radialGradient', { id: `${id}-bg`, cx: 0.5, cy: 0.92, r: 0.62 }, [stop(0, col, 0.95 * s), stop(0.5, col, 0.35 * s), stop(1, col, 0)]),
    );
    layers.push(el('ellipse', { ...whole, fill: urlRef(`${id}-bg`) }));
  }
  // 3-4. Fibres du stroma, grosses puis fines.
  const k = d.density;
  layers.push(
    stromaFibers(f, pal, rnd, Math.round(50 + 90 * k), { from: [rhoP * 1.04, rhoP * 1.04 + 0.06], to: [0.78, 0.97] }, [0.009, 0.022], [0.1, 0.4], d.contrast),
    stromaFibers(f, pal, rnd, Math.round(80 + 170 * k), { from: [0.5, 0.74], to: [0.84, 0.99] }, [0.003, 0.007], [0.12, 0.34], d.contrast),
  );
  // 5. Cryptes.
  if (d.crypts > 0) layers.push(crypts(f, pal, rnd, d.crypts, rhoC));
  // 6. Flammes d'accent : deux couronnes en quinconce, la seconde plus courte et plus claire.
  if (d.accent) {
    const a = d.accent;
    const rhoTo = rhoP + (1 - rhoP) * a.reach;
    defs.push(radial(`${id}-fl1`, [stop(rhoOf(rhoP), a.color, a.opacity), stop(rhoOf(rhoTo), a.color, a.opacity * 0.45), stop(rhoOf(rhoTo + 0.02), a.color, 0)]));
    const light = lighten(a.color, 0.35);
    defs.push(radial(`${id}-fl2`, [stop(rhoOf(rhoP), light, a.opacity * 0.55), stop(rhoOf(rhoP + (rhoTo - rhoP) * 0.6), light, 0)]));
    layers.push(
      flames(f, rnd, a.spikes, rhoP, rhoTo, 0, urlRef(`${id}-fl1`)),
      flames(f, rnd, a.spikes, rhoP, rhoP + (rhoTo - rhoP) * 0.55, 0.5, urlRef(`${id}-fl2`)),
    );
  }
  // 7. Collerette.
  if (d.collarette) layers.push(collarette(f, pal, rnd, rhoC, d.collarette.irregularity, d.collarette.opacity));
  // 8. Assombrissement limbique (progressif, puis liseré net au bord).
  if (d.limbal.strength > 0) {
    const w = d.limbal.width;
    const s = d.limbal.strength;
    const dark = darken(pal.edge, 0.55);
    defs.push(radial(`${id}-lm`, [stop(rhoOf(1 - w), dark, 0), stop(rhoOf(1 - w * 0.4), dark, 0.5 * s), stop(1, dark, 0.95 * s)]));
    layers.push(el('ellipse', { ...whole, fill: urlRef(`${id}-lm`) }));
  }
  // 9. Ombre de la paupière haute (le haut de l'iris est plus sombre).
  if (d.topShade > 0) {
    const col = darken(pal.edge, 0.7);
    defs.push(el('linearGradient', { id: `${id}-ts`, x1: 0.5, y1: 0, x2: 0.5, y2: 0.64 }, [stop(0, col, 0.88 * d.topShade), stop(0.5, col, 0.3 * d.topShade), stop(1, col, 0)]));
    layers.push(el('ellipse', { ...whole, fill: urlRef(`${id}-ts`) }));
  }
  // 10. Halo de pupille.
  if (d.pupilHalo > 0) {
    const col = lighten(pal.center, 0.5);
    defs.push(radial(`${id}-ph`, [stop(rhoOf(rhoP - 0.01), col, 0), stop(rhoOf(rhoP + 0.015), col, 0.75 * d.pupilHalo), stop(rhoOf(rhoP + 0.17), col, 0)]));
    layers.push(el('ellipse', { ...whole, fill: urlRef(`${id}-ph`) }));
  }
  // 11. Scintillements.
  if (d.sparkles > 0) layers.push(sparkles(f, rnd, d.sparkles));

  defs.push(el('clipPath', { id: `${id}-idetail-clip` }, [el('ellipse', whole)]));
  return { defs, markup: [el('g', { 'clip-path': urlRef(`${id}-idetail-clip`) }, layers)] };
}

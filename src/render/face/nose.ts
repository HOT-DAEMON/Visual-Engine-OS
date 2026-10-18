import { darken } from '../../core/color';
import type { ResolvedAppearance } from '../../appearance';
import { el, urlRef } from '../../core/svg';
import { spotGradient } from '../../materials';
import type { FaceLandmarks } from '../../face';
import type { FaceParams } from '../../schema';

/** Nez : arête (ombres latérales), ailes, narines, ombre sous le nez, reflet du bout. Tout dérive des repères. */
export function renderNose(id: string, p: FaceParams, lm: FaceLandmarks, skin: string, ra: ResolvedAppearance): { defs: string[]; markup: string[] } {
  const n = p.nose;
  const nw = n.width * lm.W;
  const base = lm.noseBaseY;
  const tip = lm.noseTipY;
  const top = lm.eyeY + 0.01 * lm.H;
  const shade = ra.tone(-1, skin);
  const gid = `${id}-nose-shadow`;
  const defs = [spotGradient(gid, darken(ra.shadow, 0.4), 0.35, 0.75)];
  const markup: string[] = [
    el('ellipse', { cx: 0, cy: base + 0.012 * lm.H, rx: nw * 0.62, ry: 0.025 * lm.H, fill: urlRef(gid) }),
  ];
  for (const sg of [-1, 1] as const) {
    // Arête : trait ténu du coin interne de l'œil vers l'aile du nez.
    markup.push(el('path', { d: `M${sg * nw * 0.2} ${top}C${sg * nw * 0.26} ${top + (tip - top) * 0.5} ${sg * nw * 0.3} ${tip - 0.03 * lm.H} ${sg * nw * 0.42} ${tip - 0.012 * lm.H}`, fill: 'none', stroke: shade, 'stroke-width': nw * 0.035, 'stroke-linecap': 'round', opacity: 0.45 * n.bridge }));
    // Aile : arc du pli naso-génien jusqu'à la narine.
    markup.push(el('path', { d: `M${sg * nw * 0.24} ${tip - 0.012 * lm.H}C${sg * nw * 0.55} ${tip - 0.02 * lm.H} ${sg * nw * 0.58} ${base + 0.004 * lm.H} ${sg * nw * 0.36} ${base + 0.006 * lm.H}`, fill: 'none', stroke: shade, 'stroke-width': nw * 0.04, 'stroke-linecap': 'round', opacity: 0.6 }));
    if (n.nostril > 0.02) markup.push(el('ellipse', { cx: sg * nw * 0.2, cy: base + 0.004 * lm.H, rx: nw * 0.11 * n.nostril + 0.5, ry: nw * 0.06 * n.nostril + 0.3, fill: darken(skin, 0.75), opacity: 0.85 }));
  }
  markup.push(el('ellipse', { cx: -nw * 0.04, cy: tip - 0.012 * lm.H, rx: nw * 0.16, ry: nw * 0.1, fill: ra.tone(0.8, skin), opacity: 0.3 }));
  return { defs, markup };
}

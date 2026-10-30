import { mk, pair } from './atom';
import type { BodyFrame } from './frame';
import { lerp, v } from './shape';
import { at } from './torso';
import type { Atom, V } from './types';

/**
 * Muscles et os du tronc, tous dessinés dans le repère (u, y) du tronc (`torso.at`) : ils suivent donc l'enveloppe quand l'âge, le sexe,
 * l'adiposité ou la charpente la déforment. Chaque ligne = un atome nommé ; `view: 'occluded'` = existe mais caché de face (os, plans profonds).
 */
export function pectorals(f: BodyFrame): Atom[] {
  const { y: Y, h, mus } = f, yn = Y.base + 0.025 * h, yp = Y.nipple, m = mus;
  const P = (u: number, y: number): V => at(f, u, y);
  const lowR = [P(0.65, yp + 0.03 * h + 0.03 * h * m), P(0.35, yp + 0.06 * h + 0.035 * h * m), P(0.05, yp + 0.07 * h + 0.03 * h * m)];
  const top = [P(0.06, yn + 0.03 * h), P(0.45, lerp(yn, Y.acr, 0.5) + 0.012 * h), P(0.8, Y.acr + 0.06 * h)];
  const out: Atom[] = [];
  out.push(...pair('pec', 'muscle', 'pectorals', 'torso.shell', 1, () => [...top, P(0.93, Y.axilla - 0.04 * h), P(0.9, Y.axilla + 0.01 * h), ...lowR], { tone: 0.1 }));
  out.push(...pair('pec.clavicular', 'muscle', 'pectorals', 'pec', 2, () => [...top, P(0.78, Y.acr + 0.11 * h), P(0.45, lerp(yn, yp, 0.5)), P(0.06, lerp(yn, yp, 0.4))], { tone: 0.2 }));
  out.push(...pair('pec.sternal', 'muscle', 'pectorals', 'pec', 2, () => [P(0.06, lerp(yn, yp, 0.4)), P(0.45, lerp(yn, yp, 0.5)), P(0.78, Y.acr + 0.11 * h), P(0.93, Y.axilla - 0.04 * h), P(0.9, Y.axilla + 0.01 * h), ...lowR], { tone: -0.1 }));
  out.push(...pair('pec.minor', 'muscle', 'pectorals', 'pec', 2, () => [P(0.55, Y.acr + 0.1 * h), P(0.85, Y.acr + 0.12 * h), P(0.75, Y.axilla + 0.08 * h), P(0.55, yp - 0.02 * h)], { view: 'occluded' }));
  return out;
}

export function abdominals(f: BodyFrame): Atom[] {
  const { y: Y, h } = f, yp = Y.nipple;
  const P = (u: number, y: number): V => at(f, u, y);
  const y0 = yp + 0.1 * h, y1 = Y.crop - 0.045 * h;
  const out: Atom[] = [];
  out.push(...pair('torso.rectus', 'muscle', 'abdominals', 'torso.shell', 1, () => [P(0.03, y0), P(0.4, y0 + 0.01 * h), P(0.43, lerp(y0, y1, 0.55)), P(0.3, y1), P(0.03, y1)], { tone: 0.05 }));
  const b = [0, 0.2, 0.43, 0.68, 0.97].map((k) => lerp(y0 + 0.01 * h, y1 - 0.005 * h, k));
  const gap = 0.004 * h;
  for (let k = 0; k < 4; k++) {
    out.push(...pair(`abs.r${k + 1}`, 'muscle', 'abdominals', 'torso.rectus', 2, () => [P(0.045, b[k]! + gap), P(0.2, b[k]! + gap - 0.003 * h), P(0.39 + 0.015 * k, b[k]! + gap + 0.002 * h), P(0.41 + 0.015 * k, lerp(b[k]!, b[k + 1]!, 0.5)), P(0.39 + 0.015 * k, b[k + 1]! - gap), P(0.2, b[k + 1]! - gap), P(0.045, b[k + 1]! - gap)], { tone: 0.15 - 0.04 * k }));
    if (k < 3) out.push(mk(`abs.intersection.${k + 1}`, 'line', 'abdominals', 'torso.shell', 3, [P(-0.4, b[k + 1]!), P(-0.2, b[k + 1]! + 0.003 * h), P(0.2, b[k + 1]! + 0.003 * h), P(0.4, b[k + 1]!)], { open: true }));
  }
  out.push(mk('abs.linea-alba', 'line', 'abdominals', 'torso.shell', 3, [P(0, yp + 0.04 * h), P(0, y0), P(0, Y.navel - 0.03 * h)], { open: true }));
  out.push(mk('abs.umbilicus', 'landmark', 'abdominals', 'torso.shell', 3, [v(-0.016 * h, Y.navel), v(0, Y.navel - 0.012 * h), v(0.016 * h, Y.navel), v(0, Y.navel + 0.016 * h)]));
  return out;
}

export function flank(f: BodyFrame): Atom[] {
  const { y: Y, h } = f, yp = Y.nipple;
  const P = (u: number, y: number): V => at(f, u, y);
  const y1 = lerp(yp, Y.waist, 0.65);
  const out: Atom[] = [];
  out.push(...pair('torso.serratus', 'muscle', 'flank', 'torso.shell', 1, () => [P(0.74, yp + 0.04 * h), P(0.97, yp + 0.02 * h), P(0.98, yp + 0.2 * h), P(0.82, yp + 0.2 * h)], { tone: -0.05 }));
  for (let k = 0; k < 4; k++) {
    const y = yp + 0.05 * h + k * 0.042 * h;
    out.push(...pair(`serratus.slip${k + 1}`, 'muscle', 'flank', 'torso.serratus', 2, () => [P(0.8 + 0.01 * k, y), P(0.96, y - 0.012 * h), P(0.98, y + 0.016 * h), P(0.84 + 0.01 * k, y + 0.032 * h)], { tone: 0.06 }));
  }
  out.push(...pair('torso.lat', 'muscle', 'flank', 'torso.shell', 1, () => [P(0.82, Y.axilla + 0.02 * h), P(0.93, Y.axilla + 0.02 * h), P(0.93, Y.waist - 0.05 * h), P(0.85, Y.waist - 0.05 * h)], { tone: -0.15 }));
  out.push(...pair('torso.oblique.external', 'muscle', 'flank', 'torso.shell', 1, () => [P(0.62, y1), P(0.98, y1 - 0.01 * h), P(1.0, Y.waist), P(1.0, Y.navel + 0.05 * h), P(0.9, Y.crop - 0.02 * h), P(0.55, Y.crop - 0.06 * h), P(0.5, lerp(Y.waist, Y.navel, 0.5))], { tone: -0.05 }));
  out.push(...pair('torso.oblique.internal', 'muscle', 'flank', 'torso.oblique.external', 2, () => [P(0.6, y1 + 0.02 * h), P(0.9, y1 + 0.02 * h), P(0.92, Y.navel), P(0.6, Y.crop - 0.08 * h)], { view: 'occluded' }));
  return out;
}

/** Os du tronc : cage thoracique, sternum (manubrium, corps, processus xiphoïde), arcs costaux, crêtes iliaques, épines iliaques, plis inguinaux. */
export function skeleton(f: BodyFrame): Atom[] {
  const { y: Y, h } = f, yn = Y.base + 0.025 * h, yp = Y.nipple;
  const P = (u: number, y: number): V => at(f, u, y);
  const out: Atom[] = [];
  const rib = (): V[] => [P(0.15, yn), P(0.7, lerp(yn, Y.axilla, 0.7)), P(0.88, Y.axilla + 0.05 * h), P(0.86, yp + 0.02 * h), P(0.78, lerp(yp, Y.waist, 0.5)), P(0.45, lerp(yp, Y.waist, 0.7)), P(0.08, lerp(yp, Y.waist, 0.55))];
  out.push(...pair('bone.ribcage', 'bone', 'skeleton', 'torso.shell', 2, rib, { view: 'occluded' }));
  out.push(mk('bone.sternum.manubrium', 'bone', 'skeleton', 'torso.shell', 2, [v(-0.05 * h, yn), v(0.05 * h, yn), v(0.04 * h, yn + 0.07 * h), v(-0.04 * h, yn + 0.07 * h)], { view: 'occluded' }));
  out.push(mk('bone.sternum.body', 'bone', 'skeleton', 'torso.shell', 2, [v(-0.04 * h, yn + 0.07 * h), v(0.04 * h, yn + 0.07 * h), v(0.035 * h, yp + 0.05 * h), v(-0.035 * h, yp + 0.05 * h)], { view: 'occluded' }));
  out.push(mk('bone.sternum.xiphoid', 'bone', 'skeleton', 'torso.shell', 3, [v(-0.015 * h, yp + 0.05 * h), v(0.015 * h, yp + 0.05 * h), v(0, yp + 0.085 * h)], { view: 'occluded' }));
  out.push(...pair('bone.costal-arch', 'line', 'skeleton', 'torso.shell', 3, () => [P(0.04, yp + 0.085 * h), P(0.4, yp + 0.1 * h), P(0.78, lerp(yp, Y.waist, 0.5))], { open: true, sidedParent: false }));
  out.push(...pair('bone.iliac-crest', 'line', 'skeleton', 'torso.shell', 3, () => [P(0.5, Y.crop - 0.07 * h), P(0.8, Y.crop - 0.1 * h), P(0.98, Y.waist + 0.12 * h)], { open: true, sidedParent: false }));
  out.push(...pair('bone.asis', 'landmark', 'skeleton', 'torso.shell', 3, () => [P(0.58, Y.crop - 0.065 * h), P(0.66, Y.crop - 0.075 * h), P(0.66, Y.crop - 0.045 * h), P(0.58, Y.crop - 0.04 * h)], { sidedParent: false }));
  out.push(...pair('torso.inguinal', 'line', 'abdominals', 'torso.shell', 3, () => [P(0.6, Y.crop - 0.05 * h), P(0.32, Y.crop - 0.01 * h), P(0.08, Y.crop + 0.015 * h)], { open: true, sidedParent: false }));
  return out;
}

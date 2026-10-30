import { mk, pair } from './atom';
import type { BodyFrame } from './frame';
import { lerp, v } from './shape';
import type { Atom, V } from './types';

/** Demi-largeur du TRONC (sans les bras) à l'ordonnée y : stations puis interpolation douce. Source unique lue par l'enveloppe ET par tous les muscles du tronc. */
export function halfAt(f: BodyFrame, y: number): number {
  const { y: Y, x: X, a } = f;
  const trap = 0.5 + 0.0 * f.mus;
  const st: ReadonlyArray<readonly [number, number]> = [
    [Y.base - 0.05 * f.h, a.baseHalf * 0.92],
    [lerp(Y.base, Y.acr, 0.55), lerp(a.baseHalf, X.acr, trap) * (1 + 0.04 * f.mus)],
    [Y.acr, X.acr],
    [lerp(Y.acr, Y.axilla, 0.55), lerp(X.acr, X.chest, 0.62)],
    [Y.axilla, X.chest],
    [Y.nipple, X.chest * 0.985],
    [Y.waist, X.waist],
    [Y.navel, lerp(X.waist, X.hip, 0.35) * (1 + 0.04 * f.fat)],
    [Y.crop, X.hip],
  ];
  if (y <= (st[0] as readonly [number, number])[0]) return (st[0] as readonly [number, number])[1];
  for (let i = 0; i < st.length - 1; i++) {
    const A = st[i] as readonly [number, number], B = st[i + 1] as readonly [number, number];
    if (y <= B[0]) { const t = (y - A[0]) / (B[0] - A[0]), s = t * t * (3 - 2 * t); return lerp(A[1], B[1], s); }
  }
  return (st[st.length - 1] as readonly [number, number])[1];
}
/** Point du tronc : u ∈ [-1,1] = fraction de la demi-largeur à la hauteur y. Les muscles sont dessinés dans CE repère (ils suivent donc l'adiposité, l'âge, le sexe). */
export const at = (f: BodyFrame, u: number, y: number): V => v(u * halfAt(f, y), y);

/** Enveloppe, repères osseux, ceinture scapulaire (clavicule, trapèze, acromion), muscles du cou en vue de face. Racine = le cou (parent : atome `neck`). */
export function torsoShell(f: BodyFrame): Atom[] {
  const { y: Y, x: X, a, h } = f;
  const ys = [Y.base - 0.05 * h, lerp(Y.base, Y.acr, 0.55), Y.acr, lerp(Y.acr, Y.axilla, 0.55), Y.axilla, Y.nipple, Y.waist, Y.navel, Y.crop, Y.crop + 0.15 * h];
  const R = ys.map((y) => v(halfAt(f, y), y));
  const yb = Y.crop + 0.15 * h, xb = halfAt(f, yb);
  const poly = [...R, v(xb * 0.5, yb), v(0, yb), v(-xb * 0.5, yb), ...[...R].reverse().map((q) => v(-q.x, q.y))];
  const out: Atom[] = [mk('torso.shell', 'skin', 'torso-shell', 'neck', 0, poly, { z: 1 })];
  const notch = v(0, Y.base + 0.025 * h);
  out.push(mk('shoulder.notch', 'landmark', 'shoulder-girdle', 'torso.shell', 3, [v(-0.012 * h, notch.y - 0.006 * h), v(0.012 * h, notch.y - 0.006 * h), v(0, notch.y + 0.016 * h)]));
  const acr = (s: 1 | -1): V => v(s * X.acr, Y.acr);
  // Clavicule : S très doux de l'incisure jugulaire à l'acromion (visible surtout chez les sujets maigres : `vis` module son trait au rendu).
  out.push(...pair('shoulder.clavicle', 'bone', 'shoulder-girdle', 'torso.shell', 3, () => [v(0.02 * h, notch.y + 0.012 * h), v(X.acr * 0.35, notch.y - 0.004 * h), v(X.acr * 0.7, lerp(notch.y, Y.acr, 0.6)), acr(1)], { open: true }));
  out.push(...pair('shoulder.acromion', 'landmark', 'shoulder-girdle', 'torso.shell', 3, () => [v(X.acr - 0.03 * h, Y.acr - 0.012 * h), v(X.acr + 0.012 * h, Y.acr - 0.006 * h), v(X.acr + 0.012 * h, Y.acr + 0.022 * h), v(X.acr - 0.03 * h, Y.acr + 0.016 * h)]));
  // Trapèze supérieur : bande de la nuque à l'acromion ; plus haut et plus épais avec la musculature et le curseur `frame.trapezius`.
  const ty = [0, 0.35, 0.7, 1].map((t) => lerp(Y.base - 0.05 * h, Y.acr, t));
  const outer = ty.map((y) => v(halfAt(f, y) * 0.96, y));
  const inner = ty.map((y, i) => v(lerp(a.baseHalf * 1.05, X.acr - 0.06 * h, i / 3), y + 0.07 * h)).reverse();
  out.push(...pair('shoulder.trapezius', 'muscle', 'shoulder-girdle', 'torso.shell', 1, () => [...outer, ...inner], { tone: -0.2 }));
  // Muscles du cou de face : sterno-cléido-mastoïdiens (deux chefs : sternal, claviculaire) ; naissent derrière l'oreille, convergent sur l'incisure.
  const nh = a.baseHalf * 0.82, top = a.chinY + 0.22 * (a.baseY - a.chinY);
  out.push(...pair('neck.scm', 'muscle', 'shoulder-girdle', 'neck', 2, () => [v(nh * 1.0, top), v(nh * 0.8, lerp(top, notch.y, 0.5)), v(0.1 * h, notch.y - 0.01 * h), v(0.03 * h, notch.y + 0.01 * h), v(0.065 * h, notch.y - 0.03 * h), v(nh * 0.55, lerp(top, notch.y, 0.55)), v(nh * 0.6, top + 0.02 * h)], { tone: -0.15, sidedParent: false }));
  return out;
}

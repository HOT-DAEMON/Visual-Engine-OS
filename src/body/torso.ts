import { mk, pair } from './atom';
import type { BodyFrame } from './frame';
import { lerp, v } from './shape';
import type { Atom, V } from './types';

/** Demi-largeur du TRONC (sans les bras) à l'ordonnée y : stations puis interpolation douce. Source unique lue par l'enveloppe ET par tous les muscles du tronc. */
export function halfAt(f: BodyFrame, y: number): number {
  const { y: Y, x: X, a } = f;
  const trap = 0.5 + 0.0 * f.mus;
  const st: ReadonlyArray<readonly [number, number]> = [
    // Haut du tronc : étroit (0,6 × base du cou) et caché DANS le cou ; il atteint la largeur de la base du cou à la base. Un haut à 0,92 × base dépassait du cou
    // (surtout cou comprimé ou en cône) et se lisait comme un bord plat derrière lui (docs/NECK-REMAINING.md §F).
    [Y.base - 0.05 * f.h, a.baseHalf * 0.6],
    [Y.base, a.baseHalf],
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

/** Enveloppe, repères osseux, ceinture scapulaire (clavicule, trapèze, acromion), Racine = le cou (parent : atome `neck`). */
export function torsoShell(f: BodyFrame): Atom[] {
  const { y: Y, x: X, a, h } = f;
  // La station `Y.base` suit `halfAt` (haut étroit → largeur de la base du cou) : sans elle, le polygone coupe en ligne droite sous le trapèze, qui reste à l'extérieur (contour fantôme).
  // Pente d'épaule (base du cou → acromion) échantillonnée finement : une corde droite entre deux stations coupait sous la courbe `halfAt` que suit le trapèze (contour fantôme).
  const slope = [0.18, 0.36, 0.55, 0.78].map((t) => lerp(Y.base, Y.acr, t));
  // La corde de l'épaule démarre `SHRUG × h` AU-DESSUS de la base du cou (le trapèze monte vers la nuque) : plus bas, la ligne d'épaule passait sous le haut du deltoïde et sous la clavicule.
  const SHRUG = 0.03;
  // Demi-largeur de la pente d'épaule : jamais sous la corde (base du cou → acromion). Plus concave, elle passait sous la clavicule, qui sortait alors du contour.
  const slopeHalf = (y: number): number => Math.max(halfAt(f, y), lerp(a.baseHalf, X.acr, Math.min(1, Math.max(0, (y - (Y.base - SHRUG * h)) / (Y.acr - Y.base + SHRUG * h)))));
  const ys = [Y.base - 0.05 * h, Y.base, ...slope, Y.acr, lerp(Y.acr, Y.axilla, 0.55), Y.axilla, Y.nipple, Y.waist, Y.navel, Y.crop, Y.crop + 0.15 * h];
  const R = ys.map((y) => v(y >= Y.base && y <= Y.acr ? slopeHalf(y) : halfAt(f, y), y));
  const yb = Y.crop + 0.15 * h, xb = halfAt(f, yb);
  const poly = [...R, v(xb * 0.5, yb), v(0, yb), v(-xb * 0.5, yb), ...[...R].reverse().map((q) => v(-q.x, q.y))];
  const out: Atom[] = [mk('torso.shell', 'skin', 'torso-shell', 'neck', 0, poly, { z: 1 })];
  const notch = v(0, Y.base + 0.025 * h);
  out.push(mk('shoulder.notch', 'landmark', 'shoulder-girdle', 'torso.shell', 3, [v(-0.012 * h, notch.y - 0.006 * h), v(0.012 * h, notch.y - 0.006 * h), v(0, notch.y + 0.016 * h)]));
  // Clavicule : S très doux de l'incisure jugulaire à l'acromion (visible surtout chez les sujets maigres : `vis` module son trait au rendu).
  // Ordonnée du contour de l'épaule à l'abscisse x (corde base du cou → acromion) : la clavicule reste SOUS ce contour (elle sortait du corps, tracé fantôme sur le fond).
  const edgeY = (x: number): number => (Y.base - SHRUG * h) + (Y.acr - Y.base + SHRUG * h) * ((x - a.baseHalf) / (X.acr - a.baseHalf));
  out.push(...pair('shoulder.clavicle', 'bone', 'shoulder-girdle', 'torso.shell', 3, () => [v(0.02 * h, notch.y + 0.012 * h), v(X.acr * 0.35, notch.y + 0.012 * h), ...[0.55, 0.7, 0.85, 0.94].map((t) => v(X.acr * t, Math.max(lerp(notch.y, Y.acr, 0.6 * t / 0.7), edgeY(X.acr * t) + 0.02 * h)))], { open: true }));
  out.push(...pair('shoulder.acromion', 'landmark', 'shoulder-girdle', 'torso.shell', 3, () => [v(X.acr - 0.03 * h, Y.acr - 0.012 * h), v(X.acr + 0.012 * h, Y.acr - 0.006 * h), v(X.acr + 0.012 * h, Y.acr + 0.022 * h), v(X.acr - 0.03 * h, Y.acr + 0.016 * h)]));
  // Trapèze supérieur : bande de la nuque à l'acromion ; plus haut et plus épais avec la musculature et le curseur `frame.trapezius`.
  // Mêmes stations que la pente d'épaule du polygone (haut, base, pente, acromion) : le bord externe du trapèze épouse le contour du torse au lieu de le dépasser (contour fantôme).
  const ty = [Y.base - 0.05 * h, Y.base, ...slope, Y.acr];
  const outer = ty.map((y) => v((y >= Y.base && y <= Y.acr ? slopeHalf(y) : halfAt(f, y)) * 0.97, y));
  const inner = ty.map((y, i) => v(lerp(a.baseHalf * 1.05, X.acr - 0.06 * h, i / (ty.length - 1)), y + 0.07 * h)).reverse();
  out.push(...pair('shoulder.trapezius', 'muscle', 'shoulder-girdle', 'torso.shell', 1, () => [...outer, ...inner], { tone: -0.2 }));
  // Les muscles du cou (sterno-cléido-mastoïdiens, platysma) appartiennent au MOTEUR DE COU (`render/neck/muscles.ts`) : ils suivent torsion, inclinaison et
  // asymétrie du cou. Le torse n'en dessine plus (un second tracé, rigide, doublait le premier à l'incisure jugulaire).
  return out;
}

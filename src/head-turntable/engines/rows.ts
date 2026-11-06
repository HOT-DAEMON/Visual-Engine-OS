import { halfWidthAt } from '../../face/outline';
import { clamp, smooth } from '../math';
import type { Row } from '../types';
import type { EngineHead } from './face-model';
import { backChain, frontChain, skinPoints, smax, zAt, type PV } from './profile';
import { Y0, fy, py } from './units';

/** Hauteurs de la table de sections (celles de la planche : comparables ligne à ligne). */
export const ROW_YS: readonly number[] = [0, 0.025, 0.05, 0.075, 0.1, 0.125, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.025, 1.04, 1.05];
const Y_STRETCH = 0.4;     // sous cette hauteur (U) la coupe de cheveux étire le haut du crâne ; au-dessus, identité

/** Ordonnée du moteur (U) correspondant à la hauteur y de la tête : la coupe de cheveux ajoute Y0 au-dessus du vertex. */
export const toEngineY = (y: number): number => (y >= Y_STRETCH ? y : Y0 + (y / Y_STRETCH) * (Y_STRETCH - Y0));

/** Plan du visage SANS nez ni lèvres (sur lequel reposent leurs bosses) : forme continue front → racine → sous-nez → menton. */
export function facePlane(e: EngineHead): (y: number) => number {
  const P = skinPoints(e), front = frontChain(e);
  const g = P.get('glabella')!, sub = P.get('subnasale')!, sul = P.get('sublabiale')!;
  return (y) => {
    if (y <= g.y) return zAt(front, y) ?? g.z;
    if (y <= sub.y) return g.z + (sub.z - g.z) * smooth((y - g.y) / (sub.y - g.y));
    if (y <= sul.y) return sub.z + (sul.z - sub.z) * ((y - sub.y) / (sul.y - sub.y));
    return zAt(front, y) ?? sul.z;
  };
}

/**
 * Plan MANDIBULAIRE (dessous de la mâchoire) : droite passant par le bas du menton, inclinée de α = angle gonial − 90° − inclinaison du ramus par rapport à
 * l'horizontale. z décroît quand on remonte (la section de la mandibule s'allonge vers l'arrière). Le moteur n'a pas ce profil : il est DÉRIVÉ ici de son angle gonial.
 */
export function mandibularPlane(e: EngineHead): (y: number) => number {
  const P = skinPoints(e), men = P.get('menton')!;
  const alpha = clamp(e.lm.jaw.gonialDeg - 90 - e.fit.ramusDeg, 12, 50) * (Math.PI / 180);
  const yb = fy(e.lm.outline.bottomY);
  const arc = (e.fit as { mandArc?: number }).mandArc ?? 0;
  return (y) => men.z - (yb - y) / Math.tan(alpha) - arc * (yb - y) ** 2;
}

/** Table de sections (y, a, zf, zb) DÉRIVÉE des moteurs : a = contour de face (`headOutline`), zf/zb = profil de `skullGeometry` + plan mandibulaire. */
export function engineRows(e: EngineHead, ys: readonly number[] = ROW_YS, hairTh = (e.fit as { hairTh?: number }).hairTh ?? 0.02): Row[] {
  const back: PV[] = backChain(e), plane = facePlane(e), mand = mandibularPlane(e);
  const P = skinPoints(e), yNuchal = P.get('nuchalGroove')!.y, yChin = P.get('menton')!.y;
  return ys.map((y): Row => {
    const ye = toEngineY(y);
    const a0 = y < 0.012 ? 0 : halfWidthAt(e.lm.outline, Math.min(py(ye), e.lm.outline.bottomY - 1)) / 1000;
    const a = Math.max(0, a0 + (y < 0.012 ? 0 : hairTh * (1 - smooth((y - 0.3) / 0.25))));
    const zf = y >= yChin ? mandibularFront(e, y) : plane(ye);
    const zbBack = zAt(back, Math.min(ye, yNuchal)) ?? -0.3;
    const zb = y <= yNuchal ? zBackTop(back, ye, zbBack) : smax(zbBack, mand(y), 0.025);
    return { y, a, zf: Math.max(zf, zb + 0.02), zb: Math.min(zb, zf - 0.02) };
  });
}
const zBackTop = (_b: readonly PV[], _y: number, z: number): number => z;
function mandibularFront(e: EngineHead, y: number): number { const f = frontChain(e); return zAt(f, y) ?? skinPoints(e).get('menton')!.z; }

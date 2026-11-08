import { halfWidthAt } from '../../face/outline';
import { clamp, smooth } from '../math';
import type { Row } from '../types';
import type { EngineHead } from './face-model';
import { backChain, frontChain, skinPoints, smax, zAt, type PV } from './profile';
import { Y0, fy, py } from './units';
import { JAW_SHAPE, borderZ, jawCtx, jawFields, type JawShapeParams } from './jaw-model';
import { cranialBackShift, hasSkullModel, skullFields } from './skull-model';

/** Hauteurs de la table de sections (celles de la planche : comparables ligne à ligne). */
export const ROW_YS: readonly number[] = [0, 0.025, 0.05, 0.075, 0.1, 0.125, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.025, 1.04, 1.05];
/** Table DENSE (têtes issues du moteur de visage) : pas de 0,05 U au crâne, 0,0125 U sur la joue et la mâchoire, plus fin au menton. Un coin de mâchoire arrondi échantillonné tous les 0,05 U donne des dents de scie. */
export const DENSE_YS: readonly number[] = [...Array.from({ length: 12 }, (_, i) => i * 0.05), ...Array.from({ length: 33 }, (_, i) => +(0.6 + i * 0.0125).toFixed(4)), 1.0125, 1.025, 1.0325, 1.04, 1.045, 1.05];
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
  // Têtes issues d'un visage quelconque (`mandLandmarks`) : bordure dérivée des repères 2D (gonion, menton), cohérente avec le contour de face ; la planche garde le plan ajusté.
  if ((e.fit as { mandLandmarks?: boolean }).mandLandmarks) { const c = jawCtx(e); return (y) => borderZ(c, y); }
  const P = skinPoints(e), men = P.get('menton')!;
  const alpha = clamp(e.lm.jaw.gonialDeg - 90 - e.fit.ramusDeg, 12, 50) * (Math.PI / 180);
  const yb = fy(e.lm.outline.bottomY);
  const arc = (e.fit as { mandArc?: number }).mandArc ?? 0;
  return (y) => men.z - (yb - y) / Math.tan(alpha) - arc * (yb - y) ** 2;
}

/** Début (U) de la calotte du menton : au-dessus, le profil vient du moteur de crâne ; au-dessous, la profondeur se referme en arc (voir `closeChin`). */
export const CHIN_CAP_Y = 1.0;
/** Longueur (U) de la transition nuque → dessous de la mâchoire des têtes issues d'un visage. */
export const NAPE_BLEND = 0.14;

/**
 * Calotte du menton : sous `CHIN_CAP_Y` la profondeur d = zf − zb se referme en d₁·√(1 − t) (t = progression jusqu'au bas), centre constant. La pente d'entrée
 * (−d₁ / 2L) est proche de la pente du profil au-dessus (pas de cassure) et le bout est vertical : le menton est ARRONDI, sans la « dent » qu'un bas resté
 * plat (profondeur 0,04 U à y = 1,05) laissait sous la lèvre. La largeur `a` n'est pas touchée : elle reste celle du contour de face.
 */
export function closeChin(rows: readonly Row[]): Row[] {
  const cap = rows.find((r) => r.y >= CHIN_CAP_Y), last = rows[rows.length - 1]!;
  if (!cap || last.y <= cap.y) return [...rows];
  const d1 = cap.zf - cap.zb, zc = (cap.zf + cap.zb) / 2, L = last.y - cap.y;
  return rows.map((r) => {
    if (r.y <= cap.y) return r;
    const d = Math.max(0.004, d1 * Math.sqrt(Math.max(0, 1 - (r.y - cap.y) / L)));
    return { ...r, zf: zc + d / 2, zb: zc - d / 2 };
  });
}

/** Table de sections (y, a, zf, zb [+ forme de la mâchoire]) DÉRIVÉE des moteurs : a = contour de face (`headOutline`), zf/zb = profil de `skullGeometry` + plan mandibulaire. */
export function engineRows(e: EngineHead, ys: readonly number[] = ROW_YS, hairTh = (e.fit as { hairTh?: number }).hairTh ?? 0.02, shape: JawShapeParams = JAW_SHAPE): Row[] {
  const back: PV[] = backChain(e), plane = facePlane(e), mand = mandibularPlane(e);
  const P = skinPoints(e), yNuchal = P.get('nuchalGroove')!.y, yChin = P.get('menton')!.y;
  const base = ys.map((y): Row => {
    const ye = toEngineY(y);
    const a0 = y < 0.012 ? 0 : halfWidthAt(e.lm.outline, Math.min(py(ye), e.lm.outline.bottomY - 1)) / 1000;
    const a = Math.max(0, a0 + (y < 0.012 ? 0 : hairTh * (1 - smooth((y - 0.3) / 0.25))));
    const zf = y >= yChin ? mandibularFront(e, y) : plane(ye);
    const zbBack = zAt(back, Math.min(ye, yNuchal)) ?? -0.3;
    const lm = (e.fit as { mandLandmarks?: boolean }).mandLandmarks === true;
    // Têtes issues d'un visage : l'arrière quitte la nuque et rejoint le dessous de la mâchoire PROGRESSIVEMENT (NAPE_BLEND U), sans marche ; la planche garde son ajustement.
    const jawBack = smax(zbBack, mand(y), lm ? 0.06 : 0.025);
    const zb = y <= yNuchal ? zBackTop(back, ye, zbBack) : lm ? zbBack + (jawBack - zbBack) * smooth((y - yNuchal) / NAPE_BLEND) : jawBack;
    const zbC = zb + cranialBackShift(e, y);   // forme crânienne : l'arrière suit la longueur amplifiée (0 pour la planche)
    return { y, a, zf: Math.max(zf, zbC + 0.02), zb: Math.min(zbC, zf - 0.02) };
  });
  const ctx = jawCtx(e);
  const sk = hasSkullModel(e);
  const rows = closeChin(base).map((r) => { const j = jawFields(e, r.y, r.zf, r.zb, shape, ctx) ?? (sk ? skullFields(e, r.y, r.a, r.zf, r.zb) : null); return j ? { ...r, ...j } : r; });
  // Le point le plus large ne recule jamais quand on descend (sinon le contour oscille en vue inclinée) : maximum courant sur la zone de mâchoire.
  let zw = -Infinity;
  return rows.map((r) => { if (r.zw === undefined || r.y < shape.y0) return r; zw = Math.max(zw, r.zw); return { ...r, zw: Math.min(zw, r.zf - 0.04) }; });
}
const zBackTop = (_b: readonly PV[], _y: number, z: number): number => z;
function mandibularFront(e: EngineHead, y: number): number { const f = frontChain(e); return zAt(f, y) ?? skinPoints(e).get('menton')!.z; }

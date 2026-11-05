import { openingGeometry, openingPolygon, type Vec } from '../geometry/eye';
import type { FaceLandmarks, OrbitLandmarks } from '../face';
import { toHostFrame, type PlacedEye } from './relations';

/**
 * ORBITE PUBLIÉE PAR L'ŒIL (docs/ORBIT-PUBLISH.md).
 *
 * Problème mesuré (docs/ANATOMY-CONTRACT.md §4, 4 nov. 2026) : deux définitions de la même cavité. `face/landmarks.ts` donne une ellipse a priori
 * (`ry = 0,085 H`, `rx` lié au temple) ; `face/fit-eye.ts` borne l'œil par l'arcade et le nez, bien plus larges. 12 visages sur 80 avaient
 * l'ouverture de l'œil HORS de l'ellipse d'orbite (pire rapport 1,86) : l'ombre de l'orbite ne contenait pas l'œil qu'elle est censée entourer.
 *
 * Règle : l'orbite a priori (repères) est le DÉFAUT ; l'œil, une fois ajusté, PUBLIE son orbite. Si l'ouverture tient déjà dans l'a priori,
 * l'orbite ne change pas (les 68 visages concernés restent identiques au pixel). Sinon l'orbite est recentrée sur l'œil et agrandie juste
 * assez pour le contenir avec une marge. Le sous-moteur d'ombres de contact (`render/face/components.ts`) consomme l'orbite PUBLIÉE.
 */

/** Marge (rapport) entre l'ouverture de l'œil et le bord de l'orbite publiée : l'œil ne touche jamais le bord. */
export const ORBIT_MARGIN = 1.08;
/**
 * Seuil de conservation de l'a priori : l'ombre est un polygone à 24 côtés INSCRIT dans l'ellipse (affaissement cos(π/24) = 0,991) ; un œil à 0,99–1,00
 * du bord de l'ellipse sortirait donc du polygone réellement dessiné (cas trouvé : graine 69). Au-delà de 0,98 l'orbite est republiée.
 */
export const ORBIT_KEEP = 0.98;

export interface PublishedOrbit extends OrbitLandmarks {
  /** `true` : l'orbite a priori ne contenait pas l'œil, elle a été recentrée et agrandie. */
  readonly grown: boolean;
  /** Rapport d'aire publiée / aire a priori (1 si inchangée). */
  readonly growth: number;
}
export interface PublishedOrbits {
  readonly left: PublishedOrbit;
  readonly right: PublishedOrbit;
}

/** Plus grande « distance orbitaire » normalisée d'un point (≤ 1 : dans l'ellipse). */
export const orbitRatio = (o: OrbitLandmarks, pts: readonly Vec[]): number =>
  Math.sqrt(Math.max(...pts.map((p) => ((p.x - o.cx) / o.rx) ** 2 + ((p.y - o.cy) / o.ry) ** 2)));

/** Écart minimal (fraction de W) entre l'orbite publiée et la ligne médiane : les deux orbites ne se touchent jamais. */
export const ORBIT_MIDLINE_GAP = 0.012;
/** Marge horizontale (rapport) de l'orbite publiée sur la largeur de l'ouverture. */
const H_SLACK = 1.2;

/**
 * Orbite publiée pour un ensemble de points (ouverture de l'œil dans le repère de l'hôte). Pure, déterministe.
 * Travaille côté « droit » (x > 0, `u = s·x`) ; le côté gauche est le miroir.
 *  1. Dépassement : sinon, l'a priori est rendu tel quel.
 *  2. Horizontalement : centre = milieu de l'étendue de l'ouverture, demi-axe = étendue × 1,2, jamais sous l'a priori ; le bord interne ne passe
 *     jamais à moins de `ORBIT_MIDLINE_GAP·W` de la ligne médiane (le centre glisse vers l'extérieur).
 *  3. Verticalement : demi-axe EXACT (pas une boîte englobante) : le plus petit `ry` qui contient chaque point avec la marge `ORBIT_MARGIN`,
 *     jamais sous l'a priori. Contenance garantie par construction : (du/rx)² + (dy/ry)² ≤ (du/rx)² + (1 − (du/rx)²)/marge² < 1.
 */
export function publishOrbit(prior: OrbitLandmarks, pts: readonly Vec[], W: number): PublishedOrbit {
  if (pts.length === 0 || orbitRatio(prior, pts) <= ORBIT_KEEP) return { ...prior, grown: false, growth: 1 };
  const s = prior.cx < 0 ? -1 : 1;
  const us = pts.map((p) => s * p.x), ys = pts.map((p) => p.y);
  const uMin = Math.min(...us), uMax = Math.max(...us);
  const rx = Math.max(prior.rx, ((uMax - uMin) / 2) * H_SLACK);
  const minInner = ORBIT_MIDLINE_GAP * W;
  const cu = Math.max((uMin + uMax) / 2, minInner + rx);
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const ry = Math.max(prior.ry, ...pts.map((p, i) => (Math.abs(p.y - cy) * ORBIT_MARGIN) / Math.sqrt(Math.max(1e-3, 1 - ((us[i] as number - cu) / rx) ** 2))));
  return { cx: s * cu, cy, rx, ry, grown: true, growth: (rx * ry) / (prior.rx * prior.ry) };
}

/** Ouverture de l'œil (fente palpébrale) dans le repère local de l'hôte, 48 points. */
export function openingInHost(pe: PlacedEye): Vec[] {
  return openingPolygon(openingGeometry(pe.eye.shape, pe.eye.canthi), 48).map((p) => toHostFrame(p, pe));
}

/** Côté de l'hôte (image) d'un œil posé : `outerSide` est le côté du canthus EXTERNE, donc le côté de l'orbite. */
export const sideOf = (pe: PlacedEye): 'left' | 'right' => (pe.eye.shape.outerSide === 'left' ? 'left' : 'right');

/**
 * Orbites publiées d'un visage par ses yeux posés. Plusieurs yeux du même côté : l'orbite contient leur union. Un côté sans œil garde l'a priori.
 */
export function publishedOrbits(lm: FaceLandmarks, eyes: readonly PlacedEye[]): PublishedOrbits {
  const pts = { left: [] as Vec[], right: [] as Vec[] };
  for (const pe of eyes) pts[sideOf(pe)].push(...openingInHost(pe));
  return { left: publishOrbit(lm.orbit.left, pts.left, lm.W), right: publishOrbit(lm.orbit.right, pts.right, lm.W) };
}

import { clamp, clamp01 } from '../core/math';
import { parseHex } from '../core/color';
import type { LightVector } from './light';

/**
 * MOTEUR D'ÉCLAIRAGE (le « rig ») : tout ce qui, dans la lumière principale, n'est pas sa direction.
 * Les fonctions sont PURES et ne connaissent ni la peau, ni le visage : elles traduisent la lumière en grandeurs
 * génériques (douceur, couleur, atténuation) que n'importe quel matériau peut lire. C'est la partie « éclairage »
 * de Rendu = f(géométrie, matériaux, éclairage, caméra).
 */

/** Couleur d'un corps noir à `kelvin` (approximation de Tanner Helland, valable 1000–40000 K), canaux sRGB 0–255. */
export function kelvinRgb(kelvin: number): [number, number, number] {
  // Le modèle est défini par t = K / 100 ; deux branches : sous 66 (rouge saturé), au-dessus (rouge décroissant).
  const t = clamp(kelvin, 1000, 40000) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)];
}

/**
 * Multiplie une couleur par la teinte du corps noir à `kelvin`, normalisée pour que 6500 K soit NEUTRE (blanc inchangé).
 * Au-dessous de 6500 K la lumière tire vers l'orange, au-dessus vers le bleu.
 */
export function applyTemperature(hex: string, kelvin: number): string {
  const ref = kelvinRgb(6500);
  const k = kelvinRgb(kelvin);
  const base = parseHex(hex);
  // Chaque canal : couleur × (teinte K / teinte 6500 K), bornée à 255.
  const ch = (i: 0 | 1 | 2): string => Math.round(clamp((base[i] * k[i]) / ref[i], 0, 255)).toString(16).padStart(2, '0');
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

/** Grandeurs du rig avec leurs valeurs neutres (un `LightVector` construit à la main reste utilisable). */
export interface Rig {
  readonly size: number;
  readonly hardness: number;
  readonly distance: number | null;
}

export const rigOf = (L: LightVector): Rig => ({ size: L.size ?? 0.5, hardness: L.hardness ?? 0.5, distance: L.distance ?? null });

/**
 * Douceur des ombres et des reflets (0 = nets, 1 = très diffus). Une source plus grande ou plus PROCHE (taille apparente
 * croissante) adoucit ; une dureté plus forte durcit. Monotone dans les trois entrées (testé).
 */
export function softness(L: LightVector): number {
  const r = rigOf(L);
  // Taille apparente : la taille de la source, agrandie quand elle est proche (distance finie, en largeurs de tête).
  const apparent = clamp01(r.distance === null ? r.size : r.size * (1 + 1.5 / Math.max(r.distance, 0.5)));
  return clamp01(0.7 * apparent + 0.5 * (1 - r.hardness) - 0.1);
}

/** Intensité effective pour une CLASSE de matériau : intensité de la lumière × influence de la classe (1 si non précisée). */
export const intensityFor = (L: LightVector, cls: string): number => clamp01(L.intensity * (L.influence?.[cls] ?? 1));

/**
 * Atténuation d'intensité entre le côté proche et le côté lointain de la source, pour une source à distance finie.
 * Source à l'infini (`null`) : 1 des deux côtés. Écart = 0,35 / distance, borné pour ne jamais éteindre un côté.
 */
export function falloff(L: LightVector): { near: number; far: number } {
  const d = rigOf(L).distance;
  if (d === null) return { near: 1, far: 1 };
  const k = Math.min(0.45, 0.35 / Math.max(d, 0.5));
  return { near: 1 + k * 0.5, far: 1 - k };
}

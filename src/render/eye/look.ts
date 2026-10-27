import { effectsReach, grade, resolveAppearance, type ResolvedAppearance } from '../../appearance';
import { dominantColor } from '../../materials';
import type { ColorSource } from '../../schema';
import type { EyeSpec } from '../../schema';

/**
 * Branchement du MOTEUR D'APPARENCE PARTAGÉ (`src/appearance/`) sur l'œil. Même contrat que les cheveux et la peau : le composant fournit
 * une couleur de base (ici : peau périoculaire et iris), le moteur calcule ombre / lumière / contour / reflet, et applique les effets.
 *
 *  - `skin` (base = peau périoculaire) : teinte des ombres des paupières et du pli, lumière de contour du bord inférieur, teinte du reflet ;
 *  - `iris` (base = couleur dominante de l'iris) : filtre d'effets (réfraction, grain, glow, bloom, émission) appliqué au disque de l'iris ;
 *  - contraste / saturation / luminosité : appliqués aux matériaux de l'iris et de la sclère (`gradeEye`), pas seulement aux teintes dérivées.
 * Limites assumées (docs/EYES-REMAINING.md) : `opacity`, `shading.cel`, `gradient` (racine → pointe) n'ont pas de sens pour un œil et sont ignorés.
 */
export interface EyeLook {
  readonly skin: ResolvedAppearance;
  readonly iris: ResolvedAppearance;
  readonly spec: NonNullable<EyeSpec['appearance']>;
  /** Marge (px) à ajouter autour de l'iris pour que le filtre contienne glow/bloom. */
  readonly reach: number;
}

export function resolveEyeLook(eye: EyeSpec, skinHex: string): EyeLook | null {
  const spec = eye.appearance;
  if (!spec) return null;
  return { skin: resolveAppearance(skinHex, spec), iris: resolveAppearance(dominantColor(eye.iris.material.base), spec), spec, reach: effectsReach(spec) };
}

const gradeSource = (s: ColorSource, g: { contrast: number; saturation: number; brightness: number }): ColorSource =>
  s.type === 'solid' ? { ...s, color: grade(s.color, g) } : { ...s, stops: s.stops.map((st) => ({ ...st, color: grade(st.color, g) })) };

/** Étalonne (contraste / saturation / luminosité) les matériaux de l'iris et de la sclère ; identité si les trois valent 0. */
export function gradeEye(eye: EyeSpec): EyeSpec {
  const a = eye.appearance;
  if (!a || (a.contrast === 0 && a.saturation === 0 && a.brightness === 0)) return eye;
  const g = { contrast: a.contrast, saturation: a.saturation, brightness: a.brightness };
  return {
    ...eye,
    iris: { ...eye.iris, material: { ...eye.iris.material, base: gradeSource(eye.iris.material.base, g) } },
    sclera: { ...eye.sclera, base: gradeSource(eye.sclera.base, g) },
  };
}

import type { EyeSpec } from '../schema';
import { ARCHETYPE_PRESETS } from './presets';

/**
 * Applique le préréglage d'archétype (s'il y en a un) à un œil déjà validé par le schéma.
 * Fonction pure et déterministe : aucune donnée n'est générée, seuls des blocs de valeurs fixes
 * (voir `presets.ts`) remplacent certaines branches. `shape`/`iris`/`pupil`/`highlights`/`canthi`/
 * `lashes` sont fusionnés clé par clé (le reste du sous-objet garde la valeur de `eye`) ;
 * `sclera`/`eyebrow` sont remplacés en bloc quand l'archétype les précise. Sans archétype (`null`,
 * valeur par défaut), retourne `eye` INCHANGÉ (même référence).
 */
export function applyArchetype(eye: EyeSpec): EyeSpec {
  if (!eye.archetype) return eye;
  const p = ARCHETYPE_PRESETS[eye.archetype];

  return {
    ...eye,
    shape: p.shape ? { ...eye.shape, ...p.shape } : eye.shape,
    sclera: p.sclera ?? eye.sclera,
    iris: p.iris ? { ...eye.iris, ...p.iris } : eye.iris,
    pupil: p.pupil ? { ...eye.pupil, ...p.pupil } : eye.pupil,
    highlights: p.highlights ? { ...eye.highlights, ...p.highlights } : eye.highlights,
    lashes: p.lashes
      ? {
          upper: { ...eye.lashes.upper, ...p.lashes.upper },
          lower: { ...eye.lashes.lower, ...p.lashes.lower },
        }
      : eye.lashes,
    eyebrow: p.eyebrow !== undefined ? p.eyebrow : eye.eyebrow,
    canthi: p.canthi
      ? {
          inner: { ...eye.canthi.inner, ...p.canthi.inner },
          outer: { ...eye.canthi.outer, ...p.canthi.outer },
        }
      : eye.canthi,
  };
}

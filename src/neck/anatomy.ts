import { clamp01 } from '../core/math';
import type { NeckSystem } from '../schema/neck-system';
import type { HeadPose } from './controllers';
import { SPECIES } from './species';
import { detailGain, effectiveStyle } from './style';
import type { DeformFields, FaceNeckParams, HeadContext, Structure, StructureId } from './types';

/**
 * LES SEPT SYSTÈMES du TODO, distingués clairement (ossature+articulations · volumes musculaires · tissus et organes représentables ·
 * géométrie extérieure · déformations · matériaux · extensions d'espèce) et les douze structures NECK-01…06G qui en relèvent.
 * Une structure a TOUJOURS une visibilité calculée, jamais « présente/absente » codé en dur : elle dépend de la morphologie (masse, âge),
 * de la posture (extension, tension), de la déformation (champs lus) et de l'espèce. Une structure qu'une espèce n'a pas est DÉSACTIVÉE
 * avec sa raison (`disabledBy`), pas supprimée en silence. `reliefs.*` numérique force la visibilité (choix explicite de l'artiste).
 */
const SYSTEM: Readonly<Record<StructureId, Structure['system']>> = {
  axial: 'skeleton', joints: 'skeleton', scm: 'muscle', trapezius: 'muscle', 'platysma-infrahyoid': 'muscle',
  larynx: 'tissue', trachea: 'tissue', hyoid: 'tissue', vessels: 'tissue', clavicle: 'skeleton', 'fat-folds': 'tissue', skin: 'material',
};
/**
 * Tension du platysma 0–1 : ouverture de la mandibule, inclinaison de la tête (valeur absolue) et serrage, pondérés par `neck.platysma`.
 * SOURCE UNIQUE : la mesure de contrat `neck.platysmaTension` (moteur de structure) appelle cette fonction.
 */
export const platysmaTension = (platysma: number, headPitchDeg: number, open: number, clench: number): number => clamp01(platysma * (0.6 * open + 0.5 * (Math.abs(headPitchDeg) / 30) + 0.4 * clench));
const mean = (a: Float64Array): number => a.reduce((s, v) => s + v, 0) / a.length;

export function buildStructures(n: FaceNeckParams, sys: NeckSystem, pose: HeadPose, fields: DeformFields, ctx: HeadContext): Structure[] {
  const ms = sys.modifiers.mass, age = sys.modifiers.age, ten = clamp01(pose.tension);
  const ext = clamp01(-pose.pitchDeg / 20), flex = clamp01(pose.pitchDeg / 30);
  const g = detailGain(effectiveStyle(sys.style));
  const rule = SPECIES[sys.species];
  const raw: Record<StructureId, number> = {
    // Ossature et articulations : internes (leur effet passe par le rig et les sections) — visibilité 0 par construction, pas par désactivation.
    axial: 0, joints: 0,
    scm: clamp01(n.muscles * (1 - 0.55 * ms) + 0.45 * ten + 0.3 * mean(fields.muscle)) * g,
    trapezius: clamp01(sys.musculature.trapezius * (1 - 0.3 * ms)) * g,
    'platysma-infrahyoid': clamp01(platysmaTension(n.platysma, ctx.headPitchDeg, ctx.jawOpen, ctx.clench) + n.platysma * (0.5 * ten + 0.3 * flex)) * g,
    larynx: clamp01(0.25 + 0.5 * (1 - ms) + 0.3 * ten + 0.3 * ext + 0.1 * age) * g,
    hyoid: clamp01(0.1 + 0.6 * ext + 0.2 * (1 - ms)) * g,
    trachea: clamp01(0.5 * (1 - ms) * (0.4 + ext) + 0.2 * age) * g,
    vessels: clamp01(0.7 * ten + 0.4 * (1 - ms) + 0.3 * age - 0.2 + 0.4 * sys.surface.skinTension - 0.12) * g,
    clavicle: clamp01(0.85 * (1 - ms) + 0.1 * age + 0.2 * sys.surface.skinTension - 0.06) * g,
    'fat-folds': clamp01(sys.softTissue.foldDepth * (0.3 + 0.9 * ms) + 0.35 * age + 0.4 * mean(fields.compression)) * g,
    skin: 1,
  };
  const forced: Partial<Record<StructureId, NeckSystem['reliefs'][keyof NeckSystem['reliefs']]>> = { larynx: sys.reliefs.larynx, hyoid: sys.reliefs.hyoid, trachea: sys.reliefs.trachea, vessels: sys.reliefs.vessels, clavicle: sys.reliefs.clavicle };
  return (Object.keys(raw) as StructureId[]).map((id) => {
    if (!rule.structures.includes(id)) return { id, system: SYSTEM[id], visibility: 0, disabledBy: `species:${sys.species}` };
    const f = forced[id];
    return { id, system: SYSTEM[id], visibility: f !== undefined && f !== 'auto' ? f : raw[id] };
  });
}

export const visibilityOf = (list: readonly Structure[], id: StructureId): number => list.find((s) => s.id === id)?.visibility ?? 0;

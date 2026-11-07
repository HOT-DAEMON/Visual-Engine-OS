import type { NeckSystem } from '../schema/neck-system';
import type { StructureId } from './types';

/**
 * COUCHE D'ESPÈCE (TODO §3) : capacités et contraintes biologiques ou imaginaires, SÉPARÉES de la morphologie et du style.
 * Une espèce dit quels composants existent et jusqu'où les paramètres peuvent aller. Un paramètre hors limite est RAMENÉ et
 * consigné (`Correction` `species-<espèce>-<param>`), un composant incompatible est DÉSACTIVÉ avec sa raison (`Structure.disabledBy`) :
 * jamais de corruption silencieuse du graphe (test « cou humain → fantastique »).
 */
export interface SpeciesRule {
  readonly structures: readonly StructureId[];
  readonly maxCurvature: number;
  readonly maxSCurve: number;
  readonly maxSegments: number;
  readonly minSegments: number;
  readonly maxCross: number;
  readonly maxTorsionDeg: number;
  /** Limites articulaires (degrés) de la tête sur le cou : tangage, lacet, roulis (±). */
  readonly joint: { readonly pitch: number; readonly yaw: number; readonly roll: number };
}

const HUMAN: readonly StructureId[] = ['axial', 'joints', 'scm', 'trapezius', 'platysma-infrahyoid', 'larynx', 'trachea', 'hyoid', 'vessels', 'clavicle', 'fat-folds', 'skin'];
const ALL = HUMAN;

export const SPECIES: Readonly<Record<NeckSystem['species'], SpeciesRule>> = {
  human: { structures: HUMAN, maxCurvature: 0.45, maxSCurve: 0.3, maxSegments: 1, minSegments: 1, maxCross: 0.4, maxTorsionDeg: 60, joint: { pitch: 55, yaw: 80, roll: 40 } },
  reptile: { structures: ['axial', 'joints', 'trapezius', 'trachea', 'vessels', 'fat-folds', 'skin'], maxCurvature: 0.8, maxSCurve: 0.7, maxSegments: 6, minSegments: 1, maxCross: 0.7, maxTorsionDeg: 90, joint: { pitch: 70, yaw: 110, roll: 60 } },
  avian: { structures: ['axial', 'joints', 'trachea', 'vessels', 'skin'], maxCurvature: 1, maxSCurve: 1, maxSegments: 10, minSegments: 1, maxCross: 0.3, maxTorsionDeg: 90, joint: { pitch: 90, yaw: 150, roll: 70 } },
  dragon: { structures: ['axial', 'joints', 'trapezius', 'trachea', 'vessels', 'fat-folds', 'skin'], maxCurvature: 1, maxSCurve: 1, maxSegments: 12, minSegments: 1, maxCross: 0.8, maxTorsionDeg: 90, joint: { pitch: 80, yaw: 130, roll: 70 } },
  armored: { structures: ['axial', 'joints', 'trapezius', 'skin'], maxCurvature: 0.6, maxSCurve: 0.5, maxSegments: 14, minSegments: 3, maxCross: 1, maxTorsionDeg: 45, joint: { pitch: 45, yaw: 70, roll: 30 } },
  serpent: { structures: ['axial', 'joints', 'vessels', 'skin'], maxCurvature: 1, maxSCurve: 1, maxSegments: 14, minSegments: 4, maxCross: 0.5, maxTorsionDeg: 90, joint: { pitch: 90, yaw: 170, roll: 90 } },
  // Fantaisie : aucune limite biologique ; tous les composants disponibles (les choix restent explicites dans le schéma).
  fantasy: { structures: ALL, maxCurvature: 1, maxSCurve: 1, maxSegments: 14, minSegments: 1, maxCross: 1, maxTorsionDeg: 90, joint: { pitch: 90, yaw: 180, roll: 90 } },
};

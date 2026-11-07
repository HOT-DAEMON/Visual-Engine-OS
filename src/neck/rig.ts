import type { NeckSystem } from '../schema/neck-system';
import { SPECIES } from './species';
import type { NeckRig } from './types';

/**
 * NeckRig : articulations, axes, limites et stratégie. Trois articulations de référence (jonction tête-cou C0-C1, milieu, jonction cou-thorax C7-T1) ;
 * les limites sont celles de l'ESPÈCE (`species.ts`) et se répartissent entre les articulations (le haut porte le tangage et le lacet, la base le roulis).
 * Le rig ne contient aucune géométrie : il dit COMMENT un mouvement se répartit, pas à quoi ressemble le cou.
 */
export function buildRig(sys: NeckSystem): NeckRig {
  const j = SPECIES[sys.species].joint;
  return {
    joints: [
      { id: 'C0-C1', u: 0, limits: { pitch: [-0.45 * j.pitch, 0.45 * j.pitch], yaw: [-0.35 * j.yaw, 0.35 * j.yaw], roll: [-0.2 * j.roll, 0.2 * j.roll] } },
      { id: 'mid', u: 0.5, limits: { pitch: [-0.35 * j.pitch, 0.35 * j.pitch], yaw: [-0.45 * j.yaw, 0.45 * j.yaw], roll: [-0.5 * j.roll, 0.5 * j.roll] } },
      { id: 'C7-T1', u: 1, limits: { pitch: [-0.2 * j.pitch, 0.2 * j.pitch], yaw: [-0.2 * j.yaw, 0.2 * j.yaw], roll: [-0.3 * j.roll, 0.3 * j.roll] } },
    ],
    strategies: sys.strategies,
    twistShare: sys.pose.twistShare,
  };
}

/** Somme des limites articulaires = amplitude totale permise de la tête sur le thorax (degrés, ±). */
export function totalLimits(rig: NeckRig): { pitch: number; yaw: number; roll: number } {
  const sum = (k: 'pitch' | 'yaw' | 'roll'): number => rig.joints.reduce((a, j) => a + j.limits[k][1], 0);
  return { pitch: sum('pitch'), yaw: sum('yaw'), roll: sum('roll') };
}

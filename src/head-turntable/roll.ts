import { neckSection } from './engines/neck3d';
import { rad } from './math';
import type { HeadTurnSpec, RollRig, View } from './types';

/**
 * ROULIS (inclinaison latérale de la tête, oreille vers l'épaule). Anatomie : la flexion latérale se partage entre l'articulation occipito-atloïdienne (la tête pivote autour de son axe antéro-postérieur,
 * ici au HAUT du cou, `T`) et le rachis cervical (le cou se plie, de sa base immobile `B` vers le haut). Part du cou : `ROLL_BEND` (≈ 40 % : le rachis cervical porte la majorité de la flexion latérale
 * clinique, mais la base, entre les épaules, ne s'incline pas : le poids de flexion du cou croît de 0 à la base à 1 au sommet, `math.bendW`). Amplitude : ±40° (flexion latérale cervicale totale ≈ 45°).
 */
export const ROLL_BEND = 0.4, ROLL_MAX = 40;

export function rollRig(spec: HeadTurnSpec, rollDeg: number): RollRig {
  const n = spec.neck, e = spec.engine, zc = (y: number): number => (e ? neckSection(e, y, n.y1).zc : n.zc), r = rad(rollDeg);
  return { T: { x: 0, y: n.y0, z: zc(n.y0) }, B: { x: 0, y: n.y1, z: zc(n.y1) }, bend: r * ROLL_BEND, roll: r };
}

/** La vue avec son gréement de roulis (si le roulis est non nul). */
export const withRig = (view: View, spec: HeadTurnSpec): View => (view.roll && !view.rig ? { ...view, rig: rollRig(spec, Math.max(-ROLL_MAX, Math.min(ROLL_MAX, view.roll))) } : view);

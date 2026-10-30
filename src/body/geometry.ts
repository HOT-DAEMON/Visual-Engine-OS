import { memoPure } from '../perf';
import { armChain } from './arm';
import { mk } from './atom';
import { breastMass, breasts } from './breast';
import { bodyFrame, type BodyFrame } from './frame';
import { handAtoms } from './hand';
import { abdominals, flank, pectorals, skeleton } from './torso-muscles';
import { torsoShell } from './torso';
import { v } from './shape';
import { BodyParams, type Atom, type BodyInput, type NeckAnchor } from './types';
import type { Correction } from '../core/resolve';

export interface BodyGeo {
  readonly params: BodyParams;
  readonly frame: BodyFrame;
  readonly atoms: readonly Atom[];
  readonly byId: ReadonlyMap<string, Atom>;
  /** Mesures indépendantes de la pose, en hauteurs de tête (h) : ce que `verify/body.ts` recoupe avec le canon. */
  readonly measures: Readonly<Record<string, number>>;
  readonly corrections: readonly Correction[];
}

const build = (p: BodyParams, a: NeckAnchor): BodyGeo => {
  const f = bodyFrame(p, a);
  const L = armChain(f, p, 'L'), R = armChain(f, p, 'R');
  const neck = mk('neck', 'landmark', 'neck', null, 0, [v(-a.baseHalf, a.chinY), v(a.baseHalf, a.chinY), v(a.baseHalf, a.baseY), v(-a.baseHalf, a.baseY)], { view: 'occluded', z: 0 });
  const atoms = [neck, ...torsoShell(f), ...pectorals(f), ...breasts(f, p), ...abdominals(f), ...flank(f), ...skeleton(f), ...L.atoms, ...handAtoms(f, p, L.hand), ...R.atoms, ...handAtoms(f, p, R.hand)];
  const h = f.h, ar = f.arm, c = f.canon;
  const measures = {
    heads: c.heads, shoulderWidth: (2 * f.x.shoulder) / h, chestWidth: (2 * f.x.chest) / h, waistWidth: (2 * f.x.waist) / h, hipWidth: (2 * f.x.hip) / h,
    shoulderToNeck: f.x.shoulder / a.baseHalf, waistToShoulder: f.x.waist / f.x.shoulder, hipToShoulder: f.x.hip / f.x.shoulder, torsoLength: (f.y.navel - f.y.base) / h,
    upperArm: ar.upper / h, forearm: ar.fore / h, hand: ar.hand / h, armStraight: (ar.upper + ar.fore + ar.hand) / h, upperToFore: ar.upper / ar.fore, handToFore: ar.hand / ar.fore,
    armWidth: (2 * ar.armHalf) / h, foreWidth: (2 * ar.foreHalf) / h, wristWidth: (2 * ar.wristHalf) / h, palmWidth: (2 * ar.palmHalf) / h, breastMass: breastMass(f, p),
  };
  return { params: p, frame: f, atoms, byId: new Map(atoms.map((q) => [q.id, q])), measures, corrections: f.corrections };
};
const memo = memoPure('body-geometry', 'geometry', build, 128);
/** Géométrie complète du corps : pure et mémoïsée par le contenu (params normalisés + ancre). Les valeurs rendues sont IMMUABLES. */
export const bodyGeometry = (raw: BodyInput, a: NeckAnchor): BodyGeo => memo(BodyParams.parse(raw), a);

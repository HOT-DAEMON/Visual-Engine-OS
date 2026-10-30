import { memoPure } from '../../perf';
import { bodyGeometry, type BodyGeo } from '../geometry';
import { BodyParams, type Atom, type BodyInput, type NeckAnchor } from '../types';
import type { Correction } from '../../core/resolve';
import { footAtoms } from './foot';
import { legFrame, type LegFrame } from './frame';
import { legChain } from './leg';
import { pelvisAtoms } from './pelvis';
import { LegParams, type LegInput } from './types';

export interface LegGeo {
  readonly params: LegParams;
  readonly body: BodyGeo;
  readonly frame: LegFrame;
  readonly atoms: readonly Atom[];
  /** Index de TOUS les atomes de la figure (haut + bas) : un atome du bas a pour ancêtre le tronc. */
  readonly byId: ReadonlyMap<string, Atom>;
  /** Mesures indépendantes de la pose, en hauteurs de tête (h) : ce que `verify/lower.ts` recoupe avec le canon. */
  readonly measures: Readonly<Record<string, number>>;
  readonly corrections: readonly Correction[];
}
const build = (bp: BodyParams, lp: LegParams, a: NeckAnchor): LegGeo => {
  const body = bodyGeometry(bp, a), lf = legFrame(body.frame, lp), h = lf.body.h;
  const atoms: Atom[] = [...pelvisAtoms(lf)];
  for (const side of ['L', 'R'] as const) { const c = legChain(lf, lp, side); atoms.push(...c.atoms, ...footAtoms(lf, lp, c.foot)); }
  const { y, len, w } = lf;
  const measures = {
    heads: (y.sole - a.chinY) / h + 1, legLength: (y.sole - y.crotch) / h, crotchHeight: (y.sole - y.crotch) / (y.sole - a.chinY + h), thigh: len.thigh / h, shin: len.shin / h, foot: len.foot / h,
    thighToShin: len.thigh / len.shin, footToHead: len.foot / h, thighWidth: (2 * w.mid) / h, kneeWidth: (2 * w.knee) / h, calfWidth: (2 * w.calf) / h, ankleWidth: (2 * w.ankle) / h, footWidth: (2 * w.foot) / h,
    hipToThigh: lf.body.x.hip / w.mid, pelvisHeight: (y.crotch - y.crop) / h,
  };
  return { params: lp, body, frame: lf, atoms, byId: new Map([...body.atoms, ...atoms].map((q) => [q.id, q])), measures, corrections: [...body.corrections, ...lf.corrections] };
};
const memo = memoPure('leg-geometry', 'geometry', build, 128);
/** Géométrie du bas du corps : pure et mémoïsée par le contenu (params du corps + des jambes + ancre). Valeurs rendues IMMUABLES. */
export const legGeometry = (body: BodyInput, legs: LegInput, a: NeckAnchor): LegGeo => memo(BodyParams.parse(body), LegParams.parse(legs), a);

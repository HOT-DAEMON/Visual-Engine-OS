import { REF_FIT } from '../ref-fit';
import type { HeadTurnSpec } from '../types';
import { ENGINE_FIT, type EngineFit } from './engine-fit';
import { engineHead } from './face-model';
import { mouthKnots, noseKnots, noseLandmarks } from './nose-mouth';
import { engineRows } from './rows';
import { skinPoints } from './profile';
import { earRig } from './ear3d';
import { sectionAt } from '../sections';
import { fx, fy } from './units';

/**
 * SPEC DE LA TÊTE DE LA PLANCHE, DÉRIVÉE DES MOTEURS EXISTANTS (skull, face/landmarks, face/jaw, face/nose, face/mouth) recalés par `fit-engines.ts`.
 * Ce qui reste MESURÉ ici (et pas dérivé) est étiqueté : tailles d'œil, de sourcil, de bouche ouverte, lisière des cheveux, palette.
 */
export function engineSpec(fit: EngineFit = ENGINE_FIT, base: HeadTurnSpec, ys?: readonly number[]): HeadTurnSpec {
  const e = engineHead(fit), P = skinPoints(e), nl = noseLandmarks(e);
  const rows = engineRows(e, ys, fit.hairTh);
  const eyeX = fx(e.lm.innerCanthus.right.x) + base.eye.w / 2;
  const out: HeadTurnSpec = {
    ...base,
    rows,
    eye: { ...base.eye, x: eyeX, y: fy(e.lm.eyeY) },
    nose: { ...base.nose, rootY: nl.rootY, rootZ: P.get('nasion')!.z, tipY: P.get('pronasale')!.y, tipZ: P.get('pronasale')!.z, baseY: nl.baseY, alaX: nl.crestX, knots: noseKnots(e) },
    mouth: { ...base.mouth, y: fy(e.lm.mouthY), z: P.get('stomion')!.z, knots: mouthKnots(e) },
    // Le cou démarre DANS le crâne (nuque sous l'occiput) : son bord haut n'est jamais visible.
    neck: { ...base.neck, y0: 0.62 },
    engine: e,
  };
  // Oreille : repères lus sur le RIG du moteur d'oreille (haut, bas, profondeur de l'attache), pas sur des constantes : les contrôles anatomiques vérifient ainsi le placement réel.
  const rig = earRig(out, 1), zc = sectionAt(out, rig.pl.topY + rig.pl.hPx / 2).zc;
  return { ...out, ear: { ...base.ear, y0: rig.pl.topY, y1: rig.pl.topY + rig.pl.hPx, z: rig.zA - zc, openDeg: rig.pl.openingDeg } };
}
void REF_FIT;

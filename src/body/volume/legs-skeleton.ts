import { LEG_KIN } from '../lower/leg-spec';
import type { LegFrame } from '../lower/frame';
import type { LegPose } from '../lower/types';
import type { Trunk } from './trunk';
import { AX, add3, mul3, norm3, p3, rotAxis, sub3, type P3 } from './vec3';

/**
 * SQUELETTE 3D D'UNE JAMBE : hanche → genou → cheville + repère du pied, déduit de `LegFrame` (cotes, venues de `legGeometry`) et de la pose. Même
 * cinématique que `lower/leg.ts` (constantes `LEG_KIN` partagées) : écartement dans le plan frontal, genou fléchi (ici vers l'ARRIÈRE : la 3D n'a pas
 * besoin de raccourcir la jambe, la projection le fait), jambe ramenée vers la verticale (`inward`). Les points passent par `tr.xf` : la pose du tronc
 * (contrapposto, torsion, décalage du bassin) est appliquée UNE fois, ici, et tout enfant de la jambe la suit.
 */
export interface LegSkel {
  readonly side: 1 | -1; readonly sd: 'L' | 'R'; readonly pose: LegPose;
  readonly T0: P3; readonly C0: P3; readonly K: P3; readonly A: P3;
  /** Axes unitaires : cuisse `d0`, jambe `d1` ; direction LATÉRALE (s'éloigne de la ligne médiane) `lat0`, `lat1` ; direction AVANT `ant0`, `ant1`. */
  readonly d0: P3; readonly d1: P3; readonly lat0: P3; readonly lat1: P3; readonly ant0: P3; readonly ant1: P3;
  /** Repère du pied : `o` = point du sol sous la cheville ; `fwd` avant, `lat` latéral, `up` vers le haut. */
  readonly foot: { readonly o: P3; readonly fwd: P3; readonly lat: P3; readonly up: P3 };
}
export function legSkeleton(tr: Trunk, lf: LegFrame, pose: LegPose, side: 1 | -1): LegSkel {
  const h = lf.body.h, al = pose.abduction, rad = (al * Math.PI) / 180, lift = LEG_KIN.lift * h, zc = tr.at(lf.y.crotch).c.z;
  const T0n = p3(side * lf.axisX, lf.y.crotch - lift, zc), d0n = norm3(p3(side * Math.sin(rad), Math.cos(rad), 0));
  const C0n = add3(T0n, mul3(d0n, lift)), Kn = add3(C0n, mul3(d0n, lf.len.thigh));
  // Flexion du genou : la jambe part vers l'arrière (rotation autour de l'axe transversal X du corps, quel que soit le côté) ; puis retour vers la verticale.
  const d1n = rotAxis(rotAxis(d0n, AX.x, -pose.kneeFlex), AX.z, side * LEG_KIN.inward * al), An = add3(Kn, mul3(d1n, lf.len.shin));
  const lat0n = p3(side * Math.cos(rad), -Math.sin(rad), 0), lat1n = rotAxis(lat0n, AX.z, side * LEG_KIN.inward * al);
  const ant0n = p3(0, 0, 1), ant1n = rotAxis(ant0n, AX.x, -pose.kneeFlex);
  const T = tr.xf, dirAt = (at: P3, v: P3): P3 => norm3(sub3(T(add3(at, v)), T(at)));
  const To = T(T0n), Co = T(C0n), Ko = T(Kn), Ao = T(An);
  // Pied à plat : avant tourné vers l'extérieur de `footTurnout` (autour de la verticale), sol à `ankleH` sous la cheville.
  const tn = (side * pose.footTurnout), fwdn = rotAxis(p3(0, 0, 1), AX.y, tn), latFn = rotAxis(p3(side, 0, 0), AX.y, tn);
  const upW = mul3(dirAt(An, p3(0, 1, 0)), -1);
  return {
    side, sd: side > 0 ? 'L' : 'R', pose, T0: To, C0: Co, K: Ko, A: Ao,
    d0: norm3(sub3(Ko, Co)), d1: norm3(sub3(Ao, Ko)), lat0: dirAt(C0n, lat0n), lat1: dirAt(Kn, lat1n), ant0: dirAt(C0n, ant0n), ant1: dirAt(Kn, ant1n),
    foot: { o: add3(Ao, mul3(upW, -lf.len.ankleH)), fwd: dirAt(An, fwdn), lat: dirAt(An, latFn), up: upW },
  };
}

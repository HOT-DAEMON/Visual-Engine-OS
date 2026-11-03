import type { LegFrame } from '../lower/frame';
import type { LegGeo } from '../lower/geometry';
import { LEG_LANDMARKS } from '../lower/leg-spec';
import type { BodyFrame } from '../frame';
import { legRows } from './legs-profile';
import { footVolumes } from './foot3d';
import { legMuscles } from './legs-muscles';
import { legSkeleton, type LegSkel } from './legs-skeleton';
import { ball, type Ctl } from './loft';
import { vol } from './mk';
import type { Volume } from './types';
import { add3, mul3, type P3 } from './vec3';

/**
 * PEAU DE LA JAMBE = PONT DE CONTINUITÉ DU BASSIN (itération 06). Une seule enveloppe lisse par jambe, de l'intérieur du bassin à la cheville : elle ne porte AUCUN
 * relief, seulement la continuité de surface avec le tronc (même tampon de profondeur `skin`). Toutes les cotes viennent de `LegGeo.frame` (donc de `legGeometry`) :
 * rien n'est recalculé ici ; l'axe est celui du squelette 3D (`legs-skeleton.ts`), le même que celui des muscles. Le relief est dans les volumes (`legs-muscles.ts`).
 */
function legSkin(lf: LegFrame, sk: LegSkel): Volume {
  const th = lf.len.thigh;
  const onU = (t: number, dy = 0): P3 => add3(sk.C0, mul3(sk.d0, t * th + dy)), onS = (t: number, dy = 0): P3 => add3(sk.K, mul3(sk.d1, t * lf.len.shin + dy));
  const rows = legRows(lf).map((q) => ({ ...q, c: q.s <= th ? onU(0, q.s) : onS(0, q.s - th), ant: q.s <= th ? sk.ant0 : sk.ant1 }));
  const ctl: Ctl[] = rows.map(({ c, a, k, back, ant }) => ({ c: add3(c, mul3(ant, -back * a * k)), a, b: a * k, hint: ant }));
  return vol({ id: `leg.env.${sk.sd}`, name: 'jambe (peau : pont de continuité du bassin)', group: 'leg', kind: 'skin', side: sk.sd, level: 0, layer: 1, tier: 0, mass: `leg.skin.${sk.sd}`, n: 48 }, ctl);
}
/** Os cachés (fémur, tibia, péroné) et repères du genou et de la cheville (rotule, condyles, tubérosité tibiale, tête du péroné, malléoles, coussinet). */
function legBony(lf: LegFrame, sk: LegSkel): Volume[] {
  const h = lf.body.h, sd = sk.sd, out: Volume[] = [], id = (k: string): string => `${k}.${sd}`;
  const bone = (k: string, name: string, pa: string, p: P3, q: P3, r: number, ant: P3): void => { out.push(vol({ id: id(k), name, group: 'leg', kind: 'bone', side: sd, parent: id(pa), level: 2, layer: 2, hidden: true, n: 4 }, [p, q].map((c) => ({ c, a: r, b: r, hint: ant })))); };
  bone('bone.femur', 'fémur', 'leg.env', sk.T0, sk.K, 0.05 * h, sk.ant0);
  bone('bone.tibia', 'tibia', 'leg.env', sk.K, sk.A, 0.03 * h, sk.ant1);
  bone('bone.fibula', 'péroné', 'leg.env', add3(sk.K, mul3(sk.lat1, lf.w.knee * 0.6)), add3(sk.A, mul3(sk.lat1, lf.w.ankle * 0.9)), 0.0125 * h, sk.ant1);
  const anc = { K: sk.K, A: sk.A }, dirs = [sk.d0, sk.d1] as const, lats = [sk.lat0, sk.lat1] as const, ants = [sk.ant0, sk.ant1] as const, wref = { K: lf.w.knee, A: lf.w.ankle };
  for (const q of LEG_LANDMARKS) {
    const n = ants[q.n], c = add3(add3(add3(anc[q.at], mul3(lats[q.n], q.lat * wref[q.at])), mul3(dirs[q.dir], q.along * h)), mul3(n, (q.dz ?? 0) * wref[q.at])), r = q.rad * h;
    const rx = (q.rx ?? q.rad) * h, ry = (q.ry ?? q.rad) * h, t = Math.max(0.008 * h, 0.4 * r);
    // Disque aplati posé sur la surface (rotule, coussinet) ou petite bosse (condyle, malléole) : trois sections empilées le long de la direction de sortie.
    const outDir = Math.abs(q.dz ?? 0) > 0.3 ? n : lats[q.n], sgn = q.lat < 0 ? -1 : 1, od = outDir === n ? n : mul3(outDir, sgn);
    out.push(vol({ id: id(q.id), name: q.id, group: 'leg', kind: q.kind, side: sd, parent: id('leg.env'), level: q.level, layer: 5, tier: 0, tone: q.tone ?? 0, mass: `leg.skin.${sd}`, n: 5 },
      [[-1, 0.55], [0, 1], [1, 0.55]].map(([o, k]) => ({ c: add3(c, mul3(od, (o as number) * t)), a: (q.rx ? rx : r) * (k as number), b: (q.ry ? ry : r) * (k as number), hint: dirs[q.dir] }))));
  }
  for (const [k, c, r] of [['joint.knee', sk.K, lf.w.knee * 0.6], ['joint.ankle', sk.A, lf.w.ankle * 0.7]] as const) out.push({ id: id(k), name: `sphère d’articulation ${k.split('.')[1]}`, group: 'joint', kind: 'joint', side: sd, parent: null, level: 3, layer: 8, stations: ball(c, r), fibres: [], tone: 0, sphere: true });
  return out;
}
/** Jambes 3D : peau (pont), muscles, os cachés, repères, pied. Tout est dérivé de `LegGeo` (cotes, params, poses) ; aucune cote n'est recalculée ici. */
export function legVolumes(tr: import('./trunk').Trunk, f: BodyFrame, lg: LegGeo): Volume[] {
  const lf = lg.frame, lp = lg.params, out: Volume[] = [];
  for (const s of [1, -1] as const) {
    const sk = legSkeleton(tr, lf, s > 0 ? lp.pose.left : lp.pose.right, s);
    out.push(legSkin(lf, sk), ...legMuscles(sk, lf, f.vis), ...legBony(lf, sk), ...footVolumes(sk, lf, lp));
  }
  return out;
}

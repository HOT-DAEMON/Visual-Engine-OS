import type { BodyFrame } from '../frame';
import type { ArmPose } from '../types';
import { ball, type Ctl } from './loft';
import { vol } from './mk';
import type { Trunk } from './trunk';
import type { Volume } from './types';
import { add3, cross3, mul3, norm3, p3, rotAxis, sub3, type P3 } from './vec3';

/** Chaîne osseuse 3D d'un bras : épaule → coude → poignet, plus le repère de la main. Tout est déduit de `BodyFrame` + pose + balancement ; aucune coordonnée en dur. */
export interface ArmChain {
  readonly side: 1 | -1; readonly sh: P3; readonly el: P3; readonly wr: P3;
  /** Axes : `up` = axe de l'humérus (épaule→coude), `fa` = axe de l'avant-bras, `ant` = direction « devant » du bras, `fant` = « paume » de l'avant-bras (tourne avec la pronation). */
  readonly up: P3; readonly fa: P3; readonly ant: P3; readonly fant: P3;
}
export function armChain(tr: Trunk, f: BodyFrame, pose: ArmPose, swing: number, side: 1 | -1): ArmChain {
  const sh = tr.shoulder(side), A = f.arm;
  // Humérus : vertical, écarté (abduction, plan frontal) puis balancé vers l'avant (autour de l'axe transversal).
  const abd = pose.abduction; // essai +8°·mus mesuré sur ref-02 : IoU 0,77 → 0,55 (les avant-bras reviennent vers le corps) — rejeté
  let up = norm3(p3(side * Math.sin((abd * Math.PI) / 180), Math.cos((abd * Math.PI) / 180), 0));
  up = rotAxis(up, p3(1, 0, 0), -swing);
  const ant0 = rotAxis(p3(0, 0, 1), p3(1, 0, 0), -swing);
  // Coude : flexion vers l'avant autour de l'axe transversal LOCAL du bras (cross(up, ant)) ; swing de l'avant-bras dans le plan de l'image en plus.
  const lat = norm3(cross3(up, ant0));
  let fa = rotAxis(up, lat, -pose.elbowFlex);
  fa = rotAxis(fa, p3(0, 0, 1), -side * pose.forearmSwing);
  const el = add3(sh, mul3(up, A.upper)), wr = add3(el, mul3(fa, A.fore));
  // Pronation −1 (paume en avant, position anatomique) … 0 (paume vers le corps) … +1 (dos de la main en avant) : rotation de la face « paume » autour de l'axe de l'avant-bras (0 → 180°).
  const antF = norm3(sub3(ant0, mul3(fa, ant0.x * fa.x + ant0.y * fa.y + ant0.z * fa.z)));
  const fant = rotAxis(antF, fa, -side * (pose.pronation + 1) * 90);
  return { side, sh, el, wr, up, fa, ant: ant0, fant };
}

const sinProf = (t: number, belly: number, tend = 0.12): number => { const k = Math.log(0.5) / Math.log(Math.min(0.95, Math.max(0.05, belly))); return Math.max(tend, Math.sin(Math.PI * t ** k) ** 0.8); };
/**
 * Fuseau musculaire 3D le long d'un os (p0→p1) : de t0 à t1, décalé de (offA devant, offL latéral) × demi-épaisseur, ventre en `belly`, gaines tendineuses aux bouts.
 * `ant` donne la face visible. Renvoie les points de contrôle prêts pour `vol`.
 */
export function fusiform(p0: P3, p1: P3, ant: P3, t0: number, t1: number, offA: number, offL: number, a: number, b: number, belly = 0.5, n = 6, tend = 0.12): Ctl[] {
  const ax = norm3(sub3(p1, p0)), lat = norm3(cross3(ax, ant)), an = norm3(cross3(lat, ax));
  return Array.from({ length: n }, (_, i) => {
    const s = i / (n - 1), t = t0 + (t1 - t0) * s, k = sinProf(s, belly, tend);
    const c = add3(add3(p0, mul3(sub3(p1, p0), t)), add3(mul3(an, offA), mul3(lat, offL)));
    return { c, a: a * k, b: b * k, hint: an };
  });
}

/** Volumes d'un bras : enveloppes, DELTOÏDE (3 chefs), biceps, triceps (3 chefs), brachial, brachio-radial, fléchisseurs/extenseurs, tendons, veines. */
export function armVolumes(ch: ArmChain, f: BodyFrame, vis: number): Volume[] {
  const H = f.h, A = f.arm, s = ch.side, sd = s > 0 ? 'L' : 'R', out: Volume[] = [], id = (k: string): string => `${k}.${sd}`;
  const { sh, el, wr, up, fa, ant, fant } = ch, latU = norm3(cross3(up, ant));
  // `cross(a, b)` de deux vecteurs symétriques par rapport à x=0 est un pseudo-vecteur (il change de signe sous le miroir) : on le multiplie par le côté pour obtenir la direction RADIALE (côté pouce) réellement symétrique.
  const latF = mul3(norm3(cross3(fa, fant)), s);
  const rU = A.armHalf, rF = A.foreHalf, m = 0.55 + 0.6 * vis;
  const spec = (k: string, name: string, grp: 'shoulder' | 'arm' | 'forearm', layer: number, tier: number, extra: object = {}) => ({ id: id(k), name, group: grp, side: sd as 'L' | 'R', layer, tier, ...extra });
  // Enveloppes (peau + noyau) : continuité 3D de l'épaule au poignet.
  out.push(vol({ ...spec('arm.env', 'bras (enveloppe)', 'arm', 1, 0, { kind: 'skin', level: 0 }) }, fusiform(sh, el, ant, -0.02, 1.02, 0, 0, rU * 1.0, rU * 1.0, 0.35, 7).map((c, i, arr) => { const e = (((i / (arr.length - 1)) - 0.7) / 0.3), k = e <= 0 ? 0 : e >= 1 ? 1 : e * e * (3 - 2 * e); return { ...c, a: Math.max(rU * 0.78, c.a) * (1 - k) + rF * 1.0 * k, b: Math.max(rU * 0.74, c.b) * (1 - k) + rF * 0.88 * k }; })));
  out.push(vol({ ...spec('forearm.env', 'avant-bras (enveloppe)', 'forearm', 1, 0, { kind: 'skin', level: 0 }) }, fusiform(el, wr, fant, -0.03, 1.03, 0, 0, rF * 1.05, rF * 0.9, 0.18, 7).map((c, i, arr) => { const e = 1 - Math.min(1, (i / (arr.length - 1)) / 0.35), k = e * e * (3 - 2 * e); return { ...c, a: Math.max(A.wristHalf * 1.02, c.a, rF * 1.0 * k), b: Math.max(A.wristHalf * 0.78, c.b, rF * 0.88 * k) }; })));
  // Deltoïde : trois chefs enroulés autour de l'articulation (antérieur, moyen, postérieur), de la clavicule/acromion/épine scapulaire à la V deltoïdienne.
  const dl = (k: string, name: string, dirOff: P3, w: number, fib: number[]): void => {
    // Le chef part DANS l'épaule (derrière l'articulation) et se referme sur la V deltoïdienne : bouts épais en haut (calotte arrondie), fins en bas.
    const p0 = add3(sh, mul3(up, rU * 0.05)), p1 = add3(sh, mul3(up, A.upper * 0.5)), nrm = norm3(add3(dirOff, p3(0, -0.15, 0)));
    out.push(vol(spec(k, name, 'shoulder', 4, k.includes('mid') ? 1 : 2, { fibres: fib, origin: 'clavicle/acromion/scapular-spine', insertion: 'humerus' }), fusiform(p0, p1, nrm, 0, 1, rU * 0.5, 0, rU * w * m, rU * 0.62 * m, 0.3, 7, 0.55)));
  };
  dl('deltoid.ant', 'deltoïde antérieur', ant, 0.55, [1.2, 1.5, 1.8]);
  dl('deltoid.mid', 'deltoïde moyen', mul3(latU, s), 0.7, [1.1, 1.35, 1.57, 1.8, 2.05]);
  dl('deltoid.post', 'deltoïde postérieur', mul3(ant, -1), 0.55, [1.2, 1.5, 1.8]);
  // Biceps (2 chefs) et brachial en avant ; triceps (long, latéral, médial) en arrière.
  out.push(vol(spec('biceps.long', 'biceps — chef long', 'arm', 4, 1, { fibres: [1.35, 1.6, 1.8], origin: 'scapula', insertion: 'radius' }), fusiform(sh, el, ant, 0.15, 0.88, rU * 0.5, rU * 0.12 * s, rU * 0.5 * m, rU * 0.52 * m, 0.45)));
  out.push(vol(spec('biceps.short', 'biceps — chef court', 'arm', 4, 2, { fibres: [1.35, 1.6, 1.8], origin: 'coracoid', insertion: 'radius' }), fusiform(sh, el, ant, 0.18, 0.88, rU * 0.46, -rU * 0.2 * s, rU * 0.42 * m, rU * 0.46 * m, 0.45)));
  out.push(vol(spec('brachialis', 'brachial', 'arm', 3, 3, { origin: 'humerus', insertion: 'ulna' }), fusiform(sh, el, ant, 0.45, 0.97, rU * 0.35, rU * 0.35 * s, rU * 0.34 * m, rU * 0.3 * m, 0.5)));
  const back = mul3(ant, -1);
  out.push(vol(spec('triceps.long', 'triceps — chef long', 'arm', 4, 2, { fibres: [1.3, 1.57, 1.85], origin: 'scapula', insertion: 'olecranon' }), fusiform(sh, el, back, 0.1, 0.9, rU * 0.5, rU * 0.05 * s, rU * 0.5 * m, rU * 0.52 * m, 0.4)));
  out.push(vol(spec('triceps.lat', 'triceps — chef latéral', 'arm', 4, 2, { origin: 'humerus', insertion: 'olecranon' }), fusiform(sh, el, back, 0.22, 0.92, rU * 0.42, rU * 0.42 * s, rU * 0.36 * m, rU * 0.4 * m, 0.45)));
  out.push(vol(spec('triceps.med', 'triceps — chef médial', 'arm', 3, 3, { origin: 'humerus', insertion: 'olecranon' }), fusiform(sh, el, back, 0.45, 0.96, rU * 0.34, -rU * 0.34 * s, rU * 0.3 * m, rU * 0.3 * m, 0.55)));
  // Avant-bras : brachio-radial, fléchisseurs (face paume), extenseurs (face dos), + tendons et veines (tubes minces dessinés au trait).
  const dorsum = mul3(fant, -1);
  out.push(vol(spec('brachioradialis', 'brachio-radial', 'forearm', 4, 2, { origin: 'humerus', insertion: 'radius' }), fusiform(el, wr, latF, 0.0, 0.7, rF * 0.1, -rF * 0.62 * s, rF * 0.34 * m, rF * 0.4 * m, 0.22)));
  out.push(vol(spec('forearm.flexors', 'fléchisseurs de l’avant-bras', 'forearm', 4, 2, { fibres: [1.4, 1.57, 1.75], origin: 'medial-epicondyle', insertion: 'carpus' }), fusiform(el, wr, fant, 0.02, 0.92, rF * 0.4, rF * 0.12 * s, rF * 0.58 * m, rF * 0.42 * m, 0.25)));
  out.push(vol(spec('forearm.extensors', 'extenseurs de l’avant-bras', 'forearm', 4, 2, { fibres: [1.4, 1.57, 1.75], origin: 'lateral-epicondyle', insertion: 'carpus' }), fusiform(el, wr, dorsum, 0.02, 0.9, rF * 0.4, -rF * 0.12 * s, rF * 0.56 * m, rF * 0.42 * m, 0.28)));
  const tube = (k: string, name: string, kind: 'tendon' | 'vein', pts: P3[], r: number, nrm: P3, tier: number, tone: number): void => { out.push(vol({ id: id(k), name, group: 'forearm', kind, side: sd as 'L' | 'R', layer: 6, level: 3, tier, tone, strand: true }, pts.map((c) => ({ c, a: r, b: r, hint: nrm })))); };
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * rF * 0.34, pts = [0.55, 0.75, 0.92, 1.0].map((t) => add3(add3(add3(el, mul3(sub3(wr, el), t)), mul3(dorsum, rF * (0.28 * (1 - t) + 0.34) * 0.9)), mul3(latF, off * (0.4 + 0.6 * t))));
    tube(`tendon.ext.${i + 1}`, `tendon extenseur ${i + 1}`, 'tendon', pts, 0.0065 * H, dorsum, 4, 0.22);
  }
  for (let i = 0; i < 2; i++) {
    const w = 0.18 + 0.2 * i, pts = [0.05, 0.28, 0.5, 0.72, 0.96].map((t, j) => add3(add3(add3(el, mul3(sub3(wr, el), t)), mul3(dorsum, rF * 0.9)), mul3(latF, rF * (w * (i ? -1 : 1) + 0.1 * Math.sin(j * 1.7 + i)))));
    tube(`vein.${i + 1}`, `veine superficielle ${i + 1}`, 'vein', pts, 0.0058 * H, dorsum, 4, -0.35);
  }
  return out;
}
/** Sphères d'articulation EXPLICITES (épaule, coude, poignet) : rendent la mécanique lisible ; elles pilotent aussi les rotations de la chaîne. */
export const jointBalls = (ch: ArmChain, f: BodyFrame): { id: string; c: P3; r: number }[] => {
  const sd = ch.side > 0 ? 'L' : 'R', A = f.arm;
  return [{ id: `joint.shoulder.${sd}`, c: ch.sh, r: A.armHalf * 0.78 }, { id: `joint.elbow.${sd}`, c: ch.el, r: A.armHalf * 0.55 }, { id: `joint.wrist.${sd}`, c: ch.wr, r: A.wristHalf * 0.8 }];
};
void ball;

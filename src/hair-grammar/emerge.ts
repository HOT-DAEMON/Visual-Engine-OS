import { widthProfile } from './blade';
import type { CurveSegment } from './curve-program';
import type { HeadSpec } from './head';
import { walk, type LockSpec } from './lock';
import { dot, norm, sub, type V3 } from './vec';
import { widthAt } from './width-program';

/**
 * TRANSITION ENTRE MASSES — une mèche qui sort d'une masse ne « commence pas à côté » : elle ÉMERGE de son volume.
 * `emergeFrom` pose la racine de l'enfant sur le point EXACT de la mère à la position `t` (même point de coque, même décollement),
 * lui donne le CAP de la mère (continuité de direction) puis la laisse s'en détacher progressivement : un tronçon droit suivi
 * d'une courbure progressive d'angle `peel`. La naissance douce du profil de largeur (`widthProfile(0)` ≈ 0,04) fait que l'enfant
 * sort mince de dessous la mère ; l'ordre de dessin local (`occlusion.ts`) la garde derrière la mère tant qu'elle est dans son volume.
 */
export interface EmergeOpts {
  /** Position de naissance sur la mère (0–1). */
  readonly t: number;
  /** Angle de détachement final par rapport au cap de la mère (rad, signé). */
  readonly peel: number;
  /** Part de longueur (poids) tenue droite dans le prolongement de la mère avant de se détacher. */
  readonly follow?: number;
  /** Enfoncement de la racine sous le décollement de la mère (unités H) : 0 = affleurant. */
  readonly sink?: number;
}

/** Direction 3D de la mère à la position t (tangente centrée sur les échantillons marchés). */
export function tangentAt(h: HeadSpec, L: LockSpec, t: number, steps = 28): { p: V3; dir: V3; n: V3; off: number; /** Pente du décollement (unités H par unité de longueur de coque) au point. */ slope: number; shell: { y: number; az: number } } {
  const S = walk(h, L, steps);
  const k = Math.min(steps - 1, Math.max(1, Math.round(t * steps)));
  const a = S[k - 1]; const b = S[k + 1] ?? S[k]; const c = S[k];
  if (!a || !b || !c) throw new Error('mèche trop courte pour émerger');
  // Décollement EFFECTIF de l'échantillon (réduit dans les creux de la coque, voir `lock.ts`) : la fille doit naître à l'altitude RÉELLE de sa mère.
  const run = Math.hypot(b.p.x - a.p.x, b.p.y - a.p.y, b.p.z - a.p.z) || 1;
  return { p: c.p, dir: norm(sub(b.p, a.p)), n: c.n, off: c.off, slope: (b.off - a.off) / run, shell: c.shell };
}

/** Mèche enfant ÉMERGEANT de `parent` : on garde les attributs de rendu de `child` (largeur, ton, longueur…) et on remplace racine, cap et programme. */
export function emergeFrom(h: HeadSpec, parent: LockSpec, child: LockSpec, o: EmergeOpts): LockSpec {
  const T = tangentAt(h, parent, o.t);
  const sh = T.shell;
  const sink = o.sink ?? 0.004;
  const prog: CurveSegment[] = [{ kind: 'straight', len: o.follow ?? 0.6 }, { kind: 'arc', len: 2, angle: o.peel, ease: 1.8 }];
  return {
    ...child, parent: { id: parent.id, t: o.t }, shellRoot: sh,
    root: { el: parent.root.el, az: parent.root.az },
    // Décollement : la fille CONTINUE la montée (ou la descente) de sa mère, pente comprise (sinon la direction 3D à la jonction saute de 10–20°, mesuré), puis
    // rejoint progressivement le décollement propre de la famille.
    aim: T.dir, lift0: Math.max(0, T.off - sink), lift1: Math.max(child.lift1, T.off), liftPow: 1, liftSlope0: T.slope,
    program: prog, layer: parent.layer === 'back' ? 'back' : child.layer,
  };
}

export interface Continuity { readonly gap: number; readonly angleDeg: number; readonly widthRatio: number }

/** Continuité à la jonction : écart de position (unités H), angle entre les deux caps (°), rapport de largeur enfant/mère à la jonction. */
export function emergenceContinuity(h: HeadSpec, parent: LockSpec, child: LockSpec): Continuity {
  const T = tangentAt(h, parent, child.parent?.t ?? 0.5);
  const C = walk(h, child, 28);
  const c0 = C[0]; const c1 = C[2];
  if (!c0 || !c1) throw new Error('enfant trop court');
  const d0 = norm(sub(c1.p, c0.p));
  const tm = child.parent?.t ?? 0.5;
  const pw = parent.width * widthAt(parent.widthProg, tm, (u) => widthProfile(u, parent.peak, parent.taper));
  const cw = child.width * widthAt(child.widthProg, 0, (u) => widthProfile(u, child.peak, child.taper));
  return { gap: Math.hypot(c0.p.x - T.p.x, c0.p.y - T.p.y, c0.p.z - T.p.z), angleDeg: (Math.acos(Math.min(1, Math.max(-1, dot(d0, T.dir)))) * 180) / Math.PI, widthRatio: cw / Math.max(1e-6, pw) };
}

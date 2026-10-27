import { rad } from '../../core/math';
import { cubicAt, type Vec } from './primitives';
import type { OpeningGeometry } from './opening';

/**
 * Rotation 3D RÉELLE de l'enveloppe palpébrale (modèle `sphere`) : chaque point de l'ouverture est repris sur la sphère de la tête,
 * tourné (lacet puis tangage), et reprojeté en orthographique. Contrairement à l'écrasement uniforme du modèle `flat`, le canthus proche et
 * le canthus lointain ne se raccourcissent pas pareil, et le raccourcissement dépend de la POSITION de l'œil sur la tête (`azimuthDeg`).
 *
 * Construction (exacte, sans approximation de petits angles) :
 *  1. l'œil dessiné de face est une vue ÉCRAN ; le centre de l'œil est sur la sphère à l'azimut `a`, à (R sin a, 0, R cos a) ;
 *  2. un point d'écran (X, Y) relatif au centre correspond au point de sphère (R sin a + X, Y, √(R² − x² − y²)) — inverse de l'orthographique ;
 *  3. on tourne ce point (lacet φ autour de Y, tangage θ autour de X, mêmes conventions que lighting/head-turn.ts) et on reprojette ;
 *  4. sortie = position reprojetée − position d'écran du centre non tourné → identité EXACTE à φ = θ = 0 (testé).
 * Invariant analytique testé : au centre, la compression horizontale vaut cos(a + φ) / cos(a) (même loi que docs/FACE-POSE.md).
 */
export interface TurnParams {
  readonly yawDeg: number;
  readonly pitchDeg: number;
  /** Position de l'œil sur la tête, autour de l'axe vertical : 0 = face ; ± ≈ 22° pour deux yeux d'un visage humain. */
  readonly azimuthDeg: number;
  /** Rayon de la tête, mêmes unités que l'œil (≈ 3 × largeur de l'œil pour une tête humaine : œil 30 mm, tête 90 mm). */
  readonly radius: number;
}

export interface Jacobian { readonly a: number; readonly b: number; readonly c: number; readonly d: number; }

export interface TurnedOpening {
  readonly g: OpeningGeometry;
  /** Matrice linéaire locale au centre de l'œil (x' = a x + b y, y' = c x + d y). */
  readonly jac: Jacobian;
  /** Décalage de parallaxe du centre de l'œil. */
  readonly shift: Vec;
  /** Composante z (0…1, en fraction du rayon) de la normale de surface au centre après rotation : ≤ 0 = œil derrière le crâne. */
  readonly facing: number;
}

/** Applique la rotation à un point d'écran (relatif au centre de l'œil). */
export function turnPoint(p: Vec, t: TurnParams): Vec {
  const R = t.radius;
  const a = rad(t.azimuthDeg);
  const x = R * Math.sin(a) + p.x;
  const y = p.y;
  const zz = R * R - x * x - y * y;
  const z = Math.sqrt(Math.max(zz, (0.02 * R) ** 2));
  const ph = rad(t.yawDeg);
  const th = rad(t.pitchDeg);
  const x1 = x * Math.cos(ph) + z * Math.sin(ph);
  const z1 = -x * Math.sin(ph) + z * Math.cos(ph);
  const y2 = y * Math.cos(th) - z1 * Math.sin(th);
  return { x: x1 - R * Math.sin(a), y: y2 };
}

export function jacobianAtCenter(t: TurnParams): Jacobian {
  const e = t.radius * 1e-4;
  const px = turnPoint({ x: e, y: 0 }, t);
  const mx = turnPoint({ x: -e, y: 0 }, t);
  const py = turnPoint({ x: 0, y: e }, t);
  const my = turnPoint({ x: 0, y: -e }, t);
  return { a: (px.x - mx.x) / (2 * e), b: (py.x - my.x) / (2 * e), c: (px.y - mx.y) / (2 * e), d: (py.y - my.y) / (2 * e) };
}

/** Normale de surface au centre après rotation : z du point central tourné / R. */
export function facingOf(t: TurnParams): number {
  const a = rad(t.azimuthDeg);
  const ph = rad(t.yawDeg);
  const th = rad(t.pitchDeg);
  const z0 = Math.cos(a);
  const x0 = Math.sin(a);
  const z1 = -x0 * Math.sin(ph) + z0 * Math.cos(ph);
  return z1 * Math.cos(th);
}

/** Ouverture tournée : les six points de contrôle passent par `turnPoint` ; boîte, largeur et hauteurs sont recalculées. */
export function turnOpening(g: OpeningGeometry, t: TurnParams, recenter = true): TurnedOpening {
  // `recenter` : retire la parallaxe du centre (l'œil tourne « sur place »). La parallaxe reste fournie dans `shift` pour un hôte (visage) qui place l'œil lui-même.
  const sh = turnPoint({ x: 0, y: 0 }, t);
  const m = (p: Vec): Vec => {
    const q = turnPoint(p, t);
    return recenter ? { x: q.x - sh.x, y: q.y - sh.y } : q;
  };
  const pi = m(g.pi); const po = m(g.po); const u1 = m(g.u1); const u2 = m(g.u2); const l1 = m(g.l1); const l2 = m(g.l2);
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  const N = 32;
  for (let i = 0; i <= N; i++)
    for (const p of [cubicAt(pi, u1, u2, po, i / N), cubicAt(po, l1, l2, pi, i / N)]) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }
  const jac = jacobianAtCenter(t);
  const sy = Math.hypot(jac.b, jac.d);
  const sx = Math.hypot(jac.a, jac.c);
  const out: OpeningGeometry = { ...g, pi, po, u1, u2, l1, l2, w: g.w * sx, h: g.h * sy, hEff: g.hEff * sy, bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY } };
  return { g: out, jac, shift: sh, facing: facingOf(t) };
}

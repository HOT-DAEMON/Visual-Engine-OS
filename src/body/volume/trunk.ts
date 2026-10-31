import type { BodyFrame } from '../frame';
import type { BodyParams } from '../types';
import { loft, type Ctl } from './loft';
import type { VolumeParams } from './params';
import { makeSpine, type Spine } from './spine';
import type { Station, Volume } from './types';
import { add3, cross3, dot3, mul3, norm3, p3, sub3, type P3 } from './vec3';

const sm = (u: number): number => { const x = Math.min(1, Math.max(0, u)); return x * x * (3 - 2 * x); };
const prof = (ys: readonly number[], vs: readonly number[], y: number): number => {
  if (y <= (ys[0] as number)) return vs[0] as number;
  for (let i = 0; i < ys.length - 1; i++) if (y <= (ys[i + 1] as number)) return (vs[i] as number) + ((vs[i + 1] as number) - (vs[i] as number)) * sm((y - (ys[i] as number)) / ((ys[i + 1] as number) - (ys[i] as number)));
  return vs[vs.length - 1] as number;
};

/**
 * TRONC 3D : enveloppe elliptique par hauteur (demi-largeur X, profondeur D) portée par la colonne courbe. Seul `point(y, ψ, lift)` est utilisé par les muscles :
 * ψ = 0 face avant · π/2 côté gauche du corps · π dos · −π/2 côté droit. Contrapposto (épaules/bassin en sens opposés + torsion) appliqué ICI, une seule fois :
 * tout enfant du tronc le suit sans rien recalculer.
 */
export interface Trunk {
  readonly spine: Spine; readonly f: BodyFrame;
  readonly at: (y: number) => { c: P3; X: number; D: number; zb: number; zf: number };
  readonly point: (y: number, psi: number, lift?: number) => { p: P3; n: P3 };
  readonly shoulder: (side: 1 | -1) => P3;
  readonly envelope: Volume;
}
export function makeTrunk(f: BodyFrame, _bp: BodyParams, vp: VolumeParams): Trunk {
  void _bp;
  const h = f.h, spine = makeSpine(f, vp), y = f.y, x = f.x, tl = y.navel - y.base;
  const yt = y.base - 0.06 * h, yk = y.base + 0.45 * (y.acr - y.base), ky = [yt, y.base, yk, y.acr, y.axilla, y.nipple, y.waist, y.navel, y.crop];
  const X = (yy: number): number => prof(ky, [f.a.baseHalf * 1.15, x.acr * 0.36, x.acr * 0.62, x.acr * 0.9, x.chest, x.chest * 1.02, x.waist, x.waist * 1.03, x.hip], yy);
  const td = 1 + 0.15 * vp.torso.thoraxDepth;
  const k = (yy: number): number => prof(ky, [0.65, 0.58, 0.5, 0.46 * td, 0.7 * td, 0.74 * td, 0.62, 0.64, 0.68], yy);
  const bellyAmt = Math.min(1.2, 0.55 * f.fat + 0.6 * vp.torso.belly), yb = (y.waist + y.navel) / 2 + 0.05 * tl;
  const belly = (yy: number): number => bellyAmt * x.waist * 0.42 * Math.exp(-(((yy - yb) / (0.2 * tl)) ** 2));
  const gl = (yy: number): number => x.hip * (0.2 + 0.1 * vp.torso.glute) * Math.exp(-(((yy - (y.navel + 0.2 * tl)) / (0.2 * tl)) ** 2));
  const s = vp.contrapposto, tiltS = s.amount * 5.5 * s.side, twist = s.amount * s.twist * 9;
  /** Transformation de pose : bascule (z), décalage latéral du bassin vers la jambe porteuse, torsion (y). */
  const T = (pt: P3): P3 => {
    const u = sm((pt.y - y.base) / (y.crop - y.base)), tilt = ((tiltS * (1 - u) - tiltS * 1.15 * u) * Math.PI) / 180, yaw = ((twist * (1 - 2 * u)) * Math.PI) / 180;
    const zc = spine.z(pt.y), cz = pt.z - zc, c = Math.cos(yaw), sn = Math.sin(yaw);
    const xr = pt.x * c + cz * sn, zr = -pt.x * sn + cz * c;
    return p3(xr + s.amount * s.side * 0.035 * h * u, pt.y + xr * Math.sin(tilt), zr + zc);
  };
  const Tn = (n: P3, yy: number): P3 => { const u = sm((yy - y.base) / (y.crop - y.base)), yaw = ((twist * (1 - 2 * u)) * Math.PI) / 180; return p3(n.x * Math.cos(yaw) + n.z * Math.sin(yaw), n.y, -n.x * Math.sin(yaw) + n.z * Math.cos(yaw)); };
  const at = (yy: number): { c: P3; X: number; D: number; zb: number; zf: number } => {
    const XX = X(yy), D0 = k(yy) * XX, zs = spine.z(yy), zb = zs - D0 - gl(yy), zf = 0.5 * zs + D0 + belly(yy);
    return { c: p3(0, yy, (zb + zf) / 2), X: XX, D: (zf - zb) / 2, zb, zf };
  };
  /** Point de peau et normale SORTANTE exacte (produit vectoriel des dérivées de la surface P(y,ψ) : correct aussi sur la pente d'épaule). */
  const raw = (yy: number, psi: number): P3 => { const t = at(yy); return p3(t.X * Math.sin(psi), yy, t.c.z + t.D * Math.cos(psi)); };
  const point = (yy: number, psi: number, lift = 0): { p: P3; n: P3 } => {
    const e = 0.004 * f.h, ep = 0.01, P = raw(yy, psi), dy = sub3(raw(yy + e, psi), raw(yy - e, psi)), dp = sub3(raw(yy, psi + ep), raw(yy, psi - ep));
    let n = norm3(cross3(dy, dp));
    if (dot3(n, sub3(P, at(yy).c)) < 0) n = mul3(n, -1);
    return { p: T(add3(P, mul3(n, lift))), n: Tn(n, yy) };
  };
  // Sections de l'enveloppe : aux hauteurs-clés du cadre ET entre elles (le dessus d'épaule varie vite : il en faut 4 sur ses 35 premiers px).
  const ys = [...new Set([...ky, y.base + 0.7 * (y.acr - y.base), (y.acr + y.axilla) / 2, (y.axilla + y.nipple) / 2, (y.nipple + y.waist) / 2, (y.waist + y.navel) / 2, (y.navel + y.crop) / 2, y.base - 0.025 * h, y.base + 0.22 * (y.acr - y.base)])].sort((p, q) => p - q);
  const ctl: Ctl[] = ys.map((yy) => { const t = at(yy); return { c: T(t.c), a: t.X, b: t.D, hint: p3(0, 0, 1) }; });
  const envelope: Volume = { id: 'trunk', name: 'tronc (cage thoracique, abdomen)', group: 'trunk', kind: 'skin', side: 'C', parent: null, level: 0, layer: 0, stations: loft(ctl, 3 * ys.length) as Station[], fibres: [], tone: 0 };
  const shoulder = (side: 1 | -1): P3 => { const t = at(f.joint.y); return T(p3(side * f.joint.x, f.joint.y, t.c.z - 0.06 * t.D)); };
  return { spine, f, at, point, shoulder, envelope };
}

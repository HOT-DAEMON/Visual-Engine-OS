import type { BodyFrame } from '../frame';
import type { LegFrame } from '../lower/frame';
import type { BodyParams } from '../types';
import { loft, type Ctl } from './loft';
import type { VolumeParams } from './params';
import { makeSpine, type Spine } from './spine';
import type { Station, Volume } from './types';
import { add3, cross3, dot3, mul3, norm3, p3, sub3, type P3 } from './vec3';

/** Part de la lordose visible sur la surface du dos (le reste est comblé par les érecteurs du rachis). */
const FILL = 0.35;
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
  /** Transformation de pose du tronc (contrapposto, torsion, décalage du bassin) : les jambes s'y accrochent pour suivre le bassin sans rien recalculer. */
  readonly xf: (p: P3) => P3;
  /** Hauteur de la fourche (y, px) : fin du bassin, début des cuisses (cotes du module du bas du corps). */
  readonly crotchY: number;
  readonly envelope: Volume;
}
export function makeTrunk(f: BodyFrame, _bp: BodyParams, vp: VolumeParams, lf: LegFrame): Trunk {
  void _bp;
  const h = f.h, spine = makeSpine(f, vp), y = f.y, x = f.x, tl = y.navel - y.base;
  // `yr` = bas de la cage thoracique (entre mamelon et taille) : point-clé ajouté à l'itération 04 (profil ref-04 : le thorax inférieur manquait de 0,14–0,19 h de profondeur).
  // BASSIN (itération 05) : le tronc ne s'arrêtait plus à la crête par une coupe plate ; il se prolonge jusqu'à la fourche (mêmes cotes que `lower/frame.ts`) en passant par le grand trochanter (`yh`, plus large que la crête), ce qui donne au haut et au bas du corps UNE seule enveloppe de peau.
  const crotch = lf.y.crotch, yh = y.crop + 0.4 * (crotch - y.crop);
  const yt = y.base - 0.06 * h, yk = y.base + 0.45 * (y.acr - y.base), yr = (y.nipple + y.waist) / 2, ky = [yt, y.base, yk, y.acr, y.axilla, y.nipple, yr, y.waist, y.navel, y.crop, yh, crotch];
  // PENTE DU TRAPÈZE (itération 05) : coefficients balayés (voir docs/BODY-UPPER-LIMB-05.md) sur la SILHOUETTE complète alignée sur l'axe du corps (ref-02 : écart moyen 0,031 tête ; ref-04 : 0,032–0,053) ET sur le dépassement muscles/os − peau (≤ 0,03 h sur la pente, des deux côtés). Plus étroit (0,36 / 0,62 / 0,90, ancien) : les muscles débordent de 0,05 h ; plus large (0,40 / 0,73 / 1,00) : la silhouette dépasse ref-02 de 0,05 h.
  const SL = { base: 0.38, yk: 0.66, acr: 0.94 };
  const X = (yy: number): number => prof(ky, [f.a.baseHalf * 1.15, x.acr * SL.base, x.acr * SL.yk, x.acr * SL.acr, x.chest, x.chest * 1.02, (x.chest * 1.02 + x.waist) / 2 + 0.02 * x.chest, x.waist, x.waist * 1.03, x.hip, x.hip * 1.05, x.hip * 1.0], yy);
  const td = 1 + 0.15 * vp.torso.thoraxDepth;
  // Profondeur de l'ABDOMEN (taille → crête iliaque) : mesurée sur le profil de ref-04 (largeur par ligne, indépendante de l'alignement) — le canon était ≈ 20 % trop plat ; +15 % à musculature visible maximale. Le thorax (aisselle, mamelon) n'est PAS touché : il collait déjà (1,29 h contre 1,35 h) et sa bande D/L reste 0,60–0,85.
  const DM = 1 + 0.15 * f.vis;
  // RAMPE POITRINE → VENTRE (itération 06). Sur le profil de ref-04 (bandes de 1/16 du tronc, `scripts/body-refs/profile-edges.ts`) la profondeur du moteur dépassait la référence au niveau des côtes
  // (1,40–1,46 h contre 1,32) puis tombait trop tôt (1,22 h contre 1,33 à la taille) : une marche de 0,21 h là où la référence décroît de 0,11 h. `YR` allège la clé des côtes (−5 %), `RAMP` relève
  // la taille et le haut de l'abdomen (+12 %) ; les clés des hanches ne bougent pas (le fessier dépasse déjà de ≈ 0,1 h vers l'arrière, tâche restante). Balayage : docs/BODY-LEGS-3D-06.md.
  const RAMP = 1.12, YR = 0.95;
  // Rapport profondeur/largeur : divisé par le même facteur que la largeur a augmenté (0,40/0,36, 0,73/0,62, 1,0/0,9) → la PROFONDEUR du haut du tronc reste celle mesurée sur le profil de ref-04.
  const k = (yy: number): number => prof(ky, [0.65, 0.58 * (0.36 / SL.base), 0.5 * (0.62 / SL.yk), 0.46 * td * (0.9 / SL.acr), 0.7 * td, 0.74 * td, (0.9 + 0.1 * vp.torso.ribDepth) * DM * YR, 0.74 * DM * RAMP, 0.76 * DM * RAMP, 0.64 * DM, 0.7 * DM, 0.62 * DM], yy);
  const bellyAmt = Math.min(1.2, 0.55 * f.fat + 0.6 * vp.torso.belly), yb = (y.waist + y.navel) / 2 + 0.05 * tl;
  const belly = (yy: number): number => bellyAmt * x.waist * 0.42 * Math.exp(-(((yy - yb) / (0.2 * tl)) ** 2));
  // Fessier : sommet SOUS la crête iliaque (≈ niveau du grand trochanter) — avant l'itération 04 il culminait à la crête et poussait le dos 0,29 h trop en arrière dans la bande navel→crête de ref-04.
  const gl = (yy: number): number => x.hip * (0.2 + 0.1 * vp.torso.glute) * Math.exp(-(((yy - (y.navel + 0.5 * tl)) / (0.2 * tl)) ** 2));
  const s = vp.contrapposto, tiltS = s.amount * 5.5 * s.side, twist = s.amount * s.twist * 9;
  // Bassin sous le thorax : lissé de la taille à la crête (aucun effet au-dessus de la taille). Appliqué ICI, une seule fois, comme le contrapposto.
  const pel = (yy: number): number => vp.torso.pelvisShift * 0.4 * h * sm((yy - y.waist) / (y.crop - y.waist));
  /** Transformation de pose : bascule (z), décalage latéral du bassin vers la jambe porteuse, torsion (y). */
  const T = (pt: P3): P3 => {
    const u = sm((pt.y - y.base) / (y.crop - y.base)), tilt = ((tiltS * (1 - u) - tiltS * 1.15 * u) * Math.PI) / 180, yaw = ((twist * (1 - 2 * u)) * Math.PI) / 180;
    const zc = spine.z(pt.y), cz = pt.z - zc, c = Math.cos(yaw), sn = Math.sin(yaw);
    const xr = pt.x * c + cz * sn, zr = -pt.x * sn + cz * c;
    return p3(xr + s.amount * s.side * 0.035 * h * u, pt.y + xr * Math.sin(tilt), zr + zc + pel(pt.y));
  };
  const Tn = (n: P3, yy: number): P3 => { const u = sm((yy - y.base) / (y.crop - y.base)), yaw = ((twist * (1 - 2 * u)) * Math.PI) / 180; return p3(n.x * Math.cos(yaw) + n.z * Math.sin(yaw), n.y, -n.x * Math.sin(yaw) + n.z * Math.cos(yaw)); };
  const at = (yy: number): { c: P3; X: number; D: number; zb: number; zf: number } => {
    const XX = X(yy), D0 = k(yy) * XX, zs = spine.z(yy);
    // Le DOS ne reproduit pas toute la lordose : les érecteurs du rachis comblent le creux osseux (surface dorsale plus plate que l'axe vertébral, ref-04) ;
    // la cyphose (zs < 0), elle, est pleinement visible. Les angles de Cobb restent mesurés sur l'axe osseux `spine.z` (inchangé).
    const zsb = zs < 0 ? zs : FILL * zs, zb = zsb - D0 - gl(yy), zf = 0.5 * zs + D0 + belly(yy);
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
  const ys = [...new Set([...ky, y.base + 0.7 * (y.acr - y.base), (y.acr + y.axilla) / 2, (y.axilla + y.nipple) / 2, (y.nipple + y.waist) / 2, (y.waist + y.navel) / 2, (y.navel + y.crop) / 2, y.base - 0.025 * h, y.base + 0.22 * (y.acr - y.base), (y.crop + yh) / 2, (yh + crotch) / 2])].sort((p, q) => p - q);
  const ctl: Ctl[] = ys.map((yy) => { const t = at(yy); return { c: T(t.c), a: t.X, b: t.D, hint: p3(0, 0, 1) }; });
  // Fermeture du périnée : le bassin se referme en deux sections sous la fourche (les cuisses la recouvrent) — jamais de coupe ouverte.
  { const t = at(crotch); for (const [dy, ka, kb] of [[0.04, 0.62, 0.8], [0.075, 0.28, 0.5]] as const) ctl.push({ c: T(p3(0, crotch + dy * h, t.c.z)), a: t.X * ka, b: t.D * kb, hint: p3(0, 0, 1) }); }
  // Les muscles lisent `point()`, qui applique la pose (bascule des épaules, torsion) à CHAQUE point ; l'enveloppe, elle, ne déplaçait que le CENTRE de ses sections (anneaux restés horizontaux). L'épaule haute voyait donc ses muscles flotter au-dessus de la peau (jusqu'à 0,08 h), l'épaule basse les voyait s'y enfoncer : asymétrie mesurée à l'itération 05. Le repère de chaque anneau est maintenant celui de la pose, déduit de T (différences finies d'1 px).
  const poseFrames = (st: Station[]): Station[] => st.map((q) => {
    const y0 = q.c.y, z0 = spine.z(y0), P0 = T(p3(0, y0, z0)), u = norm3(sub3(T(p3(-1, y0, z0)), P0)), w0 = norm3(sub3(T(p3(0, y0, z0 + 1)), P0)), w = norm3(sub3(w0, mul3(u, dot3(w0, u))));
    return { ...q, u, w, t: cross3(u, w) };
  });
  const envelope: Volume = { id: 'trunk', name: 'tronc (cage thoracique, abdomen)', group: 'trunk', kind: 'skin', side: 'C', parent: null, level: 0, layer: 0, stations: poseFrames(loft(ctl, 3 * ctl.length)) as Station[], fibres: [], tone: 0 };
  const shoulder = (side: 1 | -1): P3 => { const t = at(f.joint.y); return T(p3(side * f.joint.x, f.joint.y, t.c.z - 0.06 * t.D)); };
  return { spine, f, at, point, shoulder, xf: T, crotchY: crotch, envelope };
}

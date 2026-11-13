import type { Vec } from '../../geometry/eye/primitives';
import type { Poly } from '../poly';
import type { NoseGeometry } from './types';
import { UNDERVIEW_MODEL, type UnderviewModel } from './underview-model';

/**
 * VUE DE DESSOUS / DE DESSUS / DE TROIS QUARTS du nez (docs/NOSE-UNDERVIEW.md).
 *
 * Ce n'est PAS un second moteur de nez : il LIT la géométrie de face existante (`noseGeometry`) et lui ajoute seulement une élévation z
 * (px, vers l'observateur) par région, puis projette selon un tangage (rotation autour de x) et un lacet (autour de y).
 *   z = 0              plan du visage (columelle / sous-nez, comme `noseProfile`)
 *   z = projectionPx   sommet de la pointe (valeur du profil existant)
 * Les autres z sont des FRACTIONS de la projection (`UnderviewModel`), ajustées sur les mesures de `references/nez/04.jpg`
 * (`scripts/nose-refs/fit-underview.ts`) : ce sont des constantes calibrées, pas des lectures à l'œil.
 *
 * Conventions : x à droite, y vers le BAS (repère image), z vers l'observateur. Tangage > 0 = caméra SOUS le nez (on voit la base :
 * la pointe, la plus avancée, monte à l'écran, le sous-nez descend) ; tangage < 0 = vue de dessus. Pivot = (0, baseY, 0).
 */
export interface Vec3 { readonly x: number; readonly y: number; readonly z: number }

export interface NoseEllipse { readonly c: Vec; readonly major: number; readonly minor: number; readonly angleDeg: number; readonly extentW: number; readonly extentH: number; readonly axisRatio: number }
export interface NoseTriangle { readonly baseL: Vec; readonly baseR: Vec; readonly apex: Vec }
/**
 * Mêmes grandeurs que `frame` de `scripts/nose-refs/extract_04.py` : le triangle exprimé dans le repère PROPRE de l'ellipse (u = grand axe, v = petit axe),
 * donc INVARIANT au roulis dans le plan. `valid` est faux quand le grand axe est à plus de 45° de l'horizontale ou quand l'ellipse est quasi ronde
 * (rapport d'axes > 0,85) : même règle que la mesure, pour ne comparer que ce qui est comparable.
 */
export interface NoseFrameMetrics { readonly valid: boolean; readonly rollDeg: number; readonly baseWidthOverMajor: number; readonly heightOverMinor: number; readonly baseVRelCentre: number; readonly apexBelowBottom: number; readonly apexUOverMajor: number }
export interface NoseTriangleMetrics { readonly baseWidthOverEllipseW: number; readonly heightOverEllipseH: number; readonly baseYRelEllipseCentre: number; readonly apexBelowEllipseBottom: number }

export interface NoseView {
  readonly pitchDeg: number;
  readonly yawDeg: number;
  /** Enveloppe lobule + ailes : enveloppe convexe des deux volumes projetés (le lobule FERME la silhouette du bas). */
  readonly envelope: Poly;
  readonly ellipse: NoseEllipse;
  readonly lobule: Poly;
  readonly alae: { readonly left: Poly; readonly right: Poly };
  readonly nostrils: { readonly left: Poly; readonly right: Poly };
  /** Visibilité des narines (0–1) : elles s'ouvrent VERS LE BAS, donc invisibles d'en haut (tangage ≤ −10°), pleinement visibles dès +20°. Le rendu la lit comme opacité. */
  readonly nostrilVisibility: number;
  /** Triangle de la base des narines : extrémités externes des deux narines et sous-nez (columelle). */
  readonly triangle: NoseTriangle;
  readonly triangleMetrics: NoseTriangleMetrics;
  /** Triangle dans le repère propre de l'ellipse (roulis compensé) : ce que la calibration compare à la référence. */
  readonly frame: NoseFrameMetrics;
  /** Roulis dans le plan appliqué à la vue (degrés, > 0 = sens horaire à l'écran), pivot (0, baseY). */
  readonly rollDeg: number;
  /** Point de la pointe projeté (centre du lobule). */
  readonly tip: Vec;
}

const rad = (d: number): number => (d * Math.PI) / 180;
const smooth01 = (t: number): number => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u); };

/** z (px) du dôme du lobule en (x, y) : `projectionPx` au centre, `lobuleRim` × projection au bord (rayon elliptique normalisé r ∈ [0, 1]). */
export function lobuleZ(nose: NoseGeometry, m: UnderviewModel, x: number, y: number): number {
  const { c, rx, ry, projectionPx } = nose.tip;
  const r = Math.min(1, Math.hypot((x - c.x) / rx, (y - c.y) / ry));
  return projectionPx * (m.lobuleRim + (1 - m.lobuleRim) * (1 - r * r));
}
/** z (px) de l'aile en hauteur y : de `alarTop` (jonction avec le lobule) à `alarBase` (attache sur la joue). */
export function alaZ(nose: NoseGeometry, side: -1 | 1, m: UnderviewModel, y: number): number {
  const a = side === 1 ? nose.alae.right : nose.alae.left, yTop = nose.tip.c.y, yFoot = a.base.y, P = nose.tip.projectionPx;
  const t = smooth01((y - yTop) / Math.max(1e-6, yFoot - yTop));
  return P * (m.alarTop + (m.alarBase - m.alarTop) * t);
}
/** Élévation z de chaque point d'un polygone du nez, selon la région (voir l'en-tête du fichier). */
function liftLobule(nose: NoseGeometry, m: UnderviewModel): Vec3[] { return nose.tip.poly.map((q) => ({ x: q.x, y: q.y, z: lobuleZ(nose, m, q.x, q.y) })); }
function liftAla(nose: NoseGeometry, side: -1 | 1, m: UnderviewModel): Vec3[] {
  const a = side === 1 ? nose.alae.right : nose.alae.left;
  return a.poly.map((q) => ({ x: q.x, y: q.y, z: alaZ(nose, side, m, q.y) }));
}

/** Rotation tangage + lacet autour du pivot (0, baseY) : x, y image ET z' = profondeur vers l'observateur après rotation (pour la carte de profondeur). */
export function rotateProject3(p: Vec3, pivotY: number, pitchDeg: number, yawDeg: number, rollDeg = 0): Vec3 {
  const cy = Math.cos(rad(yawDeg)), sy = Math.sin(rad(yawDeg)), cp = Math.cos(rad(pitchDeg)), sp = Math.sin(rad(pitchDeg));
  const x1 = p.x * cy + p.z * sy, z1 = -p.x * sy + p.z * cy, dy = p.y - pivotY;
  const px = x1, py = dy * cp - z1 * sp, pz = dy * sp + z1 * cp;
  if (rollDeg === 0) return { x: px, y: pivotY + py, z: pz };
  const cr = Math.cos(rad(rollDeg)), sr = Math.sin(rad(rollDeg));
  return { x: px * cr - py * sr, y: pivotY + px * sr + py * cr, z: pz };
}
function rotateProject(p: Vec3, pivotY: number, pitchDeg: number, yawDeg: number, rollDeg = 0): Vec { const q = rotateProject3(p, pivotY, pitchDeg, yawDeg, rollDeg); return { x: q.x, y: q.y }; }

/** Enveloppe convexe (chaîne monotone d'Andrew), sens horaire en repère image. */
export function convexHull(pts: readonly Vec[]): Poly {
  const s = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Vec, a: Vec, b: Vec): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: Vec[] = [];
  for (const p of s) { while (lo.length >= 2 && cross(lo[lo.length - 2]!, lo[lo.length - 1]!, p) <= 0) lo.pop(); lo.push(p); }
  const up: Vec[] = [];
  for (const p of [...s].reverse()) { while (up.length >= 2 && cross(up[up.length - 2]!, up[up.length - 1]!, p) <= 0) up.pop(); up.push(p); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

/**
 * Ellipse équivalente d'un polygone convexe par ses MOMENTS D'AIRE (exact pour une ellipse pleine : variance = demi-axe² / 4).
 * Ce n'est pas le même estimateur que `cv2.fitEllipse` (moindres carrés sur les traits) utilisé pour mesurer la référence ;
 * l'écart est de l'ordre de quelques % sur une forme quasi elliptique et il est documenté (docs/NOSE-UNDERVIEW.md).
 */
export function equivalentEllipse(poly: Poly): NoseEllipse {
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) { const u = poly[i]!, v = poly[(i + 1) % poly.length]!, k = u.x * v.y - v.x * u.y; A += k; cx += (u.x + v.x) * k; cy += (u.y + v.y) * k; }
  A /= 2; cx /= 6 * A; cy /= 6 * A;
  let ixx = 0, iyy = 0, ixy = 0;
  for (let i = 0; i < poly.length; i++) {
    const u = poly[i]!, v = poly[(i + 1) % poly.length]!, k = u.x * v.y - v.x * u.y;
    const ax = u.x - cx, ay = u.y - cy, bx = v.x - cx, by = v.y - cy;
    ixx += k * (ax * ax + ax * bx + bx * bx); iyy += k * (ay * ay + ay * by + by * by); ixy += k * (ax * by + 2 * ax * ay + 2 * bx * by + bx * ay);
  }
  const sA = Math.abs(A);
  const sxx = Math.abs(ixx / 12) / sA, syy = Math.abs(iyy / 12) / sA, sxy = (ixy / 24) / A;
  const tr = sxx + syy, det = Math.sqrt(Math.max(0, ((sxx - syy) / 2) ** 2 + sxy * sxy));
  const l1 = tr / 2 + det, l2 = Math.max(1e-12, tr / 2 - det);
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const major = 4 * Math.sqrt(l1), minor = 4 * Math.sqrt(l2);   // axes COMPLETS : 2 × (2√λ)
  const t = ang, ex = Math.hypot((major / 2) * Math.cos(t), (minor / 2) * Math.sin(t)), ey = Math.hypot((major / 2) * Math.sin(t), (minor / 2) * Math.cos(t));
  return { c: { x: cx, y: cy }, major, minor, angleDeg: (ang * 180) / Math.PI, extentW: 2 * ex, extentH: 2 * ey, axisRatio: minor / major };
}

/** Mêmes quatre rapports que `scripts/nose-refs/extract_04.py`, calculés sur le moteur. */
export function triangleMetrics(tri: NoseTriangle, e: NoseEllipse): NoseTriangleMetrics {
  const bmx = (tri.baseL.x + tri.baseR.x) / 2, bmy = (tri.baseL.y + tri.baseR.y) / 2;
  void bmx;
  return {
    baseWidthOverEllipseW: Math.hypot(tri.baseR.x - tri.baseL.x, tri.baseR.y - tri.baseL.y) / e.extentW,
    heightOverEllipseH: (tri.apex.y - bmy) / e.extentH,
    baseYRelEllipseCentre: (bmy - e.c.y) / e.extentH,
    apexBelowEllipseBottom: (tri.apex.y - (e.c.y + e.extentH / 2)) / e.extentH,
  };
}

/** Triangle dans le repère propre de l'ellipse (voir `NoseFrameMetrics`). Même formules que `extract_04.py`. */
export function frameMetrics(tri: NoseTriangle, e: NoseEllipse): NoseFrameMetrics {
  const phi = rad(e.angleDeg), c = Math.cos(phi), sn = Math.sin(phi);
  const toFrame = (q: Vec): { u: number; v: number } => { const dx = q.x - e.c.x, dy = q.y - e.c.y; return { u: dx * c + dy * sn, v: -dx * sn + dy * c }; };
  const b0 = toFrame(tri.baseL), b1 = toFrame(tri.baseR), a = toFrame(tri.apex), bv = (b0.v + b1.v) / 2;
  return {
    valid: Math.abs(e.angleDeg) <= 45 && e.minor / e.major <= 0.85, rollDeg: e.angleDeg,
    baseWidthOverMajor: Math.abs(b1.u - b0.u) / e.major, heightOverMinor: (a.v - bv) / e.minor, baseVRelCentre: bv / e.minor,
    apexBelowBottom: (a.v - e.minor / 2) / e.minor, apexUOverMajor: a.u / e.major,
  };
}

/** Vue projetée du nez. Pure et déterministe : mêmes entrées → mêmes sommets. `model` n'est surchargé que par l'ajustement. */
export function noseView(nose: NoseGeometry, pitchDeg: number, yawDeg = 0, model: UnderviewModel = UNDERVIEW_MODEL, rollDeg = 0): NoseView {
  const pv = nose.baseY, P = nose.tip.projectionPx;
  const proj = (pts: readonly Vec3[]): Poly => pts.map((q) => rotateProject(q, pv, pitchDeg, yawDeg, rollDeg));
  const lobule = proj(liftLobule(nose, model));
  const left = proj(liftAla(nose, -1, model)), right = proj(liftAla(nose, 1, model));
  const lift2 = (poly: readonly Vec[], z: number): Poly => poly.map((q) => rotateProject({ x: q.x, y: q.y, z }, pv, pitchDeg, yawDeg, rollDeg));
  const nostrils = { left: lift2(nose.nostrils.left.poly, P * model.nostril), right: lift2(nose.nostrils.right.poly, P * model.nostril) };
  const envelope = convexHull([...lobule, ...left, ...right]);
  const ellipse = equivalentEllipse(envelope);
  // Triangle de la réf. 04 = « base des narines, sommet = columelle » : les deux sommets de base sont les extrémités EXTERNES des narines
  // (pas les pieds d'aile, qui sont plus écartés), le sommet est le sous-nez (columelle au niveau de la lèvre, z = 0).
  const outer = (poly: readonly Vec[], side: -1 | 1): Vec => poly.reduce((b, q) => (side * q.x > side * b.x ? q : b), poly[0]!);
  const oL = outer(nose.nostrils.left.poly, -1), oR = outer(nose.nostrils.right.poly, 1);
  const tri: NoseTriangle = {
    baseL: rotateProject({ x: oL.x, y: oL.y, z: P * model.nostril }, pv, pitchDeg, yawDeg, rollDeg),
    baseR: rotateProject({ x: oR.x, y: oR.y, z: P * model.nostril }, pv, pitchDeg, yawDeg, rollDeg),
    apex: rotateProject({ x: 0, y: nose.columella.bottomY, z: 0 }, pv, pitchDeg, yawDeg, rollDeg),
  };
  return {
    pitchDeg, yawDeg, rollDeg, envelope, ellipse, lobule, alae: { left, right }, nostrils, nostrilVisibility: smooth01((pitchDeg + 10) / 30), triangle: tri, triangleMetrics: triangleMetrics(tri, ellipse), frame: frameMetrics(tri, ellipse),
    tip: rotateProject({ x: nose.tip.c.x, y: nose.tip.c.y, z: P }, pv, pitchDeg, yawDeg, rollDeg),
  };
}

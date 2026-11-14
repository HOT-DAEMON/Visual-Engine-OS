import { neckSection } from './engines/neck3d';
import { headRelief } from './engines/head-relief';
import { gridMesh, PART, skullSurfacePoint, type Mesh, type SkullRelief } from './mesh';
import { clamp, smooth, v3 } from './math';
import { regionField, signedDistance } from './hair-region';
import { hairlineY, sectionAt } from './sections';
import { hemY } from './hair-hash';
import type { HairVolume } from './hair-volume-types';
import type { HeadTurnSpec, V3 } from './types';

/** Épaisseur minimale de la coque au-dessus du crâne (U), MESURÉE dans le plan horizontal le long du déplacement : jamais coplanaire (pas de z-fighting), jamais un trou, même devant où la profondeur est réduite (`kz` < 1). */
export const T_MIN = 0.008;
/** Épaisseur minimale des cheveux pendants au-dessus du cou et de la cloche des trapèzes (U) : plus que `T_MIN`, car le cou en cloche est plus large que la section ellipse et le crève sinon. */
export const T_HANG = 0.03;
/** Distance à la lisière (U, sur la surface) sur laquelle l'épaisseur passe de `T_MIN` à sa valeur pleine : les racines sortent du crâne, elles n'en sont pas un couvercle. Doit rester ≤ à la saturation du champ de distance (0,05). */
export const RAMP = 0.045;
/** Devant, la masse monte SUR le front depuis l'implantation : l'épaisseur croît avec la hauteur au-dessus de la lisière (U) au lieu d'un rebord plein (une visière à 60° – 120°). Poids = 0 sur les côtés et la nuque. */
export const RAMP_FRONT = 0.24;
/** Au-delà de cette hauteur, la section n'est plus celle du crâne (la table s'arrête au menton) mais une ellipse qui rejoint le cou : cheveux pendants. */
export const Y_SKULL_END = 1.0;
/** Le rideau naît à cette hauteur au-dessus de la nuque (U) : il recouvre la poche de peau derrière l'oreille que la lisière laisse nue (cheveux longs : l'arrière de l'oreille est caché). */
export const HANG_UP = 0.2;
const DEG = 180 / Math.PI, K = 96;

interface Ell { readonly a: number; readonly b: number; readonly zc: number }

/** Section du cou à la hauteur y (U) : moteur de cou pour une tête issue d'un visage, cylindre mesuré pour la planche. */
function neckAt(spec: HeadTurnSpec, y: number): Ell {
  const n = spec.neck;
  return spec.engine ? neckSection(spec.engine, y, n.y1) : { a: n.a, b: n.b, zc: n.zc };
}

/** Ellipse de la coque sous le crâne : fondu C¹ de la dernière section du crâne vers le cou, sur 0,2 U (ou sur 0,25 U de plus que le dessous du menton). */
export function ellipseBelow(spec: HeadTurnSpec, y: number): Ell {
  const s = sectionAt(spec, Y_SKULL_END), t = smooth((y - Y_SKULL_END) / 0.2), nk = neckAt(spec, y);
  return { a: s.a + (nk.a - s.a) * t, b: s.b + (nk.b - s.b) * t, zc: s.zc + (nk.zc - s.zc) * t };
}

/** Ordonnée z du centre de la section de la coque (repère tête) : même formule pour le maillage, la découpe et la peinture. */
export const hairCenterZ = (spec: HeadTurnSpec, y: number): number => (y <= Y_SKULL_END ? sectionAt(spec, Math.max(y, spec.rows[0]!.y)).zc : ellipseBelow(spec, y).zc);

/** Azimut (degrés ; 0 = face, +90 = côté +x) d'un point de la coque : le même repère que la région de lisière (`hair-region.ts`). */
export const hairAzimuth = (spec: HeadTurnSpec, p: V3): number => Math.atan2(p.x, p.z - hairCenterZ(spec, p.y)) * DEG;

/** Le point (azimut, hauteur) porte-t-il des cheveux ? Sommet : toujours ; ailleurs : dans la région de lisière ; rideau des cheveux pendants : sous la nuque, hors de l'ouverture avant. */
export function inHair(spec: HeadTurnSpec, vol: HairVolume, az: number, y: number, tol = 0): boolean {
  if (y <= spec.rows[0]!.y + 1e-6) return true;
  const R = spec.hairline.region, inside = R ? signedDistance(regionField(R), az, y) > -tol : y < hairlineY(spec, az) + tol;
  const h = vol.hang;
  return inside || (!!h && y >= h.y0 - HANG_UP && y <= hemY(vol.texture, vol.seed & 0xffff, h.yEnd, az) && Math.abs(az) >= h.az0);
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Épaisseur du rideau (0 … 1) : nulle au bord avant (le rideau naît contre la tempe, pas une coupe verticale), pleine 24° derrière ; l'ourlet se resserre (au moins 25 %) sur les 0,12 U du bas.
 * Verticalement : là où la région de lisière couvre déjà la nuque à cet azimut (dos de la tête), le rideau CONTINUE la coque de la tête (pas de rainure à la lisière de la nuque) ;
 * ailleurs (sous l'oreille, sur le côté) il naît à `y0 − 0,06` et croît sur 0,12 U : pas de rebord.
 */
export function hangRamp(spec: HeadTurnSpec, vol: HairVolume, az: number, y: number): number {
  const h = vol.hang;
  const yEnd = h ? hemY(vol.texture, vol.seed & 0xffff, h.yEnd, az) : 0;
  if (!h || y > yEnd + 1e-6 || Math.abs(az) < h.az0) return 0;
  const R = spec.hairline.region, covered = R ? signedDistance(regionField(R), az, h.y0 - 0.1) > 0.02 : false;
  return smooth((Math.abs(az) - h.az0) / 24) * (covered ? 1 : smooth((y - (h.y0 - HANG_UP)) / (HANG_UP + 0.06))) * (0.25 + 0.75 * smooth((yEnd - y) / 0.12));
}

/** Interpolation d'une colonne de la volumétrie à la hauteur y (rangées régulières). */
function colAt(vol: HairVolume, col: readonly number[], y: number): number {
  const ys = vol.ys, n = ys.length;
  if (y <= ys[0]!) return col[0]!;
  if (y >= ys[n - 1]!) return col[n - 1]!;
  const f = (y - ys[0]!) / (ys[n - 1]! - ys[0]!) * (n - 1), i = Math.min(n - 2, Math.floor(f));
  return lerp(col[i]!, col[i + 1]!, f - i);
}

/**
 * Cheveux pendants : la masse passe PAR-DESSUS le cou et les trapèzes. Le cou (cloche des trapèzes, nuque qui déborde du crâne) est plus large que la section du crâne ou que l'ellipse
 * de la coque ; sans cette garde il perce les cheveux (fenêtre de peau dans le dos). Le point est repoussé, dans sa direction horizontale, jusqu'à `T_HANG` au-delà de la surface du cou.
 */
function clearNeck(spec: HeadTurnSpec, vol: HairVolume, p: V3, sn: number, cs: number, zc: number): V3 {
  if (!vol.hang || p.y < vol.hang.y0 - HANG_UP) return p;
  const nk = neckAt(spec, p.y), psi = Math.atan2(sn / nk.a, cs / nk.b), qx = nk.a * Math.sin(psi), qz = nk.zc + nk.b * Math.cos(psi);
  const need = qx * sn + (qz - zc) * cs + T_HANG, have = p.x * sn + (p.z - zc) * cs;
  return have >= need ? p : v3(p.x + (need - have) * sn, p.y, p.z + (need - have) * cs);
}

/** Point de la coque à la hauteur y et à l'angle th (radians ; 0 = face, +π/2 = côté +x). Épaisseur latérale d = demi-largeur de la silhouette − demi-largeur du crâne (au moins `T_MIN`), progressive à la lisière. */
export function shellPoint(spec: HeadTurnSpec, vol: HairVolume, y: number, th: number, relief: SkullRelief = headRelief(spec.engine)): V3 {
  const sn = Math.sin(th), cs = Math.cos(th), rx = lerp(colAt(vol, vol.rL, y), colAt(vol, vol.rR, y), (1 + sn) / 2), kz = cs >= 0 ? vol.kzF : vol.kzB;
  const top = spec.rows[0]!.y;
  let ramp = 1;
  if (y > top) {
    const az = th * DEG, R = spec.hairline.region;
    const sd = R ? signedDistance(regionField(R), az, y) : (hairlineY(spec, az) - y) * 0.5;
    ramp = smooth(sd / RAMP);
    const frontW = smooth((cs - 0.15) / 0.55);
    if (frontW > 0) ramp *= 1 - frontW + frontW * smooth((hairlineY(spec, Math.abs(az)) - y) / RAMP_FRONT);
    if (vol.hang) ramp = Math.max(ramp, hangRamp(spec, vol, az, y));
  }
  if (y > Y_SKULL_END) {
    const e = ellipseBelow(spec, y), dMin = T_MIN / Math.hypot(sn, kz * cs), d = lerp(dMin, Math.max(dMin, rx - e.a), ramp);
    return clearNeck(spec, vol, v3((e.a + d) * sn, y, e.zc + (e.b + kz * d) * cs), sn, cs, e.zc);
  }
  const s = sectionAt(spec, Math.max(y, top)), above = y < top, a = above ? 0 : s.a, q = above ? { x: 0, z: s.zc } : skullSurfacePoint(spec, relief, y, th), dMin = T_MIN / Math.hypot(sn, kz * cs), d = lerp(dMin, Math.max(dMin, rx - a), ramp);
  return clearNeck(spec, vol, v3(q.x + d * sn, y, q.z + kz * d * cs), sn, cs, s.zc);
}
/**
 * COQUE DE CHEVEUX : une grille (hauteur × azimut) de la surface du crâne gonflée de l'épaisseur de la coiffure, découpée à la lisière par `clip` (test évalué par le rastériseur sur la
 * position 3D interpolée de chaque pixel). Rastérisée avec les autres pièces de la tête : MÊME rotation, MÊME tampon de profondeur (les oreilles, le nez et la mâchoire restent devant ou
 * derrière les cheveux selon la profondeur réelle). La couture de la grille est derrière la tête (θ = ±π) ; le dessin des mèches se calcule par pixel, il n'a aucune couture.
 */
export function hairShellMesh(spec: HeadTurnSpec, vol: HairVolume): Mesh {
  const ths = Array.from({ length: K }, (_, j) => -Math.PI + (2 * Math.PI * j) / K);
  const relief = headRelief(spec.engine), rows = vol.ys.map((y) => ths.map((th) => shellPoint(spec, vol, y, th, relief)));
  const m = gridMesh(PART.hair, rows, true, (i) => { const y = vol.ys[i]!; return v3(0, y, hairCenterZ(spec, y)); });
  return { ...m, clip: (p: V3) => inHair(spec, vol, hairAzimuth(spec, p), clamp(p.y, spec.rows[0]!.y, 9), 0.0015) };
}

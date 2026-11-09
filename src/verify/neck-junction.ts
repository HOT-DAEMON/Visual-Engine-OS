import { frontSilhouette } from '../neck/geometry';
import { neckModelFor } from '../neck';
import { hostFace } from '../render/face';
import type { Raster } from '../regression/png';
import type { HostSpec } from '../schema';
import { check, type Check } from './types';

/**
 * VÉRIFICATION DU RENDU FINAL du raccord tête → cou → torse, mesurée sur l'IMAGE de la scène (tête + cou + corps assemblés) et non sur la donnée.
 * Pure : elle reçoit le raster déjà produit (le test ou le script le fournit), comme `verifyPixels`. Trois couches, toutes chiffrées :
 *  - geometry : la silhouette PEINTE coïncide avec la silhouette MODÉLISÉE du cou (dedans : de la peau ; dehors : le fond, en `warn` car des cheveux peuvent s'y trouver) ;
 *  - anatomy  : la colonne médiane est continue du menton à sous la base du cou : aucun trou de fond entre la tête et le torse ;
 *  - style    : même teinte de peau de part et d'autre de la base du cou (erreur au-delà de 14°) ; marche de luminance à la base mesurée (`warn`).
 * Le visage porte un roulis : toutes les positions passent par la transformation de l'hôte (translation, rotation, échelle).
 */
export interface JunctionRenderOpts { readonly background: readonly [number, number, number] }

const bgDist = (img: Raster, x: number, y: number, bg: readonly number[]): number => {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return 0;
  const k = (Math.round(y) * img.width + Math.round(x)) * 4;
  return Math.abs(img.data[k]! - bg[0]!) + Math.abs(img.data[k + 1]! - bg[1]!) + Math.abs(img.data[k + 2]! - bg[2]!);
};
const rgbAt = (img: Raster, x: number, y: number): [number, number, number] => { const k = (Math.round(y) * img.width + Math.round(x)) * 4; return [img.data[k]!, img.data[k + 1]!, img.data[k + 2]!]; };
const lum = (c: readonly number[]): number => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
function hueDeg([r, g, b]: readonly number[]): number {
  const mx = Math.max(r!, g!, b!), mn = Math.min(r!, g!, b!), d = mx - mn;
  if (d === 0) return 0;
  const h = mx === r ? ((g! - b!) / d) % 6 : mx === g ? (b! - r!) / d + 2 : (r! - g!) / d + 4;
  return (h * 60 + 360) % 360;
}
const hueGap = (a: number, b: number): number => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

export function checkNeckJunctionRender(host: HostSpec, img: Raster, o: JunctionRenderOpts): Check[] {
  const { params, lm } = hostFace(host), model = neckModelFor(params, lm), S = model.stations, sil = frontSilhouette(model);
  const T = host.transform, th = (T.rotationDeg * Math.PI) / 180, c = Math.cos(th), s = Math.sin(th);
  const px = (x: number, y: number): { x: number; y: number } => ({ x: T.x + T.scale * (x * c - y * s), y: T.y + T.scale * (x * s + y * c) });
  const out: Check[] = [], H = lm.H, last = S.length - 1;
  const chin = lm.chinY, base = lm.neck.bottomY;
  // Stations visibles : sous le menton (le haut du cou est sous la tête) et au-dessus du haut du torse (base − 0,05 H) où seul le cou existe.
  const idx = S.map((_, i) => i).filter((i) => S[i]!.y > chin + 0.3 * (base - chin) && S[i]!.y < base - 0.07 * H);
  const pick = idx.length <= 5 ? idx : [0, 1, 2, 3, 4].map((k) => idx[Math.round((k * (idx.length - 1)) / 4)]!);
  let paintedMiss = 0, paintedTotal = 0, outsideSkin = 0, outsideTotal = 0;
  for (const i of pick) {
    const y = S[i]!.y, L = sil.left[i]!, R = sil.right[i]!, pl = px(L.x + 3, y), pr = px(R.x - 3, y), ql = px(L.x - 5, y), qr = px(R.x + 5, y), pm = px((L.x + R.x) / 2, y);
    for (const p of [pl, pr, pm]) { paintedTotal++; if (bgDist(img, p.x, p.y, o.background) <= 12) paintedMiss++; }
    for (const q of [ql, qr]) { outsideTotal++; if (bgDist(img, q.x, q.y, o.background) > 12) outsideSkin++; }
  }
  out.push(check('geometry', 'neck.render.painted-inside-silhouette', '<=', paintedMiss, 0, `${paintedMiss} / ${paintedTotal} échantillons À L'INTÉRIEUR du contour modélisé sont du fond : le cou n'est pas peint là où le modèle le place`));
  out.push(check('geometry', 'neck.render.nothing-outside-silhouette', '<=', outsideSkin, 0, `${outsideSkin} / ${outsideTotal} échantillons À L'EXTÉRIEUR du contour (5 unités) ne sont pas du fond : peau qui déborde, ou cheveux/épaule (avertissement)`, 'warn'));

  // Colonne médiane : du menton à 0,04 H sous la base, jamais de fond.
  const top = px(S[0]!.x, chin).y, bot = px(S[last]!.x, base + 0.04 * H).y, mid = (y: number): number => { const t = (y - top) / (bot - top); return px(S[Math.min(last, Math.max(0, Math.round(t * last)))]!.x, 0).x; };
  let gaps = 0, rows = 0;
  for (let y = Math.round(top) + 2; y < bot; y++) { rows++; if (bgDist(img, mid(y), y, o.background) <= 12) gaps++; }
  out.push(check('anatomy', 'neck.render.midline-continuous', '<=', gaps, 0, `${gaps} / ${rows} rangées de la colonne médiane (menton → sous la base) sont du fond : trou entre la tête et le torse`));

  // Teinte et marche de luminance de part et d'autre de la base du cou (zone centrale ±30 % de la demi-largeur de base).
  const bh = (S[last]!.aL + S[last]!.aR) / 2, pb = px(S[last]!.x, base), above: number[][] = [], below: number[][] = [];
  for (let dx = -0.3 * bh * T.scale; dx <= 0.3 * bh * T.scale; dx += 1) {
    for (let dy = 2; dy <= 6; dy++) { above.push(rgbAt(img, pb.x + dx, pb.y - dy)); below.push(rgbAt(img, pb.x + dx, pb.y + dy)); }
  }
  const mean = (a: number[][]): number[] => [0, 1, 2].map((k) => a.reduce((t, v) => t + v[k]!, 0) / a.length);
  const A = mean(above), B = mean(below), gap = hueGap(hueDeg(A), hueDeg(B)), step = Math.abs(lum(A) - lum(B));
  out.push(check('style', 'neck.render.skin-hue-continuity', '<=', gap, 14, `teinte de la peau au-dessus (${hueDeg(A).toFixed(1)}°) et au-dessous (${hueDeg(B).toFixed(1)}°) de la base du cou : écart ${gap.toFixed(1)}°`));
  out.push(check('style', 'neck.render.seam-luminance-step', '<=', step, 12, `marche de luminance à la base du cou : ${step.toFixed(1)} / 255 (couture visible au-delà de la limite)`, 'warn'));
  return out;
}

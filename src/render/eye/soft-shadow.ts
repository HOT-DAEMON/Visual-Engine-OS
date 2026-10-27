import { el, num, urlRef } from '../../core/svg';
import type { Vec } from '../../geometry/eye';

/**
 * Ombre douce SANS filtre. Un flou gaussien SVG (`feGaussianBlur`) sur une grande région est le poste dominant du rendu d'un œil : mesuré à
 * ≈ 360 ms sur 504 ms (rastérisation 1024 × 768, resvg) — tout le reste (cils, sourcil, fibres, dégradés) ne pèse que ≈ 25 ms.
 *
 * Remplacement : la zone d'ombre est « extérieur de l'ouverture décalée » (remplissage plat à `alpha`) ; le bord intérieur est adouci par un
 * EMPILEMENT de traits centrés sur le contour décalé et clippés à son intérieur. Les opacités sont CALCULÉES pour que l'alpha cumulé, à
 * chaque distance d du bord, suive le profil gaussien : alpha(d) = 2 · alpha · (1 − Φ(d / σ)) (continu avec le remplissage en d = 0).
 * Équivalence mesurée contre le flou de référence : voir tests/eye-perf.test.ts (écart moyen de luminance borné).
 */

/** Fonction de répartition de la loi normale centrée réduite (Abramowitz & Stegun 7.1.26, erreur < 1,5e-7). */
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** Demi-largeurs (en σ) des traits de l'empilement, croissantes. 2,6 σ couvre 99,5 % du profil. */
export const SHADOW_BANDS = [0.2, 0.5, 0.85, 1.25, 1.7, 2.2, 2.7] as const;

/**
 * Opacités des traits : `(1 − α_k) = (1 − C_k) / (1 − C_{k+1})` avec C_k = alpha cumulé voulu au milieu de la bande k et C_{N+1} = 0.
 * Garantit (testé) que l'alpha composé reproduit le profil gaussien aux milieux de bandes et décroît strictement vers l'intérieur.
 */
export function shadowStrokeAlphas(alpha: number): number[] {
  const n = SHADOW_BANDS.length;
  const target = (d: number): number => Math.min(0.999, 2 * alpha * (1 - normalCdf(d)));
  const mids = SHADOW_BANDS.map((b, k) => (b + (k === 0 ? 0 : (SHADOW_BANDS[k - 1] as number))) / 2);
  const out = new Array<number>(n).fill(0);
  let next = 0;
  for (let k = n - 1; k >= 0; k--) {
    const c = Math.max(next, Math.min(0.999, target(mids[k] as number)));
    out[k] = 1 - (1 - c) / (1 - next);
    next = c;
  }
  return out;
}

export interface SoftShadow { readonly defs: string[]; readonly markup: string[]; }

/** Polygone fermé dilaté de `e` le long de normales moyennées (`e` > 0 : vers l'extérieur ; l'orientation est détectée par l'aire signée). */
export function offsetClosed(pts: readonly Vec[], e: number): Vec[] {
  const n = pts.length;
  const area2 = pts.reduce((s, p, i) => { const q = pts[(i + 1) % n] as Vec; return s + (p.x * q.y - q.x * p.y); }, 0);
  const sign = area2 >= 0 ? 1 : -1; // > 0 : orienté « sens horaire visuel » en y vers le bas
  return pts.map((p, i) => {
    const a = pts[(i + n - 1) % n] as Vec;
    const c = pts[(i + 1) % n] as Vec;
    const tx = c.x - a.x;
    const ty = c.y - a.y;
    const len = Math.hypot(tx, ty) || 1;
    return { x: p.x + (sign * ty / len) * e, y: p.y - (sign * tx / len) * e };
  });
}

const polyPath = (pts: readonly Vec[]): string => `M${pts.map((p) => `${num(p.x)} ${num(p.y)}`).join('L')}Z`;

/**
 * Opacités de la RAMPE EXTÉRIEURE : remplissages « extérieur du polygone dilaté de e_k » (e_0 = 0, puis les bandes), alpha cumulé voulu
 * à la distance x en dehors du bord : alpha · Φ(x / σ) (de alpha/2 au bord à alpha loin). Dernier remplissage au-delà de 2,7 σ : alpha.
 */
export function outsideRampAlphas(alpha: number): number[] {
  const edges = [0, ...SHADOW_BANDS];
  const out: number[] = [];
  let prev = 0;
  for (let k = 0; k < edges.length; k++) {
    const mid = k + 1 < edges.length ? ((edges[k] as number) + (edges[k + 1] as number)) / 2 : (edges[k] as number) + 0.5;
    const c = Math.max(prev, Math.min(0.999, alpha * normalCdf(mid)));
    out.push(1 - (1 - c) / (1 - prev));
    prev = c;
  }
  return out;
}

/**
 * @param poly contour échantillonné de l'ouverture décalée (repère de l'œil) ; @param rect rectangle extérieur couvrant (x, y, w, h).
 * Profil total : alpha · (1 − Φ(d / σ)) avec d = distance signée vers l'intérieur du contour : continu (alpha / 2 au bord), sans filtre.
 */
export function softShadow(id: string, poly: readonly Vec[], rect: { x: number; y: number; w: number; h: number }, sigma: number, color: string, alpha: number): SoftShadow {
  const cid = `${id}-lidclip`;
  const outer = `M${num(rect.x)} ${num(rect.y)}H${num(rect.x + rect.w)}V${num(rect.y + rect.h)}H${num(rect.x)}Z`;
  const inAlphas = shadowStrokeAlphas(alpha / 2);
  const closed = polyPath(poly);
  const markup: string[] = [];
  const outAlphas = outsideRampAlphas(alpha);
  [0, ...SHADOW_BANDS].forEach((b, k) => markup.push(el('path', { d: outer + polyPath(b === 0 ? poly : offsetClosed(poly, b * sigma)), 'fill-rule': 'evenodd', fill: color, 'fill-opacity': outAlphas[k] as number })));
  const strokes = SHADOW_BANDS.map((b, k) => el('path', { d: closed, fill: 'none', stroke: color, 'stroke-width': 2 * b * sigma, 'stroke-opacity': inAlphas[k] as number, 'stroke-linejoin': 'round' }));
  markup.push(el('g', { 'clip-path': urlRef(cid) }, strokes));
  return { defs: [el('clipPath', { id: cid }, [el('path', { d: closed })])], markup };
}

/**
 * Trait doux SANS filtre : un trait de largeur `w0` dont les bords sont adoucis sur ≈ 2,7 σ de part et d'autre, par empilement de traits plus larges
 * à opacités calculées (même profil gaussien que `shadowStrokeAlphas`). Remplace `feGaussianBlur` sur les lignes fines (occlusion, ménisque).
 */
export function softLine(d: string, w0: number, sigma: number, color: string, alpha: number, extra: Record<string, string | number> = {}): string[] {
  const alphas = shadowStrokeAlphas(alpha / 2);
  return SHADOW_BANDS.map((b, k) => el('path', { d, fill: 'none', stroke: color, 'stroke-width': w0 + 2 * b * sigma, 'stroke-opacity': alphas[k] as number, 'stroke-linecap': 'round', ...extra }));
}

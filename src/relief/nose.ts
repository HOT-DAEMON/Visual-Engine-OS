import type { FaceLandmarks, NoseGeometry } from '../face';
import type { FaceParams } from '../schema';
import type { Vec } from '../geometry/eye/primitives';

/**
 * RELIEF DU NEZ pour le moteur d'éclairage unique (`src/relief`) : le nez y est un volume construit à partir de SES RÉGIONS
 * (`noseGeometry().regions`, docs/FACE-STRUCTURE-NOSE.md), et non plus de trois gaussiennes fixes. Aucun autre moteur de lumière n'est créé :
 * ce fichier ne produit qu'une HAUTEUR z (px, vers l'observateur) ajoutée au champ de profondeur de `headRelief`, que `shadeAt` éclaire ensuite
 * comme le reste du visage (même `LightModel`, même teinte de peau, mêmes ombres portées et même occlusion ambiante).
 *
 * Contrat : chaque axe du nez agit sur SA région et seulement elle (testé : `tests/nose-relief.test.ts`).
 *   arête + parois ← `dorsum.*`, `sidewall.slope` (palier de la paroi), `sidewall.concavity` (gouttière)
 *   dômes ← `domes.prominence`, `domes.separation` (via la géométrie des dômes) · ailes ← `alae.volume` · narines ← `nostrils.opening`
 *   sillons alaires ← `groove.depth` · columelle ← `nostrils.columella` (via la géométrie) · projection ← amplitude globale `tipH`.
 */
const sm = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const g2 = (x: number, y: number, cx: number, cy: number, sx: number, sy: number): number => Math.exp(-0.5 * (((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));

/** Distance d'un point à une polyligne ouverte. */
function distPolyline(x: number, y: number, pts: readonly Vec[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!, b = pts[i + 1]!, dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / l2));
    best = Math.min(best, Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)));
  }
  return best;
}

/** Interpolation linéaire d'une série échantillonnée de `rootY` (index 0) à `lastY` (dernier index). */
const lerpAt = (vals: readonly number[], t: number): number => { const f = Math.min(1, Math.max(0, t)) * (vals.length - 1), i = Math.min(vals.length - 2, Math.floor(f)); return vals[i]! + (vals[i + 1]! - vals[i]!) * (f - i); };

export type NoseRelief = (x: number, y: number) => number;

/** Amplitude de projection du nez (px) : définition UNIQUE, partagée par `headRelief`, le relief du nez et la vérification. */
export const noseTipHeight = (lm: FaceLandmarks, nose: NoseGeometry): number => Math.max(0.05 * lm.W, nose.tip.projectionPx);

/** Construit la fonction de hauteur du nez (repère local de l'hôte). `tipH` = amplitude de projection (px), la même que celle de `headRelief`. */
export function noseRelief(p: FaceParams, lm: FaceLandmarks, nose: NoseGeometry, tipH: number): NoseRelief {
  const n = p.nose, R = nose.regions, W = lm.W, H = lm.H;
  const ax = nose.dorsum.axis, rootY = nose.root.y, lastY = ax[ax.length - 1]!.y, tip = nose.tip.c;
  const axX = ax.map((q) => q.x), half = [...nose.dorsum.half], wall = nose.dorsum.wallHalf.map((w, i) => Math.max(w, half[i]! * 1.35));
  // Bornes du nez : on ne calcule rien hors de la boîte des ailes (gain de temps : la grille de la tête compte ~10⁶ pixels, le nez 2 %).
  // La boîte est LARGE et son bord est une fenêtre lissée (jamais une coupure franche : une marche dans le relief donnerait une ligne d'ombre).
  const xMax = nose.widthPx * 1.2, y0 = rootY - 0.03 * H, y1 = nose.baseY + 0.08 * H;
  const alaBox = [nose.alae.left, nose.alae.right].map((a) => { const xs = a.poly.map((q) => q.x), ys = a.poly.map((q) => q.y); return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2, rx: (Math.max(...xs) - Math.min(...xs)) / 2, ry: (Math.max(...ys) - Math.min(...ys)) / 2 }; });
  const drop = 0.55 + 0.35 * n.sidewall.slope;                                   // palier de la paroi : pente forte → paroi plus basse que l'arête
  const gutterAmp = tipH * 0.16 * n.sidewall.concavity;
  const domeAmp = tipH * (0.2 + 0.2 * n.domes.prominence);
  const alaAmp = tipH * (0.2 + 0.24 * n.alae.volume);
  const nostrilAmp = tipH * (0.1 + 0.14 * (n.nostrils.opening ?? 0.5));
  const grooveAmp = tipH * 0.16 * n.groove.depth;
  return (x, y) => {
    const axx = Math.abs(x);
    if (axx > xMax || y < y0 || y > y1) return 0;
    let b = 0;
    // 1 · Arête et parois : profil en hauteur identique à l'ancien dos du nez (0 → 0,9 de la racine à la pointe), section en trois paliers.
    const ty = (y - rootY) / Math.max(1, tip.y - rootY);
    if (ty > 0) {
      const t = (y - rootY) / Math.max(1, lastY - rootY), d = Math.abs(x - lerpAt(axX, t)), h = lerpAt(half, t), w = lerpAt(wall, t);
      const along = sm(0, 0.9, ty) ** 1.3 * (1 - sm(0.9, 1.15, ty));
      const section = (1 - drop * sm(0.5 * h, w, d)) * (1 - sm(w, w * 1.6, d)) * (1 - 0.1 * (Math.min(d, h) / h) ** 2);
      b += tipH * 0.95 * along * Math.max(0, section);
    }
    // 2 · Gouttière des parois (creux entre l'arête et le sillon alaire).
    for (const s of [R.sidewalls.left, R.sidewalls.right]) if (gutterAmp > 0 && s.gutter.length > 1) b -= gutterAmp * Math.exp(-0.5 * (distPolyline(x, y, s.gutter) / (0.012 * W)) ** 2);
    // 3 · Pointe : socle + deux dômes (leur écart fait la vallée entre les dômes).
    b += tipH * 0.3 * g2(x, y, tip.x, tip.y, nose.tip.rx * 0.9, nose.tip.ry * 0.9);
    for (const d of [R.domes.left, R.domes.right]) b += domeAmp * g2(x, y, d.c.x, d.c.y, d.rx, d.ry);
    // 4 · Ailes : un volume par aile, centré sur sa boîte.
    for (const a of alaBox) b += alaAmp * g2(x, y, a.cx, a.cy, a.rx * 0.7, a.ry * 0.7);
    // 5 · Narines : creux dans l'axe de la goutte (rotation = inclinaison propre de la narine).
    for (const nl of [nose.nostrils.left, nose.nostrils.right]) {
      const c = Math.cos((nl.side * nl.tiltDeg * Math.PI) / 180), s = Math.sin((nl.side * nl.tiltDeg * Math.PI) / 180), dx = x - nl.c.x, dy = y - nl.c.y;
      b -= nostrilAmp * Math.exp(-0.5 * (((dx * c + dy * s) / (nl.b * 1.1)) ** 2 + ((-dx * s + dy * c) / (nl.a * 1.1)) ** 2));
    }
    // 6 · Sillons alaires : pli entre l'aile et la joue.
    for (const g of [R.grooves.left, R.grooves.right]) if (grooveAmp > 0 && g.line.length > 1) b -= grooveAmp * Math.exp(-0.5 * (distPolyline(x, y, g.line) / (0.01 * W)) ** 2);
    // Fenêtre lissée aux bords de la boîte : le relief du nez s'éteint progressivement, sans marche.
    return b * (1 - sm(0.7 * xMax, xMax, axx)) * (1 - sm(nose.baseY + 0.03 * H, y1, y)) * sm(y0, y0 + 0.02 * H, y);
  };
}

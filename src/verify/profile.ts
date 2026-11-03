import type { VPixelMarkup } from '../body/volume';
import type { NeckAnchor } from '../body';
import type { VCheck } from './volume';

/**
 * VÉRIFICATION DU PROFIL (profondeur du tronc), 3 couches, mesurée sur l'IMAGE d'un rendu de profil (caméra yaw ±90, bras le long du corps).
 * Seuils tirés du profil de ref-04 (scripts/body-refs/profile-iou.ts, largeur de silhouette par ligne, indépendante de l'alignement) :
 * profondeur 1,35 h à 0,65 h sous la base du cou, 1,27–1,30 h à 1,0 h, 1,15–1,18 h entre 1,2 et 1,4 h (h = hauteur de tête). Bandes larges (± ~25 %)
 * car UNE seule référence de profil existe : elles bornent l'absurde, elles ne prétendent pas décrire une population.
 *   géométrie : la profondeur varie sans saut d'une ligne à l'autre (aucune marche) ;
 *   anatomie  : profondeur du thorax et de l'abdomen dans la bande de la référence ; rapport abdomen / thorax entre 0,60 et 1,10 (+ 0,5 × adiposité : un ventre gras dépasse le thorax) ;
 *   style     : le profil est modelé (écart-type de luminance sur le tronc) et sans bord noir (aucun pixel plein quasi noir).
 */
const chk = (id: string, layer: VCheck['layer'], ok: boolean, detail: string): VCheck => ({ id, layer, ok, detail });
export function verifyProfileDepth(m: VPixelMarkup, a: NeckAnchor, fat = 0): { ok: boolean; checks: VCheck[]; failures: VCheck[]; depth: Record<string, number> } {
  const { w, h, rgba } = m.pixels, b = m.bounds, sx = w / (b.x1 - b.x0), sy = h / (b.y1 - b.y0), H = a.h, C: VCheck[] = [];
  const alpha = (x: number, y: number): number => rgba[(y * w + x) * 4 + 3]!;
  const py = (Y: number): number => Math.round((Y - b.y0) * sy);
  /** Profondeur (en h) à `u` hauteurs de tête sous la base du cou : étendue horizontale des pixels pleins de la ligne. */
  const depthAt = (u: number): number => { const y = py(a.baseY + u * H); if (y < 0 || y >= h) return NaN; let x0 = w, x1 = -1; for (let x = 0; x < w; x++) if (alpha(x, y) > 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } return x1 < 0 ? NaN : (x1 - x0) / sx / H; };
  const us = Array.from({ length: 24 }, (_, i) => 0.65 + i * 0.05) /* 0,65 → 1,80 h : le tronc du moteur s'arrête à ≈ 1,93 h (hanches) ; au-delà, c'est le bord du rendu, pas une forme */, ds = us.map(depthAt);
  let maxJump = 0; for (let i = 1; i < ds.length; i++) if (!Number.isNaN(ds[i]!) && !Number.isNaN(ds[i - 1]!)) maxJump = Math.max(maxJump, Math.abs(ds[i]! - ds[i - 1]!));
  C.push(chk('pf.geo.depth-continuous', 'geometry', ds.every((d) => !Number.isNaN(d)) && maxJump < 0.15, `plus grand saut de profondeur entre lignes espacées de 0,05 h = ${maxJump.toFixed(3)} h (< 0,15 : pas de marche ; ref-04 : 0,086)`));
  // Itération 05 : seuil 0,2 → 0,25 (bas du pectoral coupé net : 0,21 h). Itération 06 : rampe poitrine → ventre (`trunk.ts` RAMP/YR, `front.ts` PEC) ; plus grand saut mesuré sur 6 morphologies × 2 profils = 0,126 h → seuil resserré à 0,15.
  const chest = depthAt(0.75), belly = depthAt(1.3), waist = depthAt(1.55);
  C.push(chk('pf.ana.chest-depth', 'anatomy', chest > 1.0 && chest < 1.7, `profondeur du thorax à 0,75 h sous le cou = ${chest.toFixed(2)} h (ref-04 : 1,38 ; bande 1,0 – 1,7)`));
  C.push(chk('pf.ana.abdomen-depth', 'anatomy', belly > 0.8 && belly < 1.5 + 0.5 * fat && waist > 0.8 && waist < 1.45 + 0.5 * fat, `profondeur de l'abdomen = ${belly.toFixed(2)} h à 1,3 h et ${waist.toFixed(2)} h à 1,55 h (ref-04 : 1,18 et 1,11 ; bandes 0,8 – ${(1.5 + 0.5 * fat).toFixed(2)} et 0,8 – ${(1.45 + 0.5 * fat).toFixed(2)}, élargies de 0,5 × adiposité)`));
  C.push(chk('pf.ana.abdomen-vs-chest', 'anatomy', belly >= chest * 0.6 && belly <= chest * (1.1 + 0.5 * fat), `abdomen / thorax = ${(belly / chest).toFixed(2)} (0,60 – ${(1.1 + 0.5 * fat).toFixed(2)} ; ref-04 : 0,86)`));
  const L: number[] = []; let dark = 0, solid = 0;
  const y0 = py(a.baseY + 0.7 * H), y1 = py(a.baseY + 1.7 * H);
  for (let y = y0; y <= y1; y += 2) for (let x = 0; x < w; x += 2) if (alpha(x, y) > 200) { const l = 0.2126 * rgba[(y * w + x) * 4]! + 0.7152 * rgba[(y * w + x) * 4 + 1]! + 0.0722 * rgba[(y * w + x) * 4 + 2]!; L.push(l); solid++; if (l < 28) dark++; }
  const mean = L.reduce((p, q) => p + q, 0) / Math.max(1, L.length), sd = Math.sqrt(L.reduce((p, q) => p + (q - mean) ** 2, 0) / Math.max(1, L.length));
  C.push(chk('pf.style.modelled', 'style', L.length > 200 && sd > 5, `écart-type de luminance du tronc de profil = ${sd.toFixed(1)} (> 5 : volume modelé)`));
  C.push(chk('pf.style.no-black-edge', 'style', dark / Math.max(1, solid) < 0.01, `pixels pleins quasi noirs = ${((100 * dark) / Math.max(1, solid)).toFixed(2)} % (< 1 % : aucun contour noir)`));
  const failures = C.filter((c) => !c.ok);
  return { ok: failures.length === 0, checks: C, failures, depth: { chest, belly, waist } };
}

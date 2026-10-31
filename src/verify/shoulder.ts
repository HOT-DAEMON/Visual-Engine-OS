import { FRONT, toView, type VPixelMarkup, type VolumeSet } from '../body/volume';
import type { NeckAnchor } from '../body';
import type { VCheck } from './volume';

/**
 * VÉRIFICATION DE L'ÉPAULE (trapèze + deltoïde en masses continues), 3 couches, mesurée sur l'IMAGE de FACE du rendu par pixel. Les seuils viennent
 * de ref-02 et ref-04 (scripts/body-refs/contour.ts) : pente cou → acromion 0,56 (ref-02) et 0,41 (ref-04) h par h ; chute du coin d'épaule sous le
 * menton 0,50 h (ref-02) et ≈ 0,6 h (ref-04). Chaque contrôle est nommé et chiffré.
 *   géométrie : contour supérieur continu (aucune marche), descendant du cou vers l'acromion ;
 *   anatomie  : pente cou → acromion dans la bande des références ; chute de l'acromion sous le menton ; deltoïde = UNE masse par épaule ;
 *   style     : aucune rainure parasite dans la calotte du deltoïde (pas de couture sombre), relief présent.
 */
const chk = (id: string, layer: VCheck['layer'], ok: boolean, detail: string): VCheck => ({ id, layer, ok, detail });
const lum = (r: number, g: number, b: number): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export function verifyShoulders(m: VPixelMarkup, set: VolumeSet, a: NeckAnchor): { ok: boolean; checks: VCheck[]; failures: VCheck[] } {
  const { w, h, rgba } = m.pixels, b = m.bounds, sx = w / (b.x1 - b.x0), sy = h / (b.y1 - b.y0), H = a.h, C: VCheck[] = [];
  const on = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && rgba[(y * w + x) * 4 + 3]! > 128;
  const px = (X: number): number => Math.round((X - b.x0) * sx), py = (Y: number): number => Math.round((Y - b.y0) * sy);
  // Contour supérieur du côté gauche de l'image : pour chaque colonne (0,40 h … x de l'acromion), 1er pixel plein sous la base du cou − 0,2 h.
  const acr = set.landmarks.get('acromion.R'), xa = acr ? Math.abs(toView(acr, FRONT).x) : 1.0 * H;
  const cols: number[] = [], ys: number[] = [];
  for (let u = 0.4 * H; u <= xa; u += 0.03 * H) { const x = px(-u); let top = NaN; for (let y = py(a.baseY - 0.2 * H); y < h; y++) if (on(x, y)) { top = b.y0 + y / sy; break; } if (!Number.isNaN(top)) { cols.push(u); ys.push((top - a.baseY) / H); } }
  let maxStep = 0, back = 0;
  for (let i = 1; i < ys.length; i++) { maxStep = Math.max(maxStep, Math.abs(ys[i]! - ys[i - 1]!)); back = Math.max(back, ys[i - 1]! - ys[i]!); }
  C.push(chk('sh.geo.contour-continuous', 'geometry', ys.length > 8 && maxStep < 0.07, `plus grande marche du contour d'épaule = ${maxStep.toFixed(3)} h entre colonnes de 0,03 h (< 0,07 : pas de marche)`));
  C.push(chk('sh.geo.contour-descends', 'geometry', back < 0.025, `remontée maximale du contour en s'éloignant du cou = ${back.toFixed(3)} h (< 0,025 : pente continue cou → acromion)`));
  const at = (u: number): number => { let k = 0; for (let i = 0; i < cols.length; i++) if (Math.abs(cols[i]! - u * H) < Math.abs(cols[k]! - u * H)) k = i; return ys[k] ?? NaN; };
  const slope = (at(0.94) - at(0.5)) / 0.44;
  C.push(chk('sh.ana.slope-neck-acromion', 'anatomy', slope > 0.3 && slope < 0.9, `pente du trapèze (0,50 → 0,94 h) = ${slope.toFixed(2)} (références : 0,41 – 0,56 ; bande 0,30 – 0,90)`));
  const drop = acr ? (acr.y - a.chinY) / H : NaN;
  C.push(chk('sh.ana.acromion-under-chin', 'anatomy', drop > 0.4 && drop < 0.7, `acromion à ${drop.toFixed(2)} h sous le menton (références ≈ 0,5 – 0,6 ; bande 0,40 – 0,70)`));
  const dl = (['L', 'R'] as const).map((s) => set.byId.get(`deltoid.${s}`)), heads = set.volumes.filter((v) => /^deltoid\.(ant|mid|post)/.test(v.id));
  C.push(chk('sh.ana.deltoid-single-mass', 'anatomy', dl.every((v) => v?.mass === 'deltoid') && heads.length === 0, `${dl.filter(Boolean).length} masse(s) deltoïdienne(s) (attendu 2), ${heads.length} chef(s) séparé(s) (attendu 0)`));
  const tz = set.volumes.filter((v) => v.id.startsWith('trapezius.'));
  C.push(chk('sh.ana.trapezius-single-mass', 'anatomy', tz.length >= 3 && tz.every((v) => v.mass === 'trapezius'), `${tz.length} parties du trapèze, toutes dans la masse « trapezius »`));
  // Style : calotte du deltoïde (autour de la station de ventre) — aucune couture sombre et un relief réel.
  const d = dl[1];
  if (d) {
    const s = d.stations[Math.floor(d.stations.length * 0.35)]!, c = toView(s.c, FRONT), r = Math.round(0.6 * Math.max(s.a, s.b) * sx), cx = px(c.x), cy = py(c.y), L: number[] = [];
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (on(x, y) && (x - cx) ** 2 + (y - cy) ** 2 <= r * r) L.push(lum(rgba[(y * w + x) * 4]!, rgba[(y * w + x) * 4 + 1]!, rgba[(y * w + x) * 4 + 2]!));
    L.sort((p, q) => p - q);
    const med = L[L.length >> 1] ?? 0, p5 = L[Math.floor(L.length * 0.05)] ?? 0, mean = L.reduce((p, q) => p + q, 0) / Math.max(1, L.length), sd = Math.sqrt(L.reduce((p, q) => p + (q - mean) ** 2, 0) / Math.max(1, L.length));
    C.push(chk('sh.style.no-seam-in-deltoid', 'style', L.length > 50 && p5 > 0.55 * med, `5e centile de luminance dans la calotte = ${(p5 / Math.max(1, med)).toFixed(2)} × la médiane (> 0,55 : pas de couture sombre)`));
    C.push(chk('sh.style.deltoid-relief', 'style', sd > 5, `écart-type de luminance dans la calotte = ${sd.toFixed(1)} (> 5 : volume modelé, pas d'aplat)`));
  } else C.push(chk('sh.style.no-seam-in-deltoid', 'style', false, 'deltoïde absent'));
  const failures = C.filter((c) => !c.ok);
  return { ok: failures.length === 0, checks: C, failures };
}

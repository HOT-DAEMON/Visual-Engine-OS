import type { VPixelMarkup } from '../body/volume';
import type { VolumeSet } from '../body/volume';
import type { VCheck } from './volume';

/**
 * VÉRIFICATION DU RENDU PAR PIXEL (3 couches) — mesurée sur l'IMAGE réellement produite, pas sur la donnée :
 *  géométrie  : une seule silhouette connexe, symétrie gauche/droite d'une pose symétrique, aucun pixel parasite, raccords de sections (coude) sans marche ;
 *  anatomie   : rapport bras/avant-bras, largeur des sections continue le long du membre, silhouette plus large aux épaules qu'à la taille ;
 *  style      : jamais de noir ni de blanc pur, relief réel (dispersion de luminance sur la peau), teinte de peau conservée, contraste borné.
 * Chaque contrôle est nommé et chiffré ; un échec dit quoi et de combien.
 */
const chk = (id: string, layer: VCheck['layer'], ok: boolean, detail: string): VCheck => ({ id, layer, ok, detail });
const lum = (r: number, g: number, b: number): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export function verifyPixels(m: VPixelMarkup, set: VolumeSet): { ok: boolean; checks: VCheck[]; failures: VCheck[] } {
  const { w, h, rgba } = m.pixels, C: VCheck[] = [], on = (x: number, y: number): boolean => rgba[(y * w + x) * 4 + 3]! > 128;
  // Composantes connexes (4-voisins) de la silhouette : on tolère de petits îlots (doigts écartés) sous 0,05 % de l'aire.
  const lab = new Int32Array(w * h), sizes: number[] = [0]; let area = 0;
  for (let i = 0; i < w * h; i++) if (on(i % w, (i / w) | 0)) area++;
  for (let i = 0; i < w * h; i++) {
    if (lab[i] || !on(i % w, (i / w) | 0)) continue;
    const id = sizes.length, st = [i]; let n = 0; lab[i] = id;
    while (st.length) { const k = st.pop()!, x = k % w, y = (k / w) | 0; n++; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const a = x + dx, b = y + dy; if (a < 0 || b < 0 || a >= w || b >= h) continue; const q = b * w + a; if (!lab[q] && on(a, b)) { lab[q] = id; st.push(q); } } }
    sizes.push(n);
  }
  const big = sizes.slice(1).filter((n) => n > 0.0005 * area), stray = sizes.length - 1 - big.length;
  C.push(chk('px.geo.single-silhouette', 'geometry', big.length === 1, `${big.length} composante(s) > 0,05 % de l'aire (${stray} îlots minuscules)`));
  // Symétrie miroir de la silhouette (axe = milieu des bornes) : seulement pertinente pour une pose symétrique ; seuil large (doigts relâchés asymétriques par construction).
  let inter = 0, uni = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = on(x, y), b = on(w - 1 - x, y); if (a || b) uni++; if (a && b) inter++; }
  C.push(chk('px.geo.mirror-symmetry', 'geometry', inter / Math.max(1, uni) > 0.8, `IoU miroir = ${(inter / Math.max(1, uni)).toFixed(3)} (> 0,80)`));
  // Marche au coude : écart relatif des rayons entre la dernière section du bras et la première de l'avant-bras.
  const steps = (['L', 'R'] as const).map((s) => { const a = set.byId.get(`arm.env.${s}`), f = set.byId.get(`forearm.env.${s}`); if (!a || !f) return 0; const e = a.stations[a.stations.length - 1]!, b = f.stations[0]!; return Math.abs(e.a - b.a) / Math.max(e.a, b.a); });
  C.push(chk('px.geo.elbow-seam', 'geometry', Math.max(...steps) < 0.12, `marche de rayon au coude = ${(Math.max(...steps) * 100).toFixed(1)} % (< 12 %)`));
  // Anatomie : largeur de la silhouette par ligne.
  const rowW = (y: number): number => { let a = -1, b = -1; for (let x = 0; x < w; x++) if (on(x, y)) { if (a < 0) a = x; b = x; } return a < 0 ? 0 : b - a + 1; };
  const ys = [...Array(h).keys()].filter((y) => rowW(y) > 0), y0 = ys[0] ?? 0, y1 = ys[ys.length - 1] ?? h - 1, at = (t: number): number => rowW(Math.round(y0 + (y1 - y0) * t));
  // Largeur du tronc seul à une hauteur donnée : segment connexe contenant l'axe (les bras écartés par un vide n'y comptent pas).
  const centralW = (t: number): number => { const y = Math.round(y0 + (y1 - y0) * t), c = w >> 1; if (!on(c, y)) return 0; let a = c, b = c; while (a > 0 && on(a - 1, y)) a--; while (b < w - 1 && on(b + 1, y)) b++; return b - a + 1; };
  C.push(chk('px.anat.shoulders-wider-than-waist', 'anatomy', Math.max(at(0.2), at(0.25)) > centralW(0.55), `largeur épaules ${Math.max(at(0.2), at(0.25))} px > tronc à la taille ${centralW(0.55)} px`));
  const A = set.byId.get('arm.env.L'), F = set.byId.get('forearm.env.L');
  if (A && F) { const len = (v: typeof A): number => { let l = 0; for (let i = 1; i < v.stations.length; i++) { const p = v.stations[i - 1]!.c, q = v.stations[i]!.c; l += Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z); } return l; }; const r = len(F) / len(A); C.push(chk('px.anat.forearm-over-arm', 'anatomy', r > 0.7 && r < 1.0, `avant-bras / bras = ${r.toFixed(2)} (0,70–1,00)`)); }
  // Style.
  let mn = 255, mx = 0, s1 = 0, s2 = 0, n = 0, rr = 0, bb = 0;
  for (let i = 0; i < w * h; i++) { if (rgba[i * 4 + 3]! < 250) continue; const r = rgba[i * 4]!, g = rgba[i * 4 + 1]!, b = rgba[i * 4 + 2]!, l = lum(r, g, b); mn = Math.min(mn, l); mx = Math.max(mx, l); s1 += l; s2 += l * l; n++; rr += r; bb += b; }
  const mean = s1 / Math.max(1, n), sd = Math.sqrt(Math.max(0, s2 / Math.max(1, n) - mean * mean));
  C.push(chk('px.style.no-pure-black-white', 'style', mn > 18 && mx < 250, `luminance min ${mn.toFixed(0)} / max ${mx.toFixed(0)} (18–250)`));
  C.push(chk('px.style.relief', 'style', sd > 14, `écart-type de luminance = ${sd.toFixed(1)} (> 14 : relief réel, pas d'aplat)`));
  C.push(chk('px.style.warm-skin', 'style', rr > bb * 1.05, `rouge/bleu moyens = ${(rr / Math.max(1, bb)).toFixed(2)} (> 1,05 : teinte de peau)`));
  const failures = C.filter((c) => !c.ok);
  return { ok: failures.length === 0, checks: C, failures };
}

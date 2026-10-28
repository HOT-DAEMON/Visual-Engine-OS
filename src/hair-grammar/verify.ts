import { landmarks, project, type HeadSpec, type View } from './head';
import type { HairPainting } from './paint';
import type { LockSpec } from './lock';
import { len, sub } from './vec';

/**
 * COUCHE DE VÉRIFICATION du rendu des mèches — trois contrôles indépendants, chacun renvoie des mesures et des échecs :
 *  - GÉOMÉTRIQUE : tout est fini, les mèches sont posées sur/au-dessus de la coque, aucune lame dégénérée ;
 *  - ANATOMIQUE : proportions des cheveux par rapport au visage (hauteur du volume, débord latéral, frange vs yeux/nez, longueur) ;
 *  - STYLE : cohérence de l'encre (épaisseur de trait, rapport longueur/largeur des mèches, variété des tons).
 * Les seuils sont des garde-fous calibrés sur la cellule 01, pas des preuves de ressemblance (voir docs/HAIR-GRAMMAR-01.md).
 */
export interface Check { readonly name: string; readonly value: number; readonly min: number; readonly max: number; readonly ok: boolean }
export interface Report { readonly layer: 'geometry' | 'anatomy' | 'style'; readonly checks: Check[]; readonly ok: boolean }

const chk = (name: string, value: number, min: number, max: number): Check => ({ name, value, min, max, ok: Number.isFinite(value) && value >= min && value <= max });
const rep = (layer: Report['layer'], checks: Check[]): Report => ({ layer, checks, ok: checks.every((c) => c.ok) });

export function verifyGeometry(P: HairPainting): Report {
  let bad = 0; let degenerate = 0; let minLift = Infinity;
  for (const l of P.locks) {
    const pts = [...l.blade.spine, ...l.blade.left, ...l.blade.right];
    if (pts.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) bad++;
    const L = Math.hypot((l.blade.spine.at(-1)?.x ?? 0) - (l.blade.spine[0]?.x ?? 0), (l.blade.spine.at(-1)?.y ?? 0) - (l.blade.spine[0]?.y ?? 0));
    if (L < 1) degenerate++;
    minLift = Math.min(minLift, l.spec.lift0);
  }
  return rep('geometry', [chk('mèches non finies', bad, 0, 0), chk('lames dégénérées', degenerate, 0, 0), chk('décollement minimal ≥ 0', minLift, 0, 1)]);
}

/** Boîte englobante projetée (unités image) de toutes les lames d'une famille. */
function box(P: HairPainting, fam: string | null): { x0: number; x1: number; y0: number; y1: number } {
  const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  for (const l of P.locks) {
    if (fam && l.spec.family !== fam) continue;
    for (const p of [...l.blade.left, ...l.blade.right]) { b.x0 = Math.min(b.x0, p.x); b.x1 = Math.max(b.x1, p.x); b.y0 = Math.min(b.y0, p.y); b.y1 = Math.max(b.y1, p.y); }
  }
  return b;
}

export function verifyAnatomy(h: HeadSpec, view: View, P: HairPainting): Report {
  const lm = landmarks(h);
  const top = project(view, lm.top).y; const chin = project(view, lm.chin).y; const H = chin - top;
  const all = box(P, null);
  const eyeY = project(view, lm.eyeR).y; const noseY = project(view, lm.noseTip).y;
  const fr = box(P, 'fringe');
  const faceLeft = project(view, lm.noseTip).x;
  const noseDist = len(sub({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }));
  void noseDist;
  return rep('anatomy', [
    chk('volume au-dessus du crâne / H', (top - all.y0) / H, 0.1, 0.5),
    chk('débord avant (gauche) / H', (faceLeft - all.x0) / H, 0, 0.6),
    chk('frange : pointe la plus basse vs ligne des yeux (/H)', (fr.y1 - eyeY) / H, -0.05, 0.3),
    chk('frange : ne dépasse pas la pointe du nez (/H)', (fr.y1 - noseY) / H, -0.5, 0.02),
    chk('hauteur totale des cheveux / H', (all.y1 - all.y0) / H, 0.7, 1.45),
  ]);
}

export function verifyStyle(specs: readonly LockSpec[], lineW: number): Report {
  const ratios = specs.filter((s) => s.family !== 'mass').map((s) => s.length / Math.max(1e-6, s.width));
  const tones = new Set(specs.map((s) => Math.round(s.tone * 4)));
  const mean = ratios.reduce((a, b) => a + b, 0) / Math.max(1, ratios.length);
  return rep('style', [chk('épaisseur du trait (unités image)', lineW, 0.5, 1.6), chk('rapport longueur/largeur moyen des mèches', mean, 3, 14), chk('variété de tons (classes)', tones.size, 2, 12)]);
}

/** Métriques raster contre la référence : IoU de silhouette et IoU d'encre avec tolérance de `tol` pixels. */
export interface Gray { readonly w: number; readonly h: number; readonly data: Uint8Array }
const ink = (g: Gray, thr = 110): Uint8Array => Uint8Array.from(g.data, (v) => (v < thr ? 1 : 0));

function dilate(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!m[y * w + x]) continue;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx; const yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && dx * dx + dy * dy <= r * r) out[yy * w + xx] = 1; }
  }
  return out;
}

/** Silhouette = tout ce qui n'est pas le fond blanc connecté au bord (remplissage depuis les bords sur le masque d'encre dilaté). */
export function silhouette(g: Gray, thr = 110): Uint8Array {
  const { w, h } = g;
  const wall = dilate(ink(g, thr), w, h, 2);
  const bg = new Uint8Array(w * h); const st: number[] = [];
  const push = (x: number, y: number): void => { const i = y * w + x; if (!wall[i] && !bg[i]) { bg[i] = 1; st.push(i); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (st.length) { const i = st.pop() as number; const x = i % w; const y = (i / w) | 0; if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1); }
  return Uint8Array.from(bg, (v) => 1 - v);
}

export interface RefMetrics { readonly silhouetteIoU: number; readonly inkRecall: number; readonly inkPrecision: number; readonly inkFraction: { readonly ref: number; readonly mine: number } }

/** `rows` : on ne compare que les lignes y < rows (au-dessus des vêtements). */
export function compareToReference(ref: Gray, mine: Gray, tol: number, rows: number): RefMetrics {
  const w = ref.w; const h = Math.min(rows, ref.h);
  const crop = (g: Gray): Gray => ({ w, h, data: g.data.subarray(0, w * h) });
  const R = crop(ref); const M = crop(mine);
  const sr = silhouette(R); const sm = silhouette(M);
  let inter = 0; let uni = 0;
  for (let i = 0; i < sr.length; i++) { const a = sr[i] as number; const b = sm[i] as number; inter += a & b; uni += a | b; }
  const ir = ink(R); const im = ink(M);
  const dr = dilate(ir, w, h, tol); const dm = dilate(im, w, h, tol);
  let hitR = 0; let nR = 0; let hitM = 0; let nM = 0;
  for (let i = 0; i < ir.length; i++) { if (ir[i]) { nR++; hitR += dm[i] as number; } if (im[i]) { nM++; hitM += dr[i] as number; } }
  return { silhouetteIoU: inter / Math.max(1, uni), inkRecall: hitR / Math.max(1, nR), inkPrecision: hitM / Math.max(1, nM), inkFraction: { ref: nR / ir.length, mine: nM / im.length } };
}

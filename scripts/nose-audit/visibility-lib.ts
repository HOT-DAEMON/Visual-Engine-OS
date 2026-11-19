import { Resvg } from '@resvg/resvg-js';
import { compileScene, generateRandomFace } from '../../src';
import { faceLandmarks, noseGeometry } from '../../src/face';

/**
 * AUDIT DE VISIBILITÉ DES PARAMÈTRES DU NEZ — bibliothèque.
 * Question posée : « le paramètre X produit-il une différence que l'on VOIT sur une tête complète ? ».
 * Méthode : même graine, même éclairage, peau seule (crâne chauve, sans pilosité) ; on ne change QU'UN paramètre (bas / haut de sa plage),
 * on rastérise à l'échelle d'une tête entière et on compte les pixels qui changent dans une boîte autour du nez.
 */
export type Engine = 'classic' | 'structured';
export interface Shot { readonly w: number; readonly h: number; readonly px: Uint8Array; readonly box: Box; readonly zone: Box; readonly svg: string }
export interface Box { x0: number; x1: number; y0: number; y1: number }

export const W = 600, H = 760, SCALE = 1.44; // même cadrage qu'une tête de galerie (300×380 à 0,72) rendu à ×2 pour la mesure

/** Écrit `v` au chemin `a.b.c` dans l'objet (crée rien : le chemin doit exister). */
export function setPath(o: Record<string, unknown>, path: string, v: unknown): void {
  const k = path.split('.'); let c: Record<string, unknown> = o;
  for (let i = 0; i < k.length - 1; i++) c = c[k[i]!] as Record<string, unknown>;
  c[k[k.length - 1]!] = v;
}

export function headShot(seed: number, engine: Engine, edit: Record<string, unknown> = {}, opts: { hair?: boolean; scale?: number; centerY?: number } = {}): Shot {
  const SC = opts.scale ?? SCALE, CY = opts.centerY ?? 0.5;
  const probe = generateRandomFace(seed, { id: 'f0', hairEngine: 'classic' });
  const lm = faceLandmarks(probe.params, probe.width, probe.height);
  const g = noseGeometry(probe.params, lm);
  const cy = lm.noseBaseY;
  const F = generateRandomFace(seed, { id: 'f0', hairEngine: 'classic', transform: { x: W / 2, y: H * CY - cy * SC, scale: SC } });
  const host = F.objects[0] as { face: Record<string, unknown> };
  const face = { ...host.face, anatomyEngine: engine } as Record<string, unknown>;
  if (!opts.hair) {
    face.hair = { ...(face.hair as object), style: 'bald' };
    face.facialHair = { ...(face.facialHair as object), beard: 'none', mustache: 'none' };
  }
  face.nose = JSON.parse(JSON.stringify(face.nose));
  for (const [p, v] of Object.entries(edit)) setPath(face.nose as Record<string, unknown>, p, v);
  host.face = face;
  const r = compileScene({ width: W, height: H, background: '#ffffff', objects: F.objects } as never);
  if (!r.ok) throw new Error(r.issues.join(';'));
  const img = new Resvg(r.svg, { fitTo: { mode: 'width', value: W } }).render();
  const T = (x: number, y: number) => ({ x: W / 2 + x * SC, y: H * CY + (y - cy) * SC });
  const a = T(-g.widthPx * 0.9, g.root.y - 4), b = T(g.widthPx * 0.9, cy + 10);
  // Zone étendue : de la glabelle (entre les sourcils) jusqu'à la ligne de bouche (philtrum) et aux sillons naso-labiaux (±1,7 × largeur du nez).
  const za = T(-g.widthPx * 1.7, Math.min(g.root.y - 4, g.junctions.glabella.c.y - g.junctions.glabella.ry)), zb = T(g.widthPx * 1.7, lm.mouthY + 8);
  return { w: img.width, h: img.height, px: img.pixels, svg: r.svg, box: { x0: Math.floor(a.x), x1: Math.ceil(b.x), y0: Math.floor(a.y), y1: Math.ceil(b.y) }, zone: { x0: Math.floor(za.x), x1: Math.ceil(zb.x), y0: Math.floor(za.y), y1: Math.ceil(zb.y) } };
}

export interface Diff { readonly zoneRelPixels: number; readonly zoneShare: number; readonly zonePixels: number; readonly share: number; readonly strong: number; readonly meanDelta: number; readonly maxDelta: number; readonly outside: number }
/** `zoneRelPixels` : seuil de Weber (changement > 6 % de la luminance locale, plancher 12) — équitable pour les peaux sombres. Part des pixels de la boîte du nez qui changent (Δ somme RGB > 24 = visible à l'œil ; > 60 = franc), écart moyen, et part des changements hors boîte. */
export function diffShots(a: Shot, b: Shot): Diff {
  let n = 0, vis = 0, strong = 0, sum = 0, mx = 0, tot = 0, out = 0, zn = 0, zv = 0, zr = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const i = (y * a.w + x) * 4;
    const d = Math.abs(a.px[i]! - b.px[i]!) + Math.abs(a.px[i + 1]! - b.px[i + 1]!) + Math.abs(a.px[i + 2]! - b.px[i + 2]!);
    const inZone = x >= a.zone.x0 && x <= a.zone.x1 && y >= a.zone.y0 && y <= a.zone.y1;
    if (inZone) { zn++; if (d > 24) zv++; if (d > Math.max(12, 0.06 * (a.px[i]! + a.px[i + 1]! + a.px[i + 2]!))) zr++; }
    const inside = x >= a.box.x0 && x <= a.box.x1 && y >= a.box.y0 && y <= a.box.y1;
    if (d > 24) { tot++; if (!inside) out++; }
    if (!inside) continue;
    n++; sum += d; if (d > 24) vis++; if (d > 60) strong++; if (d > mx) mx = d;
  }
  return { zoneRelPixels: zr, zoneShare: zv / zn, zonePixels: zv, share: vis / n, strong: strong / n, meanDelta: sum / n, maxDelta: mx, outside: tot ? out / tot : 0 };
}

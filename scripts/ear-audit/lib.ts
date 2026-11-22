import { Resvg } from '@resvg/resvg-js';
import { compileScene, generateRandomFace } from '../../src';
import { earGeometry, faceLandmarks } from '../../src/face';
import { FaceParams } from '../../src/schema';

/**
 * AUDIT DE VISIBILITÉ DES PARAMÈTRES DE L'OREILLE — bibliothèque (même méthode que scripts/nose-audit).
 * Question : « le paramètre X produit-il une différence que l'on VOIT sur une tête complète ? ».
 * Même graine, même éclairage, peau seule (crâne chauve, sans pilosité) ; on change UN paramètre (bas / haut de sa plage), on rastérise une tête entière
 * et on compte les pixels qui changent dans la boîte de chaque oreille (union des deux côtés).
 */
export interface Box { x0: number; x1: number; y0: number; y1: number }
export interface Shot { readonly w: number; readonly h: number; readonly px: Uint8Array; readonly boxes: Box[]; readonly svg: string }
export const W = 600, H = 760, SCALE = 1.44;

export function setPath(o: Record<string, unknown>, path: string, v: unknown): void {
  const k = path.split('.'); let c: Record<string, unknown> = o;
  for (let i = 0; i < k.length - 1; i++) c = c[k[i]!] as Record<string, unknown>;
  c[k[k.length - 1]!] = v;
}

/** Tête d'une graine, oreilles `morphology`, édition d'UN chemin de `face.ears`. `hair` conserve les cheveux ; `scale` zoome ; `top` cadre sur les oreilles. */
export function headShot(seed: number, edit: Record<string, unknown> = {}, opts: { hair?: boolean; scale?: number; ears?: object; noEars?: boolean } = {}): Shot {
  const SC = opts.scale ?? SCALE;
  const probe = generateRandomFace(seed, { id: 'f0', hairEngine: 'classic' });
  const lm = faceLandmarks(probe.params, probe.width, probe.height);
  const cy = (lm.eyeY + lm.noseBaseY) / 2;
  const F = generateRandomFace(seed, { id: 'f0', hairEngine: 'classic', transform: { x: W / 2, y: H * 0.5 - cy * SC, scale: SC } });
  const host = F.objects[0] as { face: Record<string, unknown> };
  const face = { ...host.face, anatomyEngine: 'structured' } as Record<string, unknown>;
  if (!opts.hair) {
    face.hair = { ...(face.hair as object), style: 'bald' };
    face.facialHair = { ...(face.facialHair as object), beard: 'none', mustache: 'none', sideburns: 'none' };
  }
  face.ears = JSON.parse(JSON.stringify({ ...(opts.ears ?? (face.ears as object)), visible: !opts.noEars, engine: 'morphology' }));
  for (const [p, v] of Object.entries(edit)) setPath(face.ears as Record<string, unknown>, p, v);
  host.face = face;
  const r = compileScene({ width: W, height: H, background: '#ffffff', objects: F.objects } as never);
  if (!r.ok) throw new Error(r.issues.join(';'));
  const img = new Resvg(r.svg, { fitTo: { mode: 'width', value: W } }).render();
  // Boîtes des deux oreilles : géométrie de la tête ÉDITÉE (mêmes paramètres que le rendu), élargie pour capter les variations de taille.
  const T = (x: number, y: number) => ({ x: W / 2 + x * SC, y: H * 0.5 + (y - cy) * SC });
  const ep = FaceParams.parse(face);
  const boxes = earGeometry(ep, faceLandmarks(ep, probe.width, probe.height)).map((g) => {
    const m = 0.45;
    const a = T(g.c.x - g.rx * (1 + m), g.c.y - g.ry * (1 + m * 1.6)), b = T(g.c.x + g.rx * (1 + m), g.c.y + g.ry * (1 + m * 1.2));
    return { x0: Math.floor(Math.min(a.x, b.x)), x1: Math.ceil(Math.max(a.x, b.x)), y0: Math.floor(a.y), y1: Math.ceil(b.y) };
  });
  return { w: img.width, h: img.height, px: img.pixels, svg: r.svg, boxes };
}

export interface Diff { readonly px: number; readonly strong: number; readonly share: number; readonly meanDelta: number; readonly outside: number }
/** px : pixels des boîtes d'oreille dont la somme RGB change de plus de 24 (≈ 3 % de luminance) ; strong : > 60 ; outside : part des changements hors boîtes. */
export function diffShots(a: Shot, b: Shot): Diff {
  let n = 0, vis = 0, strong = 0, sum = 0, tot = 0, out = 0;
  const boxes = [...a.boxes, ...b.boxes];
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const i = (y * a.w + x) * 4;
    const d = Math.abs(a.px[i]! - b.px[i]!) + Math.abs(a.px[i + 1]! - b.px[i + 1]!) + Math.abs(a.px[i + 2]! - b.px[i + 2]!);
    const inside = boxes.some((q) => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1);
    if (d > 24) { tot++; if (!inside) out++; }
    if (!inside) continue;
    n++; sum += d; if (d > 24) vis++; if (d > 60) strong++;
  }
  return { px: vis, strong, share: vis / n, meanDelta: sum / n, outside: tot ? out / tot : 0 };
}

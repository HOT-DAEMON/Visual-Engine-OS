import { Resvg } from '@resvg/resvg-js';
import { compileScene, generateRandomFace } from '../src';
import { faceLandmarks, noseGeometry } from '../src/face';

/** Gros plan du NEZ (peau seule : pas de cheveux, pas de pilosité) pour mesurer le matériau propre au nez sur des pixels réels. */
export interface NoseDetailInput { tipShine?: number; alarBlush?: number; pores?: number }
export interface NoseShot { readonly w: number; readonly h: number; readonly px: Uint8Array; readonly tip: { x: number; y: number; rx: number; ry: number }; readonly alae: { x: number; y: number; rx: number; ry: number }[]; readonly cheek: { x: number; y: number; r: number }; readonly svg: string }
const ZOOM = 2.6, W = 360, H = 360;

export function noseShot(seed: number, nd: NoseDetailInput, opts: { scale?: number; globalPores?: number } = {}): NoseShot {
  const probe = generateRandomFace(seed, { id: 'f0', hairEngine: 'classic' });
  const lm = faceLandmarks(probe.params, probe.width, probe.height), g = noseGeometry(probe.params, lm);
  const z = opts.scale ?? ZOOM, cy = (g.root.y + lm.noseBaseY) / 2;
  const F = generateRandomFace(seed, { id: 'f0', hairEngine: 'classic', anatomy: { skinMaterial: { noseDetail: nd, ...(opts.globalPores === undefined ? {} : { pores: opts.globalPores }) } } as never, transform: { x: W / 2, y: H / 2 - cy * z, scale: z } });
  const host = F.objects[0] as { face: Record<string, unknown> };
  host.face = { ...host.face, hair: { ...(host.face.hair as object), style: 'bald' }, facialHair: { ...(host.face.facialHair as object), beard: 'none', mustache: 'none' } } as never;
  const r = compileScene({ width: W, height: H, background: '#ffffff', objects: F.objects } as never);
  if (!r.ok) throw new Error(r.issues.join(';'));
  const img = new Resvg(r.svg, { fitTo: { mode: 'width', value: W } }).render();
  const T = (x: number, y: number) => ({ x: W / 2 + x * z, y: H / 2 + (y - cy) * z });
  const tp = T(g.tip.c.x, g.tip.c.y);
  const box = (poly: readonly { x: number; y: number }[]) => { const xs = poly.map((q) => q.x), ys = poly.map((q) => q.y); const c = T((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2); return { x: c.x, y: c.y, rx: ((Math.max(...xs) - Math.min(...xs)) / 2) * z, ry: ((Math.max(...ys) - Math.min(...ys)) / 2) * z }; };
  const cp = T(lm.W * 0.2, lm.noseBaseY - (lm.noseBaseY - g.root.y) * 0.1);
  return { w: img.width, h: img.height, px: img.pixels, tip: { x: tp.x, y: tp.y, rx: g.tip.rx * z, ry: g.tip.ry * z }, alae: [box(g.alae.left.poly), box(g.alae.right.poly)], cheek: { x: cp.x, y: cp.y, r: 14 }, svg: r.svg };
}

/** Moyenne RGB des pixels dans une ellipse. */
export function meanIn(s: NoseShot, e: { x: number; y: number; rx: number; ry: number }): [number, number, number] {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = Math.max(0, Math.floor(e.y - e.ry)); y < Math.min(s.h, Math.ceil(e.y + e.ry)); y++) for (let x = Math.max(0, Math.floor(e.x - e.rx)); x < Math.min(s.w, Math.ceil(e.x + e.rx)); x++) {
    if (((x - e.x) / e.rx) ** 2 + ((y - e.y) / e.ry) ** 2 > 1) continue;
    const i = (y * s.w + x) * 4; r += s.px[i]!; g += s.px[i + 1]!; b += s.px[i + 2]!; n++;
  }
  return [r / n, g / n, b / n];
}
/** Écart-type de la luminance dans une ellipse (texture). */
export function lumaSd(s: NoseShot, e: { x: number; y: number; rx: number; ry: number }): number {
  const v: number[] = [];
  for (let y = Math.max(0, Math.floor(e.y - e.ry)); y < Math.min(s.h, Math.ceil(e.y + e.ry)); y++) for (let x = Math.max(0, Math.floor(e.x - e.rx)); x < Math.min(s.w, Math.ceil(e.x + e.rx)); x++) {
    if (((x - e.x) / e.rx) ** 2 + ((y - e.y) / e.ry) ** 2 > 1) continue;
    const i = (y * s.w + x) * 4; v.push(0.2126 * s.px[i]! + 0.7152 * s.px[i + 1]! + 0.0722 * s.px[i + 2]!);
  }
  const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
}
/** Part des pixels modifiés (écart > 2 sur un canal) qui tombent HORS de la boîte du nez (+ marge) : la localité du matériau. */
export function changedOutside(a: NoseShot, b: NoseShot, box: { x0: number; x1: number; y0: number; y1: number }): { changed: number; outsideShare: number } {
  let ch = 0, out = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const i = (y * a.w + x) * 4;
    if (Math.abs(a.px[i]! - b.px[i]!) + Math.abs(a.px[i + 1]! - b.px[i + 1]!) + Math.abs(a.px[i + 2]! - b.px[i + 2]!) > 6) { ch++; if (x < box.x0 || x > box.x1 || y < box.y0 || y > box.y1) out++; }
  }
  return { changed: ch, outsideShare: ch ? out / ch : 0 };
}

import { Resvg } from '@resvg/resvg-js';
import { compileScene } from '../../src';
import { openingGeometry, openingPolygon } from '../../src/geometry/eye';
import { irisCenter, irisRadii } from '../../src/render/eye/helpers';
import { resolveEye } from '../../src/render/eye/eye';
import { EyeSpec } from '../../src/schema';

/**
 * TON DE L'IRIS SUR LES PIXELS — mêmes formules que `scripts/eye-refs/extract_iris_photos.py` (bloc « TON », passe 10), pour comparer le moteur aux références :
 * disque de l'iris (rr <= 0,9), hors reflets (V > 0,93 et S < 0,35), hors pupille, dans l'ouverture ; luminance moyenne (0,2126 R + 0,7152 G + 0,0722 B), part sombre (L < 50),
 * saturation des pics (15 % de pixels de plus grand S x V) et couleur vive par bande radiale (0,05–0,2 · 0,35–0,55 · 0,8–0,9 ; moyenne des 20 % de plus grand S x V).
 */
export interface IrisTone { readonly lumMean: number; readonly darkShare: number; readonly satPeaks: number; readonly vividBands: readonly (string | null)[] }
const W = 700, H = 460;
const hex = (c: number[]): string => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const pct = (a: number[], p: number): number => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] as number; };
const inPoly = (poly: readonly { x: number; y: number }[], x: number, y: number): boolean => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i]!, b = poly[j]!; if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; };

export function irisTone(input: Record<string, unknown>): IrisTone {
  const eye = resolveEye(EyeSpec.parse({ ...input, eyebrow: null })); const g = openingGeometry(eye.shape, eye.canthi);
  const r = compileScene({ width: W, height: H, background: '#ff00ff', objects: [{ kind: 'eye', id: 'e', transform: { x: W / 2, y: H / 2 }, ...input, eyebrow: null }] } as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  const px = new Resvg(r.svg, { fitTo: { mode: 'width', value: W } }).render().pixels as unknown as Uint8Array;
  const ox = W / 2, oy = H / 2, c = irisCenter(eye, g), { rx, ry } = irisRadii(eye); const poly = openingPolygon(g).map((p) => ({ x: p.x + ox, y: p.y + oy }));
  const rows: { rr: number; L: number; s: number; sv: number; rgb: number[] }[] = [];
  for (let y = Math.floor(c.y + oy - ry); y <= Math.ceil(c.y + oy + ry); y++) for (let x = Math.floor(c.x + ox - rx); x <= Math.ceil(c.x + ox + rx); x++) {
    const rr = Math.hypot((x - c.x - ox) / rx, (y - c.y - oy) / ry); if (rr > 0.9 || !inPoly(poly, x, y)) continue;
    const i = (y * W + x) * 4; const R = px[i] as number, G = px[i + 1] as number, B = px[i + 2] as number;
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B), v = mx / 255, s = mx === 0 ? 0 : (mx - mn) / mx;
    if (v > 0.93 && s < 0.35) continue;                                  // reflets
    if (rr < eye.pupil.size * 0.95 && eye.pupil.visible) continue;      // pupille
    rows.push({ rr, L: 0.2126 * R + 0.7152 * G + 0.0722 * B, s, sv: s * v, rgb: [R, G, B] });
  }
  if (rows.length < 200) return { lumMean: NaN, darkShare: NaN, satPeaks: NaN, vividBands: [null, null, null] };
  const t15 = pct(rows.map((q) => q.sv), 85); const peaks = rows.filter((q) => q.sv >= t15);
  const bands = ([[0.05, 0.2], [0.35, 0.55], [0.8, 0.9]] as const).map(([lo, hi]) => {
    const b = rows.filter((q) => q.rr >= lo && q.rr < hi); if (b.length < 30) return null;
    const t = pct(b.map((q) => q.sv), 80); const top = b.filter((q) => q.sv >= t);
    return hex([0, 1, 2].map((k) => top.reduce((a, q) => a + (q.rgb[k] as number), 0) / top.length));
  });
  const m = (a: number[]): number => a.reduce((p, q) => p + q, 0) / a.length;
  return { lumMean: +m(rows.map((q) => q.L)).toFixed(1), darkShare: +(rows.filter((q) => q.L < 50).length / rows.length).toFixed(3), satPeaks: +m(peaks.map((q) => q.s)).toFixed(3), vividBands: bands };
}

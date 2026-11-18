import { head3dSubject } from '../../src/render/head-3d';
import { hostOf } from './alar-overflow';
import { defaultFrame } from '../../src/head-turntable';
import { buildParts, alaOf } from '../../src/head-turntable/parts';
import { cullFarEar } from '../../src/head-turntable/engines/ear-cull';
import { paint, reliefLight } from '../../src/head-turntable/paint';
import { shadeAt } from '../../src/relief/model';
import { softenedNormal } from '../../src/head-turntable/nose-light';
import { dirToCam, norm } from '../../src/head-turntable/math';
import { neckClipPx } from '../../src/head-turntable/neck-clip';
import { withRig } from '../../src/head-turntable/roll';
import { rasterize, type Frame } from '../../src/head-turntable/raster';
import { alaWeight } from '../../src/head-turntable/nose-light';
import { PART } from '../../src/head-turntable/mesh';
import { v3 } from '../../src/head-turntable/math';
import { lightModelOfSpec, patternById } from '../../src/relief';
import type { HeadTurnSpec } from '../../src/head-turntable';

/**
 * MESURE de la tache claire de l'aile PROCHE (docs/NOSE-ALAR-SPOT.md). Sur le tampon sur-échantillonné (même chaîne que `renderHead` : rasterize → paint) :
 *  - masque aile = pixels PART.bump dont alaWeight ≥ 0,999 ET dont le centre d'ellipsoïde est le plus proche de la caméra (aile proche) ;
 *  - anneau = pixels de peau (PART.head) à 2–7 px du masque (dilatation) ;
 *  - ratio = luminance moyenne(masque) / luminance moyenne(anneau) ; bord = pic du saut de luminance à la lisière / pente médiane de l'anneau ;
 *  - une tache claire de joue ombrée : ratio > 1 ET bord net. Usage : npx tsx scripts/nose-refs/alar-spot-measure.ts
 */
const q = patternById('three-quarter-right'), lit = { style: q.style, shadowHue: q.shadowHue, bias: q.bias, light: { azimuthDeg: q.azimuthDeg, elevationDeg: q.elevationDeg, shadowHardness: q.hardness, sourceSize: q.sourceSize } };
const model0 = lightModelOfSpec({} as never, lit as never), model = { ...model0, ...(process.env.NOBOUNCE ? { bounce: 0 } : {}), ...(process.env.NORIM ? { rim: 0 } : {}) }, SS = 2, H = 420, f0 = defaultFrame(H);
const hi: Frame = { w: f0.w * SS, h: f0.h * SS, ppu: f0.ppu * SS, ox: f0.ox * SS, oy: f0.oy * SS };
const lum = (a: Float32Array, k: number): number => 0.2126 * a[4 * k]! + 0.7152 * a[4 * k + 1]! + 0.0722 * a[4 * k + 2]!;
const nohair = (s: HeadTurnSpec): HeadTurnSpec => { const { hairVolume: _h, ...r } = s as HeadTurnSpec & { hairVolume?: unknown }; return r as HeadTurnSpec; };

export interface Spot { ratio: number; edge: number; wingPx: number; ringStd: number; dec?: Record<string, number> }
/** Tampon géométrique sur-échantillonné (tête rasée) de la chaîne de rendu, pour les mesures et les tests. */
export function gbufOf(spec0: HeadTurnSpec, yaw: number, pitch = 0) {
  const spec = nohair(spec0), view = withRig({ yaw, pitch }, spec);
  return { spec, view, g: rasterize(cullFarEar(buildParts(spec), view), view, hi, neckClipPx(spec, view, hi)), ppuHi: hi.ppu };
}
export function spotOf(spec0: HeadTurnSpec, yaw: number, pitch = 0): Spot | null {
  const { spec, view, g } = gbufOf(spec0, yaw, pitch);
  const pa = paint(spec, g, view, { lineU: 0.022, ppuHi: hi.ppu, light: model, shadowTint: null });
  // aile proche = celle dont le centre est le plus proche de la caméra : lacet > 0 → on teste les deux et on retient celle qui a le plus de pixels visibles et la plus petite profondeur moyenne
  const wing = new Uint8Array(g.w * g.h), sums = [0, 0], cnt = [0, 0], dsum = [0, 0];
  for (let k = 0; k < g.w * g.h; k++) if (g.id[k] === PART.bump) {
    const p = v3(g.P[3 * k]!, g.P[3 * k + 1]!, g.P[3 * k + 2]!); if (alaWeight(spec, p) < 0.999) continue;
    const s = p.x >= 0 ? 0 : 1, a = alaOf(spec, s === 0 ? 1 : -1); if (Math.hypot((p.x - a.c.x) / a.ex, (p.y - a.c.y) / a.ey, (p.z - a.c.z) / a.ez) > 1.4) continue;
    wing[k] = s + 1; cnt[s]!++; dsum[s]! += g.depth[k]!; sums[s]! += 1;
  }
  const near = cnt[0]! && cnt[1]! ? (dsum[0]! / cnt[0]! < dsum[1]! / cnt[1]! ? 0 : 1) : cnt[0]! ? 0 : cnt[1]! ? 1 : -1;
  if (near < 0 || cnt[near]! < 40) return null;
  const mask: Uint8Array = new Uint8Array(g.w * g.h); for (let k = 0; k < mask.length; k++) if (wing[k] === near + 1) mask[k] = 1;
  const dil = (src: Uint8Array): Uint8Array => { const o = new Uint8Array(src.length); for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) { const k = y * g.w + x; if (src[k] || src[k - 1] || src[k + 1] || src[k - g.w] || src[k + g.w]) o[k] = 1; } return o; };
  let d2: Uint8Array = mask; const layers: Uint8Array[] = [mask]; for (let i = 0; i < 7; i++) { d2 = dil(d2); layers.push(d2); }
  let wl = 0, wn = 0, rl = 0, rn = 0; const ringV: number[] = [];
  for (let k = 0; k < mask.length; k++) { if (mask[k]) { wl += lum(pa.rgba, k); wn++; } else if (layers[7]![k] && !layers[2]![k] && g.id[k] === PART.head) { const l = lum(pa.rgba, k); rl += l; rn++; ringV.push(l); } }
  if (!rn || !wn) return null;
  // saut à la lisière : pixel de masque adjacent à un pixel de peau hors masque
  const jumps: number[] = []; for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) { const k = y * g.w + x; if (!mask[k]) continue; for (const o of [-1, 1, -g.w, g.w]) { const m = k + o; if (!mask[m] && g.id[m] === PART.head) jumps.push(Math.abs(lum(pa.rgba, k) - lum(pa.rgba, m))); } }
  jumps.sort((a, b) => a - b); const edge = jumps.length ? jumps[Math.floor(0.9 * jumps.length)]! : 0, mu = rl / rn;
  let dec: Record<string, number> | undefined;
  if (process.env.DECOMP) {
    const rl2 = reliefLight(spec, g, { lineU: 0.022, ppuHi: hi.ppu, light: model, shadowTint: null }, model, view), acc = { w: [0, 0, 0, 0, 0, 0], r: [0, 0, 0, 0, 0, 0] }, add = (a: number[], c: number, ao: number, ndl: number, lt: number, ndlRaw: number): void => { a[0]! += c; a[1]! += ao; a[2]! += ndl; a[3]! += lt; a[4]! += ndlRaw; a[5]!++; };
    for (let k = 0; k < mask.length; k++) {
      const inWing = mask[k]!, inRing = !inWing && layers[7]![k] && !layers[2]![k] && g.id[k] === PART.head; if (!inWing && !inRing) continue;
      const p = v3(g.P[3 * k]!, g.P[3 * k + 1]!, g.P[3 * k + 2]!), nh = norm(v3(g.N[3 * k]!, g.N[3 * k + 1]!, g.N[3 * k + 2]!)), nL = dirToCam(inWing ? softenedNormal(spec, p, nh) : nh, view, 'head', p.y), nR = dirToCam(nh, view, 'head', p.y);
      const sh = shadeAt(model, nL, rl2.cast[k]!, rl2.ao[k]!), ndl = nL.x * model.dir.x + nL.y * model.dir.y + nL.z * model.dir.z, ndlR = nR.x * model.dir.x + nR.y * model.dir.y + nR.z * model.dir.z;
      add(inWing ? acc.w : acc.r, rl2.cast[k]!, rl2.ao[k]!, ndl, sh.lit, ndlR);
    }
    const m = (a: number[], i: number): number => a[i]! / a[5]!;
    dec = { wCast: m(acc.w, 0), rCast: m(acc.r, 0), wAo: m(acc.w, 1), rAo: m(acc.r, 1), wNdl: m(acc.w, 2), rNdl: m(acc.r, 2), wNdlRaw: m(acc.w, 4), wLit: m(acc.w, 3), rLit: m(acc.r, 3) };
  }
  return { ...(dec ? { dec } : {}), ratio: wl / wn / mu, edge, wingPx: wn, ringStd: Math.sqrt(ringV.reduce((s, v) => s + (v - mu) ** 2, 0) / rn) };
}
const r3 = (x: number): number => +x.toFixed(3);
if (process.argv[1]?.endsWith('alar-spot-measure.ts')) {
  const N = Number(process.env.N ?? 8), YAWS = (process.env.YAWS ?? '30,45,60').split(',').map(Number);
  for (const a of ['pyramide', 'cloche-ailes', 'plat-trapeze', undefined] as const) for (const yaw of YAWS) {
    const rows = Array.from({ length: N }, (_, k) => spotOf(head3dSubject(hostOf(11 + k * 37, a), {} as never).spec, yaw)).filter((x): x is Spot => !!x);
    if (process.env.PERSEED) console.log('  par graine (ratio / bord) :', rows.map((r) => `${r3(r.ratio)}/${r3(r.edge)}`).join('  '));
    const med = (xs: number[]): number => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)] ?? NaN;
    if (process.env.DECOMP) { const d0 = rows.map((r) => r.dec!); const mm = (k: string): number => r3(med(d0.map((d) => d[k]!))); console.log('  décomposition médiane :', JSON.stringify(Object.fromEntries(Object.keys(d0[0]!).map((k) => [k, mm(k)])))); }
    console.log(String(a ?? 'libre').padEnd(13), String(yaw).padStart(3) + '°', 'n', rows.length, 'ratio méd', r3(med(rows.map((r) => r.ratio))), 'max', r3(Math.max(...rows.map((r) => r.ratio))), '| bord méd', r3(med(rows.map((r) => r.edge))), 'max', r3(Math.max(...rows.map((r) => r.edge))), '| écart-type anneau méd', r3(med(rows.map((r) => r.ringStd))));
  }
}

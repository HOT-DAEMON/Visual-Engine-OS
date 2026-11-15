/**
 * Ajustement de l'enveloppe almond (PASSE 3) : `npx tsx scripts/eye-refs/fit-almond.ts [--write]`.
 * 8 facteurs (u1, u2, l1, l2 × dx, dy) ; Nelder-Mead ; coût = RMS profils haut+bas vs REF_PROFILE (mesuré) + écarts d'angles de canthus vs mesures de face
 * (externe 119,0°, interne 93,7°) + pénalité d'apex (la fraction haute reste celle de la forme de base). Aucune valeur inventée : cibles lues dans measures.json.
 */
import { readFileSync } from 'node:fs';
import { ALMOND_REF, REF_PROFILE, openingGeometry, openingProfile } from '../../src/geometry/eye';
import { Shape } from '../../src/schema/eye-shape';
import { Canthi } from '../../src/schema/eye-canthi-fold';

type F = { -readonly [K in keyof typeof ALMOND_REF]: number };
const KEYS = ['u1dx', 'u1dy', 'u2dx', 'u2dy', 'l1dx', 'l1dy', 'l2dx', 'l2dy'] as const;
const M = JSON.parse(readFileSync('references/eyes/measures.json', 'utf8')).eyes as Record<string, { canthusAngleDeg?: { inner: number; outer: number }; canthusAngles?: { inner: number; outer: number } }>;
const ang = ['04', '07', '11'].map((k) => M[k]!.canthusAngleDeg ?? M[k]!.canthusAngles).filter(Boolean) as { inner: number; outer: number }[];
const target = ang.length === 3 ? { inner: ang.reduce((s, a) => s + a.inner, 0) / 3, outer: ang.reduce((s, a) => s + a.outer, 0) / 3 } : { inner: 93.67, outer: 119.0 };
const norm = (v: readonly number[]): number[] => { const m = Math.max(...v.map(Math.abs)); return v.map((x) => x / m); };
const rms = (a: readonly number[], b: readonly number[]): number => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]!) ** 2, 0) / a.length);
const base = Shape.parse({ style: 'almond' });
const upF0 = 0.5 * 0 + openingProfile(openingGeometry(base, Canthi.parse({}))).upperFraction; // fraction haute à conserver

function measure(f: F): { p: ReturnType<typeof openingProfile> } {
  const saved = { ...ALMOND_REF };
  Object.assign(ALMOND_REF, f);
  const p = openingProfile(openingGeometry(base, Canthi.parse({})));
  Object.assign(ALMOND_REF, saved);
  return { p };
}
const W_ANGLE = Number(process.env.W_ANGLE ?? 0.0006); // coût par degré d’écart d’angle (le RMS de profil vaut ~0,002–0,04)
function cost(x: number[]): number {
  const f = Object.fromEntries(KEYS.map((k, i) => [k, x[i]!])) as F;
  if (x.some((v) => v < 0.2 || v > 3)) return 1e9;
  const { p } = measure({ ...ALMOND_REF, ...f } as F);
  const c = rms(norm([...p.upper]), REF_PROFILE.upper) + rms(norm([...p.lower]), REF_PROFILE.lower);
  return c + W_ANGLE * (Math.abs(p.canthusAngleDeg.inner - target.inner) + Math.abs(p.canthusAngleDeg.outer - target.outer)) + 5 * Math.abs(p.upperFraction - upF0);
}
function nelderMead(f: (x: number[]) => number, x0: number[], iters = 2500): number[] {
  const n = x0.length;
  let S = [x0, ...x0.map((_, i) => x0.map((v, j) => (i === j ? v * 1.08 : v)))].map((x) => ({ x, y: f(x) }));
  for (let it = 0; it < iters; it++) {
    S.sort((a, b) => a.y - b.y);
    const c = S[0]!.x.map((_, j) => S.slice(0, n).reduce((s, p) => s + p.x[j]!, 0) / n);
    const w = S[n]!;
    const pt = (t: number) => c.map((v, j) => v + t * (w.x[j]! - v));
    const r = pt(-1); const yr = f(r);
    if (yr < S[0]!.y) { const e = pt(-2); const ye = f(e); S[n] = ye < yr ? { x: e, y: ye } : { x: r, y: yr }; }
    else if (yr < S[n - 1]!.y) S[n] = { x: r, y: yr };
    else { const k = pt(yr < w.y ? -0.5 : 0.5); const yk = f(k); if (yk < Math.min(yr, w.y)) S[n] = { x: k, y: yk }; else S = S.map((p, i) => (i === 0 ? p : { x: p.x.map((v, j) => S[0]!.x[j]! + 0.5 * (v - S[0]!.x[j]!)), y: NaN })).map((p) => (Number.isNaN(p.y) ? { x: p.x, y: f(p.x) } : p)); }
  }
  S.sort((a, b) => a.y - b.y);
  return S[0]!.x;
}
const x0 = KEYS.map((k) => ALMOND_REF[k] ?? 1);
let best = nelderMead(cost, x0);
for (let r = 0; r < 4; r++) best = nelderMead(cost, best, 1500);
const fit = Object.fromEntries(KEYS.map((k, i) => [k, +best[i]!.toFixed(3)]));
const before = measure({ ...ALMOND_REF } as F).p;
const after = measure({ ...ALMOND_REF, ...fit } as F).p;
const rep = (p: ReturnType<typeof openingProfile>) => ({ inner: p.canthusAngleDeg.inner, outer: p.canthusAngleDeg.outer, upF: p.upperFraction, rmsUp: +rms(norm([...p.upper]), REF_PROFILE.upper).toFixed(4), rmsLo: +rms(norm([...p.lower]), REF_PROFILE.lower).toFixed(4), upPeak: p.upperPeakAt, loPeak: p.lowerPeakAt });
console.log(JSON.stringify({ target, before: rep(before), after: rep(after), fit }, null, 1));

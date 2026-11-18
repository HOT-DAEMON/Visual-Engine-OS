/**
 * Ajustement de l'enveloppe almond (PASSE 7, EYES-REFS-4) : `npx tsx scripts/eye-refs/fit-almond.ts [--write]`.
 *
 * Ce qui change par rapport à la PASSE 3 :
 *  - le coût est mesuré en UNITÉS DE LARGEUR (pas de profil « normalisé par son max », qui cachait les écarts de hauteur) ;
 *  - l'œil est évalué avec SES PROPRES aspect / fraction haute / inclinaison (les paramètres de forme sont consommés, pas moyennés) :
 *    un seul jeu de 8 facteurs doit expliquer 04, 07 et 11 en même temps ;
 *  - contrat « la hauteur demandée est la hauteur obtenue » : pénalité sur |aspect moteur − aspect demandé| ;
 *  - les angles de canthus ne sont plus calés au dixième de degré sur la MOYENNE (écart-type inter-références : 13° interne, 28° externe) :
 *    ils sont comparés avec une tolérance égale à cet écart-type, par une définition COMMUNE (corde à x = 0,05 dans le repère des canthi,
 *    calculée sur les profils de 21 points des deux côtés) ;
 *  - `--write` réécrit réellement la ligne ALMOND_REF de `src/geometry/eye/opening-ref.ts`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { ALMOND_REF, canthusChordAngles, openingGeometry, openingProfile } from '../../src/geometry/eye';
import { Shape } from '../../src/schema/eye-shape';
import { Canthi } from '../../src/schema/eye-canthi-fold';

type F = { -readonly [K in keyof typeof ALMOND_REF]: number };
export const KEYS = ['u1dx', 'u1dy', 'u2dx', 'u2dy', 'l1dx', 'l1dy', 'l2dx', 'l2dy'] as const;
export const FRONT = ['04', '07', '11'] as const;
type Ref = { aspect: number; upperFraction: number; tiltDeg: number; upperProfile: number[]; lowerProfile: number[] };
const M = JSON.parse(readFileSync('references/eyes/measures.json', 'utf8')).eyes as Record<string, Ref>;

const rms = (a: readonly number[], b: readonly number[]): number => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]!) ** 2, 0) / a.length);
export const chordAngles = canthusChordAngles;   // définition commune, partagée avec la vérification (src/geometry/eye/profile.ts)
const base = (r: Ref) => Shape.parse({ style: 'almond', width: 1000, height: r.aspect * 1000, upperFraction: r.upperFraction, tiltDeg: r.tiltDeg });
export function evalEye(r: Ref, f: F | typeof ALMOND_REF) {
  const saved = { ...ALMOND_REF };
  Object.assign(ALMOND_REF, f);
  const p = openingProfile(openingGeometry(base(r), Canthi.parse({})));
  Object.assign(ALMOND_REF, saved);
  return p;
}
const refChord = FRONT.map((k) => chordAngles(M[k]!.upperProfile, M[k]!.lowerProfile));
const sd = (v: number[]): number => { const m = v.reduce((s, x) => s + x, 0) / v.length; return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length); };
const TOL = { inner: Math.max(5, sd(refChord.map((c) => c.inner))), outer: Math.max(5, sd(refChord.map((c) => c.outer))) };
const MEAN = { inner: refChord.reduce((s, c) => s + c.inner, 0) / 3, outer: refChord.reduce((s, c) => s + c.outer, 0) / 3 };

export function report(f: F | typeof ALMOND_REF) {
  const eyes = FRONT.map((k, i) => {
    const r = M[k]!; const p = evalEye(r, f); const ch = chordAngles(p.upper, p.lower);
    return { id: k, rmsUp: rms(p.upper, r.upperProfile), rmsLo: rms(p.lower, r.lowerProfile), dAspect: p.aspect - r.aspect, dUpF: p.upperFraction - r.upperFraction, chord: ch, refChord: refChord[i]! };
  });
  const mean = (g: (e: (typeof eyes)[number]) => number): number => eyes.reduce((s, e) => s + g(e), 0) / eyes.length;
  return { eyes, meanRmsUp: mean((e) => e.rmsUp), meanRmsLo: mean((e) => e.rmsLo), meanAbsDAspect: mean((e) => Math.abs(e.dAspect)), meanAbsDUpF: mean((e) => Math.abs(e.dUpF)) };
}
function cost(x: number[]): number {
  if (x.some((v) => v < 0.2 || v > 3.2)) return 1e9;
  const f = Object.fromEntries(KEYS.map((k, i) => [k, x[i]!])) as F;
  let c = 0;
  for (const k of FRONT) {
    const r = M[k]!; const p = evalEye(r, f); const ch = chordAngles(p.upper, p.lower);
    const i = FRONT.indexOf(k);
    c += rms(p.upper, r.upperProfile) + rms(p.lower, r.lowerProfile);
    c += 2 * Math.abs(p.aspect - r.aspect) + 2 * Math.abs(p.upperFraction - r.upperFraction); // contrat de hauteur
    c += 0.0008 * (Math.max(0, Math.abs(ch.inner - refChord[i]!.inner) - TOL.inner) + Math.max(0, Math.abs(ch.outer - refChord[i]!.outer) - TOL.outer));
  }
  return c / FRONT.length;
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
if (process.argv[1]?.endsWith('fit-almond.ts')) {
  const x0 = KEYS.map((k) => ALMOND_REF[k] ?? 1);
  let best = nelderMead(cost, x0);
  let prev = cost(best);
  // « boucle jusqu'à parfait » : on relance tant que le coût baisse de plus de 1e-5 (plafond 12 tours)
  for (let r = 0; r < 12; r++) { best = nelderMead(cost, best, 1500); const c = cost(best); if (prev - c < 1e-5) break; prev = c; }
  const fit = Object.fromEntries(KEYS.map((k, i) => [k, +best[i]!.toFixed(3)])) as F;
  const out = { tol: TOL, refMeanChord: MEAN, before: report(ALMOND_REF), after: report(fit), cost: { before: cost(x0), after: cost(best) }, fit };
  console.log(JSON.stringify(out, null, 1));
  if (process.argv.includes('--write')) {
    const path = 'src/geometry/eye/opening-ref.ts';
    const src = readFileSync(path, 'utf8');
    const line = `export const ALMOND_REF: EnvelopeRefFactors = { ${KEYS.map((k) => `${k}: ${fit[k]}`).join(', ')} };`;
    writeFileSync(path, src.replace(/export const ALMOND_REF: EnvelopeRefFactors = \{[^}]*\};/, line));
    console.log('écrit :', line);
  }
}

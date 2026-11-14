/**
 * Ajuste les paramètres d'ENVELOPPE du moteur existant (`geometry/eye/opening*.ts`, 12 styles) sur les silhouettes mesurées de references/eyes/measures-silhouettes.json
 * (13, 15, 17) : pas de moteur par référence, seulement des RECETTES (style + aspect, fraction haute, ouverture, rondeur des canthi) qui reproduisent leur profil.
 * Sortie : src/generation/eye-ref-fits.ts (constantes versionnées, relues par eye-gallery-ext). `npx tsx scripts/eye-refs/fit-recipes.ts`.
 * Coût = écart quadratique moyen entre les profils haut + bas (21 points, unités de largeur de l'ouverture) de l'enveloppe du moteur et de la référence ;
 * l'inclinaison des canthi est imposée par la mesure (bornée à ± 30°, limite du schéma). Les paires gauche/droite de la réf. 15 sont moyennées.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { mulberry32 } from '../../src/core/prng';
import { openingGeometry, openingProfile } from '../../src/geometry/eye';
import { checkEyeEnvelope } from '../../src/verify/eye-envelope';
import { Canthi } from '../../src/schema/eye-canthi-fold';
import { Shape } from '../../src/schema/eye-shape';

const STYLES = ['almond', 'round', 'sharp', 'drooping', 'chibi', 'angular', 'compressed', 'rounded_rect', 'triangle', 'circle', 'diamond', 'diamond_v2'] as const;
interface M { upperProfile: number[]; lowerProfile: number[]; tiltDeg: number; aspect: number; upperFraction: number }
const sil = JSON.parse(readFileSync('references/eyes/measures-silhouettes.json', 'utf8')).eyes as Record<string, M>;
const avg = (a: M, b: M): M => ({ upperProfile: a.upperProfile.map((v, i) => (v + b.upperProfile[i]!) / 2), lowerProfile: a.lowerProfile.map((v, i) => (v + b.lowerProfile[i]!) / 2), tiltDeg: (a.tiltDeg + b.tiltDeg) / 2, aspect: (a.aspect + b.aspect) / 2, upperFraction: (a.upperFraction + b.upperFraction) / 2 });
const targets: Record<string, { m: M; source: string }> = {};
for (const k of ['13-E5', '13-E10', '17-A', '17-C']) if (sil[k]) targets[k] = { m: sil[k]!, source: k };
['A', 'B', 'C', 'D', 'E'].forEach((n, i) => { const a = sil[`15-0${2 * i}`], b = sil[`15-0${2 * i + 1}`]; if (a && b) targets[`15-${n}`] = { m: avg(a, b), source: `15-0${2 * i}+15-0${2 * i + 1}` }; });

type P = { aspect: number; upperFraction: number; openness: number; inner: number; outer: number };
const LO: P = { aspect: 0.3, upperFraction: 0.4, openness: 0.5, inner: 0.05, outer: 0.05 }, HI: P = { aspect: 1.2, upperFraction: 0.8, openness: 1.2, inner: 0.95, outer: 0.95 };
const WIDTH = 240; const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const build = (style: (typeof STYLES)[number], p: P, tilt: number) => ({ shape: Shape.parse({ width: WIDTH, height: WIDTH * p.aspect, tiltDeg: clamp(tilt, -30, 30), upperFraction: p.upperFraction, openness: p.openness, style }), canthi: Canthi.parse({ inner: { roundness: p.inner, caruncle: 0.5 }, outer: { roundness: p.outer } }) });
function cost(style: (typeof STYLES)[number], p: P, m: M): number {
  try {
    const { shape, canthi } = build(style, p, m.tiltDeg); const g = openingGeometry(shape, canthi); const pr = openingProfile(g);
    if (checkEyeEnvelope(g, style, 0).some((c) => !c.ok && c.severity === 'error')) return Infinity;
    let s = 0; for (let i = 0; i < 21; i++) { s += (pr.upper[i]! - m.upperProfile[i]!) ** 2 + (pr.lower[i]! - m.lowerProfile[i]!) ** 2; }
    return Math.sqrt(s / 42);
  } catch { return Infinity; }
}
const keys = Object.keys(LO) as (keyof P)[];
function fit(m: M, seed: number) {
  const rnd = mulberry32(seed); let best = { style: 'almond' as (typeof STYLES)[number], p: LO, c: Infinity };
  for (const style of STYLES) {
    let sb = { p: LO, c: Infinity };
    for (let n = 0; n < 1800; n++) { const p = Object.fromEntries(keys.map((k) => [k, LO[k] + rnd() * (HI[k] - LO[k])])) as P; const c = cost(style, p, m); if (c < sb.c) sb = { p, c }; }
    let step = 0.12;
    for (let it = 0; it < 120 && step > 1e-3; it++) {
      let moved = false;
      for (const k of keys) for (const d of [-1, 1]) { const q = { ...sb.p, [k]: clamp(sb.p[k] + d * step * (HI[k] - LO[k]), LO[k], HI[k]) }; const c = cost(style, q, m); if (c < sb.c) { sb = { p: q, c }; moved = true; } }
      if (!moved) step *= 0.5;
    }
    if (sb.c < best.c) best = { style, p: sb.p, c: sb.c };
  }
  return best;
}
const out = Object.entries(targets).map(([id, { m, source }], i) => {
  const b = fit(m, 0xe7e + i);
  const r = (v: number): number => Math.round(v * 1e4) / 1e4;
  console.log(id.padEnd(6), b.style.padEnd(13), 'rms', r(b.c), 'asp', r(b.p.aspect), 'upF', r(b.p.upperFraction), 'open', r(b.p.openness), 'in/out', r(b.p.inner), r(b.p.outer), '| mesuré asp', m.aspect, 'upF', m.upperFraction, 'tilt', m.tiltDeg);
  return { id, source, style: b.style, aspect: r(b.p.aspect), tiltDeg: r(clamp(m.tiltDeg, -30, 30)), upperFraction: r(b.p.upperFraction), openness: r(b.p.openness), innerRoundness: r(b.p.inner), outerRoundness: r(b.p.outer), rms: r(b.c), measuredAspect: m.aspect, measuredUpperFraction: m.upperFraction };
});
writeFileSync('src/generation/eye-ref-fits.ts', `/** GÉNÉRÉ par scripts/eye-refs/fit-recipes.ts (ne pas éditer à la main) : recettes d'enveloppe ajustées sur references/eyes/measures-silhouettes.json (réfs. 13, 15, 17). */\nexport interface RefFit { readonly id: string; readonly source: string; readonly style: string; readonly aspect: number; readonly tiltDeg: number; readonly upperFraction: number; readonly openness: number; readonly innerRoundness: number; readonly outerRoundness: number; readonly rms: number; readonly measuredAspect: number; readonly measuredUpperFraction: number }\nexport const REF_FITS: readonly RefFit[] = ${JSON.stringify(out, null, 1)};\n`);

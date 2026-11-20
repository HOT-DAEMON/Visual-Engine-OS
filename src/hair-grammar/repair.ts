import { analyzeComposition } from './compose';
import { verifyComposed, type Defect, type Verdict } from './compose-verify';
import { emergeFrom } from './emerge';
import { sampleLock, type HairProfile } from './grammar';
import type { View } from './head';
import type { LockSpec } from './lock';
import { paintLock } from './paint';
import { clamp, norm, prng, v3, type V3 } from './vec';

/**
 * CYCLE DE RÉPARATION — détecter · identifier le composant · corriger LOCALEMENT · reconstruire · revérifier · GARDER ou ANNULER.
 * Un défaut localisé (`compose-verify.ts`) désigne une mèche ou une famille ; chaque code a une table de corrections candidates, essayées
 * dans l'ordre sur la seule mèche concernée. Une correction n'est gardée que si le score de défauts BAISSE (jamais de régression
 * silencieuse) ; sinon elle est annulée et la suivante essayée. Le journal garde chaque tentative (gardée ou annulée) et sa raison.
 */
export interface Attempt { readonly code: string; readonly lock?: string; readonly fix: string; readonly before: number; readonly after: number; readonly kept: boolean }
export interface RepairResult { readonly specs: LockSpec[]; readonly verdict: Verdict; readonly journal: Attempt[] }

const rotZ = (v: V3, a: number): V3 => v3(v.x * Math.cos(a) - v.y * Math.sin(a), v.x * Math.sin(a) + v.y * Math.cos(a), v.z);
type Fix = { readonly name: string; readonly apply: (L: LockSpec, ctx: Ctx) => LockSpec };
interface Ctx { readonly P: HairProfile; readonly view: View; readonly specs: readonly LockSpec[]; readonly seed: number; readonly defect: Defect }

const regenerate = (k: number): Fix => ({ name: `régénérer (tirage ${k})`, apply: (L, c) => { const F = c.P.families.find((f) => f.id === L.family); if (!F) return L; const i = Number(L.id.split('-').pop() ?? 0); const fresh = sampleLock(c.P, F, i, prng(c.seed * 977 + k * 131 + i)); return { ...fresh, id: L.id, ...(L.weave ? { weave: L.weave } : {}) }; } });
const FIXES: Record<string, Fix[]> = {
  'geom.finite': [regenerate(1), regenerate(2), regenerate(3)],
  'geom.degenerate': [{ name: 'allonger ×1,5', apply: (L) => ({ ...L, length: L.length * 1.5 }) }, regenerate(1), regenerate(2)],
  'geom.self': [{ name: 'réduire la courbure et le retroussé', apply: (L) => ({ ...L, bend: L.bend * 0.5, flick: { ...L.flick, amt: L.flick.amt * 0.5 } }) }, { name: 'raccourcir ×0,8', apply: (L) => ({ ...L, length: L.length * 0.8 }) }, regenerate(1)],
  'geom.emerge': [{ name: 'détachement ÷2', apply: (L, c) => { const par = c.specs.find((s) => s.id === L.parent?.id); return par && L.parent ? emergeFrom(c.P.head, par, L, { t: L.parent.t, peel: 0.3 }) : L; } }, regenerate(1)],
  'anat.eye': [{ name: 'écarter le cap de l\'œil (+0,4 rad)', apply: (L) => ({ ...L, aim: norm(rotZ(L.aim, 0.4)) }) }, { name: 'écarter le cap de l\'œil (−0,4 rad)', apply: (L) => ({ ...L, aim: norm(rotZ(L.aim, -0.4)) }) }, { name: 'raccourcir ×0,7', apply: (L) => ({ ...L, length: L.length * 0.7 }) }],
  'style.speckle': [{ name: 'élargir ×1,2', apply: (L) => ({ ...L, width: L.width * 1.2 }) }, { name: 'élargir ×1,4', apply: (L) => ({ ...L, width: L.width * 1.4 }) }],
  'style.coherence': [{ name: 'aligner le cap sur la lecture', apply: (L, c) => { const r = analyzeComposition(c.P.head, c.specs, c.view).reading.angle; return { ...L, aim: norm(rotZ(L.aim, clamp(r * 0.2, -0.5, 0.5))) }; } }],
};

export function repairCycle(P: HairProfile, specs0: readonly LockSpec[], view: View, seed = 1, maxAttempts = 12): RepairResult {
  let specs = [...specs0]; let verdict = verifyComposed(P.head, specs, view); const journal: Attempt[] = [];
  const tried = new Set<string>();
  for (let n = 0; n < maxAttempts && verdict.defects.length; n++) {
    const d = verdict.defects.filter((x) => x.lock && FIXES[x.code]).sort((a, b) => b.severity - a.severity).find((x) => FIXES[x.code]?.some((_, i) => !tried.has(`${x.code}|${x.lock}|${i}`)));
    if (!d) break;
    const fixes = FIXES[d.code] as Fix[]; const fi = fixes.findIndex((_, i) => !tried.has(`${d.code}|${d.lock}|${i}`)); tried.add(`${d.code}|${d.lock}|${fi}`);
    const idx = specs.findIndex((s) => s.id === d.lock); if (idx < 0) continue;
    const trial = specs.map((s, i) => (i === idx ? (fixes[fi] as Fix).apply(s, { P, view, specs, seed, defect: d }) : s));
    const v2 = verifyComposed(P.head, trial, view, trial.map((L) => paintLock(P.head, L, view)));
    const kept = v2.score < verdict.score;
    journal.push({ code: d.code, ...(d.lock ? { lock: d.lock } : {}), fix: (fixes[fi] as Fix).name, before: verdict.score, after: v2.score, kept });
    if (kept) { specs = trial; verdict = v2; }
  }
  return { specs, verdict, journal };
}

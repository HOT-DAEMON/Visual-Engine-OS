import { readFileSync, writeFileSync } from 'node:fs';
import { faceLandmarks, noseGeometry } from '../../src/face';
import { FaceParams } from '../../src/schema';
import { noseView } from '../../src/face/nose/underview';
import type { UnderviewModel } from '../../src/face/nose/underview-model';
import { identifyAngles, normaliseModel } from '../../src/face/nose/underview-identify';

/**
 * AJUSTEMENT des quatre fractions z de la vue de dessous (`UnderviewModel`) sur references/nez/04.jpg (`measures-04.json`), PROTOCOLE v2 (12 nov. 2026).
 *
 * Défaut du protocole v1 (documenté dans docs/NOSE-UNDERVIEW.md §4) : le tangage était un paramètre LIBRE par nez, ajusté sur les quatre grandeurs à la fois.
 * Il absorbait donc l'erreur du modèle : la comparaison avantageait le modèle.
 *
 * Protocole v2 :
 *  1. Les mesures sont celles du repère PROPRE de l'ellipse (roulis compensé, invariant au roulis : voir tests/nose-underview.test.ts), nez à orientation
 *     ambiguë exclus (`frame.valid`).
 *  2. Pour un modèle donné, le tangage ET le lacet d'un nez sont IDENTIFIÉS UNIQUEMENT à partir de deux grandeurs observées : le rapport d'axes de
 *     l'ellipse et |décalage latéral du sommet du triangle| (le lacet décale la pointe, qui est devant le plan, mais pas le sous-nez, qui est dans le plan).
 *  3. Le modèle est JUGÉ sur trois autres grandeurs, jamais utilisées pour fixer ces deux angles : hauteur du triangle, position de sa base, dépassement du sommet.
 *  4. Les quatre constantes sont ajustées pour minimiser l'erreur sur CINQ grandeurs : les trois prédites + les deux d'identification (le modèle doit pouvoir
 *     reproduire les ellipses plates de la référence ; une première version sans ce terme trouvait un optimum dégénéré, r ≥ 0,55 impossible à descendre).
 *  5. Leave-one-out : on retire un nez, on réajuste les constantes, on IDENTIFIE ses angles par ses deux grandeurs observées, on prédit les trois autres.
 *  6. Références de comparaison au même protocole : (a) médiane sans modèle ; (b) régression linéaire des trois grandeurs sur les deux observables (même
 *     information que le modèle, sans géométrie), elle aussi en leave-one-out.
 *  7. Identifiabilité : profil du coût en fonction de chaque constante (les autres au optimum) et bootstrap des nez (rééchantillonnage avec remise).
 * Sortie : src/face/nose/underview.generated.ts (ne pas éditer à la main).
 */
interface Ref { index: number; r: number; u: number; h: number; by: number; ab: number }
const raw = JSON.parse(readFileSync('references/nez/measures-04.json', 'utf8')).noses as { index: number; ellipse: { axisRatio: number }; triangle: null | { degenerate: boolean; frame: { valid: boolean; heightOverMinor: number; baseVRelCentre: number; apexBelowBottom: number; apexUOverMajor: number } } }[];
const refs: Ref[] = raw.filter((n) => n.triangle && !n.triangle.degenerate && n.triangle.frame.valid).map((n) => ({ index: n.index, r: n.ellipse.axisRatio, u: Math.abs(n.triangle!.frame.apexUOverMajor), h: n.triangle!.frame.heightOverMinor, by: n.triangle!.frame.baseVRelCentre, ab: n.triangle!.frame.apexBelowBottom }));
const FAST = process.env.FAST === '1';
const p = FaceParams.parse({ anatomyEngine: 'structured' });
const geo = noseGeometry(p, faceLandmarks(p, 300, 380));
const BOUNDS: Record<keyof UnderviewModel, [number, number]> = { lobuleRim: [0.05, 0.95], alarTop: [0.05, 0.95], alarBase: [0.0, 0.95], nostril: [0.05, 0.95] };
const KEYS = ['lobuleRim', 'alarTop', 'alarBase', 'nostril'] as (keyof UnderviewModel)[];
const norm = normaliseModel;   // l'aile n'est jamais derrière son pied
const std = (a: number[]): number => { const mu = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - mu) ** 2, 0) / a.length); };
const SR = std(refs.map((t) => t.r)), SU = std(refs.map((t) => t.u));      // échelles tirées des DONNÉES, pas fixées à la main
const SD = { h: std(refs.map((t) => t.h)), by: std(refs.map((t) => t.by)), ab: std(refs.map((t) => t.ab)), r: SR, u: SU } as const;
// TOUTES les erreurs sont normalisées par l'écart-type de la grandeur sur les références : l'erreur est une fraction de variance non expliquée
// (le prédicteur « médiane » vaut ≈ 1 par construction, un modèle utile doit descendre nettement sous 1).

/** Identification (tangage, lacet) : module unique du moteur (`src/face/nose/underview-identify.ts`), partagé avec les artefacts et les tests. */
function identify(m0: UnderviewModel, t: Ref): { pitch: number; yaw: number; e: number } | null {
  const r = identifyAngles(geo, m0, { r: t.r, u: t.u }, { sr: SR, su: SU });
  return r ? { pitch: r.pitchDeg, yaw: r.yawDeg, e: r.misfit } : null;
}
/**
 * Erreur d'un nez : `sq3` = erreur de PRÉDICTION sur les trois grandeurs jamais utilisées pour l'identification ; `sq` = moyenne des 5 écarts carrés, en
 * ajoutant les deux grandeurs d'identification (le modèle doit pouvoir REPRODUIRE le rapport d'axes et le décalage du sommet avec deux angles seulement :
 * sans ce terme, un modèle incapable de produire les ellipses plates des références passerait inaperçu, l'identification se contentant du plus proche angle).
 */
function predict(m0: UnderviewModel, t: Ref, id = identify(m0, t)): { sq: number; sq3: number; id: NonNullable<ReturnType<typeof identify>> } | null {
  if (!id) return null;
  const v = noseView(geo, id.pitch, id.yaw, norm(m0)), f = v.frame;
  const sq3 = (((f.heightOverMinor - t.h) / SD.h) ** 2 + ((f.baseVRelCentre - t.by) / SD.by) ** 2 + ((f.apexBelowBottom - t.ab) / SD.ab) ** 2) / 3;
  const sqId = (((v.ellipse.axisRatio - t.r) / SD.r) ** 2 + ((Math.abs(f.apexUOverMajor) - t.u) / SD.u) ** 2) / 2;
  return { sq: (3 * sq3 + 2 * sqId) / 5, sq3, id };
}
const PENAL = 4;   // un nez pour lequel aucune vue valide n'existe est pénalisé fortement (4 écarts-types au carré)
const cost = (m: UnderviewModel, set: Ref[]): number => Math.sqrt(set.reduce((s, t) => s + (predict(m, t)?.sq ?? PENAL), 0) / set.length);

let seed = 20261112; const rnd = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
function fit(set: Ref[], starts: number, passes: number): { m: UnderviewModel; c: number } {
  const rand = (): UnderviewModel => Object.fromEntries(KEYS.map((k) => [k, BOUNDS[k][0] + (BOUNDS[k][1] - BOUNDS[k][0]) * rnd()])) as unknown as UnderviewModel;
  let best = rand(), bc = cost(best, set);
  for (let i = 0; i < starts; i++) { const m = rand(), c = cost(m, set); if (c < bc) { best = m; bc = c; } }
  for (let pass = 0; pass < passes; pass++) for (const k of KEYS) for (const f of [0.15, 0.06, 0.02]) for (const s of [-1, 1]) {
    const m = { ...best, [k]: Math.min(BOUNDS[k][1], Math.max(BOUNDS[k][0], best[k] + s * f * (BOUNDS[k][1] - BOUNDS[k][0]))) } as UnderviewModel;
    const c = cost(m, set); if (c < bc) { best = m; bc = c; }
  }
  return { m: norm(best), c: bc };
}

const STARTS = FAST ? 20 : 50, PASSES = FAST ? 1 : 2;
const full = fit(refs, STARTS, PASSES);
const r4 = (x: number): number => Math.round(x * 1e4) / 1e4;
console.log(`nez utilisés : ${refs.length} (indices ${refs.map((t) => t.index).join(',')}) · σ(r)=${r4(SR)} σ(|u|)=${r4(SU)}`);
console.log('modèle ajusté', Object.fromEntries(KEYS.map((k) => [k, r4(full.m[k])])), 'coût (5 grandeurs : prédiction de h, by, ab + reproduction de r, |u|)', r4(full.c));

// (a) médiane sans modèle ; (b) régression linéaire sur (r, |u|) — toutes deux sur h, by, ab
const med = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
const targets = ['h', 'by', 'ab'] as const, targets5 = ['h', 'by', 'ab', 'r', 'u'] as const;
const rmsOf = (sq: number[]): number => Math.sqrt(sq.reduce((s, x) => s + x, 0) / sq.length);
const baseMed = rmsOf(refs.map((t) => targets5.reduce((s, k) => s + ((med(refs.map((x) => x[k])) - t[k]) / SD[k]) ** 2, 0) / 5));
/** Moindres carrés ordinaires y ~ a + b r + c u (équations normales 3×3, élimination de Gauss). */
function ols(set: Ref[], k: (typeof targets)[number]): [number, number, number] {
  const X = set.map((t) => [1, t.r, t.u]), y = set.map((t) => t[k]);
  const A = [0, 1, 2].map((i) => [0, 1, 2].map((j) => X.reduce((s, row) => s + row[i]! * row[j]!, 0))), B = [0, 1, 2].map((i) => X.reduce((s, row, n) => s + row[i]! * y[n]!, 0));
  for (let i = 0; i < 3; i++) { let piv = i; for (let r = i + 1; r < 3; r++) if (Math.abs(A[r]![i]!) > Math.abs(A[piv]![i]!)) piv = r; [A[i], A[piv]] = [A[piv]!, A[i]!]; [B[i], B[piv]] = [B[piv]!, B[i]!]; for (let r = i + 1; r < 3; r++) { const f = A[r]![i]! / A[i]![i]!; for (let c = i; c < 3; c++) A[r]![c]! -= f * A[i]![c]!; B[r]! -= f * B[i]!; } }
  const x: number[] = [0, 0, 0]; for (let i = 2; i >= 0; i--) { x[i] = (B[i]! - [0, 1, 2].slice(i + 1).reduce((s, j) => s + A[i]![j]! * x[j]!, 0)) / A[i]![i]!; }
  return [x[0]!, x[1]!, x[2]!];
}

// Leave-one-out : constantes réajustées SANS le nez i ; ses angles identifiés par ses deux grandeurs observées ; trois grandeurs prédites.
const looSq: number[] = [], looSq3: number[] = [], looMed: number[] = [], looOls: number[] = [], per: { index: number; pitchDeg: number; yawDeg: number; looErr: number }[] = [];
for (let i = 0; i < refs.length; i++) {
  const rest = refs.filter((_, j) => j !== i), t = refs[i]!;
  const f = fit(rest, FAST ? 15 : 30, 1);
  const pr = predict(f.m, t);
  looSq.push(pr?.sq ?? PENAL); looSq3.push(pr?.sq3 ?? PENAL);
  per.push({ index: t.index, pitchDeg: pr?.id.pitch ?? -1, yawDeg: pr?.id.yaw ?? -1, looErr: r4(Math.sqrt(pr?.sq ?? PENAL)) });
  looMed.push(targets5.reduce((s, k) => s + ((med(rest.map((x) => x[k])) - t[k]) / SD[k]) ** 2, 0) / 5);
  looOls.push(targets.reduce((s, k) => { const [a, b, c] = ols(rest, k); return s + ((a + b * t.r + c * t.u - t[k]) / SD[k]) ** 2; }, 0) / 3);
  console.log(`  LOO nez ${t.index}: angles identifiés tangage ${pr?.id.pitch}° lacet ${pr?.id.yaw}° · erreur ${r4(Math.sqrt(pr?.sq ?? PENAL))}`);
}

// Profil du coût (les autres constantes à l'optimum) pour lobuleRim et alarBase : largeur du plateau à +0,02 du minimum (coût normalisé).
const profile = (k: keyof UnderviewModel): { grid: number[]; cost: number[]; plateau: [number, number] } => {
  const grid = Array.from({ length: 11 }, (_, i) => r4(BOUNDS[k][0] + ((BOUNDS[k][1] - BOUNDS[k][0]) * i) / 10));
  const cs = grid.map((g) => cost(norm({ ...full.m, [k]: g } as UnderviewModel), refs));
  const mn = Math.min(...cs), ok = grid.filter((_, i) => cs[i]! <= mn + 0.02);
  return { grid, cost: cs.map(r4), plateau: [Math.min(...ok), Math.max(...ok)] };
};
const prof = { lobuleRim: profile('lobuleRim'), alarBase: profile('alarBase'), alarTop: profile('alarTop'), nostril: profile('nostril') };
for (const k of Object.keys(prof) as (keyof typeof prof)[]) console.log(`profil ${k}: plateau (coût ≤ min+0,02) = [${prof[k].plateau[0]}, ${prof[k].plateau[1]}]  coûts ${prof[k].cost.join(' ')}`);

// Bootstrap des nez : dispersion des constantes réajustées.
const B = FAST ? 3 : 8, boot: Record<string, number[]> = { lobuleRim: [], alarTop: [], alarBase: [], nostril: [] };
for (let b = 0; b < B; b++) { const s = refs.map(() => refs[Math.floor(rnd() * refs.length)]!); const f = fit(s, FAST ? 10 : 25, 1); for (const k of KEYS) boot[k]!.push(f.m[k]); }
const bootSd = Object.fromEntries(KEYS.map((k) => [k, r4(std(boot[k]!))]));
console.log('écart-type bootstrap des constantes', bootSd, `(B=${B})`);

const res = {
  protocol: 'v2 : tangage et lacet identifiés par (rapport d\'axes, |décalage du sommet|) ; jugement sur (hauteur, base, dépassement)',
  fitted: Object.fromEntries(KEYS.map((k) => [k, r4(full.m[k])])),
  residualRms: r4(full.c), baselineMedianRms: r4(baseMed), baselineMedianLooRms: r4(rmsOf(looMed)), leaveOneOutRms: r4(rmsOf(looSq)),
  /** Sur les 3 grandeurs prédites seulement (h, by, ab) : modèle LOO contre régression linéaire sur (r, |u|) LOO contre médiane LOO. */
  predicted3: { modelLooRms: r4(rmsOf(looSq3)), regressionLooRms: r4(rmsOf(looOls)), medianLooRms: r4(rmsOf(refs.map((t, i) => targets.reduce((s, k) => s + ((med(refs.filter((_, j) => j !== i).map((x) => x[k])) - t[k]) / SD[k]) ** 2, 0) / 3))) },
  noses: refs.length, usedIndices: refs.map((t) => t.index), excludedIndices: raw.filter((n) => !refs.some((t) => t.index === n.index)).map((n) => n.index),
  identified: per, plateau: Object.fromEntries(Object.keys(prof).map((k) => [k, prof[k as keyof typeof prof].plateau])), profileCost: Object.fromEntries(Object.keys(prof).map((k) => [k, prof[k as keyof typeof prof].cost])), bootstrapSd: bootSd, bootstrapB: B,
};
console.log('RÉSUMÉ', JSON.stringify({ ...res, identified: undefined, profileCost: undefined }));
if (!FAST) writeFileSync('src/face/nose/underview.generated.ts', `// FICHIER GÉNÉRÉ par scripts/nose-refs/fit-underview.ts (protocole v2) à partir de references/nez/measures-04.json — ne pas éditer à la main.\nexport const UNDERVIEW_FIT = ${JSON.stringify(res)} as const;\n`);
else console.log('(FAST : fichier généré NON écrit)');

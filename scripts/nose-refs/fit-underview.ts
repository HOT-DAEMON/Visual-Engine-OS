import { readFileSync, writeFileSync } from 'node:fs';
import { faceLandmarks, noseGeometry } from '../../src/face';
import { FaceParams } from '../../src/schema';
import { noseView } from '../../src/face/nose/underview';
import type { UnderviewModel } from '../../src/face/nose/underview-model';

/**
 * AJUSTEMENT des quatre fractions z de la vue de dessous (`UnderviewModel`) sur les mesures de references/nez/04.jpg (`measures-04.json`).
 * Pour chaque nez de référence, le tangage est un paramètre LIBRE (on ne le connaît pas : l'artiste ne l'indique pas) ; on cherche les constantes
 * qui expliquent le mieux, tous nez confondus, quatre grandeurs : rapport d'axes de l'ellipse, hauteur du triangle, position de sa base,
 * dépassement du sommet. La largeur de base du triangle n'est PAS ajustée ici : elle dépend d'un axe du contrat existant (`nose.base.width`),
 * pas de z ; elle est vérifiée par couverture dans `tests/nose-underview.test.ts`.
 * Honnêteté : on rapporte aussi (a) le résidu d'un prédicteur « médiane » sans modèle, (b) un leave-one-out (un nez retiré à chaque fois).
 * Sortie : src/face/nose/underview.generated.ts (ne pas éditer à la main).
 */
const ms = JSON.parse(readFileSync('references/nez/measures-04.json', 'utf8')).noses as { index: number; ellipse: { axisRatio: number }; triangle: null | { degenerate: boolean; heightOverEllipseH: number; baseYRelEllipseCentre: number; apexBelowEllipseBottom: number } }[];
const refs = ms.filter((n) => n.triangle && !n.triangle.degenerate).map((n) => ({ index: n.index, r: n.ellipse.axisRatio, h: n.triangle!.heightOverEllipseH, by: n.triangle!.baseYRelEllipseCentre, ab: n.triangle!.apexBelowEllipseBottom }));
const p = FaceParams.parse({ anatomyEngine: 'structured' });
const geo = noseGeometry(p, faceLandmarks(p, 300, 380));
const BOUNDS: Record<keyof UnderviewModel, [number, number]> = { lobuleRim: [0.05, 0.95], alarTop: [0.05, 0.95], alarBase: [0.0, 0.95], nostril: [0.05, 0.95] };
/** Constantes NON calibrées : aucune des 4 grandeurs mesurées ne dépend d'elles (`lobuleRim` change l'enveloppe de < 1 % ; mesuré, voir tests/nose-underview.test.ts). Fixées par vraisemblance anatomique, déclarées telles dans la doc. */
const FIXED = { lobuleRim: 0.5 } as const;
const KEYS = ['alarTop', 'alarBase', 'nostril'] as (keyof UnderviewModel)[];
const PITCHES = Array.from({ length: 46 }, (_, i) => 2 * i);                    // 0…90° par pas de 2°

/** Contrainte anatomique : la jonction aile-lobule (haut de l'aile) n'est jamais derrière le pied de l'aile (l'aile enveloppe le lobule, elle ne s'en éloigne pas vers l'arrière). */
const norm = (m: UnderviewModel): UnderviewModel => (m.alarTop < m.alarBase ? { ...m, alarTop: m.alarBase } : m);
const err = (m0: UnderviewModel, ph: number, t: { r: number; h: number; by: number; ab: number }): number => {
  const m = norm(m0), v = noseView(geo, ph, 0, m), e = v.ellipse.axisRatio, q = v.triangleMetrics;
  return 0.5 * (e - t.r) ** 2 + (q.heightOverEllipseH - t.h) ** 2 + (q.baseYRelEllipseCentre - t.by) ** 2 + (q.apexBelowEllipseBottom - t.ab) ** 2;
};
/** Meilleur tangage d'un nez pour un modèle donné. */
const bestPitch = (m: UnderviewModel, t: { r: number; h: number; by: number; ab: number }): { ph: number; e: number } => {
  let b = { ph: 0, e: Infinity };
  for (const ph of PITCHES) { const e = err(m, ph, t); if (e < b.e) b = { ph, e }; }
  return b;
};
const cost = (m: UnderviewModel, set: typeof refs): number => Math.sqrt(set.reduce((s, t) => s + bestPitch(m, t).e, 0) / set.length);

let seed = 20261111; const rnd = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
function fit(set: typeof refs): { m: UnderviewModel; c: number } {
  const rand = (): UnderviewModel => ({ ...FIXED, ...Object.fromEntries(KEYS.map((k) => [k, BOUNDS[k][0] + (BOUNDS[k][1] - BOUNDS[k][0]) * rnd()])) } as unknown as UnderviewModel);
  let best = rand(), bc = cost(best, set);
  for (let i = 0; i < 150; i++) { const m = rand(), c = cost(m, set); if (c < bc) { best = m; bc = c; } }
  for (let pass = 0; pass < 4; pass++) for (const k of KEYS) for (const f of [0.15, 0.06, 0.02]) for (const s of [-1, 1]) {
    const m = { ...best, [k]: Math.min(BOUNDS[k][1], Math.max(BOUNDS[k][0], best[k] + s * f * (BOUNDS[k][1] - BOUNDS[k][0]))) } as UnderviewModel;
    const c = cost(m, set); if (c < bc) { best = m; bc = c; }
  }
  return { m: best, c: bc };
}

const full = fit(refs);
// Prédicteur sans modèle : médiane de chaque grandeur (mêmes 3 grandeurs triangle + rapport), aucun tangage.
const med = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
const M = { r: med(refs.map((t) => t.r)), h: med(refs.map((t) => t.h)), by: med(refs.map((t) => t.by)), ab: med(refs.map((t) => t.ab)) };
const baseline = Math.sqrt(refs.reduce((s, t) => s + 0.5 * (M.r - t.r) ** 2 + (M.h - t.h) ** 2 + (M.by - t.by) ** 2 + (M.ab - t.ab) ** 2, 0) / refs.length);
// Leave-one-out : on ajuste sans le nez i, puis on mesure l'erreur sur lui avec SON meilleur tangage (le tangage reste libre).
let loo = 0;
for (let i = 0; i < refs.length; i++) { const f = fit(refs.filter((_, j) => j !== i)); loo += bestPitch(norm(f.m), refs[i]!).e; }
const looRms = Math.sqrt(loo / refs.length);
const pitches = refs.map((t) => ({ index: t.index, pitchDeg: bestPitch(norm(full.m), t).ph }));
const r4 = (x: number): number => Math.round(x * 1e4) / 1e4;
const fm = norm(full.m);
const model = { ...FIXED, ...Object.fromEntries(['alarTop', 'alarBase', 'nostril'].map((k) => [k, r4(fm[k as keyof UnderviewModel])])) };
// Profil du coût selon alarBase (alarTop = alarBase) : dit si la valeur est réellement identifiée ou si la courbe est plate.
const prof = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((a) => `${a}:${r4(cost({ ...FIXED, alarTop: a, alarBase: a, nostril: fm.nostril } as UnderviewModel, refs))}`);
console.log('profil coût(alarBase=alarTop)', prof.join(' '));
console.log('modèle', model, '\nrésidu ajusté', r4(full.c), '· prédicteur médiane', r4(baseline), '· leave-one-out', r4(looRms), '\ntangages', pitches.map((x) => `${x.index}:${x.pitchDeg}°`).join(' '));
writeFileSync('src/face/nose/underview.generated.ts', `// FICHIER GÉNÉRÉ par scripts/nose-refs/fit-underview.ts à partir de references/nez/measures-04.json — ne pas éditer à la main.\nexport const UNDERVIEW_FIT = {\n  model: ${JSON.stringify(model)},\n  residualRms: ${r4(full.c)},\n  baselineMedianRms: ${r4(baseline)},\n  leaveOneOutRms: ${r4(looRms)},\n  noses: ${refs.length},\n  pitchDegPerNose: ${JSON.stringify(pitches)},\n} as const;\n`);

import { readFileSync, writeFileSync } from 'node:fs';
import { faceLandmarks, noseGeometry } from '../../src/face';
import { FaceParams } from '../../src/schema';
import { widthProfile25 } from '../../src/face/nose/measure';

/**
 * AJUSTEMENT PAR SYNTHÈSE des archétypes de nez sur les silhouettes MESURÉES de `references/nez/06.png` (`measures-06.json`).
 * Principe : on cherche les axes du moteur dont la silhouette (`noseGeometry().silhouette`) reproduit le profil de largeur et le rapport L/H d'une référence.
 * Recherche aléatoire déterministe (graine fixe) puis descente par coordonnée. Rien n'est saisi à la main : la sortie est écrite dans
 * `src/face/nose/archetypes.generated.ts`. Le résidu est conservé et relu par `tests/nose-archetypes.test.ts` (seuil figé après mesure).
 */
const W = 300, H = 380;
// Niveaux comparés : 0…17 sur 25 (72 % du haut). Le bas des références est fermé par le contour du lobule ; le moteur ferme le nez par une base plate (écart documenté dans docs/NOSE-REFS-REMAINING.md), donc le comparer fausserait l'ajustement.
const UPPER = 18;
const refs = JSON.parse(readFileSync('references/nez/measures-06.json', 'utf8')).shapes as { index: number; aspectWoverH: number; widthProfile25: number[] }[];
const NAMES = ['pyramide', 'ellipse-large', 'cloche-ailes', 'plat-trapeze', 'losange-petit'] as const;
// Axes explorés (chemin, min, max) : uniquement des axes du contrat existant (aucun nouveau paramètre).
const AXES: [string, number, number][] = [['nose.width', 0.1, 0.28], ['nose.length', 0.1, 0.25], ['nose.tip.width', 0, 1], ['nose.alae.flare', 0, 1], ['nose.alae.volume', 0, 1], ['nose.base.width', -1, 1], ['nose.root.width', 0, 1], ['nose.dorsum.width', 0, 1], ['nose.sidewall.slope', 0, 1], ['nose.tip.roundness', 0, 1]];
const build = (v: number[]): Record<string, unknown> => {
  const patch: Record<string, any> = { anatomyEngine: 'structured' };
  AXES.forEach(([path], i) => { const ks = path.split('.'); let c = patch; for (const k of ks.slice(0, -1)) c = (c[k] ??= {}); c[ks[ks.length - 1]!] = v[i]; });
  return patch;
};
const measure = (v: number[]) => { const p = FaceParams.parse(build(v)); const lm = faceLandmarks(p, W, H); return widthProfile25(noseGeometry(p, lm).silhouette); };
const cost = (v: number[], ref: { aspectWoverH: number; widthProfile25: number[] }): number => {
  const m = measure(v); let e = 0;
  for (let i = 0; i < UPPER; i++) e += (m.profile[i]! - ref.widthProfile25[i]!) ** 2;
  return Math.sqrt(e / UPPER) + 0.25 * Math.abs(Math.log(m.aspect / ref.aspectWoverH));
};
let seed = 20261111; const rnd = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const result: Record<string, { params: Record<string, number>; residual: number; aspect: number; refAspect: number }> = {};
for (const r of refs) {
  let best = AXES.map(([, a, b]) => a + (b - a) * rnd()), bc = cost(best, r);
  for (let i = 0; i < 600; i++) { const v = AXES.map(([, a, b]) => a + (b - a) * rnd()), c = cost(v, r); if (c < bc) { best = v; bc = c; } }
  for (let pass = 0; pass < 6; pass++) AXES.forEach(([, a, b], k) => { for (const f of [0.2, 0.08, 0.03]) for (const s of [-1, 1]) { const v = [...best]; v[k] = Math.min(b, Math.max(a, v[k]! + s * f * (b - a))); const c = cost(v, r); if (c < bc) { best = v; bc = c; } } });
  const m = measure(best);
  const params: Record<string, number> = {}; AXES.forEach(([path], i) => { params[path] = Math.round(best[i]! * 1000) / 1000; });
  result[NAMES[r.index]!] = { params, residual: Math.round(bc * 1e4) / 1e4, aspect: Math.round(m.aspect * 1e3) / 1e3, refAspect: r.aspectWoverH };
  console.log(NAMES[r.index], 'résidu', bc.toFixed(4), 'L/H', m.aspect.toFixed(3), 'réf', r.aspectWoverH);
}
writeFileSync('references/nez/fit-06.json', JSON.stringify(result, null, 1));
const body = Object.entries(result).map(([k, v]) => `  '${k}': { residual: ${v.residual}, aspect: ${v.aspect}, refAspect: ${v.refAspect}, params: ${JSON.stringify(v.params)} },`).join('\n');
writeFileSync('src/face/nose/archetypes.generated.ts', `// FICHIER GÉNÉRÉ par scripts/nose-refs/fit.ts à partir de references/nez/measures-06.json — ne pas éditer à la main.\nexport const NOSE_FIT = {\n${body}\n} as const;\n`);

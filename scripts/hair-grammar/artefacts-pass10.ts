import { verifyComposed } from '../../src/hair-grammar/compose-verify';
import { generate, type HairProfile } from '../../src/hair-grammar/grammar';
import { BOB } from '../../src/hair-grammar/profiles/bob';
import { SHAG } from '../../src/hair-grammar/profiles/shag';
import { TOUSLED } from '../../src/hair-grammar/profiles/tousled';
import { H, appearance, head, repaired, scene } from './lib-cuts';
import { png, save, sheetSvg, viewAt, type Panel } from './engine-kit';

/**
 * Artefacts de la passe 10 : preuves visuelles des NOUVELLES COUPES (carré, shag), tête entière à chaque fois.
 * Usage : `npx tsx scripts/hair-grammar/artefacts-pass10.ts` → `artefacts/hair-engine-pass10/`.
 */
const OUT = 'artefacts/hair-engine-pass10';
const CUTS: readonly [string, HairProfile][] = [['bob', BOB], ['shag', SHAG]];
const COLORS: readonly [string, string][] = [['brun', '#6b4a30'], ['noir', '#1c1a24'], ['blond', '#d9b36a']];
const cell = (P: HairProfile, name: string, yaw: number, seed: number, hex: string, label: string, fix = true): Panel => {
  const s = scene(P, yaw, seed, fix); return { content: head(s.locks, s.v, appearance(hex, true), `${name}${yaw}s${seed}${fix ? 'r' : 'x'}${hex.slice(1)}`), label };
};
const sheet = (file: string, panels: Panel[], cols: number, title: string): void => save(`${OUT}/${file}`, png(sheetSvg(panels, cols, title, 3)));

// 01/02 — une coupe : 3 couleurs × 3 graines, de face.
CUTS.forEach(([n, P], i) => sheet(`0${i + 1}-${n}-toute-la-tete-3-couleurs-3-graines.png`, COLORS.flatMap(([cn, hex]) => [1, 2, 3].map((seed) => cell(P, n, 0, seed, hex, `${n} · ${cn} · graine ${seed}`))), 3, `${n} — tête entière, 3 couleurs × 3 graines (réparées, rendu principal)`));

// 03 — rotation de la tête, de −60° à +60°, mêmes mèches (graine 1).
sheet('03-rotation-lacet.png', CUTS.flatMap(([n, P]) => [-60, -30, 0, 30, 60].map((yaw) => cell(P, n, yaw, 1, n === 'bob' ? '#6b4a30' : '#1c1a24', `${n} · lacet ${yaw}°`))), 5, 'rotation du lacet −60° → +60° (graine 1)');

// 04 — avant / après réparation : ce que corrige le solveur existant (repairCycle).
sheet('04-avant-apres-reparation.png', CUTS.flatMap(([n, P]) => [0, 30].flatMap((yaw) => [false, true].map((fix) => cell(P, n, yaw, 1, n === 'bob' ? '#6b4a30' : '#1c1a24', `${n} · ${yaw}° · ${fix ? 'après' : 'avant'} réparation`, fix)))), 4, 'avant / après réparation (même graine)');

// 05 — comparaison avec la coupe de la passe 9 (tousled), même couleur, même vue.
sheet('05-comparaison-tousled-bob-shag.png', ([['tousled (passe 9)', TOUSLED, 'tousled'], ['bob (passe 10)', BOB, 'bob'], ['shag (passe 10)', SHAG, 'shag']] as const).map(([l, P, n]) => cell(P, n, 0, 2, '#6b4a30', l)), 3, 'même couleur, même graine : les trois coupes du moteur');

// 06 — vérification géométrie / anatomie / style : 8 graines × 3 lacets × 2 coupes, avant et après réparation.
const rows: Record<string, unknown>[] = [];
for (const [n, P] of CUTS) for (const yaw of [0, 30, -30]) for (let seed = 1; seed <= 8; seed++) {
  const v = viewAt(yaw); const before = verifyComposed(H, generate(P, seed), v); const r = repaired(P, seed, v);
  rows.push({ cut: n, yaw, seed, defectsBefore: before.defects.length, defectsAfter: r.verdict.defects.length, ok: r.verdict.ok, score: +r.verdict.score.toFixed(2), failing: r.verdict.reports.flatMap((q) => q.checks.filter((c) => !c.ok).map((c) => `${q.layer}:${c.name}`)) });
}
save(`${OUT}/06-verification-geometrie-anatomie-style.json`, JSON.stringify({ n: rows.length, ok: rows.filter((r) => r.ok).length, rows }, null, 1));
console.log(`${rows.filter((r) => r.ok).length}/${rows.length} combinaisons valides`);

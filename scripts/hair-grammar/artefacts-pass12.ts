import { verifyAttach } from '../../src/hair-grammar/attach-verify';
import { verifyComposed } from '../../src/hair-grammar/compose-verify';
import { generate, type HairProfile } from '../../src/hair-grammar/grammar';
import { DOUBLE_BUNS, TOP_BUN } from '../../src/hair-grammar/profiles/buns';
import { PONYTAIL } from '../../src/hair-grammar/profiles/ponytail';
import { TWIN_BRAIDS } from '../../src/hair-grammar/profiles/braids';
import { HIME } from '../../src/hair-grammar/profiles/hime';
import { H, appearance, head, repaired, scene } from './lib-cuts';
import { png, save, sheetSvg, viewAt, type Panel } from './engine-kit';

/**
 * Artefacts de la passe 12 : preuves visuelles des NOUVELLES COUPES à attache (chignons doubles, chignon haut, queue de cheval, couettes tressées), tête entière à chaque fois.
 * Usage : `npx tsx scripts/hair-grammar/artefacts-pass12.ts` → `artefacts/hair-engine-pass12/`.
 */
const OUT = 'artefacts/hair-engine-pass12';
export const CUTS: readonly [string, HairProfile][] = [['double_buns', DOUBLE_BUNS], ['top_bun', TOP_BUN], ['ponytail', PONYTAIL], ['twin_braids', TWIN_BRAIDS]];
const COLORS: readonly [string, string][] = [['brun', '#6b4a30'], ['noir', '#1c1a24'], ['blond', '#d9b36a']];
const cell = (P: HairProfile, name: string, yaw: number, seed: number, hex: string, label: string, fix = true): Panel => {
  const s = scene(P, yaw, seed, fix); return { content: head(s.locks, s.v, appearance(hex, true), `${name}${yaw}s${seed}${fix ? 'r' : 'x'}${hex.slice(1)}`), label };
};
const sheet = (file: string, panels: Panel[], cols: number, title: string): void => save(`${OUT}/${file}`, png(sheetSvg(panels, cols, title, 3)));

// 01..04 — une coupe : 3 couleurs × 3 graines, de face.
CUTS.forEach(([n, P], i) => sheet(`0${i + 1}-${n}-toute-la-tete-3-couleurs-3-graines.png`, COLORS.flatMap(([cn, hex]) => [1, 2, 3].map((seed) => cell(P, n, 0, seed, hex, `${n} · ${cn} · graine ${seed}`))), 3, `${n} — tête entière, 3 couleurs × 3 graines (réparées, rendu principal)`));

// 05 — rotation de la tête −90° → +90° : les attaches se jugent de profil (graine 1).
CUTS.forEach(([n, P], i) => sheet(`05${'abcd'[i]}-rotation-${n}.png`, [-90, -60, -30, 0, 30, 60, 90].map((yaw) => cell(P, n, yaw, 1, '#1c1a24', `${n} · lacet ${yaw}°`)), 4, `${n} — rotation du lacet −90° → +90° (graine 1)`));

// 06 — avant / après réparation.
sheet('06-avant-apres-reparation.png', CUTS.flatMap(([n, P]) => [0, 30].flatMap((yaw) => [false, true].map((fix) => cell(P, n, yaw, 1, '#6b4a30', `${n} · ${yaw}° · ${fix ? 'après' : 'avant'} réparation`, fix)))), 4, 'avant / après réparation (même graine)');

// 07 — comparaison de la famille entière (même couleur, même graine, de face et de profil).
sheet('07-comparaison-des-coupes-a-attache.png', [0, 70].flatMap((yaw) => ([['hime (passe 11, sans attache)', HIME, 'hime'], ...CUTS.map(([n, P]) => [n, P, n] as const)] as const).map(([l, P, n]) => cell(P, n, yaw, 2, '#6b4a30', `${l} · ${yaw}°`))), 5, 'les coupes à attache comparées à la hime');

// 09 — pièce de comparaison avec la référence 04 : rendu moteur seul (le panneau est composé avec la surcouche de mesure par `compose-ref04.py`).
save(`${OUT}/mesures/double_buns-s2-y0.png`, png(sheetSvg([cell(DOUBLE_BUNS, 'double_buns', 0, 2, '#1c1a24', 'double_buns · graine 2 · lacet 0°')], 1, undefined, 4)));

// 08 — vérification géométrie / anatomie / style : 8 graines × 5 lacets (0, ±30, ±60) × 4 coupes, avant et après réparation.
const rows: Record<string, unknown>[] = [];
for (const [n, P] of CUTS) for (const yaw of [0, 30, -30, 60, -60]) for (let seed = 1; seed <= 8; seed++) {
  const v = viewAt(yaw); const before = verifyComposed(H, generate(P, seed), v); const r = repaired(P, seed, v);
  // Couche d'attaches (chignon rond et borné, queue ancrée, tresses croisées) : jugée sur les mèches RÉPARÉES, en plus du verdict G/A/S commun.
  const att = verifyAttach(H, r.specs, v); const attFail = att.flatMap((q) => q.checks.filter((c) => !c.ok).map((c) => `attach-${q.layer}:${c.name} (${c.value.toFixed(2)})`));
  rows.push({ cut: n, yaw, seed, defectsBefore: before.defects.length, defectsAfter: r.verdict.defects.length, okGAS: r.verdict.ok, okAttach: attFail.length === 0, ok: r.verdict.ok && attFail.length === 0, score: +r.verdict.score.toFixed(2), failing: [...r.verdict.reports.flatMap((q) => q.checks.filter((c) => !c.ok).map((c) => `${q.layer}:${c.name}`)), ...attFail] });
}
const byCut = Object.fromEntries(CUTS.map(([n]) => [n, `${rows.filter((r) => r.cut === n && r.ok).length}/${rows.filter((r) => r.cut === n).length}`]));
const gasOnly = rows.filter((r) => r.okGAS).length;
save(`${OUT}/08-verification-geometrie-anatomie-style.json`, JSON.stringify({ n: rows.length, ok: rows.filter((r) => r.ok).length, okGASseul: gasOnly, byCut, rows }, null, 1));
console.log(`${rows.filter((r) => r.ok).length}/${rows.length} combinaisons valides`, byCut);

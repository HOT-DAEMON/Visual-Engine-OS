import { mkdirSync, writeFileSync } from 'node:fs';
import { compileScene, faceLandmarks, generateRandomFace, renderScene } from '../src';
import { faceIsCel } from '../src/face/head-style';
import { checkEyePair } from '../src/verify/eye-pair';
import { makeKit } from './lib/artefacts-kit';

/**
 * Artefacts de la PASSE 19 : `npx tsx scripts/artefacts-eyes-pass19.ts` → `artefacts/eyes-pass19/` (+ rapport.json).
 *   01 : tête cel (graines 23, 5, 11) — yeux ombrés (avant : la règle `eyes-finish-matches-head` avertit) contre `eyeFinish: 'auto'` (yeux en aplats, la règle passe) ; ligne du bas : gros plan de l'œil gauche ;
 *   02 : source `extended`, identités à yeux d'encre (réfs 13/17) — avant : tête lisse ombrée ; après `auto` : tête cel ;
 *   03 : tête lisse ordinaire, inchangée avec ou sans `auto` (preuve de non-régression, empreinte identique) ;
 *   rapport.json : violations de la règle par source (sans / avec `auto`), éléments de dégradé et de filtre de l'œil (ombré / aplats).
 */
const OUT = 'artefacts/eyes-pass19'; mkdirSync(OUT, { recursive: true });
const { png, cropPng, sheet } = makeKit(OUT);
const W = 520, H = 640, report: Record<string, unknown> = {};
type Opts = Parameters<typeof generateRandomFace>[1];
const face = (seed: number, o: Opts) => generateRandomFace(seed, { id: 'f0', transform: { x: W / 2, y: H / 2, scale: 1 }, ...o });
const svgOf = (f: ReturnType<typeof face>, pixelRatio = 1): string => { const r = compileScene({ width: W, height: H, background: '#f4ede6', objects: f.objects } as never) as { ok: boolean; scene: never; issues?: string[] }; if (!r.ok) throw new Error((r.issues ?? []).join('\n')); return renderScene(r.scene, { pixelRatio }); };
const verdict = (f: ReturnType<typeof face>): string => { const c = checkEyePair(f).find((k) => k.id === 'eyes-finish-matches-head')!; return c.ok ? 'passe' : 'AVERTIT'; };
const fin = (f: ReturnType<typeof face>): string => String((f.objects as { kind: string; finish?: string }[]).find((o) => o.kind === 'eye')?.finish ?? 'shaded');
const eyeEls = (svg: string): number => (svg.slice(Math.max(0, svg.indexOf('eye-left'))).match(/<(radialGradient|linearGradient|filter)\b/g) ?? []).length;
const caption = (f: ReturnType<typeof face>, tag: string): string => `${tag} · tête ${faceIsCel(f.params) ? 'cel' : 'lisse'} · yeux ${fin(f)} · ${verdict(f)}`;

// 01 — tête cel : yeux ombrés contre accordés
const cells: { img: Buffer; label: string }[] = []; const crops: { img: Buffer; label: string }[] = [];
const grad: Record<string, unknown>[] = [];
for (const seed of [23, 5, 11]) {
  for (const [tag, o] of [['avant', { anatomy: { style: 'cel' } }], ['après auto', { anatomy: { style: 'cel' }, eyeFinish: 'auto' }]] as [string, Opts][]) {
    const f = face(seed, o); const svg = svgOf(f);
    cells.push({ img: png(svg, 330), label: caption(f, `g${seed} ${tag}`) });
    const ic = faceLandmarks(f.params, f.width, f.height).innerCanthus.left; const cx = W / 2 + ic.x + f.fits.left.transform.x, cy = H / 2 + ic.y + f.fits.left.transform.y;
    crops.push({ img: cropPng(svg, 5, Math.max(0, cx - 60), Math.max(0, cy - 36), 120, 72), label: `g${seed} œil gauche ×5 — ${tag}` });
    grad.push({ seed, tag, eleme_degrade_filtre_oeil: eyeEls(svg), regle: verdict(f) });
  }
}
sheet('01-tete-cel-yeux-ombres-vs-accordes.png', cells, 330, 406, 2);
sheet('01b-gros-plans-oeil-gauche.png', crops, 600, 360, 2);
report.celGradientsFilters = grad;

// 02 — yeux d'encre sur tête lisse → tête cel
const ink: number[] = []; for (let s = 1; s <= 40 && ink.length < 3; s++) if (fin(generateRandomFace(s, { eyeSource: 'extended' })) === 'flat') ink.push(s);
const c2: { img: Buffer; label: string }[] = [];
for (const seed of ink) for (const [tag, o] of [['avant', {}], ['après auto', { eyeFinish: 'auto' }]] as [string, Opts][]) { const f = face(seed, { eyeSource: 'extended', ...o }); c2.push({ img: png(svgOf(f), 330), label: caption(f, `ext g${seed} ${tag}`) }); }
sheet('02-yeux-encre-tete-lisse-vs-cel.png', c2, 330, 406, 2); report.inkSeeds = ink;

// 03 — non-régression : tête ordinaire
const c3: { img: Buffer; label: string }[] = [];
for (const [tag, o] of [['sans option', {}], ['eyeFinish auto', { eyeFinish: 'auto' }]] as [string, Opts][]) { const f = face(42, o); c3.push({ img: png(svgOf(f), 330), label: caption(f, `g42 ${tag}`) }); }
sheet('03-tete-ordinaire-inchangee.png', c3, 330, 406, 2);
report.ordinaryIdentical = JSON.stringify(face(42, {}).objects) === JSON.stringify(face(42, { eyeFinish: 'auto' }).objects);

// rapport : violations par source, sans / avec auto
const perSource: Record<string, unknown> = {};
for (const src of ['gallery', 'extended', 'extended2', 'extended3', 'extended4', 'random'] as const) { let a = 0, b = 0; const n = 30; for (let s = 1; s <= n; s++) { if (checkEyePair(generateRandomFace(s, { eyeSource: src })).some((c) => c.id === 'eyes-finish-matches-head' && !c.ok)) a++; if (checkEyePair(generateRandomFace(s, { eyeSource: src, eyeFinish: 'auto' })).some((c) => c.id === 'eyes-finish-matches-head' && !c.ok)) b++; } perSource[src] = { visages: n, 'violations sans auto': a, 'violations avec auto': b }; }
report.rulePerSource = perSource;
writeFileSync(`${OUT}/rapport.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));

import { writeFileSync } from 'node:fs';
import { resolveAppearance } from '../../src/appearance';
import type { HairLock } from '../../src/face/hair';
import { branchHair, fray, joinLocks, joinGap, loopLock, splitLock } from '../../src/hair-grammar/branch';
import { verifyComposed } from '../../src/hair-grammar/compose-verify';
import { generate } from '../../src/hair-grammar/grammar';
import { DEFAULT_HEAD, landmarks, project } from '../../src/hair-grammar/head';
import { applyIntent, PRESETS, type Intent } from '../../src/hair-grammar/intent';
import { generateIntended } from '../../src/hair-grammar/intent-run';
import { frameFromEyes, grammarToHairLocks } from '../../src/hair-grammar/interop';
import { lightFromVector } from '../../src/hair-grammar/light-bridge';
import type { LockSpec } from '../../src/hair-grammar/lock';
import { walk } from '../../src/hair-grammar/lock';
import { repairCycle } from '../../src/hair-grammar/repair';
import { relationsOf } from '../../src/hair-grammar/occlusion';
import { paintHairResolved, renderResolved } from '../../src/hair-grammar/occlusion-paint';
import { orderStability } from '../../src/hair-grammar/occlusion-stability';
import { observe } from '../../src/hair-grammar/observe';
import { observeStructure } from '../../src/hair-grammar/observe-structure';
import { paintLock, INK, type PaintedLock } from '../../src/hair-grammar/paint';
import { paintHairPro } from '../../src/hair-grammar/paint-pro';
import { measureArt } from '../../src/hair-grammar/part';
import { TOUSLED } from '../../src/hair-grammar/profiles/tousled';
import { fitFromReference, headEllipse, referenceFromPainted } from '../../src/hair-grammar/reference-fit';
import { visibility } from '../../src/hair-grammar/visibility';
import { dot, len, sub } from '../../src/hair-grammar/vec';
import { direction2D, lightVector } from '../../src/lighting/light';
import { lockMarkup } from '../../src/render/face/hair-lock';
import { Appearance } from '../../src/schema';
import { ROI, headContent, png, save, sheetSvg, viewAt, type Panel } from './engine-kit';
import type { Reference } from '../../src/hair-grammar/observe';

/**
 * Artefacts de la PASSE 3 du moteur de cheveux : preuves visuelles, TÊTE ENTIÈRE, de docs/HAIR-PASS3.md.
 * `npx tsx scripts/hair-grammar/artefacts-pass3.ts` régénère tout dans artefacts/hair-engine-pass3/ (déterministe) : planches + metrics.json.
 */
const OUT = 'artefacts/hair-engine-pass3'; const H = DEFAULT_HEAD; const f2 = (x: number): string => x.toFixed(2);
const board = (name: string, panels: Panel[], cols: number, title: string): void => save(`${OUT}/${name}.png`, png(sheetSvg(panels, cols, title, 3)));
const metrics: Record<string, unknown> = {};
const HEAVY: Intent = { volume: 1, weight: 1 };
const tint = (p: PaintedLock, c: string): PaintedLock => ({ ...p, svg: p.svg.replace(/ (fill|stroke|stroke-width|stroke-linejoin|stroke-linecap)="[^"]*"/g, '').replace(/<path /g, `<path fill="${c}" stroke="#111" stroke-width="0.6" `) });
const hair = (specs: readonly LockSpec[], v: ReturnType<typeof viewAt>, over = ''): string => headContent(paintHairResolved(H, specs, v), v, { head: H, over });
const fold3d = (specs: readonly LockSpec[]): number => { let n = 0; for (const L of specs) { const S = walk(H, L, 28); for (let k = 2; k < S.length; k++) { const a = sub(S[k - 1]!.p, S[k - 2]!.p); const b = sub(S[k]!.p, S[k - 1]!.p); if (len(a) > 1e-9 && len(b) > 1e-9 && Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (len(a) * len(b))))) > Math.PI / 2) n++; } } return n; };

// 01 · COQUE C¹ + RÉPARATION LOCALE : « volume +1, lourd » (l'intention qui gardait 20), brut puis réparé, de −75° à +75°.
{
  const rows: Record<string, unknown>[] = []; const panels: Panel[] = [];
  for (const yaw of [-75, -45, -30, 0, 30, 60, 75]) {
    const v = viewAt(yaw); const raw = generateIntended(TOUSLED, HEAVY, v, 1, false); const r = generateIntended(TOUSLED, HEAVY, v, 1);
    const kinds = (x: typeof raw): Record<string, number> => { const o: Record<string, number> = {}; for (const d of x.verdict.defects) o[d.code] = (o[d.code] ?? 0) + 1; return o; };
    rows.push({ yaw, before: raw.initial.score, after: r.verdict.score, defectsBefore: kinds(raw), defectsAfter: kinds(r), localFixes: r.journal.filter((j) => j.scope === 'local' && j.kept).length, fold3dRaw: fold3d(raw.specs) });
    panels.push({ content: hair(raw.specs, v), label: `${yaw}° brut · score ${f2(raw.initial.score)}` }, { content: hair(r.specs, v), label: `${yaw}° réparé · score ${f2(r.verdict.score)}` });
  }
  metrics.heavyVolume = rows;
  board('01-volume-lourd-brut-repare', panels, 4, 'Volume +1, lourd : brut | réparé (solveur local), −75° … +75°');
}

// 02 · RAMIFICATION : fourche 2 et 3 branches, pointes libres, jonction, boucle — chaque mèche de démonstration est teintée, tête entière.
{
  const V = viewAt(20); const sp = generate(TOUSLED, 1); const sweep = sp.filter((s) => s.family === 'sweep'); const mass = sp.filter((s) => s.family === 'mass');
  const COL = ['#d93a2b', '#2b6fd9', '#2bb34f', '#e0a100'];
  const demo = (list: readonly LockSpec[]): string => { const pl = list.map((L, i) => tint(paintLock(H, L, V), COL[i % 4] as string)); const r = renderResolved(pl); return headContent({ back: '', front: r.front + r.back, over: r.over }, V, { head: H }); };
  const s2 = splitLock(H, sweep[0]!, { t: 0.55, ways: 2, spread: 1.1 }); const s3 = splitLock(H, sweep[1]!, { t: 0.5, ways: 3, spread: 1.4 });
  const fr = fray(H, sweep[2]!, { n: 4, from: 0.6 }); // Paire à joindre : deux mèches du même côté, points distants de 0,12–0,3 H (une jonction lisible, pas un détour sous le menton).
  const cand = sp.filter((x) => x.layer !== 'back' && !x.parent); let pair: [LockSpec, LockSpec] = [mass[0]!, mass[3]!]; let bestD = Infinity;
  for (const a of cand) for (const b of cand) { if (a.id >= b.id || Math.sign(a.root.az) !== Math.sign(b.root.az)) continue; const A = walk(H, a, 28)[14]!.p; const B = walk(H, b, 28)[17]!.p; const d = len(sub(A, B)); if (d > 0.12 && d < 0.3 && d < bestD) { bestD = d; pair = [a, b]; } }
  const J = joinLocks(H, pair[0], 0.5, pair[1], 0.6); const lp = loopLock(sweep[3]!, { at: 0.4, radius: 0.045 });
  metrics.branch = { split2: s2.branches.length, split3: s3.branches.length, fray: fr.length, joinGap: joinGap(H, J, pair[1], 0.6), loopLen: lp.length };
  board('02-ramification', [
    { content: demo([s2.trunk, ...s2.branches]), label: 'fourche à 2 branches (tronc rouge)' }, { content: demo([s3.trunk, ...s3.branches]), label: 'fourche à 3 branches' },
    { content: demo([sweep[2]!, ...fr]), label: `pointes libres : ${fr.length} fines mèches` }, { content: demo([pair[0], pair[1], J]), label: `jonction (verte) : pointe → cible à ${joinGap(H, J, pair[1], 0.6).toFixed(4)} H` },
    { content: demo([lp]), label: 'boucle : 1 tour (axe : 1 croisement autorisé)' }, { content: hair(branchHair(TOUSLED, generate(TOUSLED, 5), { split: { prob: 0.15 }, fray: { prob: 0.3 }, loop: { prob: 0.08 } }, 5), V), label: 'coiffure complète ramifiée (graine 5)' },
  ], 2, 'Ramification — splitLock · fray · joinLocks · loopLock · branchHair');
}

// 03 · VISIBILITÉ PAR ORDRE DE PEINTURE : part visible de chaque lame (rouge = enfouie), mèche mal étagée avant/après.
{
  const V = viewAt(29); const specs = generate(TOUSLED, 1); const pl = specs.map((L) => paintLock(H, L, V)); const vis = visibility(H, V, pl);
  const shade = pl.map((p, i) => { const k = vis.visible[i] as number; const c = vis.buried.includes(i) ? '#e0301e' : `hsl(${Math.round(30 + 110 * k)} 70% ${Math.round(88 - 38 * k)}%)`; return tint(p, c); });
  const r = renderResolved(shade); const map = headContent({ back: r.back, front: r.front, over: r.over }, V, { head: H });
  const nape: LockSpec = { ...specs.find((s) => s.family === 'farSide')!, id: 'nape-x', root: { el: 20, az: 180 }, aim: { x: 0, y: 1, z: -0.2 }, layer: 'front', length: 0.55 };
  const V0 = viewAt(0); const bad = [...specs, nape]; const before = verifyComposed(H, bad, V0); const after = repairCycle(TOUSLED, bad, V0, 1);
  const front = pl.filter((p) => p.layer !== 'back').length; const bur = vis.buried.filter((i) => (pl[i] as PaintedLock).layer !== 'back').length;
  metrics.visibility = { yaw: 29, locks: specs.length, buriedFront: bur, front, meanVisible: vis.visible.reduce((a, b) => a + b, 0) / vis.visible.length, misLayeredBefore: before.defects.filter((d) => d.code === 'geom.layer').length, misLayeredAfter: after.verdict.defects.filter((d) => d.code === 'geom.layer').length };
  board('03-visibilite', [
    { content: map, label: `part visible par lame (rouge = enfouie : ${bur}/${front} mèches de devant)` },
    { content: hair(bad, V0), label: `mèche de nuque peinte devant le visage · geom.layer ${before.defects.filter((d) => d.code === 'geom.layer').length}` },
    { content: hair(after.specs, V0), label: `après réparation · geom.layer ${after.verdict.defects.filter((d) => d.code === 'geom.layer').length}` },
  ], 3, 'Visibilité réelle — ordre de peinture (tête + couches)');
}

// 04 · PROFONDEUR DE VOLUME (mode all) : plan de profondeur vs dalles d'épaisseur — découpes et stabilité.
{
  const rows: Record<string, unknown>[] = []; const panels: Panel[] = [];
  for (const [name, I] of [['base', {}], ['lourd', PRESETS.heavy]] as const) for (const yaw of [0, 29]) {
    const V = viewAt(yaw); const P = applyIntent(TOUSLED, I).profile; const sp = generate(P, 1); const pl = sp.map((L) => paintLock(H, L, V));
    const a = renderResolved(pl, INK, 'all', relationsOf(pl, false)); const b = renderResolved(pl, INK, 'all', relationsOf(pl, true));
    const sa = orderStability(H, sp, V, 8, 'all', false); const sb = orderStability(H, sp, V, 8, 'all', true);
    rows.push({ name, yaw, planCut: a.stats.cut, volumeCut: b.stats.cut, planCrossings: a.stats.crossings, volumeCrossings: b.stats.crossings, planFlip8: sa.flipped / Math.max(1, sa.imposed), volumeFlip8: sb.flipped / Math.max(1, sb.imposed) });
    panels.push({ content: headContent({ back: a.back, front: a.front, over: a.over }, V, { head: H }), label: `${name} ${yaw}° · plan : ${a.stats.cut} découpes, inversion 8° ${f2(sa.flipped / Math.max(1, sa.imposed))}` }, { content: headContent({ back: b.back, front: b.front, over: b.over }, V, { head: H }), label: `${name} ${yaw}° · volume : ${b.stats.cut} découpes, inversion ${f2(sb.flipped / Math.max(1, sb.imposed))}` });
  }
  metrics.volumeDepth = rows;
  board('04-profondeur-de-volume', panels, 2, 'Mode all — plan de profondeur | dalles d\'épaisseur (RIBBON_K)');
}

// 05 · LUMIÈRE COMMUNE : un seul LightVector → ld 2D du rendu principal ET exposition 3D de la géométrie ; 4 azimuts, tête entière.
{
  const V = viewAt(20); const lm = landmarks(H); const eR = project(V, lm.eyeR); const eL = project(V, lm.eyeL); const frame = frameFromEyes(eR, eL, eR, eL); const headW = 2 * H.rx * V.s; const specs = generate(TOUSLED, 3);
  const panels: Panel[] = []; const rows: Record<string, unknown>[] = [];
  for (const az of [300, 0, 60, 180]) {
    const L = lightVector({ azimuthDeg: az, elevationDeg: 45, color: '#fff', intensity: 1 });
    const pro = paintHairPro(H, specs, V, undefined, lightFromVector(L, V)); const locks: HairLock[] = grammarToHairLocks(pro.locks as never, { frame, head: H, headW });
    const ra = resolveAppearance('#4a3326', Appearance.parse({ shading: { mode: 'cel', bands: 3, highlightBand: 0.75, castShadow: 0.4 } })); const ld = direction2D(L);
    const parts = locks.map((l, i) => lockMarkup(l, i, { id: `p3-${az}`, ra, ld, W: ROI.w }, 0, true));
    const back = parts.filter((_, i) => locks[i]!.layer === 'back'); const front = parts.filter((_, i) => locks[i]!.layer !== 'back');
    const e = pro.geoms.flatMap((g) => g.exposure); rows.push({ azimuth: az, meanExposure: e.reduce((a, b) => a + b, 0) / e.length });
    const arrow = `<g stroke="#e8187a" stroke-width="1.4" fill="#e8187a"><line x1="20" y1="20" x2="${20 + 14 * ld.x}" y2="${20 + 14 * ld.y}"/><circle cx="${20 + 14 * ld.x}" cy="${20 + 14 * ld.y}" r="2"/></g>`;
    panels.push({ content: headContent({ back: back.flatMap((p) => p.markup).join(''), front: `<defs>${parts.flatMap((p) => p.defs).join('')}</defs>` + front.flatMap((p) => p.markup).join(''), over: '' }, V, { head: H, over: arrow }), label: `lumière ${az}° · exposition moyenne ${f2(rows.at(-1)!.meanExposure as number)}` });
  }
  metrics.light = rows;
  board('05-lumiere-commune', panels, 2, 'Une seule lumière : ld 2D + exposition 3D (flèche rose = lumière)');
}

// 06 · RÉFÉRENCE → COIFFURE (boucle fermée) : référence synthétique d'intention connue, régions de flux observées, ajustement.
{
  const V = viewAt(0); const W = 156; const Hh = 150; const E = headEllipse(TOUSLED, V);
  const refSvg = (R: Reference, over = ''): string => { let s = `<rect width="${W}" height="${Hh}" fill="#fff"/>`; for (let y = 0; y < Hh; y++) { let x = 0; while (x < W) { const i = y * W + x; if (!R.mask[i]) { x++; continue; } const g = Math.round((R.gray[i] as number) * 255); let e = x + 1; while (e < W && R.mask[y * W + e] && Math.round((R.gray[y * W + e] as number) * 255) === g) e++; s += `<rect x="${x}" y="${y}" width="${e - x}" height="${1.02}" fill="rgb(${g},${g},${g})"/>`; x = e; } } return s + over; };
  const regionsSvg = (S: ReturnType<typeof observeStructure>): string => S.regions.map((r, i) => { const x = E.cx + r.cx * E.rx; const y = E.cy + r.cy * E.ry; const c = ['#d93a2b', '#2b6fd9', '#2bb34f', '#e0a100', '#8a3fd0'][i % 5]; return `<g stroke="${c}" fill="${c}" stroke-width="1.2"><line x1="${x - 9 * Math.cos(r.axis)}" y1="${y - 9 * Math.sin(r.axis)}" x2="${x + 9 * Math.cos(r.axis)}" y2="${y + 9 * Math.sin(r.axis)}"/><circle cx="${x}" cy="${y}" r="${2 + 8 * r.share}" fill-opacity="0.35"/></g>`; }).join('');
  const rows: Record<string, unknown>[] = []; const panels: Panel[] = [];
  for (const I of [{ volume: -0.6, weight: 0.6 }, { volume: 0.8, weight: -0.5 }] as Intent[]) {
    const P = applyIntent(TOUSLED, I).profile; const refSpecs = generate(P, 7); const R = referenceFromPainted(refSpecs.map((L) => paintLock(H, L, V)), W, Hh);
    const S = observeStructure(R, E); const fit = fitFromReference(TOUSLED, R, V, { seed: 3 });
    rows.push({ truth: I, fitted: fit.intent, steps: fit.steps.map((s) => ({ iter: s.iter, errWidth: s.err.width, errNegative: s.err.negative })), score: fit.repair.verdict.score, target: fit.target, final: fit.final, regions: S.regions.map((r) => ({ share: r.share, axis: r.axis, coherence: r.coherence })), fringe: S.fringe, part: S.part });
    panels.push({ content: refSvg(R, regionsSvg(S)), label: `référence (vol ${I.volume}, poids ${I.weight}) + régions de flux` }, { content: hair(fit.specs, V), label: `ajusté : vol ${f2(fit.intent.volume ?? 0)}, poids ${f2(fit.intent.weight ?? 0)} · erreur largeur ${f2(Math.abs(fit.steps[0]!.err.width))} → ${f2(Math.abs(fit.steps.at(-1)!.err.width))}` });
  }
  metrics.referenceFit = rows;
  board('06-reference-boucle-fermee', panels, 2, 'Référence → observation → intention → coiffure réparée (boucle fermée)');
}

// 07 · AXES D'ART DIRECTION : frange, raie, pointes libres, mesurés sur le rendu.
{
  const V = viewAt(0); const panels: Panel[] = []; const rows: Record<string, unknown>[] = [];
  const cases: [string, Intent][] = [['frange −1', { fringe: -1 }], ['frange 0', {}], ['frange +1', { fringe: 1 }], ['raie −0,4', { part: -0.4 }], ['raie 0', { part: 0 }], ['raie +0,4', { part: 0.4 }], ['pointes 0', {}], ['pointes 0,5', { tips: 0.5 }], ['pointes 1', { tips: 1 }]];
  for (const [name, I] of cases) { const r = generateIntended(TOUSLED, I, V, 1); const m = measureArt(TOUSLED, r.specs, V); rows.push({ name, ...m, score: r.verdict.score }); panels.push({ content: hair(r.specs, V), label: `${name} · front ${f2(m.fringe)} · raie ${f2(m.part.clarity)}@${f2(m.part.u)} · pointes ${f2(m.tips)}` }); }
  metrics.art = rows;
  board('07-axes-art-direction', panels, 3, 'Frange · raie · pointes libres — consommés par la génération, mesurés sur le rendu');
}

// 08 · TOUTE LA TÊTE : tout ensemble (volume, frange, raie, pointes), réparé, à 5 lacets, avec les trois couches de vérification.
{
  const I: Intent = { volume: 0.6, fringe: 0.5, part: -0.3, tips: 0.5, weight: 0.3 }; const rows: Record<string, unknown>[] = []; const panels: Panel[] = [];
  for (const yaw of [-60, -30, 0, 30, 60]) {
    const v = viewAt(yaw); const r = generateIntended(TOUSLED, I, v, 2); const rep = r.verdict.reports.map((x) => `${x.layer[0]}:${x.checks.filter((c) => !c.ok).length}`).join(' ');
    rows.push({ yaw, before: r.initial.score, after: r.verdict.score, failingChecks: rep, locks: r.specs.length }); panels.push({ content: hair(r.specs, v), label: `${yaw}° · ${r.specs.length} mèches · score ${f2(r.initial.score)} → ${f2(r.verdict.score)} · échecs ${rep}` });
  }
  metrics.fullHead = rows; board('08-toute-la-tete', panels, 3, 'Toute la tête — intention complète, vérifiée et réparée (géométrie g · anatomie a · style s)');
}

// Mesures de coque : plis 3D sur 12 graines (la métrique du correctif).
{ let n = 0; let f = 0; for (let s = 1; s <= 12; s++) { const sp = generate(TOUSLED, s); n += sp.length; f += fold3d(sp); } metrics.shellFold3d = { locks: n, folds: f, perHundred: (100 * f) / n }; }
{ const V = viewAt(29); const base = generate(TOUSLED, 1); const E = headEllipse(TOUSLED, V); const R = referenceFromPainted(base.map((L) => paintLock(H, L, V)), 156, 150); metrics.observeBase = observe(R, E); }

writeFileSync(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics, null, 2).slice(0, 3000));

import { writeFileSync } from 'node:fs';
import { analyzeComposition } from '../../src/hair-grammar/compose';
import { composeHair } from '../../src/hair-grammar/compose-plan';
import { verifyComposed } from '../../src/hair-grammar/compose-verify';
import { FULL_PROGRAM, type CurveSegment } from '../../src/hair-grammar/curve-program';
import { emergeFrom, emergenceContinuity } from '../../src/hair-grammar/emerge';
import { generate } from '../../src/hair-grammar/grammar';
import { DEFAULT_HEAD, landmarks, project, type View } from '../../src/hair-grammar/head';
import { applyIntent, PRESETS, measureIntent, type Intent, type PresetName } from '../../src/hair-grammar/intent';
import { checkHairLockContract, frameFromEyes, grammarToHairLocks } from '../../src/hair-grammar/interop';
import type { LockSpec } from '../../src/hair-grammar/lock';
import { paintHairResolved, renderResolved } from '../../src/hair-grammar/occlusion-paint';
import { bladeOutline, smoothPath, type Blade } from '../../src/hair-grammar/blade';
import { INK, paintHair, type PaintedLock } from '../../src/hair-grammar/paint';
import { paintHairPro } from '../../src/hair-grammar/paint-pro';
import { TOUSLED } from '../../src/hair-grammar/profiles/tousled';
import { repairCycle } from '../../src/hair-grammar/repair';
import { LEVELS, generateLevels, seedsFrom, type Level } from '../../src/hair-grammar/variation';
import type { WidthOp } from '../../src/hair-grammar/width-program';
import { v3, type V2 } from '../../src/hair-grammar/vec';
import { VIEW_01 } from '../../src/hair-grammar/views';
import { ROI, headContent, png, save, sheetSvg, viewAt, type Panel } from './engine-kit';

/**
 * Artefacts du MOTEUR DE CHEVEUX : preuves visuelles, tête entière, de chaque brique ajoutée (docs/HAIR-ENGINE-*.md).
 * `npx tsx scripts/hair-grammar/artefacts-engine.ts` régénère tout dans artefacts/hair-engine/ (déterministe).
 */
const OUT = 'artefacts/hair-engine'; const H = DEFAULT_HEAD; const f2 = (x: number): string => x.toFixed(2);
const board = (name: string, panels: Panel[], cols: number, title: string): void => save(`${OUT}/${name}.png`, png(sheetSvg(panels, cols, title, 3)));
const pro = (specs: readonly LockSpec[], v: View, head = H): string => headContent(paintHairPro(head, specs, v), v, { head });
const base = (id: string, o: Partial<LockSpec> = {}): LockSpec => ({ id, family: 'demo', root: { el: 62, az: -20 }, aim: v3(0, 1, 0.05), length: 1.0, bend: 0, wave: { amp: 0, freq: 1, phase: 0 }, flick: { amt: 0, len: 0.2 }, lift0: 0.05, lift1: 0.2, liftPow: 1.3, gravity: 0.05, width: 0.16, peak: 0.4, taper: 1.3, tone: 0, strands: 2, layer: 'front', ...o });
const metrics: Record<string, unknown> = {};
/** Agrandissement d'une cellule autour de (cx, cy) : le contenu hors cadre est rogné par la cellule. */
const zoom = (content: string, cx: number, cy: number, k: number): string => `<g transform="translate(${ROI.w / 2 - cx * k} ${ROI.h / 2 - cy * k}) scale(${k})">${content}</g>`;
const emergeScene = (): { mother: LockSpec; kids: LockSpec[]; scene: LockSpec[] } => {
  const mother = base('M', { root: { el: 76, az: -25 }, length: 1.3, width: 0.16, tone: 0.3, bend: 0.5, program: [{ kind: 'arc', len: 1, angle: 0.9, ease: 1.4 }] });
  const kids = [0.3, 0.5, 0.7].map((t, i) => emergeFrom(H, mother, base(`c${i}`, { width: 0.08, length: 0.55, tone: -0.15, lift1: 0.3, gravity: 0 }), { t, peel: (i % 2 ? -1 : 1) * (1.5 + 0.1 * i), follow: 0.15 }));
  return { mother, kids, scene: [...kids, mother] };
};
// 01 · grammaire de courbes : chaque comportement isolé (tête entière).
{
  const S = (k: CurveSegment): CurveSegment[] => [{ kind: 'straight', len: 1 }, k, { kind: 'straight', len: 1 }]; const v = viewAt(0);
  const demos: [string, CurveSegment[]][] = [['droite', [{ kind: 'straight', len: 1 }]], ['arc progressif', S({ kind: 'arc', len: 2, angle: 1.2, ease: 1.8 })], ['inflexion', S({ kind: 'inflect', len: 2, angle: 1 })], ['compression', S({ kind: 'compress', len: 2, amp: 0.7, f0: 1, f1: 3 })], ['onde', S({ kind: 'wave', len: 2, amp: 0.4, freq: 1.5 })], ['torsion', S({ kind: 'twist', len: 2, turns: 0.75 })], ['accélération', S({ kind: 'accelerate', len: 2, angle: 1.4, power: 2.6 })], ['retournement de pointe', [{ kind: 'straight', len: 3 }, { kind: 'tipFlip', len: 0.8, angle: -1.6 }]], ['programme complet (8)', [...FULL_PROGRAM]]];
  board('01-courbes', demos.map(([n, p]) => ({ label: n, content: pro([base(n, { program: p })], v) })), 3, 'Grammaire de courbes — un comportement par cellule, tête entière');
}
// 02 · grammaire de largeur + torsion → largeur apparente.
{
  const v = viewAt(0); const ops: [string, WidthOp[]][] = [['profil de base', []], ['renflement', [{ kind: 'bulge', at: 0.55, span: 0.3, gain: 0.8 }]], ['pincement', [{ kind: 'pinch', at: 0.5, span: 0.25, depth: 0.7 }]], ['méplat', [{ kind: 'flat', from: 0.3, to: 0.7 }]], ['marche', [{ kind: 'step', at: 0.55, ratio: 0.45, sharp: 14 }]]];
  const P: Panel[] = ops.map(([n, w]) => ({ label: n, content: pro([base(n, { program: [{ kind: 'arc', len: 1, angle: 0.4 }], widthProg: w, width: 0.26 })], v) }));
  P.push({ label: 'torsion : le ruban se met de profil', content: pro([base('tw', { width: 0.26, program: [{ kind: 'straight', len: 1 }, { kind: 'twist', len: 3, turns: 1.2 }, { kind: 'arc', len: 1, angle: 0.4 }] })], v) });
  board('02-largeur', P, 3, 'Grammaire de largeur et torsion');
}
// 03 · émergence : une mèche fille naît EXACTEMENT sur la coque de la mère (zoom ×1,8 sur la zone de naissance).
{
  const v = viewAt(0); const { mother, kids, scene } = emergeScene();
  const cont = kids.map((k) => emergenceContinuity(H, mother, k)); metrics['emergence'] = cont.map((c) => ({ gap: +c.gap.toFixed(5), angleDeg: +c.angleDeg.toFixed(2), widthRatio: +c.widthRatio.toFixed(3) }));
  const hp = (specs: LockSpec[]): string => headContent(paintHair(H, specs, v), v);
  board('03-emergence', [{ label: 'mère seule', content: hp([mother]) }, { label: `+3 filles, ×1,8 (écart ≤ ${Math.max(...cont.map((c) => c.gap)).toFixed(3)} H, ${Math.max(...cont.map((c) => c.angleDeg)).toFixed(0)}° max)`, content: zoom(hp(scene), 62, 100, 1.8) }, { label: 'idem, occlusion locale (sous la mère)', content: zoom(`<rect width="${ROI.w}" height="${ROI.h}" fill="#fff"/>${(() => { const q = paintHairResolved(H, scene, v); return q.back + q.front + q.over; })()}`, 62, 100, 1.8) }], 3, 'Émergence : naissance sur la coque de la mère');
}
// 04 · occlusion locale : tresse fabriquée (profondeurs contrôlées) + émergence réelle + coiffure générée (ordre d'écriture conservé).
{
  const N = 40; const half = 4;
  const synth = (id: string, axis: (t: number) => V2, depth: (t: number) => number, fill: string): PaintedLock => {
    const spine: V2[] = Array.from({ length: N }, (_, i) => axis(i / (N - 1))); const left: V2[] = []; const right: V2[] = [];
    spine.forEach((p, i) => { const a = spine[Math.max(0, i - 1)] as V2; const b = spine[Math.min(N - 1, i + 1)] as V2; const l = Math.hypot(b.x - a.x, b.y - a.y) || 1; const dx = (b.x - a.x) / l; const dy = (b.y - a.y) / l; left.push({ x: p.x - dy * half, y: p.y + dx * half }); right.push({ x: p.x + dy * half, y: p.y - dx * half }); });
    const blade: Blade = { spine, half: spine.map(() => half), left, right, facing: spine.map(() => 1), t: spine.map((_, i) => i / (N - 1)), depth: spine.map((_, i) => depth(i / (N - 1))), twist: spine.map(() => 0) };
    const spec: LockSpec = { ...base(id), weave: 'tresse' };
    return { spec, blade, layer: 'front', svg: `<path d="${smoothPath(bladeOutline(blade), true)}" fill="${fill}" stroke="#111" stroke-width=".8"/>` };
  };
  const ax = (t: number): V2 => ({ x: 28 + 100 * t, y: 75 - 26 * Math.sin(3 * Math.PI * t) }); const bx = (t: number): V2 => ({ x: 28 + 100 * t, y: 75 + 26 * Math.sin(3 * Math.PI * t) });
  const braid = [synth('A', ax, (t) => 1 - t, '#e8b4b4'), synth('B', bx, (t) => t, '#b4c4e8')];
  const plain = { back: '', front: braid.map((p) => p.svg).join(''), over: '' }; const res = renderResolved(braid, INK, 'weave');
  const v = viewAt(0); const sc = emergeScene().scene;
  const e1 = paintHair(H, sc, v); const e2 = paintHairResolved(H, sc, v); const gen = generate(TOUSLED, 1); const g2 = paintHairResolved(H, gen, VIEW_01);
  metrics['occlusion'] = { tresse: res.stats, émergence: e2.stats, générée: g2.stats };
  const bare = (hp: { back: string; front: string; over: string }): string => `<rect width="${ROI.w}" height="${ROI.h}" fill="#fff"/>${hp.back}${hp.front}${hp.over}`;
  board('04-occlusion', [{ label: 'tresse : ordre d\'écriture (A toujours devant)', content: bare(plain) }, { label: `tresse : occlusion locale (${res.stats.cut} tronçons)`, content: bare(res) }, { label: 'filles : ordre d\'écriture (par-dessus)', content: zoom(headContent(e1, v), 62, 100, 1.8) }, { label: `filles : émergent sous la mère (${e2.stats.emerges} rel.)`, content: zoom(headContent(e2, v), 62, 100, 1.8) }], 2, 'Occlusion locale (opt-in) — docs/HAIR-OVERLAP.md');
}
// 05/06 · composition : mesures, pilotage, surcouche d'analyse.
{
  const v = viewAt(29); const arrow = (c: ReturnType<typeof analyzeComposition>, at: V2, col: string): string => `<g stroke="${col}" stroke-width="1.6" fill="none"><line x1="${at.x}" y1="${at.y}" x2="${at.x + Math.cos(c.reading.angle) * 38}" y2="${at.y + Math.sin(c.reading.angle) * 38}"/><circle cx="${at.x}" cy="${at.y}" r="2.5" fill="${col}"/></g>`;
  const c0 = project(v, v3(0, 0, H.cz)); const rows: Panel[] = []; const jr: unknown[] = [];
  for (const t of [0.35, 1.57, 2.8]) { const r = composeHair(TOUSLED, { reading: t }, 1, v, 6); rows.push({ label: `lecture visée ${(t * 57.3).toFixed(0)}° → mesurée ${(r.composition.reading.angle * 57.3).toFixed(0)}°`, content: headContent(paintHairPro(H, r.specs, v), v, { over: arrow(r.composition, { x: c0.x, y: c0.y - 55 }, '#d33') }) }); jr.push({ cible: t, mesure: r.composition.reading.angle }); }
  for (const b of [-0.25, 0, 0.25]) { const r = composeHair(TOUSLED, { balance: b }, 1, v, 6); rows.push({ label: `équilibre visé ${b} → mesuré ${f2(r.composition.balance.moment)}`, content: headContent(paintHairPro(H, r.specs, v), v, { over: `<line x1="${c0.x}" y1="4" x2="${c0.x}" y2="146" stroke="#06c" stroke-dasharray="3 3" stroke-width=".8"/><line x1="${c0.x + b * H.rx * v.s}" y1="10" x2="${c0.x + b * H.rx * v.s}" y2="140" stroke="#d33" stroke-width="1.2"/>` }) }); jr.push({ cible: b, mesure: r.composition.balance.moment }); }
  metrics['composition'] = jr; board('05-composition-pilotage', rows, 3, 'Composition pilotant la génération (rouge = cible/mesure, bleu = axe de tête)');
  const specs = generate(TOUSLED, 1); const painted = paintHairPro(H, specs, v); const c = analyzeComposition(H, specs, v, painted.locks);
  const hue = (i: number): string => `hsl(${(i * 67) % 360} 70% 50%)`; const fam = c.masses.map((m) => m.family);
  const masses = painted.locks.map((p) => `<path d="M${bladeOutline(p.blade).map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join('L')}Z" fill="${hue(fam.indexOf(p.spec.family))}" fill-opacity=".55" stroke="none"/>`).join('');
  const gaps = c.negative.gaps.filter((g) => g.cells >= 4).map((g) => `<circle cx="${g.cx}" cy="${g.cy}" r="${Math.sqrt(g.cells) * 1.6 + 2}" fill="none" stroke="#0a0" stroke-width="1.2"/>`).join('');
  const foc = c.focal.map((f) => `<g stroke="#000" fill="none" stroke-width="1.2"><circle cx="${f.at.x}" cy="${f.at.y}" r="${6 + 6 * Math.min(1, f.strength)}"/><text x="${f.at.x + 8}" y="${f.at.y - 6}" font-size="7" fill="#000" stroke="none">${f.kind}</text></g>`).join('');
  const force = c.force.lines.filter((l) => l.kind === 'flow').map((l) => `<polyline points="${l.pts.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ')}" fill="none" stroke="#c0a" stroke-width="1.2"/>`).join('');
  metrics['analyse'] = { masses: c.masses.map((m) => ({ f: m.family, part: +m.share.toFixed(3), role: m.role })), lecture: +c.reading.angle.toFixed(3), cohérence: +c.reading.coherence.toFixed(3), équilibre: +c.balance.moment.toFixed(3), négatif: +c.negative.ratio.toFixed(3), focaux: c.focal.map((f) => f.kind), carry: +c.force.carry.toFixed(3) };
  board('06-composition-analyse', [{ label: 'masses par famille (couleur)', content: headContent({ back: '', front: '', over: '' }, v, { under: masses, face: true }) }, { label: 'espaces négatifs (vert)', content: headContent(painted, v, { over: gaps }) }, { label: 'points focaux (noir) + lignes de force (magenta)', content: headContent(painted, v, { over: foc + force + arrow(c, { x: c0.x, y: c0.y - 55 }, '#d33') }) }], 3, `Analyse de composition — ${fam.map((f, i) => `${f}=${Math.round((c.masses[i]?.share ?? 0) * 100)}%`).join('  ')}`);
}
// 07 · finition pilotée par la géométrie locale.
{
  const specs = generate(TOUSLED, 1); const v1 = VIEW_01; const v2 = viewAt(-30);
  const flat = [base('flat', { program: [{ kind: 'arc', len: 1, angle: 0.5 }], width: 0.3 })]; const tw = [base('tw', { width: 0.3, program: [{ kind: 'straight', len: 1 }, { kind: 'twist', len: 3, turns: 1.2 }, { kind: 'arc', len: 1, angle: 0.4 }] })];
  board('07-finition', [{ label: 'ruban plat : reflet continu', content: pro(flat, v2) }, { label: 'ruban torsadé : reflet cassé', content: pro(tw, v2) }, { label: 'finition de base (3 aplats + croissant)', content: headContent(paintHair(H, specs, v1), v1) }, { label: 'finition géométrie locale (reflet/ombre calculés)', content: pro(specs, v1) }], 2, 'Finition pilotée par la géométrie locale');
}
// 08 · vérification trois couches + cycle de réparation.
{
  const v = viewAt(29); const specs = generate(TOUSLED, 1); const ver = verifyComposed(H, specs, v); const rep = repairCycle(TOUSLED, specs, v, 1, 12);
  const mark = (vd: typeof ver): string => vd.defects.map((d) => { const p = d.lock ? paintHair(H, specs.filter((s) => s.id === d.lock), v).locks[0] : undefined; const q = p?.blade.spine[Math.floor(p.blade.spine.length / 2)]; return q ? `<circle cx="${q.x}" cy="${q.y}" r="${3 + 3 * d.severity}" fill="none" stroke="${d.layer === 'geometry' ? '#d00' : d.layer === 'anatomy' ? '#e80' : '#06c'}" stroke-width="1.4"/>` : ''; }).join('');
  const markR = rep.verdict.defects.map((d) => { const p = d.lock ? paintHair(H, rep.specs.filter((s) => s.id === d.lock), v).locks[0] : undefined; const q = p?.blade.spine[Math.floor(p.blade.spine.length / 2)]; return q ? `<circle cx="${q.x}" cy="${q.y}" r="${3 + 3 * d.severity}" fill="none" stroke="#d00" stroke-width="1.4"/>` : ''; }).join('');
  metrics['vérification'] = { avant: { score: ver.score, défauts: ver.defects.map((d) => `${d.layer}:${d.code}:${d.lock ?? '-'}`), ok: ver.reports.map((r) => `${r.layer}=${r.ok}`) }, après: { score: rep.verdict.score, défauts: rep.verdict.defects.map((d) => `${d.layer}:${d.code}:${d.lock ?? '-'}`) }, journal: rep.journal };
  board('08-verification-reparation', [{ label: `avant : score ${ver.score} (rouge géométrie, orange anatomie, bleu style)`, content: headContent(paintHairPro(H, specs, v), v, { over: mark(ver) }) }, { label: `après réparation : score ${rep.verdict.score} (${rep.journal.filter((j) => j.kept).length} corrections gardées, ${rep.journal.filter((j) => !j.kept).length} annulées)`, content: headContent(paintHairPro(H, rep.specs, v), v, { over: markR }) }], 2, 'Vérification localisée → réparation → revérification');
}
// 09 · intentions artistiques (tête entière) + mesures.
{
  const v = viewAt(29); const names = Object.keys(PRESETS) as PresetName[]; const mj: Record<string, unknown> = {}; const wdir = (n: PresetName): number => { const p: Intent = PRESETS[n]; return p.windDir ?? 0; };
  const P: Panel[] = [{ label: 'référence (profil 01, sans intention)', content: pro(composeHair(TOUSLED, {}, 2, v, 3).specs, v) }];
  for (const n of names) { const { profile, composition } = applyIntent(TOUSLED, PRESETS[n]); const r = composeHair(profile, composition, 2, v, 3); const m = measureIntent(profile, r.specs, v, r.composition, wdir(n)); const vd = verifyComposed(profile.head, r.specs, v); mj[n] = { ...m, scoreVerif: vd.score, défauts: vd.defects.map((d) => d.code) }; P.push({ label: `${n} — vol ${f2(m.volume)} · lisse ${f2(m.sleek)} · poids ${f2(m.weight)} · vent ${f2(m.wind)} · verif ${vd.score}`, content: pro(r.specs, v, profile.head) }); }
  metrics['intentions'] = mj; board('09-intentions', P, 3, 'Intentions artistiques : un mot → profil + composition, mesurable');
}
// 10 · variation par niveaux : ligne = niveau, colonne = graine alternative.
{
  const v = viewAt(29); const s0 = seedsFrom(3); const P: Panel[] = [{ label: 'base (7 graines de niveau)', content: pro(generateLevels(TOUSLED, s0), v) }];
  for (const lv of LEVELS) for (const k of [1, 2]) P.push({ label: `${lv} : graine #${k}`, content: pro(generateLevels(TOUSLED, { ...s0, [lv as Level]: s0[lv] + 7919 * k }), v) });
  board('10-variation-niveaux', P, 3, 'Variation par niveaux : un seul niveau change à la fois');
}
// 11 · tête entière sous plusieurs vues.
{
  const specs = composeHair(TOUSLED, { reading: 1.4, balance: 0.05 }, 4, viewAt(29), 4).specs;
  board('11-tete-entiere-vues', [-60, -45, -25, 0, 15, 30].map((y) => ({ label: `lacet ${y}°`, content: pro(specs, viewAt(y)) })), 3, 'Toute la tête, une coiffure composée, lacets −60° … +30° (au-delà de +30° : non validé, voir docs)');
}
// 12 · contrat d'interopérabilité : mèches de la grammaire → HairLock (polygone + axe) dans le repère du moteur principal.
{
  const v = viewAt(17); const lm = landmarks(H); const eR = project(v, lm.eyeR); const eL = project(v, lm.eyeL); const painted = paintHairPro(H, generate(TOUSLED, 1), v);
  const locks = grammarToHairLocks(painted.locks, { frame: frameFromEyes(eR, eL, eR, eL), head: H, headW: 2 * H.rx * v.s }); const issues = checkHairLockContract(locks, 2 * H.rx * v.s);
  const col: Record<string, string> = { mass: '#c33', main: '#e80', fine: '#27a', hairline: '#999', plait: '#0a0' };
  const over = locks.map((l) => `<path d="M${l.poly.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join('L')}Z" fill="${col[l.rank] ?? '#000'}" fill-opacity=".18" stroke="${col[l.rank] ?? '#000'}" stroke-width=".5"/>`).join('');
  const rankCount = Object.fromEntries(Object.keys(col).map((k) => [k, locks.filter((l) => l.rank === k).length])); metrics['interop'] = { locks: locks.length, violations: issues.length, rangs: rankCount };
  board('12-interop', [{ label: 'rendu grammaire', content: headContent(painted, v) }, { label: `HairLock (couleur = rang) · ${issues.length} violation(s)`, content: headContent({ back: '', front: '', over: '' }, v, { under: over }) }], 2, 'Contrat grammaire → moteur principal');
}
writeFileSync(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 1));
console.log(`artefacts écrits dans ${OUT} (ROI ${ROI.w}×${ROI.h})`);

import { writeFileSync } from 'node:fs';
import { resolveAppearance } from '../../src/appearance';
import { verifyComposed } from '../../src/hair-grammar/compose-verify';
import { generate } from '../../src/hair-grammar/grammar';
import { DEFAULT_HEAD, landmarks, project } from '../../src/hair-grammar/head';
import { generateIntended } from '../../src/hair-grammar/intent-run';
import { frameFromEyes, grammarToHairLocks, type PaintedWithGeom } from '../../src/hair-grammar/interop';
import type { LockSpec } from '../../src/hair-grammar/lock';
import { paintHairResolved, renderResolved } from '../../src/hair-grammar/occlusion-paint';
import type { PaintedLock } from '../../src/hair-grammar/paint';
import { paintHairPro } from '../../src/hair-grammar/paint-pro';
import { TOUSLED } from '../../src/hair-grammar/profiles/tousled';
import { repairCycle } from '../../src/hair-grammar/repair';
import { relationsOf } from '../../src/hair-grammar/occlusion';
import { v3 } from '../../src/hair-grammar/vec';
import { weaveStrands } from '../../src/hair-grammar/weave';
import { Appearance } from '../../src/schema';
import { lockMarkup } from '../../src/render/face/hair-lock';
import { ROI, headContent, png, save, sheetSvg, viewAt, type Panel } from './engine-kit';
import { paintLock } from '../../src/hair-grammar/paint';

/**
 * Artefacts de la PASSE 2 du moteur de cheveux : preuves visuelles, TÊTE ENTIÈRE, des chantiers de docs/HAIR-PASS2-REMAINING.md.
 * `npx tsx scripts/hair-grammar/artefacts-pass2.ts` régénère tout dans artefacts/hair-engine-pass2/ (déterministe).
 */
const OUT = 'artefacts/hair-engine-pass2'; const H = DEFAULT_HEAD; const f2 = (x: number): string => x.toFixed(2);
const board = (name: string, panels: Panel[], cols: number, title: string): void => save(`${OUT}/${name}.png`, png(sheetSvg(panels, cols, title, 3)));
const metrics: Record<string, unknown> = {};
const base = (id: string, o: Partial<LockSpec> = {}): LockSpec => ({ id, family: 'demo', root: { el: 62, az: -20 }, aim: v3(0, 1, 0.05), length: 1.0, bend: 0, wave: { amp: 0, freq: 1, phase: 0 }, flick: { amt: 0, len: 0.2 }, lift0: 0.05, lift1: 0.2, liftPow: 1.3, gravity: 0.05, width: 0.12, peak: 0.4, taper: 1.3, tone: 0, strands: 0, layer: 'front', ...o });
const zoom = (content: string, cx: number, cy: number, k: number): string => `<g transform="translate(${ROI.w / 2 - cx * k} ${ROI.h / 2 - cy * k}) scale(${k})">${content}</g>`;
const tint = (p: PaintedLock, c: string): PaintedLock => ({ ...p, svg: p.svg.replace(/ (fill|stroke|stroke-width|stroke-linejoin|stroke-linecap)="[^"]*"/g, '').replace(/<path /g, `<path fill="${c}" stroke="#111" stroke-width="0.6" `) });

// 01 · ENTRELACS écrit par le moteur : alternance devant/derrière lue dans la géométrie (cap + décollement oscillants).
{
  const V = viewAt(0); const COL = ['#d93a2b', '#2b6fd9', '#2bb34f'];
  const mk = (n: number, lift: number): PaintedLock[] => weaveStrands(H, base('B'), { strands: n, spread: 0.06, freq: 2, lift }).map((s, i) => tint(paintLock(H, s, V), COL[i] as string));
  const head = (P: PaintedLock[]): string => { const r = renderResolved(P); return headContent({ back: r.back, front: r.front, over: r.over }, V, { face: true }); };
  const two = mk(2, 0.03); const flat = mk(2, 0); const three = mk(3, 0.03);
  const nCross = (P: PaintedLock[]): string => relationsOf(P).map((r) => r.kind).join('+');
  metrics.weave = { two: nCross(two), flat: nCross(flat), three: nCross(three) };
  board('01-entrelacs', [
    { content: head(two), label: `2 brins, lift 0,03 : ${nCross(two)} (devant alterné)` }, { content: zoom(head(two), 60, 80, 2.2), label: '2 brins : zoom sur les croisements' },
    { content: head(flat), label: `2 brins, lift 0 : ${nCross(flat)} (même brin devant)` }, { content: zoom(head(flat), 60, 80, 2.2), label: 'sans entrelacs : zoom' },
    { content: head(three), label: `3 brins (tresse) : ${nCross(three)}` }, { content: zoom(head(three), 60, 80, 2.2), label: 'tresse : zoom' },
  ], 2, 'Entrelacs écrit par le moteur — weaveStrands (segment weave)');
}

// 02 · PONT « une seule apparence » : le rendu principal (lockMarkup) lit HairLock.geom ; repère identité (le rendu reste en repère de la planche).
{
  const V = viewAt(20); const lm = landmarks(H); const eR = project(V, lm.eyeR); const eL = project(V, lm.eyeL);
  const frame = frameFromEyes(eR, eL, eR, eL); const headW = 2 * H.rx * V.s;
  const pro = paintHairPro(H, generate(TOUSLED, 3), V);
  const withGeom = grammarToHairLocks(pro.locks as PaintedWithGeom[], { frame, head: H, headW });
  const without = grammarToHairLocks(pro.locks.map(({ spec, blade, layer, svg }) => ({ spec, blade, layer, svg })), { frame, head: H, headW });
  const draw = (locks: typeof withGeom, mode: 'cel' | 'smooth'): string => {
    const ra = resolveAppearance('#4a3326', Appearance.parse({ shading: { mode, bands: 3, highlightBand: 0.75, castShadow: 0.4 } }));
    const st = { id: `p2-${mode}`, ra, ld: { x: -0.6, y: -0.8 }, W: ROI.w };
    const parts = locks.map((l, i) => lockMarkup(l, i, st, 0, true));
    const back = locks.map((l, i) => (l.layer === 'back' ? parts[i]! : null)).filter((x): x is NonNullable<typeof x> => x !== null);
    const front = locks.map((l, i) => (l.layer !== 'back' ? parts[i]! : null)).filter((x): x is NonNullable<typeof x> => x !== null);
    const defs = `<defs>${parts.flatMap((p) => p.defs).join('')}</defs>`;
    return headContent({ back: back.flatMap((p) => p.markup).join(''), front: defs + front.flatMap((p) => p.markup).join(''), over: '' }, V, { face: true });
  };
  metrics.bridge = { locks: withGeom.length, withGeom: withGeom.filter((l) => l.geom).length };
  board('02-pont-geometrie-locale', [
    { content: draw(without, 'smooth'), label: 'hors cel · formule de largeur (avant)' }, { content: draw(withGeom, 'smooth'), label: 'hors cel · géométrie locale (après)' },
    { content: draw(without, 'cel'), label: 'cel · formule de largeur (avant)' }, { content: draw(withGeom, 'cel'), label: 'cel · géométrie locale (après)' },
    { content: zoom(draw(without, 'cel'), 52, 40, 2.4), label: 'cel · avant · zoom sommet' }, { content: zoom(draw(withGeom, 'cel'), 52, 40, 2.4), label: 'cel · après · zoom sommet' },
  ], 2, 'Une seule apparence — HairLock.geom lu par celBands / lockMarkup / hairGloss');
}

// 03 · VUES −75° … +75° : coiffure réparée, tête entière, avec le score avant → après de la couche de vérification.
{
  const rows: Record<string, unknown>[] = []; const panels: Panel[] = [];
  for (const yaw of [-75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75]) {
    const v = viewAt(yaw); const s0 = generate(TOUSLED, 1); const a = verifyComposed(H, s0, v); const r = repairCycle(TOUSLED, s0, v, 1);
    rows.push({ yaw, before: a.score, after: r.verdict.score, eyeFace: r.verdict.defects.filter((d) => d.code === 'anat.eye' || d.code === 'anat.face').length });
    panels.push({ content: headContent(paintHairResolved(H, r.specs, v), v, { head: H }), label: `${yaw}° · défauts ${f2(a.score)} → ${f2(r.verdict.score)}` });
  }
  metrics.views = rows;
  board('03-vues-75-75-reparees', panels, 4, 'Tête entière de −75° à +75° — vérification géométrie · anatomie · style, puis réparation');
}

// 04 · ANATOMIE DU VISAGE : une mèche sur le nez et la bouche est détectée (anat.face), nommée, puis écartée par le cycle de réparation.
{
  const V = viewAt(0); const lm = landmarks(H); const mk = (id: string, az: number, w: number): LockSpec => base(id, { family: 'fringe', root: { el: 68, az }, aim: v3(0, 1, 0.45), length: 1.15, lift0: 0.06, lift1: 0.12, gravity: 0, width: w });
  const specs = [...generate(TOUSLED, 1), mk('intruder-0', 0, 0.16), mk('intruder-1', 4, 0.14)];
  const before = verifyComposed(H, specs, V); const r = repairCycle(TOUSLED, specs, V, 1);
  const mark = (): string => [lm.noseTip, lm.mouth].map((p) => { const q = project(V, p); return `<circle cx="${q.x}" cy="${q.y}" r="3.2" fill="none" stroke="#e8187a" stroke-width="1.1"/>`; }).join('');
  const faceDefects = (v: typeof before): string => `${v.defects.filter((d) => d.code === 'anat.face').length} anat.face`;
  metrics.face = { before: before.score, after: r.verdict.score, defectsBefore: faceDefects(before), defectsAfter: faceDefects(r.verdict), kept: r.journal.filter((j) => j.kept).map((j) => `${j.lock}: ${j.fix}`) };
  board('04-anat-face', [
    { content: headContent(paintHairResolved(H, specs, V), V, { head: H, over: mark() }), label: `avant : ${faceDefects(before)} · score ${f2(before.score)}` },
    { content: headContent(paintHairResolved(H, r.specs, V), V, { head: H, over: mark() }), label: `après réparation : ${faceDefects(r.verdict)} · score ${f2(r.verdict.score)}` },
  ], 2, 'Nez et bouche (cercles roses) — anat.face détecté puis réparé');
}

// 05 · INTENTIONS VÉRIFIÉES : generateIntended = intention → vérification → réparation (avant | après).
{
  const V = viewAt(25); const panels: Panel[] = []; const rows: Record<string, unknown>[] = [];
  const I = [['volume +1, lourd', { volume: 1, weight: 1 }], ['vent 1 vers +0,6 rad', { wind: 1, windDir: 0.6, volume: 0.5 }], ['plaqué lisse', { volume: -1, sleek: 1 }]] as const;
  for (const [name, intent] of I) for (const seed of [2]) {
    const r = generateIntended(TOUSLED, intent, V, seed); const raw = generateIntended(TOUSLED, intent, V, seed, false);
    rows.push({ name, seed, before: raw.initial.score, after: r.verdict.score, kept: r.journal.filter((j) => j.kept).length });
    panels.push({ content: headContent(paintHairResolved(H, raw.specs, V), V, { head: H }), label: `${name} · brut ${f2(raw.initial.score)}` }, { content: headContent(paintHairResolved(H, r.specs, V), V, { head: H }), label: `${name} · vérifié ${f2(r.verdict.score)}` });
  }
  metrics.intents = rows;
  board('05-intentions-verifiees', panels, 2, 'Intention → vérification → réparation (generateIntended), vue 25°');
}

writeFileSync(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics, null, 2));

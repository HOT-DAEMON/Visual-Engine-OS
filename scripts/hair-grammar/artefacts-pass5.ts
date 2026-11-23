import { generate } from '../../src/hair-grammar/grammar';
import { DEFAULT_HEAD, project } from '../../src/hair-grammar/head';
import type { Intent } from '../../src/hair-grammar/intent';
import { generateIntended } from '../../src/hair-grammar/intent-run';
import type { LockSpec } from '../../src/hair-grammar/lock';
import { paintHairResolved } from '../../src/hair-grammar/occlusion-paint';
import { applyPart, measureArt } from '../../src/hair-grammar/part';
import { partOpenness } from '../../src/hair-grammar/part-line';
import { paintLock } from '../../src/hair-grammar/paint';
import { TOUSLED } from '../../src/hair-grammar/profiles/tousled';
import { headEllipse, referenceFromPainted } from '../../src/hair-grammar/reference-fit';
import { observePart } from '../../src/hair-grammar/observe-part';
import { Resvg } from '@resvg/resvg-js';
import { generateRandomFace } from '../../src';
import { compileScene } from '../../src';
import { ROI, headContent, png, save, sheetSvg, viewAt, type Panel } from './engine-kit';

/**
 * Artefacts de la PASSE 5 du moteur de cheveux : preuves visuelles, TÊTE ENTIÈRE, de docs/HAIR-PASS5.md.
 * `npx tsx scripts/hair-grammar/artefacts-pass5.ts` régénère tout dans artefacts/hair-engine-pass5/ (déterministe) : planches + metrics.json.
 */
const OUT = 'artefacts/hair-engine-pass5'; const H = DEFAULT_HEAD; const f2 = (x: number): string => x.toFixed(2);
const board = (name: string, panels: Panel[], cols: number, title: string): void => save(`${OUT}/${name}.png`, png(sheetSvg(panels, cols, title, 3)));
const metrics: Record<string, unknown> = {};
const hair = (specs: readonly LockSpec[], v: ReturnType<typeof viewAt>, over = ''): string => headContent(paintHairResolved(H, specs, v), v, { head: H, over });
/** Points verts = la raie DEMANDÉE (ligne de crâne x = xp projetée) ; trait vert = couloir protégé (± PART_HALF). */
const dotsOf = (xp: number, v: ReturnType<typeof viewAt>): string => {
  let o = ''; for (let el = 30; el <= 89; el += 3) { const c = Math.cos((el * Math.PI) / 180); const az = Math.asin(Math.max(-1, Math.min(1, xp / (H.rx * c)))); const p = project(v, { x: H.rx * c * Math.sin(az), y: -H.ry * Math.sin((el * Math.PI) / 180), z: H.cz + H.rz * c * Math.cos(az) }); o += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="0.9" fill="#13c46b"/>`; }
  return o;
};
const lineOf = (r: ReturnType<typeof generateIntended>, v: ReturnType<typeof viewAt>, xp: number) => partOpenness(r.profile.head, v, r.specs.map((s) => paintLock(r.profile.head, s, v)), xp);

// 01 · TOUTE LA TÊTE — intention complète à 5 lacets : brut | réparé, raie −0,3 en points verts.
{
  const I: Intent = { volume: 0.6, fringe: 0.5, part: -0.3, tips: 0.5, weight: 0.3 }; const rows: Record<string, unknown>[] = []; const panels: Panel[] = []; const xp = -0.3 * H.rx;
  for (const yaw of [-60, -30, 0, 30, 60]) {
    const v = viewAt(yaw); const raw = generateIntended(TOUSLED, I, v, 2, false); const r = generateIntended(TOUSLED, I, v, 2); const a = lineOf(raw, v, xp); const b = lineOf(r, v, xp);
    const fails = (x: typeof r): string => x.verdict.reports.map((q) => `${q.layer[0]}:${q.checks.filter((c) => !c.ok).length}`).join(' ');
    rows.push({ yaw, scoreRaw: raw.initial.score, scoreRepaired: r.verdict.score, corridorFreeRaw: a.bare, corridorFreeFinal: b.bare, samplesInDome: b.judged, clarityRaw: a.clarity, clarityFinal: b.clarity, judged: b.judged, failingFinal: fails(r), defectsFinal: r.verdict.defects.map((d) => d.code) });
    panels.push({ content: hair(raw.specs, v, dotsOf(xp, v)), label: `${yaw}° brut · ${a.judged < 4 ? 'raie non lisible' : `netteté ${f2(a.clarity)}`} · ${raw.initial.defects.length} défauts` }, { content: hair(r.specs, v, dotsOf(xp, v)), label: `${yaw}° réparé · ${b.judged < 4 ? 'raie non lisible (côté détourné)' : `netteté ${f2(b.clarity)}`} · score ${f2(r.verdict.score)} · ${fails(r)}` });
  }
  metrics.fullHead = rows; board('01-toute-la-tete-brut-repare', panels, 4, 'Intention complète (volume · frange · raie −0,3 · pointes · poids) : brut | réparé — points verts = raie demandée');
}

// 02 · RAIE : avant (racines poussées seulement, `applyPart`) | après (couloir dégagé + flancs fermés, `shapePart`), 3 positions × 3 graines, vue de face ; netteté lue sur le raster (observateur de sillon).
{
  const v = viewAt(0); const rows: Record<string, unknown>[] = []; const panels: Panel[] = []; let g0 = 0; let g1 = 0; let n = 0;
  for (const part of [-0.4, 0, 0.4]) for (const seed of [1, 2, 3]) {
    const xp = part * H.rx; const before = applyPart(H, generate(TOUSLED, seed), xp); const after = generateIntended(TOUSLED, { part }, v, seed, false).specs;
    const obs = (sp: readonly LockSpec[]) => observePart(referenceFromPainted(sp.map((L) => paintLock(H, L, v)), ROI.w, ROI.h, headEllipse(TOUSLED, v)), headEllipse(TOUSLED, v));
    const a = obs(before); const b = obs(after); n++; if (a.groove) g0++; if (b.groove) g1++;
    rows.push({ part, seed, before: { groove: a.groove, clarity: a.clarity, width: a.width, window: a.window, u: a.u }, after: { groove: b.groove, clarity: b.clarity, width: b.width, window: b.window, u: b.u } });
    if (seed <= 2) panels.push({ content: hair(before, v, dotsOf(xp, v)), label: `raie ${part} g${seed} avant · ${a.groove ? 'sillon' : a.window > 0 ? `FENÊTRE ${f2(a.window)} rx` : 'illisible'}` }, { content: hair(after, v, dotsOf(xp, v)), label: `raie ${part} g${seed} après · ${b.groove ? `sillon ${f2(b.width)} rx` : 'non lue'}` });
  }
  metrics.partBeforeAfter = { cases: n, grooveBefore: g0, grooveAfter: g1, rows }; board('02-raie-avant-apres', panels, 4, `Raie : une fenêtre chauve n'est pas une raie — sillon lu avant ${g0}/${n}, après ${g1}/${n}`);
}

// 03 · LACETS : raie −0,3 / 0 / +0,3 à −45°, −30°, 0°, 30°, 45° (2 graines) : statistiques exactes de la lecture sur la ligne de crâne.
{
  const rows: Record<string, unknown>[] = []; let free = 0; let readable = 0; let sharp = 0; let n = 0; const panels: Panel[] = [];
  for (const part of [-0.4, -0.3, 0, 0.3, 0.4]) for (const yaw of [-45, -30, 0, 30, 45]) for (const seed of [1, 2]) {
    const v = viewAt(yaw); const xp = part * H.rx; const r = generateIntended(TOUSLED, { part }, v, seed); const l = lineOf(r, v, xp); n++; if (l.bare >= 0.99) free++; if (l.judged >= 4) { readable++; if (l.clarity >= 0.6) sharp++; }
    rows.push({ part, yaw, seed, corridorFree: l.bare, clarity: l.clarity, judged: l.judged, open: l.width, defects: r.verdict.defects.map((d) => d.code) });
    if (seed === 1 && part === -0.3) panels.push({ content: hair(r.specs, v, dotsOf(xp, v)), label: `raie −0,3 · ${yaw}° · ${l.judged < 4 ? `non lisible (${l.judged} éch.)` : `netteté ${f2(l.clarity)} (${l.judged} éch.)`}` });
  }
  metrics.yawSweep = { cases: n, corridorFree: free, readable, sharpOnReadable: sharp, rows }; board('03-raie-tous-lacets', panels, 5, `Raie −0,3 réparée à 5 lacets · ${n} cas : couloir libre ${free}/${n}, netteté ≥ 0,6 sur ${sharp}/${readable} cas lisibles`);
}

// 04 · OMBRE DES MÈCHES SUR LA PEAU : suit la lumière de la scène (azimut 330° = lumière de référence = rendu d'origine).
{
  const panels: Panel[] = []; const rows: Record<string, unknown>[] = [];
  for (const [az, el] of [[330, 55], [90, 55], [180, 55], [270, 55], [330, 20], [330, 85]] as const) {
    const F = generateRandomFace(321, { id: 'f', hairEngine: 'classic', hair: { style: 'short', texture: 'straight', color: '#23232b', seed: 5, volume: 0.5, density: 0.85, part: 0.2, sim: { enabled: true, archetype: 'side_sweep', skinShadow: 0.9 } }, transform: { x: 200, y: 215, scale: 1.05 } } as never);
    const r = compileScene({ width: 400, height: 420, background: '#f4efe9', light: { azimuthDeg: az, elevationDeg: el }, objects: F.objects } as never); if (!r.ok) throw new Error(r.issues.join(';'));
    const img = new Resvg(r.svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng(); rows.push({ azimuth: az, elevation: el });
    panels.push({ content: `<svg x="0" y="0" width="${ROI.w}" height="${ROI.h}" viewBox="250 160 700 673" overflow="hidden"><image href="data:image/png;base64,${Buffer.from(img).toString('base64')}" width="1200" height="1260"/></svg>`, label: `lumière ${az}° / ${el}°${az === 330 && el === 55 ? ' (référence)' : ''}` });
  }
  metrics.skinShadow = rows; board('04-ombre-peau-suit-la-lumiere', panels, 3, 'Ombre des mèches sur la peau (gros plan front, ×3) : la lumière tourne, l\'ombre suit (avant : toujours en bas à droite, même longueur)');
}

save(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 1)); console.log('artefacts pass 5 :', OUT); void measureArt;

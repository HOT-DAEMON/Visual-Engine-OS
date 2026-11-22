import { writeFileSync } from 'node:fs';
import { resolveAppearance } from '../../src/appearance';
import type { HairLock } from '../../src/face/hair';
import { bladeOutline } from '../../src/hair-grammar/blade';
import { domeLimit } from '../../src/hair-grammar/compose-verify';
import { domeMask, domeRatio } from '../../src/hair-grammar/dome';
import { generate } from '../../src/hair-grammar/grammar';
import { DEFAULT_HEAD, landmarks, project } from '../../src/hair-grammar/head';
import { applyIntent, PRESETS, type Intent } from '../../src/hair-grammar/intent';
import { generateIntended } from '../../src/hair-grammar/intent-run';
import { frameFromEyes, grammarToHairLocks } from '../../src/hair-grammar/interop';
import { lightFromVector } from '../../src/hair-grammar/light-bridge';
import type { LockSpec } from '../../src/hair-grammar/lock';
import { orderStability } from '../../src/hair-grammar/occlusion-stability';
import { paintHairResolved } from '../../src/hair-grammar/occlusion-paint';
import { segmentStrands } from '../../src/hair-grammar/observe-strands';
import { measureArt } from '../../src/hair-grammar/part';
import { paintLock } from '../../src/hair-grammar/paint';
import { paintHairPro } from '../../src/hair-grammar/paint-pro';
import { TOUSLED } from '../../src/hair-grammar/profiles/tousled';
import { partCorridor } from '../../src/hair-grammar/repair-dome';
import { headEllipse, referenceFromPainted } from '../../src/hair-grammar/reference-fit';
import { direction2D, lightVector } from '../../src/lighting/light';
import { shadowReach } from '../../src/render/face/hair-light';
import { lockMarkup } from '../../src/render/face/hair-lock';
import { Appearance } from '../../src/schema';
import { ROI, headContent, png, save, sheetSvg, viewAt, type Panel } from './engine-kit';

/**
 * Artefacts de la PASSE 4 du moteur de cheveux : preuves visuelles, TÊTE ENTIÈRE, de docs/HAIR-PASS4.md.
 * `npx tsx scripts/hair-grammar/artefacts-pass4.ts` régénère tout dans artefacts/hair-engine-pass4/ (déterministe) : planches + metrics.json.
 */
const OUT = 'artefacts/hair-engine-pass4'; const H = DEFAULT_HEAD; const f2 = (x: number): string => x.toFixed(2);
const board = (name: string, panels: Panel[], cols: number, title: string): void => save(`${OUT}/${name}.png`, png(sheetSvg(panels, cols, title, 3)));
const metrics: Record<string, unknown> = {};
const hair = (specs: readonly LockSpec[], v: ReturnType<typeof viewAt>, over = ''): string => headContent(paintHairResolved(H, specs, v), v, { head: H, over });
const outlinePath = (s: LockSpec, v: ReturnType<typeof viewAt>): string => `<path d="M${bladeOutline(paintLock(H, s, v).blade).map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')}Z" fill="#1f6fe0" fill-opacity="0.35" stroke="#1f6fe0" stroke-width="0.8"/>`;
const dotsOf = (xp: number, v: ReturnType<typeof viewAt>): string => { let o = ''; for (let el = 30; el <= 89; el += 6) { const c = Math.cos((el * Math.PI) / 180); const az = Math.asin(Math.max(-1, Math.min(1, xp / (H.rx * c)))); const p = project(v, { x: H.rx * c * Math.sin(az), y: -H.ry * Math.sin((el * Math.PI) / 180), z: H.cz + H.rz * c * Math.cos(az) }); o += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="0.9" fill="#1aa34a"/>`; } return o; };
const dome = (r: ReturnType<typeof generateIntended>, v: ReturnType<typeof viewAt>, part?: number): number => { const g = r.verdict.composition.grid; void part; return domeRatio(domeMask(r.profile.head, v, g), g); };

// 01 · TOUTE LA TÊTE — intention complète (planche 08 de la passe 3) : brut | réparé, mèches ajoutées en bleu ; style désormais vert à tous les lacets, calotte ≥ 0,70.
{
  const I: Intent = { volume: 0.6, fringe: 0.5, part: -0.3, tips: 0.5, weight: 0.3 }; const rows: Record<string, unknown>[] = []; const panels: Panel[] = [];
  for (const yaw of [-60, -30, 0, 30, 60]) {
    const v = viewAt(yaw); const raw = generateIntended(TOUSLED, I, v, 2, false); const r = generateIntended(TOUSLED, I, v, 2); const added = r.specs.filter((s) => /-dome\d/.test(s.id));
    const fails = (x: typeof r): string => x.verdict.reports.map((q) => `${q.layer[0]}:${q.checks.filter((c) => !c.ok).length}`).join(' ');
    rows.push({ yaw, scoreRaw: raw.initial.score, scoreRepaired: r.verdict.score, domeRaw: dome(raw, v), domeRepaired: dome(r, v), domeLimit: domeLimit(), addedLocks: added.length, failingRaw: fails(raw), failingRepaired: fails(r) });
    panels.push({ content: hair(raw.specs, v, dotsOf(-0.3 * H.rx, v)), label: `${yaw}° brut · calotte ${f2(dome(raw, v))} · échecs ${fails(raw)}` }, { content: hair(r.specs, v, added.map((s) => outlinePath(s, v)).join('') + dotsOf(-0.3 * H.rx, v)), label: `${yaw}° réparé · calotte ${f2(dome(r, v))} · +${added.length} · échecs ${fails(r)}` });
  }
  metrics.fullHead = rows; board('01-toute-la-tete-brut-repare', panels, 4, 'Intention complète (volume · frange · raie −0,3 · pointes · poids) : brut | réparé — points verts = raie demandée');
}

// 02 · RAIE : −0,3 / 0 / +0,4 à 0°, graines 1, 2, 4 : le couloir de la raie reste à découvert, la calotte est comblée autour.
{
  const rows: Record<string, unknown>[] = []; const panels: Panel[] = []; const v = viewAt(0);
  for (const [part, seed] of [[-0.3, 1], [-0.3, 4], [0, 2], [0.4, 3]] as const) {
    const raw = generateIntended(TOUSLED, { part }, v, seed, false); const r = generateIntended(TOUSLED, { part }, v, seed); const added = r.specs.filter((s) => /-dome\d/.test(s.id)); const xp = part * H.rx;
    const a = measureArt(raw.profile, raw.specs, v).part; const b = measureArt(r.profile, r.specs, v).part;
    const cor = partCorridor(r.profile, v, xp, r.verdict.composition.grid); const msk = domeMask(r.profile.head, v, r.verdict.composition.grid); let leak = 0;
    for (let i = 0; i < cor.length; i++) if (cor[i] && msk[i] && r.verdict.composition.grid.data[i]) leak++;
    rows.push({ part, seed, domeRaw: dome(raw, v), domeRepaired: dome(r, v), addedLocks: added.length, clarityRaw: a.clarity, clarityRepaired: b.clarity, uRaw: a.u, uRepaired: b.u, corridorCellsCoveredAfterRepair: leak });
    panels.push({ content: hair(raw.specs, v, dotsOf(xp, v)), label: `raie ${part} g${seed} brut · calotte ${f2(dome(raw, v))} · netteté ${f2(a.clarity)}` }, { content: hair(r.specs, v, added.map((s) => outlinePath(s, v)).join('') + dotsOf(xp, v)), label: `réparé · calotte ${f2(dome(r, v))} · netteté ${f2(b.clarity)} · +${added.length}` });
  }
  metrics.part = rows; board('02-raie-et-calotte', panels, 4, 'Raie : la calotte est comblée sans fermer le couloir (points verts)');
}

// 03 · FIABILITÉ DE L'ORDRE DE PROFONDEUR — mesure par tronçon (plan vs volume), 48 cas : le « 0,11 → 0,17 » de la passe 3 était du bruit de petits dénominateurs.
{
  let pl = 0; let pf = 0; let vl = 0; let vf = 0; let pairF = 0; let pairV = 0; let n = 0; let worse = 0; const per: Record<string, unknown>[] = [];
  for (const [name, I] of [['base', {}], ['lourd', PRESETS.heavy]] as const) for (const yaw of [0, 29, -29, 50]) for (const seed of [1, 2, 3, 4, 5, 6]) {
    const sp = generate(applyIntent(TOUSLED, I).profile, seed); const V = viewAt(yaw); const a = orderStability(H, sp, V, 8, 'all', false); const b = orderStability(H, sp, V, 8, 'all', true);
    pl += a.segLength; pf += a.segLength * a.segRate; vl += b.segLength; vf += b.segLength * b.segRate; pairF += a.flipped; pairV += b.flipped; n++; if (b.flipped > a.flipped) worse++;
    per.push({ name, yaw, seed, planPairs: a.imposed, planFlipped: a.flipped, volPairs: b.imposed, volFlipped: b.flipped, planSegRate: a.segRate, volSegRate: b.segRate });
  }
  metrics.depthStability = { cases: n, plan: { segLength: pl, segRate: pf / pl, flippedPairs: pairF }, volume: { segLength: vl, segRate: vf / vl, flippedPairs: pairV }, casesWhereVolumeFlipsMorePairs: worse, per };
  const bar = (x: number, y: number, v: number, max: number, c: string, t: string): string => `<rect x="${x}" y="${y}" width="${(120 * v) / max}" height="14" fill="${c}"/><text x="${x + 4}" y="${y + 11}" font-size="9" fill="#111" font-family="Inter,sans-serif">${t}</text>`;
  const card = `<rect width="${ROI.w}" height="${ROI.h}" fill="#fff"/><text x="8" y="14" font-size="9" font-weight="600" font-family="Inter,sans-serif">longueur d'ordre imposée (tronçons)</text>${bar(8, 22, pl, pl, '#b9c4d6', `plan ${pl.toFixed(0)}`)}${bar(8, 40, vl, pl, '#1f6fe0', `volume ${vl.toFixed(0)}`)}<text x="8" y="72" font-size="9" font-weight="600" font-family="Inter,sans-serif">longueur INVERSÉE à 8° (%)</text>${bar(8, 80, 100 * pf / pl, 6, '#b9c4d6', `plan ${(100 * pf / pl).toFixed(1)} %`)}${bar(8, 98, 100 * vf / vl, 6, '#1f6fe0', `volume ${(100 * vf / vl).toFixed(1)} %`)}<text x="8" y="132" font-size="8" fill="#555" font-family="Inter,sans-serif">paires inversées : plan ${pairF} · volume ${pairV}</text>`;
  board('03-profondeur-ordre-par-troncon', [{ content: card, label: `48 cas · volume impose ${(vl / pl).toFixed(2)}× la longueur du plan, aussi fiable` }], 1, 'Profondeur de volume : fiabilité par tronçon (ce que le rendu consomme)');
}

// 04 · LUMIÈRE 3D DU MOTEUR PRINCIPAL : l'élévation (55° = référence, rendu d'origine) change la portée de l'ombre portée ; mêmes mèches, azimut 300°.
{
  const V = viewAt(20); const lm = landmarks(H); const eR = project(V, lm.eyeR); const eL = project(V, lm.eyeL); const frame = frameFromEyes(eR, eL, eR, eL); const headW = 2 * H.rx * V.s; const specs = generate(TOUSLED, 3);
  const panels: Panel[] = []; const rows: Record<string, unknown>[] = [];
  for (const el of [20, 55, 85]) for (const use3 of [false, true]) {
    const L = lightVector({ azimuthDeg: 300, elevationDeg: el, color: '#fff', intensity: 1 });
    const pro = paintHairPro(H, specs, V, undefined, lightFromVector(L, V)); const locks: HairLock[] = grammarToHairLocks(pro.locks as never, { frame, head: H, headW });
    const ra = resolveAppearance('#4a3326', Appearance.parse({ shading: { mode: 'cel', bands: 3, highlightBand: 0.75, castShadow: 0.9 } })); const ld = direction2D(L);
    const parts = locks.map((l, i) => lockMarkup(l, i, { id: `p4-${el}-${use3}`, ra, ld, ...(use3 ? { light: L } : {}), W: ROI.w }, 0, true));
    const back = parts.filter((_, i) => locks[i]!.layer === 'back'); const front = parts.filter((_, i) => locks[i]!.layer !== 'back');
    if (use3) rows.push({ elevation: el, shadowReach: shadowReach(L) });
    panels.push({ content: headContent({ back: back.flatMap((p) => p.markup).join(''), front: `<defs>${parts.flatMap((p) => p.defs).join('')}</defs>` + front.flatMap((p) => p.markup).join(''), over: '' }, V, { head: H }), label: `élévation ${el}° · ${use3 ? `lumière 3D : portée de l'ombre ×${f2(shadowReach(L))}` : 'ld 2D seul (avant)'}` });
  }
  metrics.light3d = rows; board('04-lumiere-3d-moteur-principal', panels, 2, 'Ombre portée selon l\'élévation de la lumière (avant : portée fixe | après : portée physique)');
}

// 05 · SEGMENTATION PAR MÈCHE : référence raster | composantes retrouvées (couleur par mèche) | vérité du moteur ; mesure de rappel / précision.
{
  const V = viewAt(0); const E = headEllipse(TOUSLED, V); const panels: Panel[] = []; const rows: Record<string, unknown>[] = [];
  const col = (k: number): string => `hsl(${(k * 47) % 360} 65% 62%)`; const px = (w: number, h: number, f: (x: number, y: number) => string): string => { let s = ''; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = f(x, y); if (c) s += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c}"/>`; } return `<rect width="${ROI.w}" height="${ROI.h}" fill="#fff"/>${s}`; };
  for (const [name, I, seed] of [['base', {}, 1], ['lourd', PRESETS.heavy, 2]] as const) {
    const P = applyIntent(TOUSLED, I).profile; const sp = generate(P, seed); const pl = sp.map((L) => paintLock(P.head, L, V)); const R = referenceFromPainted(pl, ROI.w, ROI.h); const S = segmentStrands(R, E);
    rows.push({ name, seed, locks: sp.length, components: S.count, coverage: S.coverage, widthMean: S.width.mean, widthCv: S.width.cv, lengthMean: S.length.mean });
    panels.push({ content: px(ROI.w, ROI.h, (x, y) => { const i = y * ROI.w + x; if (!R.mask[i]) return ''; const g = Math.round((R.gray[i] as number) * 255); return `rgb(${g},${g},${g})`; }), label: `${name} graine ${seed} · référence (${sp.length} mèches)` },
      { content: px(ROI.w, ROI.h, (x, y) => { const l = S.labels[y * ROI.w + x] as number; return l >= 0 ? col(l) : R.mask[y * ROI.w + x] ? '#222' : ''; }), label: `${S.count} mèches segmentées · larg. ${f2(S.width.mean)} rx · couv. ${f2(S.coverage)}` });
  }
  metrics.strands = rows; board('05-segmentation-par-meche', panels, 2, 'Segmentation par mèche d\'un raster : vallées perpendiculaires au flux + marqueurs');
}

// 06 · TÊTE ENTIÈRE FINALE — graines 1–3, intention complète, 0° et 30°, tout vérifié.
{
  const I: Intent = { volume: 0.4, fringe: 0.4, part: 0.2, tips: 0.4, weight: 0.2 }; const panels: Panel[] = []; const rows: Record<string, unknown>[] = [];
  for (const seed of [1, 3, 5]) for (const yaw of [0, 30]) {
    const v = viewAt(yaw); const r = generateIntended(TOUSLED, I, v, seed); const bad = r.verdict.reports.flatMap((q) => q.checks.filter((c) => !c.ok).map((c) => c.name));
    rows.push({ seed, yaw, locks: r.specs.length, score: r.verdict.score, failing: bad }); panels.push({ content: hair(r.specs, v), label: `graine ${seed} · ${yaw}° · ${r.specs.length} mèches · échecs ${bad.length}` });
  }
  metrics.finalHeads = rows; board('06-tetes-entieres-finales', panels, 3, 'Têtes entières — intention complète, 3 graines × 2 lacets, vérifiées (géométrie · anatomie · style)');
}

writeFileSync(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics, null, 2).slice(0, 2500));

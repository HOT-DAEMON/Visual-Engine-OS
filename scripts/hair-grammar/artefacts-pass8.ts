import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { resolveAppearance } from '../../src/appearance';
import { lumaOf, peakShadeOpacity, shadeDip } from '../../src/core/shade';
import type { HairLock } from '../../src/face/hair';
import { generate } from '../../src/hair-grammar/grammar';
import { DEFAULT_HEAD, landmarks, project } from '../../src/hair-grammar/head';
import { checkHairLockContract, frameFromEyes, grammarToHairLocks } from '../../src/hair-grammar/interop';
import type { LockSpec } from '../../src/hair-grammar/lock';
import { fillOf } from '../../src/hair-grammar/paint';
import { INK_PRO, paintHairPro, paintLockPro, type ProLock, type ProStyle } from '../../src/hair-grammar/paint-pro';
import { TOUSLED } from '../../src/hair-grammar/profiles/tousled';
import { ringDefects } from '../../src/hair-grammar/ring-check';
import { MEASURED } from '../../src/hair-grammar/ring-measures';
import { shadeAt } from '../../src/hair-grammar/ring-shade';
import { RING, ringBands } from '../../src/hair-grammar/spec-ring';
import { norm, v3 } from '../../src/hair-grammar/vec';
import { verifyRing } from '../../src/hair-grammar/verify-ring';
import { lockMarkup, type LockStyle } from '../../src/render/face/hair-lock';
import { Appearance } from '../../src/schema';
import { ROI, headContent, png, save, sheetSvg, viewAt, type Panel } from './engine-kit';

/**
 * Artefacts de la PASSE 8 du moteur de cheveux (docs/HAIR-PASS8.md) : preuves visuelles, TÊTE ENTIÈRE puis détails, puis la mesure.
 * `npx tsx scripts/hair-grammar/artefacts-pass8.ts` régénère tout dans artefacts/hair-engine-pass8/ (déterministe ; lit artefacts/hair-engine-pass7/measures-ref60.json).
 *  01 TÊTE ENTIÈRE du moteur de grammaire, trois lumières × (sans reflet | ombre en paliers passe 7 | ombre lisse passe 8), verdict G·A·S ;
 *  02 détail du crâne ×2,8, paliers | lisse ;
 *  03 profil de l'ombre aval : référence 60 (points mesurés) contre les paliers et contre le dégradé lisse, erreur quadratique ;
 *  04 RENDU PRINCIPAL, tête entière : reflet de grammaire éteint | « replace » | « add », hors cel et cel, avec la part de pixels clairs mesurée comme sur la référence ;
 *  05 RENDU PRINCIPAL, détail ×2,4 du sommet : off | replace | add (hors cel) ;
 *  06 RENDU PRINCIPAL, tête entière à −30° / 0° / +30° dans le mode retenu (la rotation existante de la pose) ;
 *  07 une même mèche en trois tons, paliers | lisse : lisibilité sur ton clair, absence d'ombre sur ton sombre.
 */
const OUT = 'artefacts/hair-engine-pass8'; const H = DEFAULT_HEAD;
const meas = JSON.parse(readFileSync('artefacts/hair-engine-pass7/measures-ref60.json', 'utf8'));
const board = (name: string, panels: Panel[], cols: number, title: string): void => save(`${OUT}/${name}.png`, png(sheetSvg(panels, cols, title, 3)));
const metrics: Record<string, unknown> = {};
const LIGHTS: readonly { name: string; dir: ReturnType<typeof norm> }[] = [
  { name: 'haut-gauche (réf.)', dir: norm(v3(-0.45, -0.65, 0.6)) }, { name: 'haut-droite', dir: norm(v3(0.6, -0.6, 0.5)) }, { name: 'zénith', dir: norm(v3(0, -0.9, 0.4)) },
];
const P7: ProStyle = { ...INK_PRO, ring: 'add', shoulder: { profile: 'steps' } }; const P8: ProStyle = { ...INK_PRO, ring: 'add' }; const OFF: ProStyle = { ...INK_PRO };
/** Mode retenu pour le rendu principal, décidé sur la mesure de la planche 04 (docs/HAIR-PASS8-RENDER.md). */
const CHOSEN: 'replace' | 'add' = 'replace';
const hair = (specs: readonly LockSpec[], v: ReturnType<typeof viewAt>, st: ProStyle, light: { dir: ReturnType<typeof norm> }): string => headContent(paintHairPro(H, specs, v, st, light), v, { head: H });
const zoom = (content: string, x: number, y: number, w: number): string => `<svg x="0" y="0" width="${ROI.w}" height="${ROI.h}" viewBox="${x} ${y} ${w} ${(w * ROI.h) / ROI.w}" overflow="hidden">${content}</svg>`;
const verdict = (v: ReturnType<typeof viewAt>, specs: readonly LockSpec[], st: ProStyle, light: { dir: ReturnType<typeof norm> }): { ok: boolean; failing: string[]; defects: number; rings: number } => {
  const painted = paintHairPro(H, specs, v, st, light).locks as unknown as ProLock[]; const rep = verifyRing(H, v, painted, light, st);
  const rings = painted.flatMap((l) => { const r = ringBands(l.blade, l.geom, l.spec, v, light, st.shoulder?.len); return r ? [{ l, r }] : []; });
  return { ok: rep.every((r) => r.ok), failing: rep.flatMap((r) => r.checks.filter((c) => !c.ok).map((c) => c.name)), defects: rings.reduce((a, { l, r }) => a + ringDefects(l, r).length, 0), rings: rings.length };
};

// 01 · TOUTE LA TÊTE — trois lumières × (sans | paliers passe 7 | lisse passe 8).
{
  const v = viewAt(0); const specs = generate(TOUSLED, 2); const panels: Panel[] = []; const rows: Record<string, unknown>[] = [];
  for (const light of LIGHTS) for (const [tag, st] of [['sans', OFF], ['paliers (passe 7)', P7], ['lisse (passe 8)', P8]] as const) {
    const r = st === OFF ? null : verdict(v, specs, st, light); rows.push({ light: light.name, variant: tag, rings: r?.rings ?? null, verified: r?.ok ?? null, failing: r?.failing ?? [], defects: r?.defects ?? null });
    panels.push({ content: hair(specs, v, st, light), label: `${light.name} · ${tag}${r ? ` · ${r.rings} reflets · ${r.ok ? 'G·A·S ✓' : `ÉCHEC ${r.failing.length}`}` : ''}` });
  }
  metrics.fullHead = rows; board('01-toute-la-tete-ombre-lisse', panels, 3, 'Moteur de grammaire, tête entière : sans | paliers | dégradé lisse');
}

// 02 · DÉTAIL — crâne ×2,8.
{
  const v = viewAt(0); const specs = generate(TOUSLED, 2); const panels: Panel[] = [];
  for (const light of LIGHTS) for (const [tag, st] of [['paliers (passe 7)', P7], ['lisse (passe 8)', P8]] as const) panels.push({ content: zoom(hair(specs, v, st, light), 62, 20, 56), label: `${light.name} · ${tag} (×2,8)` });
  board('02-details-ombre-lisse', panels, 2, 'Détail ×2,8 : paliers | dégradé lisse');
}

// 03 · PROFIL DE L'OMBRE AVAL — luminance relative selon la distance au bord aval du reflet.
{
  const W = 640; const Hh = 440; const m = { l: 64, r: 20, t: 112, b: 52 }; const X = (x: number): number => m.l + (x / 0.6) * (W - m.l - m.r); const Y = (r: number): number => m.t + ((0.1 - r) / 0.5) * (Hh - m.t - m.b);
  const fill = fillOf(0.6, INK_PRO); const sh = INK_PRO.shadow; const yl = lumaOf(fill); const ys = lumaOf(sh);
  const prof = meas.fan.profile as [number, number][]; const base = [...prof].filter((p) => p[0] > 0.7).map((p) => p[1]).sort((a, b) => a - b)[Math.floor(prof.filter((p) => p[0] > 0.7).length / 2)] as number;
  const ref = prof.filter((p) => p[0] > meas.fan.edgeAt && p[0] < 0.94).map((p) => [p[0] - meas.fan.edgeAt, p[1] / base - 1] as [number, number]).filter((p) => p[0] <= 0.6);
  const a7 = (() => { const t = 0.171; return 1 - (1 - t) ** 3 === 0 ? 0 : t; })(); void a7;
  const steps = (x: number): number => { const a = 0.171; const k = RING.shoulderSteps.filter((f) => x <= f * RING.shoulderLen).length; return (1 - (1 - a) ** k) * (ys - yl) / yl; };
  const peak = peakShadeOpacity(fill, sh); const dipMax = shadeDip(fill, sh, peak); const smooth = (x: number): number => dipMax * shadeAt(x / RING.shoulderLen);
  const line = (f: (x: number) => number, n = 160): string => Array.from({ length: n + 1 }, (_, i) => { const x = (0.6 * i) / n; return `${i ? 'L' : 'M'}${X(x).toFixed(1)} ${Y(f(x)).toFixed(1)}`; }).join('');
  const rms = (f: (x: number) => number): number => Math.sqrt(ref.reduce((acc, p) => acc + (f(p[0]) - p[1]) ** 2, 0) / ref.length);
  const rS = rms(steps); const rL = rms(smooth);
  const yt = [0.1, 0, -0.1, -0.2, -0.3, -0.4]; const xt = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}" font-family="Inter, sans-serif"><rect width="${W}" height="${Hh}" fill="#fff"/>
<text x="${m.l}" y="24" font-size="15" font-weight="600" fill="#111">Ombre aval : luminance relative selon la distance au bord du reflet</text>
${yt.map((t) => `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="${t === 0 ? '#555' : '#ddd'}"/><text x="${m.l - 8}" y="${Y(t) + 4}" font-size="11" text-anchor="end" fill="#444">${(100 * t).toFixed(0)} %</text>`).join('')}
${xt.map((t) => `<text x="${X(t)}" y="${Hh - m.b + 18}" font-size="11" text-anchor="middle" fill="#444">${t.toFixed(1)}</text>`).join('')}
<text x="${(m.l + W - m.r) / 2}" y="${Hh - 10}" font-size="12" text-anchor="middle" fill="#222">distance au bord aval du reflet (fraction de L ; éventail : de R)</text>
<path d="${line(steps)}" fill="none" stroke="#8a8a8a" stroke-width="2.2" stroke-dasharray="6 4"/><path d="${line(smooth)}" fill="none" stroke="#d9480f" stroke-width="2.8"/>
${ref.map((p) => `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="3.4" fill="#111"/>`).join('')}
<g font-size="12"><circle cx="${m.l + 6}" cy="46" r="3.4" fill="#111"/><text x="${m.l + 18}" y="50" fill="#111">référence 60, éventail (mesuré)</text>
<line x1="${m.l}" x2="${m.l + 12}" y1="66" y2="66" stroke="#8a8a8a" stroke-width="2.2" stroke-dasharray="6 4"/><text x="${m.l + 18}" y="70" fill="#111">trois paliers (passe 7) · EQM ${(100 * rS).toFixed(1)} pts</text>
<line x1="${m.l}" x2="${m.l + 12}" y1="86" y2="86" stroke="#d9480f" stroke-width="2.8"/><text x="${m.l + 18}" y="90" fill="#111">dégradé lisse (passe 8) · EQM ${(100 * rL).toFixed(1)} pts</text></g></svg>`;
  save(`${OUT}/03-profil-ombre-aval-paliers-vs-lisse.png`, png(svg, 1280));
  metrics.shadowProfile = { rmsVsReference: { steps: Number(rS.toFixed(4)), smooth: Number(rL.toFixed(4)) }, peakOpacity: Number(peak.toFixed(3)), peakRelativeDip: Number(dipMax.toFixed(3)), nodes: MEASURED.shadeProfile };
}

// Rendu principal : mèches de la grammaire → HairLock → lockMarkup. Part de pixels clairs mesurée comme la référence (pixels de reflet / pixels de cheveux, tête sans visage sur fond blanc).
const HAIR = '#4a3326';
const raOf = (cel: boolean) => resolveAppearance(HAIR, Appearance.parse({ shading: { mode: cel ? 'cel' : 'smooth', bands: 3, highlightBand: 0.75, castShadow: 0.4 } }));
function mainHead(locks: readonly HairLock[], v: ReturnType<typeof viewAt>, ring: LockStyle['ring'], cel: boolean, face = true): string {
  const st: LockStyle = { id: `p8-${ring ?? 'off'}-${cel ? 'c' : 's'}`, ra: raOf(cel), ld: { x: -0.6, y: -0.8 }, W: ROI.w, ...(ring ? { ring } : {}) };
  const parts = locks.map((l, i) => lockMarkup(l, i, st, 0, true)); const pick = (back: boolean): string[] => parts.flatMap((p, i) => ((locks[i] as HairLock).layer === 'back') === back ? p.markup : []);
  return headContent({ back: pick(true).join(''), front: `<defs>${parts.flatMap((p) => p.defs).join('')}</defs>${pick(false).join('')}`, over: '' }, v, { face });
}
function lightShare(svgContent: string, cel: boolean): { share: number; hairPx: number } {
  const S = 6; const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ROI.w * S}" height="${ROI.h * S}" viewBox="0 0 ${ROI.w} ${ROI.h}">${svgContent}</svg>`; const px = new Resvg(svg).render().pixels;
  const ra = raOf(cel); const lh = lumaOf(String(ra.highlight)); const lf = lumaOf(HAIR); const thr = (lh + lf) / 2; let hair = 0; let hl = 0;
  for (let i = 0; i < px.length; i += 4) { const r = px[i] as number; const g = px[i + 1] as number; const b = px[i + 2] as number; if (r > 250 && g > 250 && b > 250) continue; hair++; if (0.299 * r + 0.587 * g + 0.114 * b >= thr) hl++; }
  return { share: hl / Math.max(1, hair), hairPx: hair };
}
const bridge = (yaw: number, seed: number, light: { dir: ReturnType<typeof norm> }): { v: ReturnType<typeof viewAt>; locks: HairLock[]; headW: number; ok: boolean } => {
  const v = viewAt(yaw); const lm = landmarks(H); const eR = project(v, lm.eyeR); const eL = project(v, lm.eyeL); const headW = 2 * H.rx * v.s;
  const locks = grammarToHairLocks(paintHairPro(H, generate(TOUSLED, seed), v, P8, light).locks as never, { frame: frameFromEyes(eR, eL, eR, eL), head: H, headW });
  return { v, locks, headW, ok: checkHairLockContract(locks, headW).length === 0 };
};

// 04 · RENDU PRINCIPAL, TÊTE ENTIÈRE — off | replace | add, hors cel puis cel.
{
  const L0 = LIGHTS[0]!; const { v, locks, ok } = bridge(0, 2, L0); const panels: Panel[] = []; const rows: Record<string, unknown>[] = [];
  for (const cel of [false, true]) for (const ring of [undefined, 'replace', 'add'] as const) {
    const s = lightShare(mainHead(locks, v, ring, cel, false), cel); const tag = ring ?? 'off';
    rows.push({ shading: cel ? 'cel' : 'smooth', ring: tag, lightPixelShare: Number(s.share.toFixed(4)), hairPixels: s.hairPx });
    panels.push({ content: mainHead(locks, v, ring, cel), label: `${cel ? 'cel' : 'lisse'} · ${tag} · pixels clairs ${(100 * s.share).toFixed(2)} % (réf. ${(100 * MEASURED.headHighlightShare).toFixed(2)} %)` });
  }
  metrics.mainRender = { contractOk: ok, locksWithRing: locks.filter((l) => l.geom?.ring).length, locks: locks.length, target: { head: MEASURED.headHighlightShare, panels: MEASURED.panelHighlightShare }, rows };
  board('04-rendu-principal-tete-entiere-off-replace-add', panels, 3, 'Rendu principal, tête entière : reflet de grammaire off | replace | add (lisse puis cel)');
}

// 05 · RENDU PRINCIPAL, DÉTAIL ×2,4 DU SOMMET — off | replace | add, hors cel.
{
  const L0 = LIGHTS[0]!; const { v, locks } = bridge(0, 2, L0); const panels: Panel[] = [];
  for (const ring of [undefined, 'replace', 'add'] as const) panels.push({ content: zoom(mainHead(locks, v, ring, false), 56, 22, 64), label: `lisse · ${ring ?? 'off'} (×2,4)` });
  for (const ring of [undefined, 'replace', 'add'] as const) panels.push({ content: zoom(mainHead(locks, v, ring, true), 56, 22, 64), label: `cel · ${ring ?? 'off'} (×2,4)` });
  board('05-rendu-principal-detail-sommet', panels, 3, 'Rendu principal, détail du sommet');
}

// 06 · RENDU PRINCIPAL à −30° / 0° / +30° dans le mode retenu : la rotation existante de la pose, tête entière.
{
  const L0 = LIGHTS[0]!; const panels: Panel[] = []; const rows: Record<string, unknown>[] = [];
  for (const yaw of [-30, 0, 30]) {
    const { v, locks, ok } = bridge(yaw, 2, L0); const s = lightShare(mainHead(locks, v, CHOSEN, false, false), false); rows.push({ yaw, contractOk: ok, mode: CHOSEN, lightPixelShare: Number(s.share.toFixed(4)), locksWithRing: locks.filter((l) => l.geom?.ring).length });
    panels.push({ content: mainHead(locks, v, CHOSEN, false), label: `lacet ${yaw}° · ${CHOSEN} · ${rows.at(-1)!.locksWithRing} reflets · pixels clairs ${(100 * s.share).toFixed(2)} %` });
  }
  metrics.mainRenderYaw = rows; board('06-rendu-principal-trois-lacets', panels, 3, `Rendu principal (${CHOSEN}), tête entière à −30° / 0° / +30°`);
}

// 07 · UNE MÈCHE, TROIS TONS — paliers | lisse.
{
  const v = viewAt(0); const light = LIGHTS[1]!; const base = generate(TOUSLED, 2).map((s) => paintLockPro(H, s, v, P8, light)).filter((l: ProLock) => l.spec.tone >= -0.6 && ringBands(l.blade, l.geom, l.spec, v, light)).sort((a, b) => b.blade.spine.length - a.blade.spine.length)[0]!;
  const pts = [...base.blade.left, ...base.blade.right]; const x0 = Math.min(...pts.map((p) => p.x)); const x1 = Math.max(...pts.map((p) => p.x)); const y0 = Math.min(...pts.map((p) => p.y)); const y1 = Math.max(...pts.map((p) => p.y));
  const w = Math.max(x1 - x0, ((y1 - y0) * ROI.w) / ROI.h) * 1.25; const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2; const panels: Panel[] = []; const rows: Record<string, unknown>[] = [];
  for (const tone of [0.6, -0.3, -0.9]) for (const [tag, st] of [['paliers', P7], ['lisse', P8]] as const) {
    const l = paintLockPro(H, { ...base.spec, tone }, v, st, light); const fill = fillOf(tone, INK_PRO); const a = peakShadeOpacity(fill, INK_PRO.shadow); const dip = a > 0 ? shadeDip(fill, INK_PRO.shadow, a) : 0;
    rows.push({ tone, variant: tag, peakOpacity: Number(a.toFixed(3)), peakRelativeDip: Number(dip.toFixed(3)), gradients: (l.svg.match(/<linearGradient/g) ?? []).length });
    panels.push({ content: zoom(l.svg, cx - w / 2, cy - (w * ROI.h) / ROI.w / 2, w), label: `ton ${tone} · ${tag}${tag === 'lisse' ? ` · creux max ${(100 * dip).toFixed(0)} %` : ''}` });
  }
  metrics.tones = { lock: base.spec.id, rows }; board('07-une-meche-trois-tons', panels, 2, 'Même mèche, trois tons : paliers | lisse');
}

// 08 · Rapport de vérification : 3 lumières × 3 graines × 2 lacets, ombre lisse.
{
  const rows: Record<string, unknown>[] = [];
  for (const light of LIGHTS) for (const seed of [1, 2, 3]) for (const yaw of [0, 30]) {
    const v = viewAt(yaw); const specs = generate(TOUSLED, seed); const painted = paintHairPro(H, specs, v, P8, light).locks as unknown as ProLock[]; const rep = verifyRing(H, v, painted, light, P8); const r = verdict(v, specs, P8, light);
    rows.push({ light: light.name, seed, yaw, ok: rep.every((x) => x.ok), defects: r.defects, rings: r.rings, failing: r.failing });
  }
  metrics.ringVerification = { cases: rows.length, passing: rows.filter((r) => r.ok).length, defects: rows.reduce((a, r) => a + (r.defects as number), 0), rows };
}
save(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 2));
console.log(JSON.stringify({ shadowProfile: metrics.shadowProfile, mainRender: (metrics.mainRender as { rows: unknown }).rows, yaw: metrics.mainRenderYaw, verification: { cases: (metrics.ringVerification as { cases: number }).cases, passing: (metrics.ringVerification as { passing: number }).passing, defects: (metrics.ringVerification as { defects: number }).defects } }, null, 1));
console.log('artefacts écrits dans', OUT);

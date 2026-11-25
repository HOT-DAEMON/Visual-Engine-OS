import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { compileScene, generateRandomFace } from '../../src';
import { generate } from '../../src/hair-grammar/grammar';
import { DEFAULT_HEAD } from '../../src/hair-grammar/head';
import type { LockSpec } from '../../src/hair-grammar/lock';
import { fillOf } from '../../src/hair-grammar/paint';
import { INK_PRO, paintHairPro, paintLockPro, type ProLock, type ProStyle } from '../../src/hair-grammar/paint-pro';
import { TOUSLED } from '../../src/hair-grammar/profiles/tousled';
import { PART_INVERT_TOL, skullFromImageU } from '../../src/hair-grammar/reference-fit-part';
import { ringDefects } from '../../src/hair-grammar/ring-check';
import { MEASURED } from '../../src/hair-grammar/ring-measures';
import { shoulderDip, shoulderOpacityFor } from '../../src/hair-grammar/ring-tone';
import { RING, ringBands } from '../../src/hair-grammar/spec-ring';
import { norm, v3 } from '../../src/hair-grammar/vec';
import { verifyRing } from '../../src/hair-grammar/verify-ring';
import { ROI, headContent, png, save, sheetSvg, viewAt, type Panel } from './engine-kit';

/**
 * Artefacts de la PASSE 7 du moteur de cheveux (docs/HAIR-PASS7.md) : preuves visuelles, TÊTE ENTIÈRE puis détails, puis les graphiques de mesure.
 * `python3 -I scripts/hair-grammar/measure-ref60.py` puis `npx tsx scripts/hair-grammar/artefacts-pass7.ts` régénèrent tout dans artefacts/hair-engine-pass7/ (déterministe).
 *  01 TÊTE ENTIÈRE, trois lumières × (sans reflet transversal | ombre de la passe 6 | ombre de la passe 7), avec verdict de vérification G·A·S ;
 *  02 détail du crâne (×2,8), passe 6 | passe 7 ;
 *  03 TÊTE ENTIÈRE à −30° / 0° / +30° (la rotation existante de la pose), passe 7 ;
 *  04 une même mèche en trois tons, passe 6 | passe 7 : lisibilité de l'ombre sur ton clair, absence d'ombre sur ton sombre ;
 *  05 profil de luminance de l'ombre aval : référence 60 (éventail) contre le moteur, passe 6 et passe 7 ;
 *  06 lecture de la raie selon le lacet : erreur de re-projection de l'inversion image → crâne, et seuil de rejet ;
 *  07 EFFET ISOLÉ sur les cheveux : intensité de scène fixée à 1, seule `light.influence.hair` varie (1 / 0,5 / 0,15) — la planche 03 de la passe 6 faisait varier TOUTE la scène.
 */
const OUT = 'artefacts/hair-engine-pass7'; const H = DEFAULT_HEAD;
const meas = JSON.parse(readFileSync(`${OUT}/measures-ref60.json`, 'utf8'));
const board = (name: string, panels: Panel[], cols: number, title: string): void => save(`${OUT}/${name}.png`, png(sheetSvg(panels, cols, title, 3)));
const metrics: Record<string, unknown> = {};
const LIGHTS: readonly { name: string; dir: ReturnType<typeof norm> }[] = [
  { name: 'haut-gauche (réf.)', dir: norm(v3(-0.45, -0.65, 0.6)) }, { name: 'haut-droite', dir: norm(v3(0.6, -0.6, 0.5)) }, { name: 'zénith', dir: norm(v3(0, -0.9, 0.4)) },
];
const P6: ProStyle = { ...INK_PRO, ring: 'add', shoulder: { len: 0.2, opacity: 0.12 } }; const P7: ProStyle = { ...INK_PRO, ring: 'add' }; const OFF: ProStyle = { ...INK_PRO };
const hair = (specs: readonly LockSpec[], v: ReturnType<typeof viewAt>, st: ProStyle, light: { dir: ReturnType<typeof norm> }): string => headContent(paintHairPro(H, specs, v, st, light), v, { head: H });
const zoom = (content: string, x: number, y: number, w: number): string => `<svg x="0" y="0" width="${ROI.w}" height="${ROI.h}" viewBox="${x} ${y} ${w} ${(w * ROI.h) / ROI.w}" overflow="hidden">${content}</svg>`;
const verdict = (v: ReturnType<typeof viewAt>, specs: readonly LockSpec[], st: ProStyle, light: { dir: ReturnType<typeof norm> }): { painted: ProLock[]; ok: boolean; failing: string[]; defects: number; rings: number } => {
  const painted = specs.map((s) => paintLockPro(H, s, v, st, light)); const rep = verifyRing(H, v, painted, light, st);
  const rings = painted.flatMap((l) => { const r = ringBands(l.blade, l.geom, l.spec, v, light, st.shoulder?.len); return r ? [{ l, r }] : []; });
  return { painted, ok: rep.every((r) => r.ok), failing: rep.flatMap((r) => r.checks.filter((c) => !c.ok).map((c) => c.name)), defects: rings.reduce((a, { l, r }) => a + ringDefects(l, r).length, 0), rings: rings.length };
};

// 01 · TOUTE LA TÊTE — trois lumières × (sans | passe 6 | passe 7).
{
  const v = viewAt(0); const specs = generate(TOUSLED, 2); const panels: Panel[] = []; const rows: Record<string, unknown>[] = [];
  for (const light of LIGHTS) for (const [tag, st] of [['sans', OFF], ['passe 6', P6], ['passe 7', P7]] as const) {
    const r = st === OFF ? null : verdict(v, specs, st, light); rows.push({ light: light.name, variant: tag, rings: r?.rings ?? null, verified: r?.ok ?? null, failing: r?.failing ?? [], defects: r?.defects ?? null });
    panels.push({ content: hair(specs, v, st, light), label: `${light.name} · ${tag}${r ? ` · ${r.rings} reflets · ${r.ok ? 'G·A·S ✓' : `ÉCHEC ${r.failing.length}`}` : ''}` });
  }
  metrics.fullHead = rows; board('01-toute-la-tete-ombre-aval', panels, 3, 'Reflet transversal, tête entière : sans | passe 6 | passe 7');
}

// 02 · DÉTAIL — crâne ×2,8.
{
  const v = viewAt(0); const specs = generate(TOUSLED, 2); const panels: Panel[] = [];
  for (const light of LIGHTS) for (const [tag, st] of [['passe 6', P6], ['passe 7', P7]] as const) panels.push({ content: zoom(hair(specs, v, st, light), 62, 20, 56), label: `${light.name} · ${tag} (×2,8)` });
  board('02-details-ombre-aval', panels, 2, 'Détail ×2,8 : passe 6 | passe 7');
}

// 03 · TOUTE LA TÊTE À −30° / 0° / +30° — la rotation existante de la pose, passe 7, sous la lumière de référence.
{
  const specs = generate(TOUSLED, 2); const light = LIGHTS[0]!; const panels: Panel[] = []; const rows: Record<string, unknown>[] = [];
  for (const yaw of [-30, 0, 30]) {
    const v = viewAt(yaw); const r = verdict(v, specs, P7, light); rows.push({ yaw, rings: r.rings, verified: r.ok, failing: r.failing, defects: r.defects });
    panels.push({ content: hair(specs, v, P7, light), label: `lacet ${yaw}° · ${r.rings} reflets · ${r.ok ? 'G·A·S ✓' : `ÉCHEC ${r.failing.length}`}` });
  }
  metrics.yaw = rows; board('03-toute-la-tete-trois-lacets', panels, 3, 'Passe 7, tête entière à −30° / 0° / +30°');
}

// 04 · UNE MÈCHE, TROIS TONS — passe 6 | passe 7. La même mèche, repeinte avec tone 0,6 / −0,3 / −0,9.
{
  const v = viewAt(0); const light = LIGHTS[1]!; const base = generate(TOUSLED, 2).map((s) => paintLockPro(H, s, v, P7, light)).filter((l) => l.spec.tone >= -0.6 && ringBands(l.blade, l.geom, l.spec, v, light))
    .sort((a, b) => b.blade.spine.length - a.blade.spine.length)[0]!;
  const pts = [...base.blade.left, ...base.blade.right]; const x0 = Math.min(...pts.map((p) => p.x)); const x1 = Math.max(...pts.map((p) => p.x)); const y0 = Math.min(...pts.map((p) => p.y)); const y1 = Math.max(...pts.map((p) => p.y));
  const w = Math.max(x1 - x0, ((y1 - y0) * ROI.w) / ROI.h) * 1.25; const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
  const panels: Panel[] = []; const rows: Record<string, unknown>[] = [];
  for (const tone of [0.6, -0.3, -0.9]) for (const [tag, st] of [['passe 6', P6], ['passe 7', P7]] as const) {
    const l = paintLockPro(H, { ...base.spec, tone }, v, st, light); const fill = fillOf(tone, INK_PRO); const a = st.shoulder?.opacity ?? shoulderOpacityFor(fill, INK_PRO.shadow);
    const dip = a > 0 ? shoulderDip(fill, INK_PRO.shadow, a) : 0; const lighter = shoulderDip(fill, INK_PRO.shadow, 0.12) > 0;
    rows.push({ tone, fill, variant: tag, stepOpacity: a, relativeDip: Number(dip.toFixed(3)), shadowLightensFill: tag === 'passe 6' ? lighter : false });
    panels.push({ content: zoom(l.svg, cx - w / 2, cy - (w * ROI.h) / ROI.w / 2, w), label: `ton ${tone} · ${tag} · creux ${(100 * dip).toFixed(0)} %${tag === 'passe 6' && lighter ? ' (éclaircit)' : ''}` });
  }
  metrics.tones = { lock: base.spec.id, rows }; board('04-une-meche-trois-tons', panels, 2, 'Même mèche, trois tons : passe 6 | passe 7');
}

// 05 · PROFIL DE L'OMBRE AVAL — luminance relative (au niveau du ruban) selon la distance au bord aval du reflet : référence 60 (éventail), moteur passe 6 et passe 7 sur un remplissage clair.
{
  const W = 640; const Hh = 420; const m = { l: 64, r: 20, t: 104, b: 52 }; const X = (x: number): number => m.l + (x / 0.6) * (W - m.l - m.r); const Y = (r: number): number => m.t + ((0.1 - r) / 0.5) * (Hh - m.t - m.b);
  const fill = fillOf(0.6, INK_PRO); const ys = 0.299 * 0x35 + 0.587 * 0x35 + 0.114 * 0x3b; const yl = 0.299 * 0xf3 + 0.587 * 0xf1 + 0.114 * 0xee;
  const engine = (x: number, len: number, a: number): number => { const k = RING.shoulderSteps.filter((f) => x <= f * len).length; return (1 - (1 - a) ** k) * (ys - yl) / yl; };
  const grid = Array.from({ length: 11 }, (_, i) => -0.4 + 0.05 * i + 0.4).map((x) => x); void grid;
  const prof = meas.fan.profile as [number, number][]; const base = [...prof].filter((p) => p[0] > 0.7).map((p) => p[1]).sort((a, b) => a - b)[Math.floor(prof.filter((p) => p[0] > 0.7).length / 2)] as number;
  // r ≥ 0,94 R : liseré blanc anti-aliasé du bord extérieur de l'éventail (+104 % au dernier point), hors de l'ombre : exclu du tracé ET de l'écart quadratique.
  const ref = prof.filter((p) => p[0] > meas.fan.edgeAt && p[0] < 0.94).map((p) => [p[0] - meas.fan.edgeAt, p[1] / base - 1] as [number, number]).filter((p) => p[0] <= 0.6);
  const line = (f: (x: number) => number, n = 120): string => Array.from({ length: n + 1 }, (_, i) => { const x = (0.6 * i) / n; return `${i ? 'L' : 'M'}${X(x).toFixed(1)} ${Y(f(x)).toFixed(1)}`; }).join('');
  const a7 = shoulderOpacityFor(fill, INK_PRO.shadow);
  const rmsOf = (len: number, a: number): number => Math.sqrt(ref.reduce((acc, p) => acc + (engine(p[0], len, a) - p[1]) ** 2, 0) / ref.length);
  const rms6 = rmsOf(0.2, 0.12); const rms7 = rmsOf(RING.shoulderLen, a7);
  const yt = [0.1, 0, -0.1, -0.2, -0.3, -0.4]; const xt = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}" font-family="Inter, sans-serif"><rect width="${W}" height="${Hh}" fill="#fff"/>
<text x="${m.l}" y="24" font-size="15" font-weight="600" fill="#111">Ombre aval : luminance relative selon la distance au bord du reflet</text>
${yt.map((t) => `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="${t === 0 ? '#555' : '#ddd'}"/><text x="${m.l - 8}" y="${Y(t) + 4}" font-size="11" text-anchor="end" fill="#444">${(100 * t).toFixed(0)} %</text>`).join('')}
${xt.map((t) => `<text x="${X(t)}" y="${Hh - m.b + 18}" font-size="11" text-anchor="middle" fill="#444">${t.toFixed(1)}</text>`).join('')}
<text x="${(m.l + W - m.r) / 2}" y="${Hh - 10}" font-size="12" text-anchor="middle" fill="#222">distance au bord aval du reflet (fraction de L ; éventail : de R)</text>
<path d="${line((x) => engine(x, 0.2, 0.12))}" fill="none" stroke="#8a8a8a" stroke-width="2.2" stroke-dasharray="6 4"/>
<path d="${line((x) => engine(x, RING.shoulderLen, a7))}" fill="none" stroke="#d9480f" stroke-width="2.6"/>
${ref.map((p) => `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="3.4" fill="#111"/>`).join('')}
<g font-size="12"><circle cx="${m.l + 6}" cy="42" r="3.4" fill="#111"/><text x="${m.l + 18}" y="46" fill="#111">référence 60, éventail (mesuré)</text>
<line x1="${m.l}" x2="${m.l + 12}" y1="62" y2="62" stroke="#8a8a8a" stroke-width="2.2" stroke-dasharray="6 4"/><text x="${m.l + 18}" y="66" fill="#111">passe 6 (0,2 L · 0,12) · EQM ${(100 * rms6).toFixed(1)} pts</text>
<line x1="${m.l}" x2="${m.l + 12}" y1="82" y2="82" stroke="#d9480f" stroke-width="2.6"/><text x="${m.l + 18}" y="86" fill="#111">passe 7 (0,42 L · ${a7.toFixed(3)}) · EQM ${(100 * rms7).toFixed(1)} pts</text></g></svg>`;
  save(`${OUT}/05-profil-ombre-aval-reference-vs-moteur.png`, png(svg, 1280));
  const half = (f: (x: number) => number): number => { const d = f(0.0001); for (let x = 0; x < 0.6; x += 0.001) if (f(x) >= d / 2) return x; return 0.6; };
  metrics.shadowProfile = { referenceFanHalfRecovery: MEASURED.halfRecovery.C, engineHalfRecovery: { pass6: Number(half((x) => engine(x, 0.2, 0.12)).toFixed(3)), pass7: Number(half((x) => engine(x, RING.shoulderLen, a7)).toFixed(3)) }, pass7Opacity: a7, rmsVsReference: { pass6: Number(rms6.toFixed(4)), pass7: Number(rms7.toFixed(4)) }, ribbons: meas.ribbons };
}

// 06 · LECTURE DE LA RAIE SELON LE LACET — erreur de re-projection de l'inversion image → crâne ; au-delà de PART_INVERT_TOL la raie n'est plus retenue.
{
  const W = 640; const Hh = 380; const m = { l: 64, r: 20, t: 46, b: 52 }; const X = (u: number): number => m.l + ((u + 1) / 2) * (W - m.l - m.r); const cap = 0.8; const Y = (e: number): number => Hh - m.b - (Math.min(e, cap) / cap) * (Hh - m.t - m.b);
  const colors: Record<number, string> = { 0: '#1b7f3b', 30: '#2563eb', 60: '#b45309', 75: '#b91c1c' }; const rows: Record<string, unknown>[] = [];
  const paths = [0, 30, 60, 75].map((yaw) => {
    const v = viewAt(yaw); const d: string[] = []; let accepted = 0; let total = 0;
    for (let i = 0; i <= 100; i++) { const u = -1 + i / 50; const r = skullFromImageU(TOUSLED, v, u); const e = r ? r.err : cap; d.push(`${i ? 'L' : 'M'}${X(u).toFixed(1)} ${Y(e).toFixed(1)}`); total++; if (r && r.err <= PART_INVERT_TOL) accepted++; }
    rows.push({ yaw, acceptedShare: Number((accepted / total).toFixed(3)) }); return `<path d="${d.join('')}" fill="none" stroke="${colors[yaw]}" stroke-width="2.4"/>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}" font-family="Inter, sans-serif"><rect width="${W}" height="${Hh}" fill="#fff"/>
<text x="${m.l}" y="24" font-size="15" font-weight="600" fill="#111">Raie lue : erreur de re-projection selon la position image et le lacet</text>
<rect x="${m.l}" y="${Y(PART_INVERT_TOL)}" width="${W - m.l - m.r}" height="${Hh - m.b - Y(PART_INVERT_TOL)}" fill="#e6f4ea"/>
<line x1="${m.l}" x2="${W - m.r}" y1="${Y(PART_INVERT_TOL)}" y2="${Y(PART_INVERT_TOL)}" stroke="#1b7f3b" stroke-dasharray="5 4"/><text x="${X(0.1)}" y="${Y(PART_INVERT_TOL) - 5}" font-size="11" text-anchor="middle" fill="#1b7f3b">seuil ${PART_INVERT_TOL} rx : raie retenue sous la ligne</text>
${[0, 0.2, 0.4, 0.6, 0.8].map((t) => `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="#eee"/><text x="${m.l - 8}" y="${Y(t) + 4}" font-size="11" text-anchor="end" fill="#444">${t.toFixed(1)}${t === cap ? '+' : ''}</text>`).join('')}
${[-1, -0.5, 0, 0.5, 1].map((t) => `<text x="${X(t)}" y="${Hh - m.b + 18}" font-size="11" text-anchor="middle" fill="#444">${t}</text>`).join('')}
<text x="${(m.l + W - m.r) / 2}" y="${Hh - 10}" font-size="12" text-anchor="middle" fill="#222">position image du sillon u (rx ; + = droite)</text>
<text x="16" y="${(m.t + Hh - m.b) / 2}" font-size="12" fill="#222" transform="rotate(-90 16 ${(m.t + Hh - m.b) / 2})" text-anchor="middle">erreur (rx)</text>
${paths.join('')}<g font-size="12">${[0, 30, 60, 75].map((y, i) => `<line x1="${X(0.55)}" x2="${X(0.55) + 16}" y1="${m.t + 12 + 18 * i}" y2="${m.t + 12 + 18 * i}" stroke="${colors[y]}" stroke-width="2.4"/><text x="${X(0.55) + 22}" y="${m.t + 16 + 18 * i}" fill="#111">lacet ${y}°</text>`).join('')}</g></svg>`;
  save(`${OUT}/06-raie-cote-detourne.png`, png(svg, 1280)); metrics.partHidden = { tolerance: PART_INVERT_TOL, rows };
}

// 07 · EFFET ISOLÉ SUR LES CHEVEUX — même scène que la planche 03 de la passe 6 (graine 321, side_sweep), intensité 1 ; seule l'influence de la classe `hair` change.
{
  const panels: Panel[] = []; const rows: Record<string, unknown>[] = []; const imgs: string[] = [];
  const facePixels: Buffer[] = [];
  for (const hairInfluence of [1, 0.5, 0.15]) {
    const F = generateRandomFace(321, { id: 'f', hairEngine: 'classic', hair: { style: 'short', texture: 'straight', color: '#23232b', seed: 5, volume: 0.5, density: 0.85, part: 0.2, sim: { enabled: true, archetype: 'side_sweep', skinShadow: 0.9 } }, transform: { x: 200, y: 215, scale: 1.05 } } as never);
    const r = compileScene({ width: 400, height: 420, background: '#f4efe9', light: { azimuthDeg: 330, elevationDeg: 55, intensity: 1, influence: { hair: hairInfluence } }, objects: F.objects } as never); if (!r.ok) throw new Error(r.issues.join(';'));
    const res = new Resvg(r.svg, { fitTo: { mode: 'width', value: 1200 } }).render(); const img = res.asPng(); imgs.push(`data:image/png;base64,${Buffer.from(img).toString('base64')}`); facePixels.push(Buffer.from(res.pixels));
    rows.push({ hairInfluence });
  }
  // Part de pixels qui changent par rapport à l'influence 1, dans la moitié basse du visage (peau, yeux, bouche : hors cheveux) et dans la moitié haute (cheveux) : la preuve chiffrée de l'isolement.
  const wpx = 1200; const hpx = 1260; const diffShare = (a: Buffer, b: Buffer, y0: number, y1: number): number => { let n = 0; let d = 0; for (let y = y0; y < y1; y++) for (let x = 250; x < 950; x++) { const i = (y * wpx + x) * 4; n++; if (Math.abs((a[i] as number) - (b[i] as number)) + Math.abs((a[i + 1] as number) - (b[i + 1] as number)) + Math.abs((a[i + 2] as number) - (b[i + 2] as number)) > 6) d++; } return d / n; };
  const lower: [number, number] = [Math.round(hpx * 0.6), Math.round(hpx * 0.78)]; const upper: [number, number] = [Math.round(hpx * 0.18), Math.round(hpx * 0.4)];
  imgs.forEach((href, i) => {
    const inf = [1, 0.5, 0.15][i]!; const ch = i === 0 ? 0 : diffShare(facePixels[0]!, facePixels[i]!, ...upper); const cl = i === 0 ? 0 : diffShare(facePixels[0]!, facePixels[i]!, ...lower);
    Object.assign(rows[i]!, { changedShareUpperHead: Number(ch.toFixed(4)), changedShareLowerFace: Number(cl.toFixed(4)) });
    panels.push({ content: `<rect width="${ROI.w}" height="${ROI.h}" fill="#f4efe9"/><svg x="0" y="0" width="${ROI.w}" height="${ROI.h}" viewBox="0 0 1200 1260" overflow="hidden"><image href="${href}" width="1200" height="1260"/></svg>`, label: `influence cheveux ${inf} · haut ${(100 * ch).toFixed(1)} % · bas ${(100 * cl).toFixed(1)} % changés` });
  });
  metrics.hairInfluenceIsolated = rows; board('07-effet-isole-sur-les-cheveux', panels, 3, 'Intensité de scène 1, influence « cheveux » 1 / 0,5 / 0,15');
}

// 08 · Rapport de vérification : 3 lumières × 3 graines × 2 lacets, ombre passe 7, reflet « add ».
{
  const rows: Record<string, unknown>[] = [];
  for (const light of LIGHTS) for (const seed of [1, 2, 3]) for (const yaw of [0, 30]) {
    const v = viewAt(yaw); const specs = generate(TOUSLED, seed); const painted = specs.map((s) => paintLockPro(H, s, v, P7, light)); const rep = verifyRing(H, v, painted, light, P7); const r = verdict(v, specs, P7, light);
    rows.push({ light: light.name, seed, yaw, ok: rep.every((x) => x.ok), defects: r.defects, rings: r.rings, reports: rep.map((x) => ({ layer: x.layer, ok: x.ok, checks: x.checks.map((c) => ({ name: c.name, value: Number(c.value.toFixed(4)), min: Number(c.min.toFixed(4)), max: Number(c.max.toFixed(4)), ok: c.ok })) })) });
  }
  metrics.ringVerification = { cases: rows.length, passing: rows.filter((r) => r.ok).length, defects: rows.reduce((a, r) => a + (r.defects as number), 0), rows };
}
save(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 2));
console.log('artefacts écrits dans', OUT);

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { generateRandomFace } from '../src';
import { faceLandmarks } from '../src/face';
import { buildBoundary, projectBoundary, rootFrames, windDir } from '../src/face/hair/boundary';
import { luminance } from '../src/core/color';
import { HAIR_STYLES, HAIR_TEXTURES } from '../src/schema';
import { checkHairBoundary } from '../src/verify/hair-boundary';
import { verifyFace } from '../src/verify';
import { rasterPng } from './lib/raster';
import { layout, render, toWorld } from './lib/proof';

/**
 * Preuves de la LISIÈRE (`docs/HAIR-BOUNDARY.md`) : `npx tsx scripts/artefacts-hair-boundary.ts`. Les images « avant » viennent du commit d'origine
 * (`artefacts/hair-boundary/avant/`, produites par un worktree de ff8b33e avec la même configuration).
 */
const OUT = 'artefacts/hair-boundary';
mkdirSync(OUT, { recursive: true });
const NOFH = { mustache: 'none', beard: 'none' } as const;
const STYLES = ['short', 'buzz', 'bob', 'long', 'ponytail', 'bun', 'spiky', 'afro'] as const;
const KIND = { front: '#ff3b30', sideburn: '#ffb300', ear: '#00c853', nape: '#2979ff' } as const;
const FONT = 'Inter, DejaVu Sans, sans-serif';
const txt = (x: number, y: number, s: string, size = 14, fill = '#222', anchor = 'start'): string => `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${s}</text>`;
const sheet = (name: string, w: number, h: number, body: string, bg = '#f4f1ea'): void => {
  const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${bg}"/>${body}</svg>`;
  writeFileSync(`${OUT}/${name}.png`, rasterPng(full, { fonts: true, fitWidth: Math.min(2000, w) }));
  console.log(`${OUT}/${name}.png`);
};
const b64 = (path: string): string => readFileSync(path).toString('base64');
const CW = 420;
const CH = 560;

// ---- 01 : la lisière sur 8 visages différents (4 tronçons, 4 couleurs) ---------------------------------------------------------------
{
  const seeds = [321, 11, 77, 902, 4040, 31337, 555, 2024];
  const L = layout(seeds.length, 4, CW, CH, 0.7, (i) => ({ seed: seeds[i] as number, opts: { hair: { style: 'short', sideburns: 0.5 } as never, hairEngine: 'classic' } }));
  let ov = '';
  L.cells.forEach((c) => {
    const b = buildBoundary(c.face.params, c.lm);
    const pts = b.loop.map((q) => toWorld(c, q.p.x, q.p.y));
    for (let i = 0; i < b.loop.length; i++) {
      const q = b.loop[i] as (typeof b.loop)[number];
      const n = b.loop[(i + 1) % b.loop.length] as (typeof b.loop)[number];
      if (Math.abs(n.az) > Math.PI / 2 + 0.3 && Math.abs(q.az) > Math.PI / 2 + 0.3) continue;
      ov += `<path d="M${(pts[i] as number[])[0]} ${(pts[i] as number[])[1]}L${(pts[(i + 1) % pts.length] as number[])[0]} ${(pts[(i + 1) % pts.length] as number[])[1]}" stroke="${KIND[q.kind]}" stroke-width="2.4" fill="none"/>`;
    }
  });
  const png = render(L.objects, 4 * CW, 2 * CH, ov, '#f4f1ea');
  const leg = (['front', 'sideburn', 'ear', 'nape'] as const).map((k, i) => `<rect x="${20 + i * 200}" y="${2 * CH + 14}" width="26" height="6" fill="${KIND[k]}"/>${txt(54 + i * 200, 2 * CH + 22, { front: 'implantation du front', sideburn: 'bord avant de la patte', ear: 'contour de l\'oreille', nape: 'nuque (cachée de face)' }[k], 13)}`).join('');
  sheet('01-lisiere-8-visages', 4 * CW, 2 * CH + 40, `<image x="0" y="0" width="${4 * CW}" height="${2 * CH}" href="data:image/png;base64,${png.toString('base64')}"/>${leg}`);
}

// ---- 02 : avant / après, 8 coiffures, deux moteurs ---------------------------------------------------------------------------------------
for (const engine of ['classic', 'v2'] as const) {
  const L = layout(STYLES.length, 4, CW, CH, 0.7, (i) => ({ seed: 321, opts: { identity: 3, ...(engine === 'classic' ? { hairEngine: 'classic' as const } : {}), hair: { style: STYLES[i], texture: 'straight', fringe: 'sweep', color: '#3a2417', seed: 5, volume: 0.5, density: 0.85, part: 0.2 }, facialHair: NOFH } as never }));
  const after = render(L.objects, 4 * CW, 2 * CH, '', '#f4f1ea');
  const w = 4 * CW;
  const h = 2 * CH;
  sheet(`02-avant-apres-${engine}`, w, 2 * h + 70, `${txt(w / 2, 24, `AVANT (commit ff8b33e) — moteur ${engine}`, 18, '#a33', 'middle')}<image x="0" y="34" width="${w}" height="${h}" href="data:image/png;base64,${b64(`${OUT}/avant/styles-${engine}.png`)}"/>${txt(w / 2, h + 60, `APRÈS — moteur ${engine} : coque posée sur la lisière, ailes sur les tempes, oreilles dégagées`, 18, '#285', 'middle')}<image x="0" y="${h + 70}" width="${w}" height="${h}" href="data:image/png;base64,${after.toString('base64')}"/>`);
}

// ---- 03 : défaut corrigé — l'implantation d'origine sortait du crâne -----------------------------------------------------------------
{
  const defect = JSON.parse(readFileSync(`${OUT}/avant/hairline-defect.json`, 'utf8')) as { seed: number; recession: number; hairline: number; hairlineShape?: string; W: number; H: number; pts: { x: number; y: number; a: number }[]; maxRatio: number }[];
  const PW = 470;
  const PH = 560;
  const parts = defect.map((d, i) => {
    const f = generateRandomFace(d.seed, { hairEngine: 'classic', hair: { style: 'short', recession: d.recession, hairline: d.hairline, hairlineShape: d.hairlineShape ?? 'round' } as never });
    const lm = faceLandmarks(f.params, f.width, f.height);
    const b = buildBoundary(f.params, lm);
    const k = 1.15;
    const S = b.skull;
    const contour = Array.from({ length: 60 }, (_, j) => { const y = S.topY + ((S.chinY - S.topY) * j) / 59; return S.a(y); });
    const outline = `M${contour.map((a, j) => `${a * k} ${(S.topY + ((S.chinY - S.topY) * j) / 59) * k}`).join('L')}L${[...contour].reverse().map((a, j) => `${-a * k} ${(S.topY + ((S.chinY - S.topY) * (59 - j)) / 59) * k}`).join('L')}Z`;
    const poly = (pts: { x: number; y: number }[], col: string): string => `<path d="M${pts.map((q) => `${q.x * k} ${q.y * k}`).join('L')}" stroke="${col}" stroke-width="3" fill="none"/>`;
    const out = defect[i] as (typeof defect)[number];
    const dots = out.pts.filter((q) => Math.abs(q.x) > q.a + 1e-6).map((q) => `<circle cx="${q.x * k}" cy="${q.y * k}" r="4" fill="#ff3b30"/>`).join('');
    const after = b.hairline.pts;
    const worst = Math.max(...after.map((q) => Math.abs(q.x) / S.a(q.y)));
    return `<g transform="translate(${i * PW + PW / 2} ${PH / 2 + 10})"><path d="${outline}" fill="#e8c9a8" stroke="#555" stroke-width="2"/>${poly(out.pts, '#ff3b30')}${dots}${poly(after, '#0a8f3c')}</g>${txt(i * PW + PW / 2, 30, `graine ${d.seed} · recul ${d.recession} · implantation ${d.hairline}`, 13, '#222', 'middle')}${txt(i * PW + PW / 2, PH + 14, `avant : |x|/contour max = ${out.maxRatio.toFixed(3)}`, 14, '#c22', 'middle')}${txt(i * PW + PW / 2, PH + 36, `après : ${worst.toFixed(3)}`, 14, '#0a8f3c', 'middle')}`;
  });
  sheet('03-implantation-hors-du-crane-avant-apres', defect.length * PW, PH + 50, `${parts.join('')}`);
}

// ---- 04 : rotation de la tête (schéma de géométrie sur la surface du crâne) ---------------------------------------------------------------
{
  const f = generateRandomFace(321, { hairEngine: 'classic', hair: { style: 'short', sideburns: 0.5 } as never });
  const lm = faceLandmarks(f.params, f.width, f.height);
  const b = buildBoundary(f.params, lm);
  const PW = 360;
  const PH = 520;
  const poses: [number, number][] = [[0, 0], [20, 0], [35, 0], [50, 0], [70, 0], [35, 15]];
  const parts = poses.map(([yaw, pitch], i) => {
    const P = projectBoundary(b, yaw, pitch);
    const sil = Array.from({ length: 40 }, (_, j) => { const y = b.skull.topY + ((lm.jawY - b.skull.topY) * j) / 39; const t = (yaw * Math.PI) / 180; const h = Math.hypot(b.skull.a(y) * Math.cos(t), b.skull.b(y) * Math.sin(t)); return { y, h }; });
    const outline = `M${sil.map((q) => `${q.h} ${q.y}`).join('L')}L${[...sil].reverse().map((q) => `${-q.h} ${q.y}`).join('L')}Z`;
    let body = `<path d="${outline}" fill="#e8c9a8" stroke="#555" stroke-width="2"/>`;
    for (let k = 0; k < P.length; k++) {
      const a = P[k] as (typeof P)[number];
      const n = P[(k + 1) % P.length] as (typeof P)[number];
      const vis = a.visible && n.visible;
      body += `<path d="M${a.x} ${a.y}L${n.x} ${n.y}" stroke="${KIND[a.kind]}" stroke-width="${vis ? 3 : 1.4}" ${vis ? '' : 'stroke-dasharray="3 4" opacity="0.55"'} fill="none"/>`;
    }
    return `<g transform="translate(${i * PW + PW / 2} ${PH / 2 + 10}) scale(1.0)">${body}</g>${txt(i * PW + PW / 2, 28, `lacet ${yaw}° · tangage ${pitch}°`, 15, '#222', 'middle')}`;
  });
  sheet('04-rotation-lisiere-schema', poses.length * PW, PH + 40, `${parts.join('')}${txt(poses.length * PW / 2, PH + 24, 'Schéma de GÉOMÉTRIE : la lisière suit la surface du crâne (trait plein = visible, pointillé = caché). Le rendu complet d\'un visage tourné n\'est pas encore branché.', 13, '#555', 'middle')}`);
}

// ---- 05 : repères de racine et vent -------------------------------------------------------------------------------------------------------
{
  const f = generateRandomFace(321, { hairEngine: 'classic', hair: { style: 'short' } as never });
  const lm = faceLandmarks(f.params, f.width, f.height);
  const b = buildBoundary(f.params, lm);
  const fr = rootFrames(b, 48);
  const PW = 400;
  const PH = 520;
  const winds: [string, { x: number; y: number; z: number }, number][] = [['sans vent', { x: 0, y: 0, z: 0 }, 1], ['vent → (cheveu souple)', { x: 2.2, y: 0, z: 0 }, 1], ['vent ← (cheveu souple)', { x: -2.2, y: 0, z: 0 }, 1], ['vent → (cheveu raide, k = 0,25)', { x: 2.2, y: 0, z: 0 }, 0.25]];
  const parts = winds.map(([label, w, k], i) => {
    const S = b.skull;
    const sil = Array.from({ length: 40 }, (_, j) => { const y = S.topY + ((lm.jawY - S.topY) * j) / 39; return { y, h: S.a(y) }; });
    const outline = `M${sil.map((q) => `${q.h} ${q.y}`).join('L')}L${[...sil].reverse().map((q) => `${-q.h} ${q.y}`).join('L')}Z`;
    const arrows = fr.filter((r) => r.normal.z > 0.15).map((r) => { const d = windDir(r, w, k); const L = 22; return `<path d="M${r.pos.x} ${r.pos.y}l${d.dir.x * L} ${d.dir.y * L}" stroke="${r.kind === 'front' ? '#d22' : r.kind === 'nape' ? '#27c' : '#b80'}" stroke-width="2.4"/><circle cx="${r.pos.x}" cy="${r.pos.y}" r="2.6" fill="#222"/>`; }).join('');
    return `<g transform="translate(${i * PW + PW / 2} ${PH / 2 + 10})"><path d="${outline}" fill="#e8c9a8" stroke="#555" stroke-width="2"/>${arrows}</g>${txt(i * PW + PW / 2, 28, label, 15, '#222', 'middle')}`;
  });
  sheet('05-reperes-de-racine-et-vent', winds.length * PW, PH + 40, `${parts.join('')}${txt(winds.length * PW / 2, PH + 24, 'Chaque repère : position sur le crâne, normale exacte, écoulement tangent (flèche). Le vent dévie la direction par sa seule composante tangente, pondérée par la souplesse.', 13, '#555', 'middle')}`);
}

// ---- 06 : style de la lisière : couleur de cheveux × peau, coiffure (gros plans du front) -------------------------------------------
// Les graines sont CHOISIES pour leur peau réelle (luminance mesurée sur le matériau de l'hôte) : l'étiquette donne la teinte mesurée.
{
  const skinOf = (seed: number): string => (generateRandomFace(seed, { identity: 3 }).objects[0] as { material: { color: string } }).material.color;
  const pick = (ok: (l: number) => boolean): number => { for (let s = 1; s < 2000; s++) if (ok(luminance(skinOf(s)))) return s; throw new Error('aucune graine'); };
  const light = pick((l) => l > 0.5);
  const dark = pick((l) => l < 0.1);
  const cases: { label: string; seed: number; hair: Record<string, unknown> }[] = [
    { label: 'noir · peau claire · short', seed: light, hair: { style: 'short', color: '#15110e' } },
    { label: 'blond · peau claire · short', seed: light, hair: { style: 'short', color: '#e3cf8c' } },
    { label: 'noir · peau foncée · short', seed: dark, hair: { style: 'short', color: '#15110e' } },
    { label: 'châtain · buzz (bord flou)', seed: light, hair: { style: 'buzz', color: '#4a3020' } },
    { label: 'châtain · bun (bord franc)', seed: light, hair: { style: 'bun', color: '#4a3020' } },
    { label: 'châtain · afro crépu (bord flou)', seed: light, hair: { style: 'afro', texture: 'coily', color: '#4a3020' } },
  ];
  const PW = 400;
  const PH = 360;
  const parts = cases.map((c, i) => {
    const L = layout(1, 1, 700, 800, 1, () => ({ seed: c.seed, opts: { identity: 3, hairEngine: 'classic', hair: { seed: 5, volume: 0.5, density: 0.85, part: 0.2, texture: 'straight', ...c.hair } as never, facialHair: NOFH } as never }));
    const png = render(L.objects, 700, 800, '', '#f4f1ea');
    const x = (i % 3) * PW;
    const y = Math.floor(i / 3) * (PH + 34);
    return `<svg x="${x}" y="${y}" width="${PW}" height="${PH}" viewBox="130 60 440 400" overflow="hidden"><image x="0" y="0" width="700" height="800" href="data:image/png;base64,${png.toString('base64')}"/></svg>${txt(x + PW / 2, y + PH + 22, `${c.label} · peau mesurée ${skinOf(c.seed)}`, 13, '#222', 'middle')}`;
  });
  sheet('06-style-de-lisiere-couleur-et-coiffure', 3 * PW, 2 * (PH + 34), parts.join(''));
}

// ---- 07 : toute la tête, 10 coiffures (cou compris), avec le verdict de la vérification ------------------------------------------------
{
  const STY = HAIR_STYLES.filter((s) => s !== 'bald');
  const L = layout(STY.length, 5, CW, CH, 0.7, (i) => ({ seed: 700 + i * 13, opts: { identity: i % 8, hairEngine: 'classic', hair: { style: STY[i], texture: 'auto', fringe: i % 2 ? 'sweep' : 'none', seed: 5 + i } as never, facialHair: NOFH } as never }));
  const png = render(L.objects, 5 * CW, 2 * CH, '', '#f4f1ea');
  const labels = L.cells.map((c, i) => { const r = verifyFace(c.face); const bd = r.checks.filter((k) => k.id.startsWith('boundary') || k.id.startsWith('shell') || k.id.startsWith('hairline')); return txt((i % 5) * CW + CW / 2, Math.floor(i / 5) * CH + CH - 12, `${STY[i]} · lisière ${bd.filter((k) => k.ok).length}/${bd.length} · rapport ${r.ok ? 'OK' : 'ÉCHEC'}`, 14, '#222', 'middle'); }).join('');
  sheet('07-tete-complete-10-coiffures', 5 * CW, 2 * CH, `<image x="0" y="0" width="${5 * CW}" height="${2 * CH}" href="data:image/png;base64,${png.toString('base64')}"/>${labels}`);
}

// ---- 08 : vérification : corpus + contrôles négatifs (rapport JSON) -----------------------------------------------------------------------
{
  const tally: Record<string, { layer: string; severity: string; n: number; fail: number }> = {};
  let faces = 0;
  for (const engine of ['classic', 'v2'] as const) for (const style of HAIR_STYLES.filter((s) => s !== 'bald')) for (const texture of HAIR_TEXTURES) for (let k = 0; k < 6; k++) {
    const seed = 9000 + k * 131 + HAIR_STYLES.indexOf(style) * 7;
    const f = generateRandomFace(seed, { hairEngine: engine, hair: { style, texture } as never });
    faces++;
    for (const c of checkHairBoundary(f)) { const t = (tally[c.id] ??= { layer: c.layer, severity: c.severity, n: 0, fail: 0 }); t.n++; if (!c.ok) t.fail++; }
  }
  writeFileSync(`${OUT}/verification.json`, JSON.stringify({ faces, checks: tally }, null, 1));
  const rows = Object.entries(tally).map(([id, t], i) => `${txt(30, 70 + i * 24, `${t.layer.padEnd(9)} ${id}`, 14, t.fail ? '#c22' : '#222')}${txt(560, 70 + i * 24, `${t.n - t.fail}/${t.n}${t.severity === 'warn' ? ' (avertissement)' : ''}`, 14, t.fail ? '#c22' : '#285')}`).join('');
  sheet('08-verification-3-couches', 760, 110 + Object.keys(tally).length * 24, `${txt(30, 34, `Vérification de la lisière — ${faces} visages (10 styles × 5 textures × 2 moteurs × 6 graines)`, 16)}${rows}`);
  console.log('verification', faces, 'visages');
}

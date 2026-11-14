import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { compileScene, generateRandomFace } from '../src';
import { faceLandmarks, noseGeometry } from '../src/face';
import { FaceParams } from '../src/schema';
import { lightModelOf, litUnderview, patternById, underviewRelief } from '../src/relief';
import { nostrilElongations } from '../src/verify/nose-lit';
import { rasterPng } from './lib/raster';
/**
 * Artefacts des narines en fentes (docs/NOSE-NOSTRIL-SLIT.md) : npx tsx scripts/artefacts-nose-slit.ts [dossier] [dossier-des-images-AVANT]
 *  01 réf. 04 avec les 9 traits mesurés · 02 AVANT (HEAD 13da21e, rendu par un worktree propre) / APRÈS · 03 balayage du paramètre `shape` · 04 mesures (réf. 03, réf. 04, rendu) · 05 têtes complètes + dessous du même visage.
 */
const out = process.argv[2] ?? 'artefacts/nez-narines-fentes', before = process.argv[3] ?? '/tmp/beforeimg';
mkdirSync(out, { recursive: true });
const b64 = (f: string, mime: string): string => `data:${mime};base64,${readFileSync(f).toString('base64')}`;
const LIGHT = { azimuthDeg: 300, elevationDeg: 45, color: '#ffffff', intensity: 1, sourceSize: 0.3 }, model = lightModelOf(LIGHT, { style: 'soft' });
const T = (x: number, y: number, s: string, fs = 13, fill = '#fff'): string => `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${fs}" fill="${fill}">${s}</text>`;
const svgPng = (w: number, h: number, body: string): Buffer => rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#2c3040"/>${body}</svg>`, { fonts: true });
const geo = (shape: number) => { const p = FaceParams.parse({ anatomyEngine: 'structured', nose: { nostrils: { shape } } }); return { p, nose: noseGeometry(p, faceLandmarks(p, 300, 380)) }; };
const lit = (shape: number, pitch: number) => { const { p, nose } = geo(shape); return litUnderview(nose, { pitchDeg: pitch }, '#c68e63', model, { shadow: p.skin.light.shadow }); };
const m4 = JSON.parse(readFileSync('references/nez/measures-04-nostrils.json', 'utf8')), m3 = JSON.parse(readFileSync('references/nez/measures-03.json', 'utf8'));

// 01 · réf. 04 + traits mesurés
{
  const boxes = (m4.strokes as { cx: number; cy: number; lengthPx: number; angleInEllipseFrameDeg: number; elongation: number }[]).map((s) =>
    `<g transform="translate(${s.cx} ${s.cy}) rotate(${s.angleInEllipseFrameDeg})"><rect x="${-s.lengthPx / 2 - 3}" y="-8" width="${s.lengthPx + 6}" height="16" fill="none" stroke="#ff2d9a" stroke-width="1.5"/></g><text x="${s.cx - 10}" y="${s.cy - 12}" font-family="sans-serif" font-size="10" fill="#d0107a">${s.elongation}</text>`).join('');
  writeFileSync(`${out}/01-ref04-traits-mesures.png`, svgPng(1180, 800, `${T(10, 22, `RÉF. 04 : ${m4.summary.strokes} traits de narines mesurés (rectangle = axe et longueur, nombre = allongement) · médiane ${m4.summary.elongation.median} (majorant), extrémité externe relevée de ${m4.summary.outerEndRiseDeg.median}°`, 13)}<g transform="translate(10 40) scale(1.35)"><image width="564" height="761" href="${b64('references/nez/04.jpg', 'image/jpeg')}"/>${boxes}</g>`));
}

// 02 · avant / après (même nez, mêmes tangages)
{
  const cells: string[] = [];
  [20, 40, 60].forEach((pitch, j) => {
    const a = lit(0.55, pitch), x = 10 + j * 380;
    cells.push(`<image x="${x}" y="40" width="360" height="360" preserveAspectRatio="xMidYMid meet" href="${b64(`${before}/p${pitch}.png`, 'image/png')}"/>${T(x, 418, `AVANT (creux ronds) · ${pitch}°`, 12)}`);
    cells.push(`<image x="${x}" y="440" width="360" height="360" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${a.png.toString('base64')}"/>${T(x, 818, `APRÈS (fentes mesurées) · ${pitch}°`, 12)}`);
  });
  writeFileSync(`${out}/02-avant-apres.png`, svgPng(1160, 840, `${T(10, 24, 'Nez par défaut, vue de dessous éclairée par src/relief : avant (commit 13da21e) et après', 14)}${cells.join('')}`));
}

// 03 · balayage du paramètre shape (ronde → fente)
{
  const cells: string[] = []; const shapes = [0, 0.3, 0.55, 1];
  shapes.forEach((s, j) => { const a = lit(s, 40), x = 10 + j * 300, e = nostrilElongations(underviewRelief(geo(s).nose, { pitchDeg: 40 }, 2), 8);
    cells.push(`<image x="${x}" y="40" width="290" height="290" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${a.png.toString('base64')}"/>${T(x, 348, `shape ${s} · allongement mesuré sur l'image ${e.map((v) => v.toFixed(2)).join(' / ')}`, 11)}`); });
  writeFileSync(`${out}/03-balayage-shape.png`, svgPng(1220, 370, `${T(10, 24, 'Paramètre nose.nostrils.shape à 40° de tangage : le paramètre change réellement la forme des ouvertures', 14)}${cells.join('')}`));
}

// 04 · mesures : réf. 03, réf. 04, rendu
{
  const rows: string[] = [T(10, 24, 'Allongement des ouvertures de narine : références (traits mesurés) et rendu (mesuré sur l\'image)', 14)]; let y = 60;
  const st3 = (m3.noses as { strokes?: { elongation: number }[]; merged?: boolean; pair?: unknown }[]).filter((n) => !n.merged && n.pair).flatMap((n) => n.strokes!.map((s) => s.elongation));
  const med = (a: number[]) => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)]!;
  const bar = (v: number, c: string): string => `<rect x="330" y="${y - 12}" width="${Math.round(Math.min(v, 8) * 60)}" height="14" fill="${c}"/>${T(336 + Math.round(Math.min(v, 8) * 60), y, v.toFixed(2), 12)}`;
  rows.push(T(10, y, `réf. 03 (médiane de ${st3.length} traits)`, 12), bar(med(st3), '#79b'), ''); y += 28;
  rows.push(T(10, y, `réf. 04 (médiane de ${m4.summary.strokes} traits, majorant)`, 12), bar(m4.summary.elongation.median, '#79b')); y += 28;
  for (const pitch of [20, 40, 60]) for (const s of [0, 0.55, 1]) { const e = nostrilElongations(underviewRelief(geo(s).nose, { pitchDeg: pitch }, 2), 8); rows.push(T(10, y, `rendu shape ${s} · ${pitch}°`, 12), bar(Math.min(...e), s === 0 ? '#c55' : '#5b8')); y += 24; }
  rows.push(T(330, y + 16, 'rouge = ancien creux rond (shape 0) · vert = fentes', 12, '#ddd'));
  writeFileSync(`${out}/04-mesures.png`, svgPng(820, y + 40, rows.join('')));
}

// 05 · têtes complètes (head_3d ne consomme PAS la vue de dessous : le visage de face est inchangé) + dessous du même visage
{
  const q = patternById('three-quarter-right'), L = { style: q.style, shadowHue: q.shadowHue, bias: q.bias, light: { azimuthDeg: q.azimuthDeg, elevationDeg: q.elevationDeg, shadowHardness: q.hardness, sourceSize: q.sourceSize } };
  const parts: string[] = []; let k = 0;
  for (const seed of [11, 77]) {
    const F = generateRandomFace(seed, { id: 'f0', transform: { x: 340, y: 320, scale: 0.3 } } as never), skin = (F.objects[0] as unknown as { material: { color: string } }).material.color;
    [[0, 0], [45, 0], [0, 25]].forEach(([yaw, pitch], j) => {
      const r = compileScene({ width: 300, height: 360, background: '#ece6dc', objects: [...generateRandomFace(seed, { id: 'f0', transform: { x: 290, y: 350, scale: 0.05 } } as never).objects, { kind: 'head_3d', id: 't0', host: 'f0', resolution: 2, yaw, pitch, transform: { x: 150, y: 30, scale: 0.62 }, lit: L }] } as never);
      if (!r.ok) throw new Error(r.issues.join(';'));
      parts.push(`<image x="${j * 300}" y="${k * 380}" width="300" height="360" href="data:image/png;base64,${rasterPng(r.svg).toString('base64')}"/>${T(j * 300 + 6, k * 380 + 372, `graine ${seed} · lacet ${yaw}° tangage ${pitch}°`, 11)}`);
    });
    const p = F.params, nose = noseGeometry(p, faceLandmarks(p, F.width, F.height)), l = litUnderview(nose, { pitchDeg: 40 }, skin, model, { shadow: p.skin.light.shadow }), sc = Math.min(300 / l.grid.w, 360 / l.grid.h);
    parts.push(`<image x="900" y="${k * 380}" width="${l.grid.w * sc}" height="${l.grid.h * sc}" href="data:image/png;base64,${l.png.toString('base64')}"/>${T(906, k * 380 + 372, `graine ${seed} · dessous éclairé 40° (fentes)`, 11)}`);
    k++;
  }
  writeFileSync(`${out}/05-tetes-et-dessous.png`, svgPng(1210, 770, parts.join('')));
}
console.log('artefacts écrits dans', out);

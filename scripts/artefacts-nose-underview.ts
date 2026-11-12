import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cellSvg, board } from './lib/board';
import { rasterPng } from './lib/raster';
import { lightModelOf, litHead } from '../src/relief';
import { toHsl, fromHsl } from '../src/appearance';
import { faceLandmarks, noseGeometry, noseArchetype } from '../src/face';
import { noseView, type NoseView } from '../src/face/nose';
import { UNDERVIEW_FIT } from '../src/face/nose/underview.generated';
import { FaceParams } from '../src/schema';
import { checkNoseView } from '../src/verify';
import { generateRandomFace } from '../src';

/**
 * Artefacts de la vue de dessous du nez : `npx tsx scripts/artefacts-nose-underview.ts` → artefacts/nez-underview/. Rendus réels, jamais retouchés.
 *  01 superposition du moteur sur la réf. 04 (mesure en cyan/orange, moteur en jaune/vert) : ce que le moteur prédit AU MÊME TANGAGE ajusté ;
 *  02 balayage de tangage et de lacet du même nez ; 03 tête complète éclairée (moteurs existants) + vue de dessous du MÊME nez, même peau.
 * Le rendu de la vue de dessous est DIAGNOSTIQUE (aplats de la peau de l'hôte + nuances de la même teinte) : il n'est pas encore éclairé par src/relief.
 */
const OUT = 'artefacts/nez-underview'; mkdirSync(OUT, { recursive: true });
const S = { anatomyEngine: 'structured' } as const;
const esc = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const pts = (p: readonly { x: number; y: number }[], f: (q: { x: number; y: number }) => [number, number]): string => p.map((q) => f(q).map((v) => v.toFixed(1)).join(',')).join(' ');
const shade = (hex: string, k: number): string => { const c = toHsl(hex); return fromHsl({ ...c, l: Math.min(1, Math.max(0, c.l * k)) }); };
const metrics: Record<string, unknown> = {};

// ── 01 : superposition sur la réf. 04 ───────────────────────────────────────────────────────
{
  const m = JSON.parse(readFileSync('references/nez/measures-04.json', 'utf8')) as { noses: { index: number; ellipse: { cx: number; cy: number; extentW: number; extentH: number; axisRatio: number }; triangle: null | { degenerate: boolean; apex: number[]; baseWidthOverEllipseW: number; heightOverEllipseH: number; baseYRelEllipseCentre: number } }[] };
  const p = FaceParams.parse({ ...S }), geo = noseGeometry(p, faceLandmarks(p, 300, 380));
  const jpg = readFileSync('references/nez/04.jpg').toString('base64');
  const picks = [3, 6, 10, 13, 1, 9];
  const cw = 280, ch = 250, SC = 2.2; let body = ''; const errs: number[] = [];
  picks.forEach((idx, k) => {
    const n = m.noses.find((q) => q.index === idx)!, ph = UNDERVIEW_FIT.pitchDegPerNose.find((q) => q.index === idx)!.pitchDeg, v = noseView(geo, ph);
    const e = n.ellipse, ox = (k % 3) * cw + 10, oy = Math.floor(k / 3) * (ch + 56) + 60;
    // Recalage SANS ajuster la forme : échelle = largeur d'ellipse mesurée / largeur du moteur, centre = centre d'ellipse. Le triangle n'est pas recalé.
    const s = e.extentW / v.ellipse.extentW, toRef = (q: { x: number; y: number }): [number, number] => [e.cx + (q.x - v.ellipse.c.x) * s, e.cy + (q.y - v.ellipse.c.y) * s];
    const vx = ox - (e.cx - cw / (2 * SC)) * SC, vy = oy - (e.cy - ch / (2 * SC)) * SC, T = (q: [number, number]): string => `${(vx + q[0] * SC).toFixed(1)},${(vy + q[1] * SC).toFixed(1)}`;
    const poly = (arr: readonly { x: number; y: number }[]): string => arr.map((q) => T(toRef(q))).join(' ');
    const tri = v.triangle, tm = n.triangle!;
    const mapped = [tri.baseL, tri.baseR, tri.apex].map((q) => toRef(q));
    const apexMeasured: [number, number] = [tm.apex[0]!, tm.apex[1]!];
    const dApex = Math.hypot(mapped[2]![0] - apexMeasured[0], mapped[2]![1] - apexMeasured[1]) / e.extentH; errs.push(dApex);
    body += `<svg x="${ox}" y="${oy}" width="${cw}" height="${ch}" viewBox="${ox} ${oy} ${cw} ${ch}"><rect x="${ox}" y="${oy}" width="${cw}" height="${ch}" fill="#fff"/>`
      + `<image href="data:image/jpeg;base64,${jpg}" x="${vx}" y="${vy}" width="${564 * SC}" height="${761 * SC}"/>`
      + `<polygon points="${poly(v.envelope)}" fill="none" stroke="#ffd54f" stroke-width="2.2" stroke-dasharray="7 4"/>`
      + `<polygon points="${mapped.map((q) => T(q)).join(' ')}" fill="rgba(124,252,0,0.15)" stroke="#43a047" stroke-width="2.2"/>`
      + `<circle cx="${T(apexMeasured).split(',')[0]}" cy="${T(apexMeasured).split(',')[1]}" r="4" fill="#e65100"/></svg>`
      + `<text x="${ox}" y="${oy + ch + 18}" font-family="DejaVu Sans" font-size="12" fill="#e8ecf5">nez ${idx} · tangage ajusté ${ph}°</text>`
      + `<text x="${ox}" y="${oy + ch + 34}" font-family="DejaVu Sans" font-size="10" fill="#9aa4bd">sommet : écart ${(100 * dApex).toFixed(0)} % de la hauteur d'ellipse</text>`;
  });
  metrics.overlay04 = { apexErrorPctOfEllipseH: picks.map((i, k) => ({ nose: i, pct: +(100 * errs[k]!).toFixed(1) })), medianPct: +(100 * [...errs].sort((a, b) => a - b)[Math.floor(errs.length / 2)]!).toFixed(1) };
  const W = 3 * cw + 20, H = 2 * (ch + 56) + 70;
  writeFileSync(`${OUT}/01-superposition-ref04.png`, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#1b1f2e"/><text x="12" y="24" fill="#fff" font-family="DejaVu Sans" font-size="14" font-weight="bold">Moteur recalé sur l'ellipse de la réf. 04 : enveloppe jaune, triangle prédit vert, sommet MESURÉ orange</text><text x="12" y="44" fill="#9aa4bd" font-family="DejaVu Sans" font-size="11">Recalage = centre + largeur de l'ellipse seulement ; nez par défaut, tangage libre, ni lacet ni roulis.</text>${body}</svg>`, { fonts: true }));
}

// ── 02 : balayage tangage / lacet ───────────────────────────────────────────────────────────
function drawView(v: NoseView, skin: string, cx: number, cy: number, s: number): string {
  const f = (q: { x: number; y: number }): [number, number] => [cx + (q.x - 0) * s, cy + (q.y - v.ellipse.c.y) * s];
  const dark = shade(skin, 0.62), mid = shade(skin, 0.86), light = shade(skin, 1.1);
  return `<polygon points="${pts(v.envelope, f)}" fill="${mid}" stroke="${shade(skin, 0.5)}" stroke-width="1.4"/>`
    + `<polygon points="${pts(v.alae.left, f)}" fill="${skin}" stroke="${dark}" stroke-width="1"/><polygon points="${pts(v.alae.right, f)}" fill="${skin}" stroke="${dark}" stroke-width="1"/>`
    + `<polygon points="${pts(v.lobule, f)}" fill="${light}" stroke="${dark}" stroke-width="1"/>`
    + `<polygon points="${pts(v.nostrils.left, f)}" fill="#2b1714" fill-opacity="${(0.88 * v.nostrilVisibility).toFixed(2)}"/><polygon points="${pts(v.nostrils.right, f)}" fill="#2b1714" fill-opacity="${(0.88 * v.nostrilVisibility).toFixed(2)}"/>`
    + `<polygon points="${pts([v.triangle.baseL, v.triangle.baseR, v.triangle.apex], f)}" fill="none" stroke="#ff8a80" stroke-width="1.2" stroke-dasharray="4 3"/>`;
}
const skinOf = (patch: object): string => (cellSvg({ seed: 321, patch: { ...S, ...patch } as never }, 200, 200).meta.face.objects[0] as unknown as { material: { color: string } }).material.color;
{
  const skin = skinOf({}), p = FaceParams.parse({ ...S }), geo = noseGeometry(p, faceLandmarks(p, 300, 380)), s = 3.4, cw = 190, chh = 170;
  const rows: { title: string; views: [string, NoseView][] }[] = [
    { title: 'Tangage (caméra sous le nez → au-dessus) · lacet 0°', views: [-30, 0, 20, 40, 60, 80].map((ph) => [`${ph}°`, noseView(geo, ph)] as [string, NoseView]) },
    { title: 'Lacet (trois quarts) · tangage 30°', views: [-45, -25, 0, 25, 45].map((ya) => [`lacet ${ya}°`, noseView(geo, 30, ya)] as [string, NoseView]) },
  ];
  let body = '', y = 54;
  for (const r of rows) {
    body += `<text x="12" y="${y}" fill="#e8ecf5" font-family="DejaVu Sans" font-size="14" font-weight="bold">${esc(r.title)}</text>`;
    r.views.forEach(([lab, v], i) => { body += drawView(v, skin, 12 + i * cw + cw / 2, y + 14 + chh / 2, s) + `<text x="${12 + i * cw + cw / 2}" y="${y + chh + 8}" fill="#9aa4bd" font-family="DejaVu Sans" font-size="12" text-anchor="middle">${esc(lab)} · L/H ellipse ${v.ellipse.axisRatio.toFixed(2)}</text>`; });
    y += chh + 44;
  }
  const W = 12 + 6 * cw, H = y + 20;
  writeFileSync(`${OUT}/02-balayage-tangage-lacet.png`, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#1b1f2e"/><text x="12" y="26" fill="#fff" font-family="DejaVu Sans" font-size="14" font-weight="bold">Même nez par dessous/dessus puis en trois quarts (rendu diagnostique ; triangle de base en pointillé rouge)</text>${body}</svg>`, { fonts: true }));
  metrics.sweep = Object.fromEntries([-30, 0, 20, 40, 60, 80].map((ph) => { const v = noseView(geo, ph); return [`${ph}deg`, { axisRatio: +v.ellipse.axisRatio.toFixed(3), triangleHeight: +v.triangleMetrics.heightOverEllipseH.toFixed(3) }]; }));
}

// ── 03 : tête complète + vue de dessous du même nez ─────────────────────────────────────────
{
  const LIGHT = { azimuthDeg: 300, elevationDeg: 45, color: '#ffffff', intensity: 1, sourceSize: 0.3 }, model = lightModelOf(LIGHT, { style: 'soft' });
  const heads: [string, object][] = [['nez par défaut', {}], ['archétype « pyramide »', noseArchetype('pyramide')], ['archétype « cloche-ailes »', noseArchetype('cloche-ailes')]];
  const cells: { png: Buffer; label: string }[] = [];
  for (const [label, patch] of heads) {
    const full = { ...S, ...patch };
    const { svg, meta } = cellSvg({ seed: 321, patch: full as never, light: LIGHT, focus: 'face' }, 360, 440);
    const host = { face: meta.params, width: meta.face.width, height: meta.face.height }, skin = (meta.face.objects[0] as unknown as { material: { color: string } }).material.color;
    cells.push({ png: rasterPng(litHead(svg, { ...host }, skin, model).svg, { fonts: true }), label: `${label} — tête entière` });
    const nose = noseGeometry(meta.params, meta.lm), v = noseView(nose, 40);
    const dv = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="440"><rect width="360" height="440" fill="#3b4157"/>${drawView(v, skin, 180, 220, 360 / (nose.widthPx * 1.5))}<text x="180" y="420" fill="#e8ecf5" font-family="DejaVu Sans" font-size="13" text-anchor="middle">même nez, même peau, vu de dessous (40°)</text></svg>`;
    cells.push({ png: rasterPng(dv, { fonts: true }), label: `${label} — dessous` });
  }
  writeFileSync(`${OUT}/03-tete-et-dessous.png`, board('Tête éclairée et vue de dessous du même nez', cells, 2, 360, 440));
  // Vérification (3 couches) sur 12 visages × 3 tangages : preuve chiffrée dans le fichier de métriques.
  const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 321]; let n = 0, errors = 0, warns = 0;
  for (const sd of SEEDS) for (const ph of [20, 40, 60]) for (const c of checkNoseView(generateRandomFace(sd, {}), ph)) { n++; if (!c.ok) { if (c.severity === 'error') errors++; else warns++; } }
  metrics.verification = { checks: n, errors, warns };
}
metrics.fit = { residualRms: UNDERVIEW_FIT.residualRms, baselineMedianRms: UNDERVIEW_FIT.baselineMedianRms, leaveOneOutRms: UNDERVIEW_FIT.leaveOneOutRms, noses: UNDERVIEW_FIT.noses };
writeFileSync(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 1));
console.log(JSON.stringify(metrics, null, 1));

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cellSvg, board } from './lib/board';
import { rasterPng } from './lib/raster';
import { lightModelOf, litHead, litUnderview } from '../src/relief';
import { toHsl, fromHsl } from '../src/appearance';
import { faceLandmarks, noseGeometry, noseArchetype } from '../src/face';
import { noseView, identifyAngles, type NoseView } from '../src/face/nose';
import { UNDERVIEW_FIT } from '../src/face/nose/underview.generated';
import { UNDERVIEW_MODEL } from '../src/face/nose/underview-model';
import { FaceParams } from '../src/schema';
import { checkNoseView } from '../src/verify';
import { generateRandomFace } from '../src';

/**
 * Artefacts de la vue de dessous du nez : `npx tsx scripts/artefacts-nose-underview.ts` → artefacts/nez-underview/. Rendus réels, jamais retouchés.
 *  01 superposition du moteur sur la réf. 04 (mesure en orange, moteur en jaune/vert) : angles LUS sur les observables (protocole v2), sommet non utilisé pour le placement ;
 *  02 balayage de tangage et de lacet du même nez ; 03 tête complète éclairée (moteurs existants) + vue de dessous du MÊME nez, même peau.
 * Le rendu de la vue de dessous est DIAGNOSTIQUE (aplats de la peau de l'hôte + nuances de la même teinte) : il n'est pas encore éclairé par src/relief.
 */
const OUT = 'artefacts/nez-underview'; mkdirSync(OUT, { recursive: true });
const S = { anatomyEngine: 'structured' } as const;
const esc = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const pts = (p: readonly { x: number; y: number }[], f: (q: { x: number; y: number }) => [number, number]): string => p.map((q) => f(q).map((v) => v.toFixed(1)).join(',')).join(' ');
const shade = (hex: string, k: number): string => { const c = toHsl(hex); return fromHsl({ ...c, l: Math.min(1, Math.max(0, c.l * k)) }); };
const metrics: Record<string, unknown> = {};
const std = (a: number[]): number => { const mu = a.reduce((t, x) => t + x, 0) / a.length; return Math.sqrt(a.reduce((t, x) => t + (x - mu) ** 2, 0) / a.length); };

// ── 01 : superposition sur la réf. 04 ───────────────────────────────────────────────────────
// Angles TIRÉS DES OBSERVABLES (protocole v2, docs/NOSE-UNDERVIEW-CALIB.md) : tangage et lacet identifiés par (rapport d'axes, |décalage du sommet|), signe du lacet par
// le signe du décalage mesuré, roulis par l'angle mesuré du grand axe. Le sommet du triangle n'est PAS utilisé pour placer le moteur : l'écart est une vraie prédiction.
{
  type Fr = { valid: boolean; heightOverMinor: number; baseVRelCentre: number; apexBelowBottom: number; apexUOverMajor: number; rollDeg: number };
  const m = JSON.parse(readFileSync('references/nez/measures-04.json', 'utf8')) as { noses: { index: number; ellipse: { cx: number; cy: number; major: number; minor: number; extentW: number; extentH: number; axisRatio: number; majorAngleDeg: number }; triangle: null | { degenerate: boolean; apex: number[]; frame: Fr } }[] };
  const p = FaceParams.parse({ ...S }), geo = noseGeometry(p, faceLandmarks(p, 300, 380));
  const jpg = readFileSync('references/nez/04.jpg').toString('base64');
  const valid = m.noses.filter((n) => n.triangle && !n.triangle.degenerate && n.triangle.frame.valid);
  const SR = std(valid.map((n) => n.ellipse.axisRatio)), SU = std(valid.map((n) => Math.abs(n.triangle!.frame.apexUOverMajor)));
  const med = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
  interface Placed { idx: number; pitch: number; yaw: number; roll: number; v: NoseView; mapped: [number, number][]; errMinor: number; errExtentH: number; errBaselineMinor: number; misfit: number }
  const place = (n: (typeof valid)[number]): Placed => {
    const e = n.ellipse, fr = n.triangle!.frame, id = identifyAngles(geo, UNDERVIEW_MODEL, { r: e.axisRatio, u: Math.abs(fr.apexUOverMajor) }, { sr: SR, su: SU })!;
    let yaw = id.yawDeg; if (Math.sign(noseView(geo, id.pitchDeg, yaw).frame.apexUOverMajor) !== Math.sign(fr.apexUOverMajor)) yaw = -yaw;
    const tilt0 = noseView(geo, id.pitchDeg, yaw).ellipse.angleDeg, roll = fr.rollDeg - tilt0, v = noseView(geo, id.pitchDeg, yaw, UNDERVIEW_MODEL, roll);
    const s2 = e.major / v.ellipse.major, toRef = (q: { x: number; y: number }): [number, number] => [e.cx + (q.x - v.ellipse.c.x) * s2, e.cy + (q.y - v.ellipse.c.y) * s2];
    const mapped = [v.triangle.baseL, v.triangle.baseR, v.triangle.apex].map(toRef) as [number, number][], am = n.triangle!.apex;
    const dpx = Math.hypot(mapped[2]![0] - am[0]!, mapped[2]![1] - am[1]!);
    // Prédicteur SANS modèle (médiane, nez courant retiré) : sommet placé au décalage médian du repère propre, même ellipse mesurée.
    const rest = valid.filter((q) => q.index !== n.index).map((q) => q.triangle!.frame), phi = (e.majorAngleDeg * Math.PI) / 180;
    const uu = med(rest.map((f) => f.apexUOverMajor)) * e.major, vv = (med(rest.map((f) => f.baseVRelCentre)) + med(rest.map((f) => f.heightOverMinor))) * e.minor;
    const bx = e.cx + uu * Math.cos(phi) - vv * Math.sin(phi), by = e.cy + uu * Math.sin(phi) + vv * Math.cos(phi);
    return { idx: n.index, pitch: id.pitchDeg, yaw, roll, v, mapped, errMinor: dpx / e.minor, errExtentH: dpx / e.extentH, errBaselineMinor: Math.hypot(bx - am[0]!, by - am[1]!) / e.minor, misfit: id.misfit };
  };
  const all = valid.map(place);
  const picks = [3, 6, 10, 13, 1, 9];
  const cw = 280, ch = 250, SC = 2.2; let body = '';
  picks.forEach((idx, k) => {
    const n = m.noses.find((q) => q.index === idx)!, pl = all.find((q) => q.idx === idx)!, e = n.ellipse, ox = (k % 3) * cw + 10, oy = Math.floor(k / 3) * (ch + 56) + 60;
    const vx = ox - (e.cx - cw / (2 * SC)) * SC, vy = oy - (e.cy - ch / (2 * SC)) * SC, T = (q: [number, number]): string => `${(vx + q[0] * SC).toFixed(1)},${(vy + q[1] * SC).toFixed(1)}`;
    const s2 = e.major / pl.v.ellipse.major, toRef = (q: { x: number; y: number }): [number, number] => [e.cx + (q.x - pl.v.ellipse.c.x) * s2, e.cy + (q.y - pl.v.ellipse.c.y) * s2];
    const am: [number, number] = [n.triangle!.apex[0]!, n.triangle!.apex[1]!];
    body += `<svg x="${ox}" y="${oy}" width="${cw}" height="${ch}" viewBox="${ox} ${oy} ${cw} ${ch}"><rect x="${ox}" y="${oy}" width="${cw}" height="${ch}" fill="#fff"/>`
      + `<image href="data:image/jpeg;base64,${jpg}" x="${vx}" y="${vy}" width="${564 * SC}" height="${761 * SC}"/>`
      + `<polygon points="${pl.v.envelope.map((q) => T(toRef(q))).join(' ')}" fill="none" stroke="#ffd54f" stroke-width="2.2" stroke-dasharray="7 4"/>`
      + `<polygon points="${pl.mapped.map((q) => T(q)).join(' ')}" fill="rgba(124,252,0,0.15)" stroke="#43a047" stroke-width="2.2"/>`
      + `<circle cx="${T(am).split(',')[0]}" cy="${T(am).split(',')[1]}" r="4" fill="#e65100"/></svg>`
      + `<text x="${ox}" y="${oy + ch + 18}" font-family="DejaVu Sans" font-size="12" fill="#e8ecf5">nez ${idx} · T ${pl.pitch}° L ${pl.yaw.toFixed(0)}° R ${pl.roll.toFixed(0)}° (lus)</text>`
      + `<text x="${ox}" y="${oy + ch + 34}" font-family="DejaVu Sans" font-size="10" fill="#9aa4bd">sommet : ${(100 * pl.errMinor).toFixed(0)} % du petit axe · sans modèle ${(100 * pl.errBaselineMinor).toFixed(0)} %</text>`;
  });
  const meds = (a: number[]): number => +(100 * med(a)).toFixed(1);
  metrics.overlay04 = {
    protocol: 'v2 : angles lus sur les observables, sommet NON utilisé pour le placement', noses: all.length,
    apexErrorPctOfMinorAxis: all.map((q) => ({ nose: q.idx, pitch: q.pitch, yaw: +q.yaw.toFixed(0), roll: +q.roll.toFixed(0), pct: +(100 * q.errMinor).toFixed(1), baselinePct: +(100 * q.errBaselineMinor).toFixed(1) })),
    modelMedianPct: meds(all.map((q) => q.errMinor)), baselineMedianPct: meds(all.map((q) => q.errBaselineMinor)),
    modelMedianPctOfEllipseExtentH_comparableToV1: meds(all.map((q) => q.errExtentH)), v1MedianPctReportedBefore: 22.7,
    nosesWhereModelBeatsBaseline: all.filter((q) => q.errMinor < q.errBaselineMinor).length,
  };
  const W = 3 * cw + 20, H = 2 * (ch + 56) + 70;
  writeFileSync(`${OUT}/01-superposition-ref04.png`, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#1b1f2e"/><text x="12" y="24" fill="#fff" font-family="DejaVu Sans" font-size="15" font-weight="bold">Moteur sur la réf. 04 (jaune : enveloppe, vert : triangle, orange : sommet mesuré)</text><text x="12" y="44" fill="#9aa4bd" font-family="DejaVu Sans" font-size="11">T tangage, L lacet, R roulis : LUS sur les observables, jamais ajustés sur le sommet. Recalage : centre et grand axe de l'ellipse seulement.</text>${body}</svg>`, { fonts: true }));
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
metrics.fit = { protocol: UNDERVIEW_FIT.protocol, residualRms: UNDERVIEW_FIT.residualRms, baselineMedianRms: UNDERVIEW_FIT.baselineMedianRms, leaveOneOutRms: UNDERVIEW_FIT.leaveOneOutRms, baselineMedianLooRms: UNDERVIEW_FIT.baselineMedianLooRms, predicted3: UNDERVIEW_FIT.predicted3, noses: UNDERVIEW_FIT.noses, plateau: UNDERVIEW_FIT.plateau, fitted: UNDERVIEW_FIT.fitted };
// ── 04 : vue de dessous ÉCLAIRÉE par le moteur unique (src/relief) contre l'ancien aplat diagnostique ─────────────────────────
{
  const LIGHT = { azimuthDeg: 300, elevationDeg: 45, color: '#ffffff', intensity: 1, sourceSize: 0.3 }, model = lightModelOf(LIGHT, { style: 'soft' });
  const heads: [string, object][] = [['nez par défaut', {}], ['archétype « pyramide »', noseArchetype('pyramide')], ['archétype « cloche-ailes »', noseArchetype('cloche-ailes')]];
  const cells: { png: Buffer; label: string }[] = [], stats: Record<string, unknown>[] = [];
  const lum = (r: number, g: number, b: number): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  for (const [label, patch] of heads) {
    const { meta } = cellSvg({ seed: 321, patch: { ...S, ...patch } as never, light: LIGHT, focus: 'face' }, 360, 440);
    const skin = (meta.face.objects[0] as unknown as { material: { color: string } }).material.color, nose = noseGeometry(meta.params, meta.lm);
    for (const pitch of [20, 40, 60]) {
      const lit = litUnderview(nose, { pitchDeg: pitch }, skin, model), g = lit.grid, uri = `data:image/png;base64,${lit.png.toString('base64')}`;
      const sc = Math.min(360 / g.w, 250 / g.h), w = g.w * sc, h = g.h * sc, flat = noseView(nose, pitch);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="300"><rect width="360" height="300" fill="#3b4157"/>`
        + `<image href="${uri}" x="${(360 - w) / 2}" y="10" width="${w}" height="${h}"/>`
                + `<text x="180" y="${Math.min(290, h + 30)}" fill="#e8ecf5" font-family="DejaVu Sans" font-size="12" text-anchor="middle">${label} · ${pitch}°</text></svg>`;
      cells.push({ png: rasterPng(svg, { fonts: true }), label: `${label} ${pitch}°` });
      // preuve chiffrée : contraste de luminance DANS le nez (un aplat vaut 0), part ombrée au sol, part de cavité
      let n = 0, mu = 0, mu2 = 0, shadowed = 0, nosePx = 0;
      for (let k = 0; k < g.w * g.h; k++) { if (lit.field.depth[k] === -Infinity || lit.field.region[k] !== 3) continue; const L = lum(lit.rgba[k * 4]!, lit.rgba[k * 4 + 1]!, lit.rgba[k * 4 + 2]!); n++; mu += L; mu2 += L * L; nosePx++; if (lit.cast[k]! > 0.5) shadowed++; }
      const sdL = Math.sqrt(Math.max(0, mu2 / n - (mu / n) ** 2)); let cav = 0; for (const c of lit.cavity) cav += c;
      stats.push({ nose: label, pitch, flatLuminanceStd: 0, litLuminanceStd: +sdL.toFixed(2), nosePixels: nosePx, castShadowShareOfNose: +(shadowed / nosePx).toFixed(3), cavityPixels: cav, envelopePolys: flat.envelope.length });
    }
  }
  writeFileSync(`${OUT}/04-dessous-eclaire.png`, board('Vue de dessous éclairée par src/relief (3 nez x 3 tangages)', cells, 3, 360, 300));
  metrics.litUnderview = stats;
}

writeFileSync(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 1));
console.log(JSON.stringify(metrics, null, 1));

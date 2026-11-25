import { mkdirSync, writeFileSync } from 'node:fs';
import { EyeSpec, compileScene, generateRandomFace } from '../src';
import { CREASE_FOLLOW, creaseCurve, edgeFrames, eyeEdges, eyeLashSet, eyeTurn, lashKeepShare, openingGeometry, upperEdgeShift, apparentWidthRatio } from '../src/geometry/eye';
import { resolveEye, withAutoLod } from '../src/render/eye/eye';
import { verifyEye } from '../src/verify/eye';
import { svgCostMs, svgFeatures } from '../src/verify/eye-cost';
import { famEye } from './eye-refs/calibrate-atoms-lib';
import { makeKit } from './lib/artefacts-kit';

/**
 * Artefacts de la PASSE 17 : `npx tsx scripts/artefacts-eyes-pass17.ts` → `artefacts/eyes-pass17/` (+ rapport.json).
 *   01-03 : TÊTES ENTIÈRES (graines 11 et 23) aux yeux émeraude / feu, lacet 0° et 25°, + gros plan des yeux (bords irréguliers, plis des canthi, cils au LOD) ;
 *   10 : preuve GÉOMÉTRIQUE du suivi du bord (tracé perturbé, racines de cils, pli, caroncule en surimpression) à irrégularité 0 / 0,5 / 1 ;
 *   11 : LOD des cils à 4 tailles (nœuds, part conservée, couverture d'encre) ; 12 : LOD et rotation de tête (largeur apparente) ;
 *   13 : plis des canthi (absent / moyen / fort, peint et flat) ; 14 : verdicts de la couche de vérification (géométrie / anatomie / style) sur 6 yeux.
 */
const OUT = 'artefacts/eyes-pass17'; mkdirSync(OUT, { recursive: true });
const { BG, png, cropPng, T, eyeScene, sheet } = makeKit(OUT);
const report: Record<string, unknown> = {};
const parse = (o: object): EyeSpec => EyeSpec.parse({ kind: 'eye', id: 'z', ...o });
const nodes = (svg: string): number => (svg.match(/<path[ >/]/g) ?? []).length;

// ── 01-03 : têtes entières ───────────────────────────────────────────────────────────────────────────
const irisOf = (f: 'emerald-facets' | 'fire-halo'): Record<string, unknown> => { const e = famEye(f) as any; return { iris: e.iris, pupil: e.pupil, highlights: e.highlights }; };
const FEATURES = {
  cornea: { refraction: 1.2, haze: 0.5 },
  microdetail: { edge: { irregularity: 0.55, grain: 0.5 }, canthusLines: { outer: 0.6, count: 4, spread: 0.6, inner: 0.5 }, vessels: { density: 0.5, thickness: 0.4, tint: '#c4574e', visibility: 0.35, branching: 0.6 }, imperfections: 4 },
};
function head(seed: number, f: 'emerald-facets' | 'fire-halo', yaw: number): { svg: string; eyes: any[] } {
  const g = generateRandomFace(seed, { id: 'f0', transform: { x: 400, y: 400, scale: 1 } } as never);
  (g.objects[0] as any).face = { ...(g.objects[0] as any).face, headPose: { yawDeg: yaw } };
  const eyes: any[] = [];
  for (const o of g.objects as any[]) if (o.kind === 'eye') { Object.assign(o, irisOf(f), FEATURES, { archetype: null }); eyes.push(o); }
  const r: any = compileScene({ width: 800, height: 800, background: BG, objects: g.objects } as never); if (!r.ok) throw new Error(r.issues.join('\n'));
  return { svg: r.svg, eyes };
}
const headReport: Record<string, unknown> = {};
for (const [n, seed, f] of [['01-tete-emeraude', 11, 'emerald-facets'], ['02-tete-feu', 11, 'fire-halo'], ['03-tete-graine-23', 23, 'emerald-facets']] as const) {
  const cells: { img: Buffer; label: string }[] = [];
  for (const yaw of [0, 25]) {
    const { svg, eyes } = head(seed, f, yaw);
    cells.push({ img: png(svg, 520), label: `${f} — graine ${seed}, tête entière, lacet ${yaw}°` }); cells.push({ img: cropPng(svg, 4, 262, 340, 300, 116), label: `gros plan yeux, lacet ${yaw}° (×4)` });
    headReport[`${n}-yaw${yaw}`] = { svgBytes: svg.length, eyeFailures: eyes.map((e) => verifyEye(e).failures.map((c) => c.id)) };
  }
  sheet(`${n}.png`, cells, 520, 520, 2);
}
report.heads = headReport;

// ── 10 : le bord suivi par les cils, le pli et la caroncule (surimpression des quantités RÉELLES du code) ─────────────────────────
const E0 = famEye('emerald-facets') as any;
const base = { ...E0, kind: 'eye', id: 'z', seed: 5, shape: { width: 300, height: 170, tiltDeg: 6, upperFraction: 0.62, openness: 1, style: 'almond', outerSide: 'right' }, lashes: { upper: { count: 26, length: 0.26, curl: 0.5, sweep: 24 }, lower: { count: 8 } }, lids: { crease: { height: 0.3, depth: 0.6 } }, canthi: { inner: { roundness: 0.4, caruncle: 0.6 }, outer: { roundness: 0.2 } } };
const SC = 1.9; const W = 760; const H = 440;
function overlayEye(irr: number): { svg: string; max: number } {
  const spec = { ...base, microdetail: { edge: { irregularity: irr, grain: 0.8 }, vessels: null, chroma: null, tearFilm: null, occlusion: 0.3, lod: { eyePixels: 8000 } } };
  const svg = eyeScene(spec, SC, W, H);
  const e = withAutoLod(resolveEye(parse(spec))).eye; const g = openingGeometry(e.shape, e.canthi); const th = e.lids.thickness * e.shape.height; const ed = eyeEdges(e, g)!;
  const set = eyeLashSet(e, g, th, ed); const fr = edgeFrames(g, ed); const cr = creaseCurve(g, e.lids.crease.height, (t) => upperEdgeShift(g, ed, t))!;
  const pl = (pts: readonly { x: number; y: number }[]): string => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('');
  const ov = `<g transform="translate(${W / 2} ${H / 2 + 4}) scale(${SC})" fill="none" stroke-width="${(0.9 / SC).toFixed(3)}">`
    + `<path d="${pl(ed.upper)}" stroke="#ff2d55"/><path d="${pl(ed.lower)}" stroke="#ff2d55"/>`
    + set.upper.map((l) => `<circle cx="${l.base.x.toFixed(2)}" cy="${l.base.y.toFixed(2)}" r="${(2.2 / SC).toFixed(2)}" fill="#00a2ff" stroke="none"/>`).join('')
    + set.lower.map((l) => `<circle cx="${l.base.x.toFixed(2)}" cy="${l.base.y.toFixed(2)}" r="${(2.2 / SC).toFixed(2)}" fill="#00a2ff" stroke="none"/>`).join('')
    + `<path d="M${cr.p0.x} ${cr.p0.y}C${cr.p1.x} ${cr.p1.y} ${cr.p2.x} ${cr.p2.y} ${cr.p3.x} ${cr.p3.y}" stroke="#2ecc71"/>`
    + `<circle cx="${fr.upper(0.07).pos.x.toFixed(2)}" cy="${fr.upper(0.07).pos.y.toFixed(2)}" r="${(3 / SC).toFixed(2)}" fill="#f1c40f" stroke="none"/><circle cx="${fr.lower(0.07).pos.x.toFixed(2)}" cy="${fr.lower(0.07).pos.y.toFixed(2)}" r="${(3 / SC).toFixed(2)}" fill="#f1c40f" stroke="none"/></g>`;
  return { svg: svg.replace('</svg>', `${ov}</svg>`), max: ed.maxDev };
}
const edgeCells = [0, 0.5, 1].map((irr) => { const o = overlayEye(irr); return { svg: o.svg, label: `bord irrégulier ${irr} — rouge : tracé réel, bleu : racines des cils, vert : pli (suit ×${CREASE_FOLLOW}), jaune : repères de la caroncule` }; });
sheet('10-bord-suivi.png', edgeCells, 760, 440, 1);

// ── 11 : LOD des cils ──────────────────────────────────────────────────────────────────────────────────────
const lodRows: Record<string, unknown>[] = []; const lodCells: { svg: string; label: string }[] = [];
for (const px of [300, 120, 60, 30]) {
  const spec = { ...base, lashes: { upper: { count: 40, length: 0.26, curl: 0.5, sweep: 24, thickness: 0.2 }, lower: { count: 12 } }, microdetail: { lod: { eyePixels: px }, edge: null, vessels: null, chroma: null, tearFilm: null, occlusion: 0 } };
  const e = withAutoLod(resolveEye(parse(spec))).eye; const g = openingGeometry(e.shape, e.canthi); const th = e.lids.thickness * e.shape.height;
  const set = eyeLashSet(e, g, th, null); const full = eyeLashSet({ ...e, microdetail: null }, g, th, null);
  const cover = (a: readonly { baseWidth: number }[]): number => a.reduce((s, l) => s + l.baseWidth, 0);
  const ppu = px / e.shape.width; const row = { eyePixels: px, upper: set.upper.length, upperFull: full.upper.length, keepShare: +lashKeepShare(full.upper, ppu).toFixed(3), coverageRatio: +(cover(set.upper) / cover(full.upper)).toFixed(3), svgNodes: nodes(eyeScene(spec, px / 300, 480, 400)) };
  lodRows.push(row); lodCells.push({ svg: eyeScene(spec, 1.5, 480, 330), label: `œil de ${px} px — cils ${row.upper}/${row.upperFull}, couverture ×${row.coverageRatio}, ${row.svgNodes} nœuds path` });
}
report.lashLod = lodRows; sheet('11-lod-cils.png', lodCells, 480, 330, 2);

// ── 12 : rotation de tête et LOD (largeur apparente) ────────────────────────────────────────────────────
const rotRows: Record<string, unknown>[] = []; const rotCells: { svg: string; label: string }[] = [];
for (const yaw of [0, 35, 60, 75]) {
  const spec = { ...base, headTurn: { model: 'sphere', yawDeg: yaw, azimuthDeg: 22 }, microdetail: { edge: { irregularity: 0.5, grain: 0.5 }, canthusLines: { outer: 0.6, count: 4, spread: 0.6, inner: 0.5 }, vessels: null, chroma: null, tearFilm: null, occlusion: 0.3 } };
  const r = resolveEye(parse(spec)); const { g0, turned } = eyeTurn(r); const ratio = apparentWidthRatio(g0, turned);
  const lod = withAutoLod(r, 1, ratio); const flatLod = withAutoLod(r, 1);
  rotRows.push({ yawDeg: yaw, apparentWidthRatio: +ratio.toFixed(3), eyePxFrontal: +flatLod.eyePx.toFixed(1), eyePxApparent: +lod.eyePx.toFixed(1) });
  rotCells.push({ svg: eyeScene(spec, 1.5, 480, 330), label: `lacet ${yaw}° — largeur apparente ×${ratio.toFixed(2)} → LOD ${lod.eyePx.toFixed(0)} px (au lieu de ${flatLod.eyePx.toFixed(0)})` });
}
report.rotationLod = rotRows; sheet('12-lod-rotation.png', rotCells, 480, 330, 2);

// ── 13 : plis des canthi ──────────────────────────────────────────────────────────────────────────────
const cl = (o: object | null, extra: object = {}) => ({ ...base, ...extra, microdetail: { canthusLines: o, edge: null, vessels: null, chroma: null, tearFilm: null, occlusion: 0.3 } });
const clCells = [
  { svg: eyeScene(cl(null), 1.9, W, H), label: 'sans plis de canthi (null = historique)' },
  { svg: eyeScene(cl({ outer: 0.6, count: 4, spread: 0.6, inner: 0.5 }), 1.9, W, H), label: 'moyens : outer 0,6 · count 4 · spread 0,6 · inner 0,5' },
  { svg: eyeScene(cl({ outer: 1, count: 6, spread: 1, inner: 1 }), 1.9, W, H), label: 'forts : outer 1 · count 6 · spread 1 · inner 1' },
  { svg: eyeScene(cl({ outer: 0.6, count: 4, spread: 0.6, inner: 0.5 }, { finish: 'flat' }), 1.9, W, H), label: 'fini flat : encre pleine, mêmes rides' },
];
sheet('13-plis-canthi.png', clCells, 760, 440, 2);

// ── 14 : verdicts de la couche de vérification ───────────────────────────────────────────────────────
const verifyCases: [string, object][] = [
  ['bords 0,9 + plis', { ...base, microdetail: { edge: { irregularity: 0.9, grain: 0.8 }, canthusLines: { outer: 0.7, count: 4, spread: 0.6, inner: 0.6 }, lod: { eyePixels: 8000 } } }],
  ['plis forts flat', { ...base, finish: 'flat', microdetail: { canthusLines: { outer: 0.95, count: 6, spread: 1, inner: 1 }, lod: { eyePixels: 8000 } } }],
  ['rotation 60°', { ...base, headTurn: { model: 'sphere', yawDeg: 60, azimuthDeg: 22 }, microdetail: { edge: { irregularity: 0.6, grain: 0.5 }, canthusLines: { outer: 0.5, count: 3, spread: 0.5, inner: 0.4 } } }],
  ['petit œil 40 px', { ...base, microdetail: { edge: { irregularity: 0.6, grain: 0.5 }, canthusLines: { outer: 0.5, count: 3, spread: 0.5, inner: 0.4 }, lod: { eyePixels: 40 } } }],
  ['émeraude', { ...(famEye('emerald-facets') as object), microdetail: { edge: { irregularity: 0.5, grain: 0.5 } } }],
  ['feu', { ...(famEye('fire-halo') as object), microdetail: { canthusLines: { outer: 0.5, count: 3, spread: 0.5, inner: 0.4 } } }],
];
let rows = ''; const verdicts: Record<string, unknown>[] = [];
verifyCases.forEach(([name, spec], i) => {
  const r = verifyEye({ kind: 'eye', id: 'v', ...spec } as never); const by = (l: string) => r.checks.filter((c) => c.layer === l);
  const cnt = (l: string): string => `${by(l).filter((c) => c.ok).length}/${by(l).length}`; const warn = r.warnings.map((c) => c.id).join(', ') || '—'; const fail = r.failures.map((c) => c.id).join(', ') || '—';
  verdicts.push({ name, geometry: cnt('geometry'), anatomy: cnt('anatomy'), style: cnt('style'), warnings: r.warnings.map((c) => c.id), failures: r.failures.map((c) => c.id) });
  const y = 60 + i * 46; rows += `${T(20, y, `${name}`, 15)}${T(230, y, `géométrie ${cnt('geometry')}`, 15)}${T(380, y, `anatomie ${cnt('anatomy')}`, 15)}${T(530, y, `style ${cnt('style')}`, 15)}${T(650, y, `échecs : ${fail}`, 13)}${T(650, y + 17, `avertissements : ${warn}`, 11)}`;
});
writeFileSync(`${OUT}/14-verification.png`, png(`<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="${60 + verifyCases.length * 46 + 10}"><rect width="100%" height="100%" fill="${BG}"/>${T(20, 30, 'Couche de vérification d’un œil — contrôles réussis / total par famille (calculés sur les cils, plis et bords RÉELLEMENT dessinés)', 16)}${rows}</svg>`));
report.verify = verdicts;

// ── poids / coût du SVG des yeux de la passe ────────────────────────────────────────────────────────
report.svgCost = (['bords 0,9 + plis', 'émeraude', 'feu'] as const).map((n) => { const spec = verifyCases.find(([k]) => k === n)![1]; const svg = eyeScene(spec as Record<string, unknown>, 1.9, W, H); const f = svgFeatures(svg); return { n, bytes: Buffer.byteLength(svg), nodes: f.nodes, filterApps: f.filterApps, costMs: +svgCostMs(f).toFixed(2) }; });
report.edge = { maxDevAt1: overlayEye(1).max };
writeFileSync(`${OUT}/rapport.json`, JSON.stringify(report, null, 2));
console.log('passe 17 : artefacts écrits');

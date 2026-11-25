import { mkdirSync, writeFileSync } from 'node:fs';
import { compileScene, generateRandomFace } from '../src';
import { corneaWarp } from '../src/geometry/eye';
import { verifyEye } from '../src/verify/eye';
import { atomMetrics } from './lib/eye-iris-atoms';
import { irisTone } from './lib/eye-iris-tone';
import { measurePupilRadiusPx } from './lib/verify-eye-cornea-render';
import { BASE } from './lib/eye-param-sweeps';
import { famEye } from './eye-refs/calibrate-atoms-lib';
import { makeKit } from './lib/artefacts-kit';

/**
 * Artefacts de la PASSE 16 : `npx tsx scripts/artefacts-eyes-pass16.ts` → `artefacts/eyes-pass16/` (+ rapport.json).
 *   01-02 : TÊTES ENTIÈRES (graine 11) aux yeux émeraude / feu de la passe, lacet 0° et 25°, + gros plan des yeux ; 10 : réfraction 0 / 1 / 3 (mesure de pupille en pixels) ;
 *   11 : bords palpébraux 0 / 0,4 / 0,9 ; 12 : LOD automatique à 4 tailles ; 13 : atomes de 07 et 10a avant / après (mêmes yeux, paramètres de la passe remis à leur défaut).
 */
const OUT = 'artefacts/eyes-pass16'; mkdirSync(OUT, { recursive: true });
const { BG, png, cropPng, eyeScene, sheet } = makeKit(OUT);
const report: Record<string, unknown> = {};


// ── 01-02 : têtes entières ────────────────────────────────────────────────────────────────────────────────────────
const irisOf = (f: 'emerald-facets' | 'fire-halo'): Record<string, unknown> => { const e = famEye(f) as any; return { iris: e.iris, pupil: e.pupil, highlights: e.highlights }; };
const FEATURES = { cornea: { refraction: 1.2, haze: 0.5 }, microdetail: { edge: { irregularity: 0.45, grain: 0.5 }, vessels: { density: 0.5, thickness: 0.4, tint: '#c4574e', visibility: 0.35, branching: 0.6 }, imperfections: 4 } };
function head(f: 'emerald-facets' | 'fire-halo', yaw: number): string {
  const g = generateRandomFace(11, { id: 'f0', transform: { x: 400, y: 400, scale: 1 } } as never);
  (g.objects[0] as any).face = { ...(g.objects[0] as any).face, headPose: { yawDeg: yaw } };
  for (const o of g.objects as any[]) if (o.kind === 'eye') Object.assign(o, irisOf(f), FEATURES, { archetype: null });   // le visage tiré a l'archétype `feline`, qui impose une pupille en fente par-dessus l'iris de la famille
  const r: any = compileScene({ width: 800, height: 800, background: BG, objects: g.objects } as never); if (!r.ok) throw new Error(r.issues.join('\n')); return r.svg;
}
for (const [n, f] of [['01-tete-emeraude', 'emerald-facets'], ['02-tete-feu', 'fire-halo']] as const) {
  const cells: { img: Buffer; label: string }[] = [];
  for (const yaw of [0, 25]) { const svg = head(f, yaw); cells.push({ img: png(svg, 520), label: `${f} — tête entière, lacet ${yaw}°` }); cells.push({ img: cropPng(svg, 4, 290, 372, 250, 100), label: `gros plan yeux, lacet ${yaw}° (×4)` }); }
  sheet(`${n}.png`, cells, 520, 520, 2);
}

// ── 10 : réfraction ───────────────────────────────────────────────────────────────────────────────────────────────
// Ligne 1 : œil émeraude de la famille, rayon de pupille PRÉDIT par la loi (la mesure en pixels exige une pupille nettement plus sombre que l'iris voisin : vrai pour l'œil de test BASE,
// faux pour le feu, où elle donne 0 px) ; ligne 2 : œil de test BASE, rayon MESURÉ sur l'image.
{
  const shape = { ...(BASE.shape as object), width: 420, height: 240 }; const cells: { svg: string; label: string }[] = []; const rows: unknown[] = []; const fam = famEye('emerald-facets') as any;
  const w = (k: number): ((r: number) => number) => corneaWarp({ curvature: 0.76, depth: 0.61, index: 1.376, strength: k });
  const size = fam.pupil.size as number;
  for (const k of [0, 1, 3]) cells.push({ svg: eyeScene({ ...fam, cornea: k === 0 ? null : { refraction: k, haze: 0.6 } }, 2.0), label: `émeraude, réfraction ${k} — pupille ×${(w(k)(size) / size).toFixed(2)} (loi)` });
  for (const k of [0, 1, 3]) {
    const co = k === 0 ? null : { refraction: k, haze: 0.6 }; const m = measurePupilRadiusPx({ ...BASE, shape, cornea: co });
    rows.push({ refraction: k, pupilRadiusMeasuredPx: m.measured, pupilRadiusPredictedPx: +m.predicted.toFixed(2), trueRadiusPx: +m.trueRadius.toFixed(2) });
    cells.push({ svg: eyeScene({ ...BASE, shape, cornea: co }, 1.0), label: `œil de test, réfraction ${k} — pupille MESURÉE ${m.measured.toFixed(1)} px (loi ${m.predicted.toFixed(1)})` });
  }
  const wh = w(1); report.refraction = { rows, warpHumain: [0.1, 0.25, 0.5, 0.75, 1].map((r) => [r, +wh(r).toFixed(4)]) };
  sheet('10-cornee-refraction.png', cells, 480, 400, 3);
}

// ── 11 : bords palpébraux ─────────────────────────────────────────────────────────────────────────────────────────
{
  const cells = [0, 0.4, 0.9].map((k) => ({ svg: eyeScene({ ...(famEye('emerald-facets') as object), microdetail: { edge: k === 0 ? null : { irregularity: k, grain: 0.6 }, vessels: null, chroma: null, tearFilm: null, occlusion: 0 } }, 2.0), label: k === 0 ? 'bord parfait (null)' : `irregularity ${k}, grain 0,6` }));
  report.bords = [0.4, 0.9].map((k) => ({ irregularity: k, verify: verifyEye({ kind: 'eye', id: 'e', ...(famEye('emerald-facets') as object), microdetail: { edge: { irregularity: k, grain: 0.6 } } } as never).failures.length }));
  sheet('11-bords-palpebraux.png', cells, 480, 400, 3);
}

// ── 12 : LOD automatique ──────────────────────────────────────────────────────────────────────────────────────────
{
  const e = { ...(famEye('fire-halo') as object), shape: { width: 300, height: 170 }, microdetail: { vessels: { density: 0.9, thickness: 0.5, tint: '#c4574e', visibility: 0.6, branching: 0.8 }, imperfections: 6 } }; const cells: { img: Buffer; label: string }[] = []; const rows: unknown[] = [];
  for (const px of [300, 150, 70, 34]) {
    const scale = px / 300; const svg = eyeScene(e, scale, 420, 280); const nodes = (svg.match(/<(path|circle|ellipse|rect|line|polygon)[ >/]/g) ?? []).length; rows.push({ eyePixels: px, svgNodes: nodes, bytes: svg.length });
    cells.push({ img: cropPng(svg, 2.4, 0, 0, 420, 280), label: `œil de ${px} px — ${nodes} nœuds SVG (×2,4)` });
  }
  report.lod = rows; sheet('12-lod-automatique.png', cells, 504, 336, 2);
}

// ── 13 : atomes 07 / 10a avant / après ────────────────────────────────────────────────────────────────────────────
{
  const strip = (e: any): void => { const d = e.iris.detail; if (d.facets) { delete d.facets.shard; delete d.facets.dust; } if (d.bubbles) { delete d.bubbles.sizeSpread; delete d.bubbles.rim; } if (d.embers) { delete d.embers.shape; delete d.embers.scatter; } };
  const cells: { svg: string; label: string }[] = []; const rows: Record<string, unknown> = {};
  for (const f of ['emerald-facets', 'fire-halo'] as const) {
    const after = famEye(f) as any; const before = structuredClone(after); strip(before);
    if (f === 'emerald-facets') { Object.assign(before.iris.detail.bubbles, { count: 18, size: 0.105 }); before.iris.lift = 0.93; before.iris.vibrance = 0.137; }
    if (f === 'fire-halo') { before.iris.detail.voids = before.iris.detail.voids.slice(0, 1); Object.assign(before.iris.detail.embers, { count: 18, size: 0.012, streak: 0.8 }); }
    for (const [n, e] of [['avant', before], ['après', after]] as const) { cells.push({ svg: eyeScene(e, 2.0), label: `${f} — ${n}` }); const t = irisTone({ kind: 'eye', id: 'e', ...e } as never); const s = atomMetrics({ kind: 'eye', id: 'e', ...e } as never).stars; rows[`${f}:${n}`] = { darkShare: +t.darkShare.toFixed(3), lumMean: +t.lumMean.toFixed(1), satPeaks: +t.satPeaks.toFixed(3), feretTop6Mean: +(s.feretTop6Mean as number).toFixed(3) }; }
  }
  report.atomes = rows; sheet('13-atomes-07-10a-avant-apres.png', cells, 480, 400, 2);
}
writeFileSync(`${OUT}/rapport.json`, JSON.stringify(report, null, 2)); console.log('passe 16 : artefacts écrits');

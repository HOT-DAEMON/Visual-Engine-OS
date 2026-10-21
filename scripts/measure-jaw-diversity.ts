/**
 * Banc reproductible de diversité du menton et de la mâchoire.
 *
 * Usage:
 *   npx tsx scripts/measure-jaw-diversity.ts
 *   npx tsx scripts/measure-jaw-diversity.ts 1000 0.004 artefacts/jaw-diversity
 *
 * Génère les géométries sans compiler/rendre 1000 visages complets : chaque cellule rend
 * uniquement le contour de tête, ce qui isole la morphologie et évite le coût des yeux/cheveux.
 * Les résultats sont des mesures d'échantillonnage, pas une preuve du nombre total de formes possibles.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { generateRandomFace } from '../src/generation/random-face';
import { headOutline, outlinePath, rightSamples } from '../src/face';
import { effectiveAngle } from '../src/face/jaw/structure';

const count = Math.max(1, Math.min(5000, Number(process.argv[2] ?? 1000)));
const tolerance = Math.max(0.0001, Math.min(0.05, Number(process.argv[3] ?? 0.004)));
const outputBase = resolve(process.argv[4] ?? 'artefacts/jaw-diversity');
const SEED_BASE = 0x4a415700;
const SAMPLES_PER_SEGMENT = 12;
const COLS = 10;
const CELL_W = 160;
const CELL_H = 172;

type Point = { x: number; y: number };
type Row = {
  seed: number;
  width: number;
  height: number;
  cluster: number;
  isRepresentative: boolean;
  valid: boolean;
  issues: string[];
  metrics: {
    jawWidthRatio: number;
    chinWidthRatio: number;
    chinToJawConvergence: number;
    chinHeightRatio: number;
    effectiveGonialAngle: number;
    meanCurvature: number;
    symmetryError: number;
  };
  params: unknown;
  contour: Point[];
  path: string;
};

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function esc(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
}
function num(n: number): string {
  return Number.isFinite(n) ? n.toFixed(4) : 'null';
}
function curvature(points: Point[]): number {
  let sum = 0;
  let count = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1]!, b = points[i]!, c = points[i + 1]!;
    const u = { x: b.x - a.x, y: b.y - a.y };
    const v = { x: c.x - b.x, y: c.y - b.y };
    const lu = Math.hypot(u.x, u.y), lv = Math.hypot(v.x, v.y);
    if (lu < 1e-9 || lv < 1e-9) continue;
    const cosine = Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / (lu * lv)));
    sum += Math.acos(cosine);
    count++;
  }
  return count ? sum / count : 0;
}
function contourDistance(a: Point[], b: Point[]): { rms: number; max: number } {
  let squares = 0, max = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d = distance(a[i]!, b[i]!);
    squares += d * d;
    max = Math.max(max, d);
  }
  return { rms: Math.sqrt(squares / Math.max(1, Math.min(a.length, b.length))), max };
}

const rows: Row[] = [];
for (let i = 0; i < count; i++) {
  const seed = (SEED_BASE + i) >>> 0;
  const face = generateRandomFace(seed, {
    structure: true,
    expression: { kind: 'neutral', intensity: 0 },
    hairEngine: 'classic',
    occlusions: false,
  });
  const outline = headOutline(face.params, face.width, face.height);
  const sampled = rightSamples(outline, SAMPLES_PER_SEGMENT);
  // Repère sans dimension : les différences de taille de tête ne comptent pas comme différence de forme.
  // Exclut le segment supérieur crâne→tempe : le clustering doit mesurer la mâchoire/menton,
  // pas fusionner/séparer des visages sur la seule forme du front.
  const jawSamples = sampled.slice(SAMPLES_PER_SEGMENT);
  const contour = jawSamples.map(p => ({ x: (2 * p.x) / face.width, y: (p.y + face.height / 2) / face.height }));
  const issues: string[] = [];
  if (contour.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) issues.push('coordonnée_non_finie');
  if (outline.bottomY <= outline.keys.chinCorner.y) issues.push('menton_dégénéré');
  if (outline.keys.gonion.x <= 0 || outline.keys.gonion.x >= face.width / 2) issues.push('gonion_hors_limites');
  for (let j = 1; j < sampled.length; j++) {
    if (sampled[j]!.y + 1e-6 < sampled[j - 1]!.y) { issues.push('contour_non_monotone'); break; }
  }
  const gonionHalf = Math.max(1e-9, Math.abs(outline.keys.gonion.x));
  const metrics = {
    jawWidthRatio: (2 * gonionHalf) / face.width,
    chinWidthRatio: (2 * outline.chinHalf) / face.width,
    chinToJawConvergence: outline.chinHalf / gonionHalf,
    chinHeightRatio: (outline.bottomY - outline.keys.chinCorner.y) / face.height,
    effectiveGonialAngle: effectiveAngle(face.params),
    meanCurvature: curvature(contour),
    // Le contour canonique actuel est construit par miroir : cette valeur doit être nulle par construction.
    symmetryError: 0,
  };
  rows.push({
    seed, width: face.width, height: face.height, cluster: -1, isRepresentative: false, valid: issues.length === 0, issues, metrics,
    params: face.params, contour, path: outlinePath(outline),
  });
}

// Clustering glouton déterministe : une forme rejoint le premier représentant dont le RMS ET le
// déplacement maximal sont sous les seuils. On ne compare que des contours échantillonnés de façon identique.
const representatives: number[] = [];
for (let i = 0; i < rows.length; i++) {
  const row = rows[i]!;
  if (!row.valid) continue;
  let match = -1;
  for (let c = 0; c < representatives.length; c++) {
    const rep = rows[representatives[c]]!
    const d = contourDistance(row.contour, rep.contour);
    if (d.rms <= tolerance && d.max <= tolerance * 2.5) { match = c; break; }
  }
  if (match < 0) {
    row.cluster = representatives.length;
    row.isRepresentative = true;
    representatives.push(i);
  } else {
    row.cluster = match;
  }
}

const validCount = rows.filter(r => r.valid).length;
const clustered = rows.filter(r => r.valid && r.cluster >= 0);
const clusterSizes = new Map<number, number>();
for (const r of clustered) clusterSizes.set(r.cluster, (clusterSizes.get(r.cluster) ?? 0) + 1);
const summary = {
  protocolVersion: 1,
  seedBase: SEED_BASE,
  requestedCount: count,
  validCount,
  invalidCount: count - validCount,
  uniqueClustersAtTolerance: representatives.length,
  toleranceNormalizedRms: tolerance,
  toleranceNormalizedMax: tolerance * 2.5,
  samplesPerSegment: SAMPLES_PER_SEGMENT,
  clusterSizes: Object.fromEntries([...clusterSizes.entries()].sort((a, b) => a[0] - b[0])),
  caveats: [
    'Le clustering est glouton et dépend de l’ordre déterministe des graines.',
    'La similarité est mesurée sur des échantillons homologues normalisés, pas par distance de Hausdorff exacte.',
    'La symétrie est garantie par le contour canonique en miroir ; ce test ne mesure pas l’asymétrie des tissus rendus.',
    'Les artefacts de rendu des yeux, cheveux, ombres et matériaux ne sont pas testés : cette planche isole la silhouette.',
    'Le nombre de clusters dépend du nombre de graines, de la tolérance et du profil de génération.',
  ],
  rows: rows.map(({ contour: _contour, path: _path, ...r }) => r),
};

const tile = (row: Row, idx: number): string => {
  const x = (idx % COLS) * CELL_W;
  const y = Math.floor(idx / COLS) * CELL_H;
  const scale = 112 / Math.max(row.width, row.height);
  const transform = `translate(${x + CELL_W / 2} ${y + 98}) scale(${scale})`;
  const label = `#${row.seed.toString(16)} C${row.cluster < 0 ? 'X' : row.cluster}`;
  const status = row.valid ? '#dce9df' : '#f4cccc';
  return `<g><rect x="${x + 2}" y="${y + 2}" width="${CELL_W - 4}" height="${CELL_H - 4}" rx="5" fill="${status}" stroke="#999" stroke-width=".7"/><path d="${row.path}" transform="${transform}" fill="#e7bfa7" stroke="#352d2a" stroke-width="2" stroke-linejoin="round"/><text x="${x + 7}" y="${y + 124}" font-size="10" font-family="monospace">${esc(label)}</text><text x="${x + 7}" y="${y + 139}" font-size="9" font-family="monospace">jaw ${num(row.metrics.jawWidthRatio)} · chin ${num(row.metrics.chinWidthRatio)}</text><text x="${x + 7}" y="${y + 153}" font-size="9" font-family="monospace">${row.valid ? 'OK' : esc(row.issues.join(','))}</text></g>`;
};
const sheetHeight = 22 + Math.ceil(rows.length / COLS) * CELL_H;
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * CELL_W}" height="${sheetHeight}" viewBox="0 0 ${COLS * CELL_W} ${sheetHeight}"><rect width="100%" height="100%" fill="#f7f7f7"/><text x="12" y="18" font-size="12" font-family="sans-serif">Jaw diversity benchmark · n=${count} · tolerance=${tolerance} · clusters=${representatives.length}</text><g transform="translate(0 22)">${rows.map((r, i) => tile(r, i)).join('')}</g></svg>`;
mkdirSync(dirname(outputBase), { recursive: true });
writeFileSync(`${outputBase}.json`, JSON.stringify(summary, null, 2));
writeFileSync(`${outputBase}.svg`, sheet);
const png = new Resvg(sheet).render().asPng();
writeFileSync(`${outputBase}.png`, png);
const csvHeader = ['seed','cluster','representative','valid','jawWidthRatio','chinWidthRatio','chinToJawConvergence','chinHeightRatio','effectiveGonialAngle','meanCurvature','symmetryError','issues'];
const csvRows = rows.map(r => [
  r.seed, r.cluster, r.isRepresentative, r.valid,
  r.metrics.jawWidthRatio, r.metrics.chinWidthRatio, r.metrics.chinToJawConvergence,
  r.metrics.chinHeightRatio, r.metrics.effectiveGonialAngle, r.metrics.meanCurvature,
  r.metrics.symmetryError, r.issues.join(';'),
].join(','));
writeFileSync(`${outputBase}.csv`, [csvHeader.join(','), ...csvRows].join('\n'));
console.log(JSON.stringify({
  requested: count, valid: validCount, invalid: count - validCount,
  clusters: representatives.length, tolerance,
  outputs: [`${outputBase}.json`, `${outputBase}.csv`, `${outputBase}.svg`, `${outputBase}.png`],
}, null, 2));

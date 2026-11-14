import { cross, norm, toCam, v3 } from './math';
import { CELLS } from './hair-hash';
import { FRINGE_BROW_GAP } from './hair-features';
import { fringeY, shellPoint } from './hair-shell';
import { strandSample } from './hair-strands';
import { check, type Check } from './verify-types';
import { defaultFrame, refView, renderHead } from './render';
import { REGION, type HeadTurnSpec, type TurnRender } from './types';

/**
 * VÉRIFICATIONS DES TRAITS DE LA COIFFURE 3D (frange, épis, mèches ; `docs/HAIR-VERIFY-FEATURES.md`). Mêmes trois couches que `verify-hair-volume.ts`, mêmes contrats. Les bornes sont des
 * CONVENTIONS d'anatomie et de style écrites avant la mesure ; aucune n'a été ajustée pour faire passer un rendu.
 */
const G = 'geometry' as const, A = 'anatomy' as const, S = 'style' as const, DEG = Math.PI / 180, P = 'head.hair3d.';

const median = (a: readonly number[]): number => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };

/** Normale sortante de la coque en (y, θ) par différences finies. */
function shellNormal(s: HeadTurnSpec, y: number, th: number): { x: number; y: number; z: number } {
  const v = s.hairVolume!, e = 0.01, a = shellPoint(s, v, y, th + e), b = shellPoint(s, v, y, th - e), c = shellPoint(s, v, y + e, th), d = shellPoint(s, v, y - e, th);
  const n = norm(cross(v3(a.x - b.x, a.y - b.y, a.z - b.z), v3(c.x - d.x, c.y - d.y, c.z - d.z)));
  // Orientation : vers l'extérieur, c'est-à-dire du côté de la direction horizontale (sin θ, cos θ).
  return n.x * Math.sin(th) + n.z * Math.cos(th) >= 0 ? n : v3(-n.x, -n.y, -n.z);
}

export function hairFeatureGeometryChecks(s: HeadTurnSpec, R?: { at: (yaw: number, pitch0?: boolean) => TurnRender }): Check[] {
  const v = s.hairVolume;
  if (!v) return [];
  const c: Check[] = [];
  const spikes = v.parts.filter((p) => p.kind === 'spike');
  if (spikes.length) {
    // Un épi ne rentre jamais dans le crâne : sa direction a une composante SORTANTE sur la normale de la coque (cos ≥ 0,15, soit ≤ 81° de la normale).
    let worst = 1;
    for (const p of spikes) {
      if (p.kind !== 'spike') continue;
      const th = p.az * DEG, sn = Math.sin(th), cs = Math.cos(th), d = norm(v3(sn * p.out + cs * p.sx, -p.up, cs * p.out - sn * p.sx)), n = shellNormal(s, p.y, th);
      worst = Math.min(worst, d.x * n.x + d.y * n.y + d.z * n.z);
    }
    c.push(check(G, P + 'geo.spike.outward', 'Épis : cosinus minimal entre la direction d\'un épi et la normale sortante de la coque (≥ 0,15 : aucun épi ne rentre dans le crâne)', worst, 0.15, 1));
  }
  if (v.fringe) {
    const yMax = Math.max(...v.fringe.y), yMin = Math.min(...v.fringe.y);
    c.push(check(G, P + 'geo.fringe.range', 'Frange : table de hauteurs finie et au-dessous du sommet (U)', Number.isFinite(yMax) && Number.isFinite(yMin) ? yMin : -1, s.rows[0]!.y, 1.1));
  }
  if (v.fringe && R) {
    // La frange est portée par la rotation de la tête : son bord inférieur, projeté par la rotation, est un bord cheveux / peau dans le rendu (points de face, 4 angles).
    let ok = 0, tot = 0;
    for (const yaw of [0, 25, -25, 50]) {
      const r = R.at(yaw, false), view = refView(yaw);
      for (let az = -75; az <= 75; az += 15) {
        const y = fringeY(v, az), th = az * DEG;
        if (!Number.isFinite(y)) continue;
        const nrm = toCam({ x: Math.sin(th), y: 0, z: Math.cos(th) }, { yaw: view.yaw, pitch: 0 });
        if (nrm.z < 0.5) continue;
        const q = toCam(shellPoint(s, v, y, th), view), px = Math.round(r.originX + q.x * r.ppu), py = Math.round(r.originY + q.y * r.ppu);
        let hair = false, skin = false;
        for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const x = px + dx, yy = py + dy; if (x < 0 || yy < 0 || x >= r.w || yy >= r.h) continue; const g = r.regions[yy * r.w + x]; if (g === REGION.hair) hair = true; else if (g === REGION.skin) skin = true; }
        tot++; if (hair && skin) ok++;
      }
    }
    c.push(check(G, P + 'geo.fringe.track', 'Frange portée par la rotation : part des points du bord de la frange (4 angles, faces visibles) où le rendu montre un bord cheveux / peau à ≤ 6 px', tot ? ok / tot : 1, 0.7, 1));
  }
  return c;
}

export function hairFeatureAnatomyChecks(s: HeadTurnSpec): Check[] {
  const v = s.hairVolume;
  if (!v) return [];
  const c: Check[] = [], spikes = v.parts.filter((p) => p.kind === 'spike');
  if (v.fringe) {
    // Le bord de la frange reste au-dessus du sourcil : écart entre le point le plus bas de la frange et le haut du sourcil le plus haut (U ; ≥ FRINGE_BROW_GAP / 2 ; le plafond est FRINGE_BROW_GAP).
    const brow = Math.min(s.brow.yIn, s.brow.yMid, s.brow.yOut) - s.brow.thick, low = Math.max(...v.fringe.y);
    c.push(check(A, P + 'anat.fringe.brow', `Frange : écart entre son bord le plus bas et le haut du sourcil (U ; ≥ ${FRINGE_BROW_GAP / 2} : la frange ne descend jamais sur l'œil)`, brow - low, FRINGE_BROW_GAP / 2, 1));
    c.push(check(A, P + 'anat.fringe.eye', 'Frange : écart entre son bord le plus bas et le haut de l\'œil (U ; ≥ 0,05)', s.eye.y - s.eye.hUp - low, 0.05, 1));
  }
  if (v.style === 'spiky') {
    c.push(check(A, P + 'anat.spike.count', 'Coiffure en épis : nombre d\'épis [convention : ≥ 12 pointes lisibles tout autour]', spikes.length, 12, 80));
    c.push(check(A, P + 'anat.spike.len', 'Épis : longueur médiane (U ; un épi de gel mesure 2 – 7 cm, la tête 23 cm = 1,05 U)', median(spikes.map((p) => (p.kind === 'spike' ? p.len : 0))), 0.04, 0.3));
  }
  return c;
}

/** Part des pas de `u` où l'arête de mèche franchit 0,5 (une côte) : retourne les positions des arêtes sur [0, N) à `v` donné. */
function strandEdges(s: HeadTurnSpec, v: number): number[] {
  const vol = s.hairVolume!, N = CELLS[vol.texture] ?? 72, out: number[] = [];
  let prev = 0;
  for (let i = 0; i <= N * 20; i++) { const e = strandSample(vol, i / 20, v, N).edge; if (e >= 0.5 && prev < 0.5) out.push(i / 20); prev = e; }
  return out;
}

export function hairFeatureStyleChecks(s: HeadTurnSpec): Check[] {
  const v = s.hairVolume;
  if (!v || v.style === 'buzz' || v.texture === 'curly' || v.texture === 'coily' || v.texture === 'braided') return [];
  // Anti-mécanique : les colonnes de mèches ne sont pas toutes de la même largeur (coefficient de variation de l'écart entre deux arêtes consécutives, à trois hauteurs).
  const cv: number[] = [];
  for (const y of [0.15, 0.3, 0.5]) {
    const e = strandEdges(s, y), gaps = e.slice(1).map((x, i) => x - e[i]!);
    if (gaps.length > 5) { const m = gaps.reduce((a, b) => a + b, 0) / gaps.length; cv.push(Math.sqrt(gaps.reduce((a, b) => a + (b - m) ** 2, 0) / gaps.length) / m); }
  }
  return [check(S, P + 'style.strand.irregular', 'Mèches : irrégularité de la largeur des colonnes (écart-type / moyenne ; ≥ 0,1 : des colonnes toutes égales = rendu mécanique)', cv.length ? Math.min(...cv) : 0, 0.1, 2)];
}

/**
 * Distinction de deux coiffures sur la MÊME tête, vue de face (0°) : part des pixels (de l'union des zones de cheveux des deux rendus) où les deux rendus n'ont pas la même région
 * (cheveux d'un côté, peau ou fond de l'autre). Deux coiffures « qui se ressemblent » en ont presque 0.
 */
export function styleDistinctness(a: HeadTurnSpec, b: HeadTurnSpec, size = 360): number {
  const ra = renderHead({ yaw: 0, pitch: 0 }, a, { frame: defaultFrame(size), ss: 1 }), rb = renderHead({ yaw: 0, pitch: 0 }, b, { frame: defaultFrame(size), ss: 1 });
  let diff = 0, uni = 0;
  for (let k = 0; k < ra.w * ra.h; k++) {
    const ha = ra.regions[k] === REGION.hair, hb = rb.regions[k] === REGION.hair;
    if (ha || hb) { uni++; if (ha !== hb) diff++; }
  }
  return uni ? diff / uni : 0;
}

import { mulberry32 } from '../../core/prng';
import type { EyeSpec } from '../../schema';
import type { Frame, OpeningGeometry } from './opening';
import { microLod } from './micro-detail';
import { cubicAt, cubicDeriv, norm, type Vec } from './primitives';

/**
 * EYE-07E — Irrégularité des bords palpébraux (pure, déterministe). Le bord libre d'une paupière n'est jamais une courbe de Bézier parfaite : il ondule lentement
 * (relief du tarse), se festonne finement (glandes de Meibomius, côté cils) et reste régulier près des canthi. Le bord est ÉCHANTILLONNÉ sur la courbe de l'enveloppe,
 * chaque point est déplacé le long de la normale par une somme de trois ondes (lente / moyenne / fine, phases tirées par la graine de l'œil, dans un ordre FIXE),
 * amortie par une enveloppe nulle aux canthi. Le déplacement est borné à `MAX_DEV` × hauteur effective : l'ouverture ne peut ni se refermer ni changer de forme.
 *  - `irregularity` : amplitude (0 = bord parfait, 1 = `MAX_DEV` × hEff) ;
 *  - `grain` : part des ondes moyennes et fines (0 = ondulation lente seule, 1 = festonnage net) ; les ondes dont la période descend sous ~2 px sont retirées par le LOD (`fine`).
 * Le bord supérieur (porteur des cils, plus lisse) vaut `UPPER_WEIGHT` du bord inférieur.
 */
export const EDGE_MAX_DEV = 0.03;
export const EDGE_UPPER_WEIGHT = 0.7;
const SAMPLES = 48;

export interface EdgeIrregularity {
  /** Bord supérieur, canthus interne → externe, et bord inférieur, externe → interne (même sens que les traits de paupière). */
  readonly upper: readonly Vec[];
  readonly lower: readonly Vec[];
  /** Plus grand déplacement mesuré (unités locales). */
  readonly maxDev: number;
}

type Cubic4 = readonly [Vec, Vec, Vec, Vec];
function edge(c: Cubic4, amp: number, grain: number, fine: number, rnd: () => number): { pts: Vec[]; dev: number } {
  // tirages FIXES (3 ondes × [fréquence, phase]) même si l'onde est ensuite retirée : l'identité ne dépend ni du LOD ni de `grain`
  const waves = [[1.5 + 1.5 * rnd(), rnd() * 6.2832, 1], [5 + 3 * rnd(), rnd() * 6.2832, grain], [12 + 8 * rnd(), rnd() * 6.2832, grain * fine]] as const;
  const norm2 = waves.reduce((s, w) => s + w[2], 0) || 1;   // norme L1 : |déplacement| <= amp EXACTEMENT (la norme L2 laissait monter à ×√3)
  const pts: Vec[] = []; let dev = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES; const p = cubicAt(c[0], c[1], c[2], c[3], t); const d = norm(cubicDeriv(c[0], c[1], c[2], c[3], t));
    const env = Math.sin(Math.PI * t) ** 0.7;
    const off = amp * env * (waves.reduce((s, w) => s + w[2] * Math.sin(2 * Math.PI * w[0] * t + w[1]), 0) / norm2);
    dev = Math.max(dev, Math.abs(off));
    pts.push({ x: p.x - d.y * off, y: p.y + d.x * off });
  }
  return { pts, dev };
}

export function irregularEdges(g: OpeningGeometry, o: { readonly irregularity: number; readonly grain: number }, seed: number, fine = 1): EdgeIrregularity {
  const rnd = mulberry32((seed ^ 0x5be0cd19) >>> 0); const amp = o.irregularity * EDGE_MAX_DEV * g.hEff;
  const up = edge([g.pi, g.u1, g.u2, g.po], amp * EDGE_UPPER_WEIGHT, o.grain, fine, rnd);
  const lo = edge([g.po, g.l1, g.l2, g.pi], amp, o.grain, fine, rnd);
  return { upper: up.pts, lower: lo.pts, maxDev: Math.max(up.dev, lo.dev) };
}

/**
 * Bords de l'œil EFFECTIF (LOD déjà résolu dans `microdetail.lod`) : source unique du rendu (`render/eye/eye.ts`), des cils (`eyeLashSet`) et de la vérification (`verify/eye.ts`).
 * `null` = bord parfait (courbes de l'enveloppe), comportement historique.
 */
export function eyeEdges(eye: EyeSpec, g: OpeningGeometry): EdgeIrregularity | null {
  const md = eye.microdetail;
  return md?.edge ? irregularEdges(g, md.edge, eye.seed, microLod(md.lod.eyePixels).fine) : null;
}

/** Point de la polyligne au paramètre t (0..1, échantillonnage uniforme = même paramètre que la cubique de l'enveloppe), tangente par différence centrée sur ±1 échantillon. */
function polyFrameAt(pts: readonly Vec[], t: number): { pos: Vec; T: Vec } {
  const n = pts.length - 1; const f = Math.min(Math.max(t, 0), 1) * n; const i = Math.min(Math.floor(f), n - 1); const u = f - i;
  const a = pts[i] as Vec; const b = pts[i + 1] as Vec;
  const pos = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
  const p0 = pts[Math.max(i - 1, 0)] as Vec; const p1 = pts[Math.min(i + 2, n)] as Vec;
  const T = norm({ x: p1.x - p0.x, y: p1.y - p0.y });
  return { pos, T };
}

/**
 * Repères (position, tangente, normale sortante) des bords PERTURBÉS : mêmes conventions que `upperFrame` / `lowerFrame` (t = 0 canthus interne → 1 externe), mais sur le tracé irrégulier.
 * La normale garde le côté de la normale de l'enveloppe (jamais retournée par une ondulation). Les cils, la caroncule et le pli y accrochent leurs racines : ils suivent le bord réellement dessiné.
 */
export function edgeFrames(g: OpeningGeometry, e: EdgeIrregularity): { readonly upper: (t: number) => Frame; readonly lower: (t: number) => Frame } {
  const upper = (t: number): Frame => { const { pos, T } = polyFrameAt(e.upper, t); return { pos, T, N: { x: g.s * T.y, y: -g.s * T.x } }; };
  // le bord inférieur est stocké de l'externe vers l'interne : t (interne → externe) = 1 − paramètre de stockage
  const lower = (t: number): Frame => { const { pos, T: d } = polyFrameAt(e.lower, 1 - t); const T = { x: -d.x, y: -d.y }; return { pos, T, N: { x: -g.s * T.y, y: g.s * T.x } }; };
  return { upper, lower };
}

/** Contour échantillonné du tracé perturbé (haut interne → externe, puis bas externe → interne) : même sens que `openingPolygon`, utilisé par le dégagement des cils. */
export function edgePolygon(e: EdgeIrregularity): Vec[] { return [...e.upper.slice(0, -1), ...e.lower.slice(0, -1)]; }

/** Déplacement du bord supérieur (perturbé − enveloppe) au paramètre t : ce que le pli palpébral et la caroncule héritent du tarse. */
export function upperEdgeShift(g: OpeningGeometry, e: EdgeIrregularity, t: number): Vec {
  const a = polyFrameAt(e.upper, t).pos; const b = cubicAt(g.pi, g.u1, g.u2, g.po, Math.min(Math.max(t, 0), 1));
  return { x: a.x - b.x, y: a.y - b.y };
}

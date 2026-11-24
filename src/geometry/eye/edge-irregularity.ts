import { mulberry32 } from '../../core/prng';
import type { OpeningGeometry } from './opening';
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

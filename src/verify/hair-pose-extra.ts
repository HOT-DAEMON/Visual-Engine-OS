import type { Vec } from '../geometry/eye/primitives';
import { halfWidthAt, type FaceLandmarks } from '../face';
import type { HairGeometry } from '../face/hair';
import { HAIRLINE_PEAK_TURN } from '../face/hair/hairline';
import type { Skull } from '../face/pose/skull';
import { check, type Check } from './types';

/**
 * RÈGLES AJOUTÉES À `checkHairPose` (`docs/ROTATION-HAIR-VERIFY-2.md`) : lisière de FACE, coin de lisière mesuré sur une fenêtre d'arc fixe, épaisseur des masses. Chacune a son contrôle négatif (`tests/hair-pose-extra.test.ts`).
 *  `pose.hairline-front-peak`  (anatomie) : à TOUT lacet, aucun SOMMET de la ligne d'implantation de face ne tourne de plus de `HAIRLINE_PEAK_TURN` (le rabotage `shavePeaks` est une garantie, pas un espoir) ;
 *  `pose.hairline-corner`      (style)    : virage maximal de la ligne posée mesuré APRÈS rééchantillonnage à pas d'arc constant (0,01 W) ≤ 1,35 × celui de la ligne de face (mêmes opérateur et pas) + 0,05 rad.
 *    Le contrôle `pose.hairline-smooth` lit les sommets tels quels : un échantillonnage plus fin le fait passer sans changer la ligne (mesuré : 0 alerte sur 480 poses alors que 152 poses sur 192 avaient un coin 1,5 à 4,5 fois trop
 *    vif sur fenêtre fixe) ; celui-ci ne se contourne pas ;
 *  `pose.mass-thickness`       (anatomie) : l'épaisseur des masses d'étage et de la masse simulée au-delà de la silhouette du crâne, rangée par rangée, ne dépasse pas celle de face (la pose n'épaissit pas la chevelure).
 */
const turn = (a: Vec, b: Vec, c: Vec): number => Math.abs(Math.atan2((c.y - b.y) * (b.x - a.x) - (c.x - b.x) * (b.y - a.y), (c.x - b.x) * (b.x - a.x) + (c.y - b.y) * (b.y - a.y)));

/** Rééchantillonne une polyligne ouverte à pas d'arc constant ≈ h (extrémités conservées). */
export function uniformSamples(line: readonly Vec[], h: number): Vec[] {
  const cum = [0];
  for (let i = 1; i < line.length; i++) cum.push((cum[i - 1] as number) + Math.hypot((line[i] as Vec).x - (line[i - 1] as Vec).x, (line[i] as Vec).y - (line[i - 1] as Vec).y));
  const L = cum[cum.length - 1] as number;
  if (!(L > 1e-9) || line.length < 2) return [...line];
  const n = Math.max(2, Math.round(L / h)), out: Vec[] = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const s = (L * k) / n;
    while (j + 2 < cum.length && (cum[j + 1] as number) < s) j++;
    const c0 = cum[j] as number, c1 = cum[j + 1] as number, t = c1 > c0 ? Math.min(1, Math.max(0, (s - c0) / (c1 - c0))) : 0, a = line[j] as Vec, b = line[j + 1] as Vec;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

/** Plus grand virage (rad) d'une polyligne rééchantillonnée à pas d'arc constant `h` : indépendant de la densité des sommets d'origine. */
export function windowTurn(line: readonly Vec[], h: number): number {
  const u = uniformSamples(line, h);
  let m = 0;
  for (let i = 1; i + 1 < u.length; i++) { const t = turn(u[i - 1] as Vec, u[i] as Vec, u[i + 1] as Vec); if (Number.isFinite(t) && t > m) m = t; }
  return m;
}

/** Plus grand virage (rad) d'un SOMMET (ordonnée plus haute que ses deux voisins) : ce que `shavePeaks` borne. */
export function peakTurn(line: readonly Vec[]): number {
  let m = 0;
  for (let i = 1; i + 1 < line.length; i++) {
    const a = line[i - 1] as Vec, b = line[i] as Vec, c = line[i + 1] as Vec;
    if (b.y < a.y && b.y < c.y) m = Math.max(m, turn(a, b, c));
  }
  return m;
}

type Span = (poly: readonly Vec[], y: number) => { lo: number; hi: number } | null;

/** Plus grand excès (px) d'épaisseur de masse au-delà de la silhouette, posé − face, sur 48 rangées entre le haut du crâne et la mâchoire. */
export function massExcess(g0: HairGeometry, g: HairGeometry, lm: FaceLandmarks, skull: Skull, yawDeg: number, spanAt: Span): number {
  const yc = (y: number): number => Math.min(lm.chinY - 0.02 * lm.H, Math.max(skull.topY + 0.02 * lm.H, y));
  const pairs: [readonly Vec[], readonly Vec[]][] = [];
  g0.tierMasses.forEach((m, i) => { const q = g.tierMasses[i]; if (q) pairs.push([m.poly, q.poly]); });
  if (g0.simMass && g.simMass) pairs.push([g0.simMass, g.simMass]);
  const yTop = skull.topY + 0.02 * lm.H, yBot = lm.jawY;
  let excess = 0;
  for (const [m0, m1] of pairs) for (let k = 0; k <= 48; k++) {
    const y = yTop + ((yBot - yTop) * k) / 48, s0 = spanAt(m0, y), s1 = spanAt(m1, y);
    if (!s0 || !s1) continue;
    const t0 = Math.max(s0.hi, -s0.lo) - halfWidthAt(lm.outline, yc(y)), t1 = Math.max(s1.hi, -s1.lo) - skull.halfAt(yc(y), yawDeg);
    excess = Math.max(excess, t1 - Math.max(0, t0));
  }
  return Math.max(0, excess);
}

/** Pas d'arc (part de W) du rééchantillonnage de `pose.hairline-corner`. */
export const CORNER_STEP = 0.01;

export function checkHairPoseExtra(g0: HairGeometry, g: HairGeometry, lm: FaceLandmarks, skull: Skull, yawDeg: number, spanAt: Span): Check[] {
  const out: Check[] = [];
  out.push(check('anatomy', 'pose.hairline-front-peak', '<=', peakTurn(g0.hairline), HAIRLINE_PEAK_TURN, 'sommet de la ligne d\'implantation de face plus aigu que le seuil de rabotage'));
  if (yawDeg === 0) return out;
  const h = CORNER_STEP * lm.W;
  out.push(check('style', 'pose.hairline-corner', '<=', windowTurn(g.hairline, h), 1.35 * windowTurn(g0.hairline, h) + 0.05, 'coin de lisière plus vif que celui de face (virage sur pas d\'arc constant)'));
  out.push(check('anatomy', 'pose.mass-thickness', '<=', massExcess(g0, g, lm, skull, yawDeg, spanAt), 0.5 + 0.004 * lm.W, 'masse d\'étage plus épaisse sous pose que de face'));
  return out;
}

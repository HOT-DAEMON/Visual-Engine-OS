import { clamp } from '../../core/math';
import type { Vec } from '../../geometry/eye/primitives';
import type { HairLock } from '../../face/hair';
import type { Poly } from '../../face/poly';
import { normals, halfWidth } from '../../face/hair/ribbon';

/** Les trois bandes d'une mèche en ombrage cel : ombre portée côté opposé à la lumière, ombre propre au pied, bande de reflet. */
export interface CelBands {
  readonly shade: Poly | null;
  readonly core: Poly | null;
  readonly highlight: Poly | null;
}

/**
 * Bandes cel d'UNE mèche, à partir de sa ligne médiane et de son profil (`spine/w0/sharp/profile`), pour la direction
 * de lumière locale `ld` (unitaire, repère de l'hôte).
 *
 * Coordonnée latérale λ ∈ [−1, 1] : 0 = axe de la mèche, +1 = bord côté normale. En chaque point, d = n·ld ∈ [−1, 1]
 * dit de quel côté vient la lumière.
 *  - OMBRE : de λ₀ = −0,55·d jusqu'au bord opposé à la lumière (−tanh(3d)) ; elle s'amincit continûment quand la mèche
 *    est parallèle à la lumière (d → 0) : pas de saut de côté le long d'un S.
 *  - REFLET : bande centrée en λ = 0,35·d, de demi-largeur `band`·0,5, sur u ∈ [0,12 ; 0,78], effilée aux deux bouts.
 *  - OMBRE PROPRE : toute la largeur sur le premier quart (u ≤ 0,26), bord bas irrégulier.
 * Les polygones sont ensuite ROGNÉS par le contour réel de la mèche (clip-path) : aucune bande ne peut en sortir.
 */
export function celBands(l: HairLock, ld: Vec, band: number, wantCore: boolean): CelBands {
  const sp = l.spine;
  if (!sp || sp.length < 6 || l.w0 === undefined) return { shade: null, core: null, highlight: null };
  const n = sp.length;
  const nn = normals(sp);
  const profile = l.profile ?? 'ribbon';
  const hw = (i: number): number => halfWidth(i / (n - 1), l.w0 as number, l.sharp ?? 0.5, profile, l.power ?? 1);
  const at = (i: number, lam: number): Vec => {
    const q = nn[i] as Vec;
    const w = hw(i) * lam;
    return { x: (sp[i] as Vec).x + q.x * w, y: (sp[i] as Vec).y + q.y * w };
  };
  const d = (i: number): number => clamp((nn[i] as Vec).x * ld.x + (nn[i] as Vec).y * ld.y, -1, 1);
  const edge = (i: number): Vec => at(i, -Math.tanh(3 * d(i)) * 1.15);
  const inner = (i: number): Vec => at(i, -0.55 * d(i));
  const idx = Array.from({ length: n }, (_, i) => i);
  const shade = [...idx.map(inner), ...[...idx].reverse().map(edge)];
  let highlight: Poly | null = null;
  if (band > 0.01) {
    const a = Math.floor(0.12 * (n - 1));
    const b = Math.floor(0.78 * (n - 1));
    const half = (i: number): number => 0.5 * band * 0.55 * Math.max(0, Math.sin((Math.PI * (i - a)) / Math.max(1, b - a))) ** 0.7;
    const sub = idx.filter((i) => i >= a && i <= b);
    highlight = [...sub.map((i) => at(i, 0.35 * d(i) + half(i))), ...[...sub].reverse().map((i) => at(i, 0.35 * d(i) - half(i)))];
  }
  let core: Poly | null = null;
  if (wantCore) {
    const k = Math.floor(0.26 * (n - 1));
    const sub = idx.filter((i) => i <= k);
    // Bord bas dentelé : la limite recule d'un point sur deux (irrégulier, volontairement non lissé).
    core = [...sub.map((i) => at(i, 1.2)), ...[...sub].reverse().map((i) => at(i, -1.2))].map((q, j, all) => (j % 2 === 1 && j > all.length / 4 ? { x: q.x * 0.98 + (sp[0] as Vec).x * 0.02, y: q.y } : q));
  }
  return { shade, core, highlight };
}

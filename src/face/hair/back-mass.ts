import { clamp } from '../../core/math';
import type { Vec } from '../../geometry/eye/primitives';
import type { FaceLandmarks } from '../landmarks';
import { orient, type Poly } from '../poly';
import type { SkullSurface } from './boundary/skull-surface';

/**
 * MASSE ARRIÈRE (bob, long, archétypes simulés) : sous-couche posée DERRIÈRE la tête, entre les mèches arrière, pour qu'on ne voie pas le fond à travers
 * la chevelure. Elle n'est jamais une silhouette de plein droit : ce sont les mèches qui dessinent le contour, la masse ne fait que les doubler.
 *
 * Défauts de l'ancienne construction (mesurés, `docs/HAIR-BACK-MASS.md`) : couvercle PLAT au niveau des tempes (largeur à 6 % sous le haut = 0,88–0,92 du
 * maximum : « oreilles de chat » qui dépassent jusqu'à 0,44 W du crâne), bas plat à la mèche la plus basse (aire / boîte = 0,88–0,96 : un rectangle),
 * contour pris sur la mèche la plus extérieure (aucune mèche ne dépasse de la masse : bord nu visible), teinte à 0,27–0,37 × la luminance des cheveux.
 *
 * Construction, ligne par ligne de haut en bas, séparément à gauche et à droite :
 *  1. HAUT = le crâne : demi-largeur `a(y)` du contour du crâne + épaisseur de coque, en CLOCHE (maximum courant : une chevelure qui tombe ne rentre pas
 *     avec la mâchoire). Le haut se referme donc sur le sommet du crâne, sans couvercle.
 *  2. FLANCS = l'étendue des mèches, RETRÉCIE d'une largeur de mèche (`INSET`) : les pointes extérieures dépassent de la masse.
 *  3. ÉVASEMENT borné (`FLARE`, pente maximale) au-dessous de la tempe : une mèche isolée ne tire pas un coin.
 *  4. PLANCHER = la largeur du crâne (ou du cou plus bas) : jamais de trou entre la masse et la tête, que la tête recouvre ensuite.
 *  5. BAS = le 85ᵉ centile des pointes arrière, relevé de `TIP_INSET` H, FERMÉ en demi-ellipse : les pointes pendent sous la masse.
 */
/** Les pointes dépassent sous une masse d'au moins cette part de H (masse arrière ET masses d'étage). */
export const TIP_INSET = 0.05;
export const BACK_MASS = { rows: 56, inset: 0.018, flare: 0.8, tipInset: TIP_INSET, round: 0.11, floor: 0.97 } as const;

export interface BackMassInput {
  readonly lm: FaceLandmarks;
  readonly skull: SkullSurface;
  /** Polygones de TOUTES les mèches visibles (avant + arrière) : leur étendue borne les flancs de la masse. */
  readonly polys: readonly Poly[];
  /** Polygones des mèches arrière : leurs pointes règlent le bas de la masse. */
  readonly backPolys: readonly Poly[];
  /** Épaisseur de la coque de cheveux (px), même valeur que la sous-couche avant. */
  readonly crown: number;
}

/** Étendue [min x, max x] des polygones sur chaque ligne y0 + r·dy (les arêtes sont parcourues : aucune ligne n'est sautée entre deux sommets éloignés). */
export function rowExtents(polys: readonly Poly[], y0: number, dy: number, n: number): { lo: number[]; hi: number[] } {
  const lo: number[] = new Array(n).fill(Infinity);
  const hi: number[] = new Array(n).fill(-Infinity);
  for (const q of polys) {
    for (let i = 0; i < q.length; i++) {
      const a = q[i] as Vec;
      const b = q[(i + 1) % q.length] as Vec;
      const r0 = Math.max(0, Math.ceil((Math.min(a.y, b.y) - y0) / dy));
      const r1 = Math.min(n - 1, Math.floor((Math.max(a.y, b.y) - y0) / dy));
      const span = b.y - a.y;
      for (let r = r0; r <= r1; r++) {
        const t = span === 0 ? 0 : clamp((y0 + r * dy - a.y) / span, 0, 1);
        const x = a.x + (b.x - a.x) * t;
        if (x < (lo[r] as number)) lo[r] = x;
        if (x > (hi[r] as number)) hi[r] = x;
      }
    }
  }
  return { lo, hi };
}

const smooth121 = (v: number[], passes: number): void => {
  for (let p = 0; p < passes; p++) {
    const c = v.slice();
    for (let i = 1; i < v.length - 1; i++) v[i] = 0.25 * (c[i - 1] as number) + 0.5 * (c[i] as number) + 0.25 * (c[i + 1] as number);
  }
};

/** Ordonnée du bas de la masse : 85ᵉ centile des pointes arrière, relevé de `TIP_INSET` H. `null` si la masse serait plus courte que la tempe. */
export function backMassBottom(lm: FaceLandmarks, backPolys: readonly Poly[]): number | null {
  const tips: number[] = [];
  for (const q of backPolys) {
    let m = -Infinity;
    for (const v of q) if (v.y > m) m = v.y;
    if (Number.isFinite(m)) tips.push(m);
  }
  if (tips.length < 3) return null;
  tips.sort((a, b) => a - b);
  const y = (tips[Math.floor(0.85 * (tips.length - 1))] as number) - BACK_MASS.tipInset * lm.H;
  return y > lm.hair.sideY + 0.08 * lm.H ? y : null;
}

/** Hauteur (px) de la fermeture arrondie du bas : la masse s'y resserre en demi-ellipse ; au-dessus, elle suit la tête. Source unique : construction et vérification. */
export function backMassCloseHeight(lm: FaceLandmarks, yBot: number): number {
  return Math.min(BACK_MASS.round * lm.H, 0.3 * (yBot - lm.hair.sideY));
}

export function backMassShape(inp: BackMassInput): Poly | null {
  const { lm, skull: S, crown } = inp;
  const { W } = lm;
  const yBot = backMassBottom(lm, inp.backPolys);
  if (yBot === null) return null;
  const n = BACK_MASS.rows;
  const y0 = S.topY;
  const dy = (yBot - y0) / (n - 1);
  const ys = Array.from({ length: n }, (_, i) => y0 + i * dy);
  const { lo, hi } = rowExtents(inp.polys, y0, dy, n);
  const inset = BACK_MASS.inset * W;
  const jawY = lm.jawY;
  const neckHalf = lm.neck.half;

  // 1. cloche : maximum courant de a(y) + coque, figé sous la mâchoire.
  const base: number[] = [];
  let run = 0;
  for (const y of ys) {
    if (y <= jawY) run = Math.max(run, S.a(y) + crown);
    base.push(run);
  }
  const floorAt = (y: number): number => (y <= jawY ? BACK_MASS.floor * S.a(y) : Math.max(neckHalf, BACK_MASS.floor * S.a(jawY) * 0.6));
  const side = (ext: (r: number) => number): number[] => {
    const w = ys.map((y, r) => {
      const e = ext(r);
      const cap = (base[r] as number) + BACK_MASS.flare * Math.max(0, y - lm.hair.sideY); // 3. évasement borné
      const wanted = Number.isFinite(e) ? e - inset : cap; // 2. flancs = mèches rétrécies
      return Math.max(floorAt(y), Math.min(wanted, cap)); // 4. plancher
    });
    smooth121(w, 3);
    // Le lissage ne doit ni sortir des mèches ni rentrer sous la tête.
    return w.map((v, r) => {
      const e = ext(r);
      const cap = (base[r] as number) + BACK_MASS.flare * Math.max(0, (ys[r] as number) - lm.hair.sideY);
      return Math.max(floorAt(ys[r] as number), Math.min(v, cap, Number.isFinite(e) ? e - 0.6 * inset : cap));
    });
  };
  const wR = side((r) => hi[r] as number);
  const wL = side((r) => -(lo[r] as number));

  // 5. bas en demi-ellipse : les rangées de fermeture rétrécissent jusqu'à une pointe arrondie.
  const rr = backMassCloseHeight(lm, yBot);
  const close = (y: number): number => {
    const t = clamp((y - (yBot - rr)) / Math.max(1e-6, rr), 0, 1);
    return Math.sqrt(Math.max(0.04, 1 - t * t));
  };
  const right: Vec[] = ys.map((y, r) => ({ x: (wR[r] as number) * close(y), y }));
  const left: Vec[] = ys.map((y, r) => ({ x: -(wL[r] as number) * close(y), y }));
  return orient([...right, ...left.reverse()]);
}

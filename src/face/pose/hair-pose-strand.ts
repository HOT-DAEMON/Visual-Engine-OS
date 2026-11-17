import { clamp } from '../../core/math';
import type { Vec } from '../../geometry/eye/primitives';
import type { HairGeometry, HairLock } from '../hair/types';
import { smoothstep } from '../hair/noise';
import type { Poly } from '../poly';
import { densify } from './densify';
import type { RowMap, Skull } from './skull';

/**
 * MÈCHES SOUS POSE (`docs/ROTATION-STEP-04-HAIR-2D.md`, tranche 2 ; décisions et mesures : `docs/ROTATION-HAIR-STRANDS.md`).
 *
 * Une masse est reprojetée point par point (`Skull.projectX`, bande du limbe lointain dépliée jusqu'à 2,2× à 30°) : c'est acceptable pour un aplat, pas pour une mèche, dont la largeur et la courbure sont le dessin.
 * Une mèche est donc posée comme une CARTE ACCROCHÉE À SA RACINE : sa racine suit la surface (la même projection que les masses, donc la racine reste collée à la coque et à la lisière), et son dessin est conservé,
 * avec seulement une échelle HORIZONTALE locale s = pente de la projection à la racine, bornée à [STRAND_SCALE.min, STRAND_SCALE.max] :
 *  - s < 1 : raccourcissement vrai (le côté qui se présente de profil), la mèche s'affine ;
 *  - s > 1 : dépliage de la bande écrasée du limbe lointain : on le REFUSE (s = 1) ; la mèche garde sa largeur, c'est le défaut d'étirement de la tranche 1 (2,2× à 30°) ;
 *  - plancher 0,45 : une mèche ne devient jamais un trait (le raccourcissement exact de 70° serait 0,34).
 * Par sommet : x' = P(x_r, y) + ∫ de x_r à x de clamp(P'(u, y)) du : les ordonnées ne changent pas (lacet seul). Partout où la pente de la projection est dans les bornes, c'est EXACTEMENT la projection de la masse
 * (x' = P(x, y)) : la mèche épouse la tête sur toute sa longueur et reste collée à la coque ; ailleurs seule la pente est bornée, donc la largeur d'une mèche à une ordonnée donnée est multipliée par un facteur
 * dans [min, max], jamais plus (propriété EXACTE, mesurée par `pose.strand-scale`). Une mèche qui épouse le crâne n'est pas redressée (le premier essai, translation fixe x_r + échelle, la ramenait à 0,34 de son étendue).
 *
 * Mèches de la couche `over` (devant le visage) : elles s'effacent quand leur côté se détourne. Visibilité = composante z de la normale du crâne à la racine après la rotation EXACTE : `cos(φ + a)`, φ = asin(x_r / hx) ;
 * opacité `smoothstep(n_z / 0,35)`. Une mèche ne peut pas APPARAÎTRE : le dessin de face n'a rien derrière l'horizon (limite documentée).
 *
 * Pièces ATTACHÉES (queue, chignon) : rigides, dans le plan de leur attache. Profondeur propre = celle de l'ancre : côté → 0 (oreille), basse → derrière la tête (−k·hx), dessus → légèrement derrière le sommet (−0,15 k·rx).
 * Chaque sommet : x' = x·cos a + z·sin a. Les tresses (`braid`) naissent du cuir chevelu : modèle de mèche ordinaire.
 */
export const STRAND_SCALE = { min: 0.45, max: 1 } as const;
/** Longueur maximale (fraction de W, ≈ 0,75 px) d'une arête du contour d'une mèche avant projection : la carte n'est pas affine (la translation varie avec y, jusqu'à ≈ 0,85 px par px près du sommet du crâne) ; deux sommets d'une même arête sont translatés différemment, l'erreur de largeur est ≈ pas × pente (1,45 px mesurés à 1,7 px de pas : cisaillement, pas étirement). La ligne médiane (`spine`) n'est JAMAIS rééchantillonnée : le rendu la lit par indice (bandes cel, dégradé). */
export const STRAND_EDGE = 0.002;
/** Fondu des mèches de devant : opaque dès `n_z` ≥ FACING.full, invisible à `n_z` ≤ 0. */
export const FACING = { full: 0.35 } as const;
/** Profondeur de l'ancre du chignon de dessus (part de k·rx, derrière le sommet) : choix de conception. */
const TOP_BUN_DEPTH = 0.15;

type Tie = HairGeometry['ties'][number];
export type AnchorKind = 'side' | 'low' | 'top';

/** Racine d'une mèche : début de la ligne médiane ; sans ligne médiane, centre de la forme. */
export function rootOf(l: HairLock): Vec {
  const r = l.spine?.[0];
  if (r) return r;
  const xs = l.poly.map((q) => q.x), ys = l.poly.map((q) => q.y);
  return { x: xs.reduce((a, b) => a + b, 0) / xs.length, y: ys.reduce((a, b) => a + b, 0) / ys.length };
}

/** Rôle de l'ancre d'une attache : même classement que la construction (`tie.ts` : `tailLocks`). */
export function anchorKind(T: Vec, skull: Skull, W: number): AnchorKind {
  const H = -2 * skull.topY;
  return Math.abs(T.x) >= 0.2 * W ? 'side' : T.y < skull.topY + 0.06 * H ? 'top' : 'low';
}

/** Profondeur z (vers la caméra) de l'ancre : côté 0 ; basse derrière la tête ; dessus un peu derrière le sommet. */
export function anchorDepth(kind: AnchorKind, T: Vec, skull: Skull): number {
  return kind === 'side' ? 0 : kind === 'low' ? -skull.depthRatio * skull.hangHalf(T.y) : -TOP_BUN_DEPTH * skull.depthRatio * skull.rx;
}

/** Visibilité (composante z de la normale après rotation exacte) de la surface au point (x, y) de la vue de face. */
export function facing(skull: Skull, x: number, y: number, yawDeg: number): number {
  const hx = skull.hangHalf(y), phi = Math.asin(clamp(x / hx, -1, 1));
  return Math.cos(phi + (yawDeg * Math.PI) / 180);
}

const near = (ties: readonly Tie[], r: Vec): Tie | null => {
  let best: Tie | null = null, bd = Infinity;
  for (const t of ties) { const d = Math.hypot(t.at.x - r.x, t.at.y - r.y); if (d < bd) { bd = d; best = t; } }
  return best;
};

/** Pas de la table d'intégrale de la pente bornée, dans la section (s = x / hx ∈ [−1, 1]) : 128 cellules. Hors section la pente vaut 1 (épaisseur conservée) : intégrale exacte. */
const TABLE = 128;

/** Rangée de projection + intégrale cumulée de la pente BORNÉE : Ĝ(x) = ∫₀ˣ clamp(P'(u)) du. Une différence Ĝ(x₂) − Ĝ(x₁) est le produit de x₂ − x₁ par un facteur dans [min, max] (cumul de cellules à pente bornée,
 *  interpolé linéairement : propriété exacte, y compris entre les deux bords d'une mèche mince). */
export interface StrandRow {
  readonly R: RowMap;
  G(x: number): number;
}

/** Cache de rangées (une par ordonnée arrondie à 0,1 px) pour une pose donnée : tous les sommets de toutes les mèches à la même hauteur partagent la même table. */
export function rowCache(skull: Skull, yawDeg: number): (y: number) => StrandRow {
  const memo = new Map<number, StrandRow>();
  return (y) => {
    const key = Math.round(y * 10);
    let hit = memo.get(key);
    if (!hit) {
      const R = skull.rowMap(key / 10, yawDeg), cum = new Float64Array(TABLE + 1), dx = (2 * R.hx) / TABLE;
      for (let i = 0; i < TABLE; i++) cum[i + 1] = (cum[i] as number) + clamp(R.slope((-1 + (i + 0.5) * (2 / TABLE)) * R.hx), STRAND_SCALE.min, STRAND_SCALE.max) * dx;
      const mid = (cum[TABLE / 2] as number);   // Ĝ(0) = 0 : on recentre la table
      const G = (x: number): number => {
        const s = x / R.hx;
        if (s <= -1) return (cum[0] as number) - mid + (x + R.hx);
        if (s >= 1) return (cum[TABLE] as number) - mid + (x - R.hx);
        const u = (s + 1) * (TABLE / 2), i = Math.min(TABLE - 1, Math.floor(u)), f = u - i;
        return (cum[i] as number) * (1 - f) + (cum[i + 1] as number) * f - mid;
      };
      memo.set(key, (hit = { R, G }));
    }
    return hit;
  };
}

/** Carte d'une mèche de racine x_r : P(x_r, y) + Ĝ(x) − Ĝ(x_r) (voir l'en-tête). */
export function strandMap(skull: Skull, yawDeg: number, xr: number, rows: (y: number) => StrandRow = rowCache(skull, yawDeg)): (q: Vec) => Vec {
  // La translation P(x_r, y) est évaluée à l'ordonnée EXACTE (la racine reste exactement sur la projection de la masse) ; seule la TABLE de l'intégrale est partagée entre les ordonnées voisines (0,1 px) : seule sa différence compte.
  return (q) => ({ x: skull.projectX(xr, q.y, yawDeg) + rows(q.y).G(q.x) - rows(q.y).G(xr), y: q.y });
}

/** Pose d'UNE mèche. `ties` : attaches de la coiffure (pour la profondeur des pièces attachées). */
export function poseLock(l: HairLock, skull: Skull, yawDeg: number, W: number, ties: readonly Tie[], rows: (y: number) => StrandRow = rowCache(skull, yawDeg)): HairLock {
  const root = rootOf(l), xr = root.x;
  let map: (q: Vec) => Vec, scale: number;
  const tie = l.part === 'tail' || l.part === 'bun' ? near(ties, root) : null;
  if (tie) {
    const a = (yawDeg * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a), z = anchorDepth(anchorKind(tie.at, skull, W), tie.at, skull);
    map = (q) => ({ x: q.x * c + z * sn, y: q.y });
    scale = Math.abs(c);
  } else {
    map = strandMap(skull, yawDeg, xr, rows);
    scale = clamp(skull.slopeX(xr, root.y, yawDeg), STRAND_SCALE.min, STRAND_SCALE.max);
  }
  const poly: Poly = densify(l.poly, STRAND_EDGE * W).map(map);
  const out: { -readonly [K in keyof HairLock]: HairLock[K] } = { ...l, poly };
  if (l.spine) out.spine = l.spine.map(map);
  if (l.w0 !== undefined) out.w0 = l.w0 * scale;
  if (l.layer === 'over') {
    const nz = facing(skull, xr, root.y, yawDeg), alpha = smoothstep(clamp(nz / FACING.full, 0, 1));
    if (alpha < 1) out.alpha = alpha;
  }
  return out;
}

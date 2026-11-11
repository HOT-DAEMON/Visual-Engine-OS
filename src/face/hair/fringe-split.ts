import { mulberry32 } from '../../core/prng';
import type { Vec } from '../../geometry/eye/primitives';
import type { HairCtx } from './flow';

/**
 * Rapport MAXIMAL largeur de base / longueur d'une mèche de frange (`docs/HAIR-FRINGE-ASPECT.md`). Mesuré avant sur 30 visages : médiane 0,39 mais p90 1,07 et max 5–6,5 ;
 * 12 % des mèches de frange étaient plus LARGES que hautes (cônes de 0,27 W pour 0,07 H en `asym_brow`) : des triangles trapus, lus comme des dents de scie.
 */
export const FRINGE_ASPECT_MAX = 0.85;
/** Nombre maximal de mèches issues d'une seule (garde-fou : jamais une rafale de fils). */
export const SPLIT_MAX = 4;
/** Recouvrement des pièces voisines (largeur ×) et raccourcissement des pointes étagées (longueur ×) : le rapport VISÉ tient compte des deux. */
const OVERLAP = 1.2;
const STAGGER = 0.9;

export interface Piece {
  readonly centre: Vec[];
  readonly width: number;
}

export const spineLength = (c: readonly Vec[]): number => c.reduce((a, p, i) => (i ? a + Math.hypot(p.x - (c[i - 1] as Vec).x, p.y - (c[i - 1] as Vec).y) : 0), 0);

/**
 * Une mèche trop large pour sa longueur est RÉPARTIE en `n` mèches côte à côte (recouvrement 1,2), de rapport ≤ `FRINGE_ASPECT_MAX`, pointes étagées une sur deux
 * (pas d'arête alignée) ; au-delà de `SPLIT_MAX` mèches, la largeur totale est plafonnée (un moignon quasi sans longueur reste un fil, pas un bloc).
 * Fonction pure, SANS tirage aléatoire : le reste de la coiffure ne bouge pas. Mèche déjà assez étroite : rendue telle quelle.
 */
export function splitByAspect(centre: Vec[], width: number): Piece[] {
  const len = spineLength(centre);
  if (len < 1e-9) return [{ centre, width }];
  // Capacité d'une pièce : le rapport final = (total / n × OVERLAP) / (len × STAGGER) ≤ FRINGE_ASPECT_MAX ; au-delà de SPLIT_MAX pièces, la largeur totale est plafonnée.
  const cap = (FRINGE_ASPECT_MAX * len * STAGGER) / OVERLAP;
  const total = Math.min(width, SPLIT_MAX * cap);
  const n = Math.max(1, Math.min(SPLIT_MAX, Math.ceil(total / cap)));
  if (n === 1) return [{ centre, width: Math.min(width, FRINGE_ASPECT_MAX * len) }];
  // Les pièces se partagent EXACTEMENT l'emprise latérale de la mèche d'origine (bords extérieurs inchangés, translation parallèle le long de la ligne) : la découpe
  // ne doit rien ajouter à la couverture (oreille, tempe) ; elle ne fait que remplacer un bloc par des mèches étroites.
  const wp = (total / n) * OVERLAP;
  const r = centre[0] as Vec;
  return Array.from({ length: n }, (_, k) => {
    const dx = -total / 2 + wp / 2 + (k * (total - wp)) / (n - 1);
    const grow = k % 2 ? STAGGER : 1;
    return { width: wp, centre: centre.map((q) => ({ x: r.x + (q.x - r.x) * grow + dx, y: r.y + (q.y - r.y) * grow })) };
  });
}

/**
 * Contexte d'une pièce : la PREMIÈRE garde le flux aléatoire de la coiffure (même consommation que la mèche d'origine), les suivantes ont un flux PROPRE issu de la graine
 * (`salt` = rang de la mèche d'origine). La découpe ne décale donc aucun tirage du reste de la coiffure (mesuré : sans cela, un visage short voyait son oreille recouverte
 * à 0,132 pour 0,12 par simple décalage du flux, graine 52442).
 */
export function pieceCtx(ctx: HairCtx, salt: number, k: number): HairCtx {
  return k === 0 ? ctx : { ...ctx, rnd: mulberry32((ctx.h.seed ^ Math.imul(salt + 1, 0x9e3779b1) ^ Math.imul(k, 0x85ebca6b)) >>> 0) };
}

import { rad } from '../../core/math';
import type { Lash } from './lashes';
import { cubicAt, type Vec } from './primitives';

/**
 * DÉGAGEMENT DE L'OUVERTURE : un cil ne doit jamais retomber dans l'ouverture (sur l'iris ou la sclère). Deux causes réelles, mesurées sur la galerie : (1) les yeux très inclinés,
 * où la normale du bord pointe encore vers l'intérieur de l'ouverture à l'extrémité du cil ; (2) les mèches (`clump`) combinées à `bendDeg`, dont les pointes convergent vers une
 * moyenne qui peut tomber sur l'iris.
 * Règle : un cil dont un point échantillonné (après sa zone de racine) est dans l'ouverture pivote autour de sa racine, du plus petit angle qui le dégage (± 2° par pas, jusqu'à ± 50°,
 * côté qui éloigne le plus la pointe du centre de l'ouverture). Un cil déjà dégagé n'est PAS touché (octet pour octet) ; aucun tirage de PRNG.
 */
export const CLEARANCE = { stepDeg: 2, maxDeg: 50, rootSkip: 0.5, samples: 12 } as const;

const inside = (p: Vec, poly: readonly Vec[]): boolean => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as Vec; const b = poly[j] as Vec;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};
const rotAbout = (p: Vec, o: Vec, a: number): Vec => ({ x: o.x + (p.x - o.x) * Math.cos(a) - (p.y - o.y) * Math.sin(a), y: o.y + (p.x - o.x) * Math.sin(a) + (p.y - o.y) * Math.cos(a) });
const along = (l: Lash, s: number): Vec => {
  if (l.ctrl2) return cubicAt(l.base, l.ctrl, l.ctrl2, l.tip, s);
  const u = 1 - s;
  return { x: u * u * l.base.x + 2 * u * s * l.ctrl.x + s * s * l.tip.x, y: u * u * l.base.y + 2 * u * s * l.ctrl.y + s * s * l.tip.y };
};
const segDist = (p: Vec, a: Vec, b: Vec): number => {
  const dx = b.x - a.x; const dy = b.y - a.y; const L = dx * dx + dy * dy;
  const t = L === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};
/** Profondeur SIGNÉE d'un point par rapport au contour de l'ouverture : > 0 dedans (distance au contour), < 0 dehors, 0 sur le contour. */
export function signedDepth(p: Vec, poly: readonly Vec[]): number {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) d = Math.min(d, segDist(p, poly[i] as Vec, poly[j] as Vec));
  return inside(p, poly) ? d : -d;
}
/** Profondeur d'un point DANS l'ouverture (distance au contour), 0 s'il est dehors. */
export function depthInOpening(p: Vec, poly: readonly Vec[]): number {
  return Math.max(0, signedDepth(p, poly));
}
/** Demi-largeur du cil à l'abscisse curviligne `s` (même profil que le rendu : `cubicLash`, (1 − s)^(0,7 + 0,5 · tipSharpness)). */
export const lashHalfWidth = (l: Lash, s: number): number => (l.baseWidth / 2) * (1 - s) ** (0.7 + 0.5 * l.tipSharpness);
/**
 * Vrai si le CORPS du cil (ligne médiane + demi-largeur) pénètre dans l'ouverture de plus que la demi-épaisseur du trait de paupière `lidPx` après la zone de racine. Le trait est centré sur le bord :
 * ce qui reste dans son épaisseur est fondu dans la paupière, pas dans l'œil (racines enfoncées par `rootFuse`) ; ce qui la dépasse recouvre l'iris ou la sclère.
 */
export function lashHitsOpening(l: Lash, poly: readonly Vec[], lidPx: number): boolean {
  const n = CLEARANCE.samples;
  for (let i = 0; i <= n; i++) {
    const s = CLEARANCE.rootSkip + ((1 - CLEARANCE.rootSkip) * i) / n;
    if (signedDepth(along(l, s), poly) + lashHalfWidth(l, s) > lidPx * 0.5) return true;
  }
  return false;
}
const turn = (l: Lash, a: number): Lash => ({ ...l, ctrl: rotAbout(l.ctrl, l.base, a), tip: rotAbout(l.tip, l.base, a), ...(l.ctrl2 ? { ctrl2: rotAbout(l.ctrl2, l.base, a) } : {}) });

/** Rétrécit le cil vers sa racine (même courbe, longueur × f) : sa forme et son angle de départ sont conservés. */
const shrink = (l: Lash, f: number): Lash => {
  const k = (p: Vec): Vec => ({ x: l.base.x + (p.x - l.base.x) * f, y: l.base.y + (p.y - l.base.y) * f });
  return { ...l, ctrl: k(l.ctrl), tip: k(l.tip), ...(l.ctrl2 ? { ctrl2: k(l.ctrl2) } : {}) };
};
/**
 * Repli quand AUCUNE rotation ≤ `maxDeg` ne dégage le cil (audit des cils : 24 cas sur 19 021 laissés tels quels, donc dessinés sur l'iris) : on raccourcit le cil par paliers
 * (× 0,85 → 0,3), en retestant les rotations à chaque palier. Anatomiquement un cil implanté sur un canthus très aigu ou une paupière très inclinée est court ; un cil long qui traverse
 * l'œil est une erreur. Un cil dont la RACINE est elle-même dans l'ouverture (dessin dégénéré) n'est pas touché : le contrôle `verifyEye` le signale.
 */
export const CLEARANCE_SHRINK = [0.85, 0.7, 0.55, 0.4, 0.3] as const;
/**
 * 2ᵉ repli, mesuré sur la galerie : les 24 cils restants après rotation + raccourcissement sont tous des cils du BAS, des mèches plus LARGES que longues (largeur de base 18–28 px pour 4–13 px de
 * longueur) dont la demi-largeur, ajoutée à la racine déjà à ≈ 0,5 épaisseur dans l'ouverture, dépasse le seuil : seule une mèche plus fine les dégage. On amincit la base par paliers (× 0,75 → 0,3)
 * en conservant longueur et angle.
 */
export const CLEARANCE_NARROW = [0.75, 0.6, 0.45, 0.3] as const;

/** Dégage de l'ouverture les cils qui y retombent ; renvoie la liste (mêmes objets pour les cils déjà dégagés ; un cil impossible à dégager est omis, voir le dernier recours). */
export function clearLashesFromOpening(lashes: readonly Lash[], poly: readonly Vec[], center: Vec, lidPx: number): Lash[] {
  return lashes.flatMap((l): Lash[] => {
    if (!lashHitsOpening(l, poly, lidPx)) return [l];
    const d = (x: Lash): number => Math.hypot(x.tip.x - center.x, x.tip.y - center.y);
    const rotate = (src: Lash): Lash | null => {
      for (let a = CLEARANCE.stepDeg; a <= CLEARANCE.maxDeg; a += CLEARANCE.stepDeg) {
        const p = turn(src, rad(a)); const m = turn(src, -rad(a));
        const first = d(p) >= d(m) ? p : m; const second = first === p ? m : p;
        if (!lashHitsOpening(first, poly, lidPx)) return first;
        if (!lashHitsOpening(second, poly, lidPx)) return second;
      }
      return null;
    };
    const cleared = rotate(l);
    if (cleared) return [cleared];
    for (const f of CLEARANCE_SHRINK) { const s = shrink(l, f); if (!lashHitsOpening(s, poly, lidPx)) return [s]; const r = rotate(s); if (r) return [r]; }
    for (const w of CLEARANCE_NARROW) { const n = { ...l, baseWidth: l.baseWidth * w }; if (!lashHitsOpening(n, poly, lidPx)) return [n]; }
    // Dernier recours (8 cils sur 19 021 : racine déjà dans la fente d'une paupière basse concave) : un cil qui ne peut s'implanter nulle part sans recouvrir l'œil n'est pas dessiné.
    return [];
  });
}

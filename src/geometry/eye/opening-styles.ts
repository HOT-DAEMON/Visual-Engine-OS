import { rad } from '../../core/math';
import type { EyeSpec } from '../../schema';
import type { Vec } from './primitives';

/** Les six points de contrôle de la fente palpébrale (voir `OpeningGeometry`). */
export interface Curves {
  readonly pi: Vec;
  readonly po: Vec;
  readonly u1: Vec;
  readonly u2: Vec;
  readonly l1: Vec;
  readonly l2: Vec;
}

/** Grandeurs de base calculées par `openingGeometry`, communes à tous les styles. */
export interface StyleCtx {
  readonly s: 1 | -1;
  readonly w: number;
  readonly k: number;
  readonly hUp: number;
  readonly hLo: number;
  readonly hEff: number;
  readonly t: number;
  readonly rIn: number;
  readonly rOut: number;
}

const lerp = (a: Vec, b: Vec, f: number): Vec => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });

/** Six points de contrôle en coordonnées normalisées : x en fraction de la largeur totale, y en fraction de la hauteur. */
interface NormCurves {
  readonly pi: readonly [number, number];
  readonly po: readonly [number, number];
  readonly u1: readonly [number, number];
  readonly u2: readonly [number, number];
  readonly l1: readonly [number, number];
  readonly l2: readonly [number, number];
}

/**
 * Place des contrôles normalisés (origine en haut à gauche de la boîte englobante, côté interne à
 * gauche avant miroir) dans le repère de l'œil. `dTilt` fait pivoter l'ensemble : l'interne descend
 * de `dTilt`, l'externe monte d'autant (comme `tiltDeg` pour les autres styles).
 */
function place(n: NormCurves, x0: number, s: 1 | -1, W: number, H: number, dTilt: number): Curves {
  const at = (p: readonly [number, number]): Vec => ({ x: x0 + s * p[0] * W, y: (p[1] - 0.5) * H + dTilt * (1 - 2 * p[0]) });
  return { pi: at(n.pi), po: at(n.po), u1: at(n.u1), u2: at(n.u2), l1: at(n.l1), l2: at(n.l2) };
}

/**
 * Triangle (référence « Triangle », œil turquoise de la planche) : dessus quasi plat, fond LARGE et
 * arrondi (point bas à ~41 % depuis le canthus interne), longue diagonale externe, flanc interne en
 * arc. Ajustement aux moindres carrés de deux cubiques sur le contour de la fente relevé sur la
 * photo (écart moyen 0,6 px sur 109 px de large).
 */
const TRIANGLE: NormCurves = { pi: [0, 0.2364], po: [1, 0.0909], u1: [0.0337, -0.129], u2: [1.034, 0.0004], l1: [0.7698, 1.1045], l2: [0.1497, 1.43] };

/**
 * Chibi (grand œil arrondi façon Goku / Anya) : œil haut et long, côté externe en ARC DE DISQUE
 * (pas de bombé), coin externe étiré vers le haut-droit, coin interne légèrement pointu. Conçu à la
 * main (pas de modèle photographique) puis comparé à des variantes ; rapport h/l ≈ 0,78.
 */
const CHIBI: NormCurves = { pi: [0, 0.52], po: [1, 0.17], u1: [0, -0.26], u2: [0.72, -0.16], l1: [1.08, 0.9], l2: [0.32, 1.42] };

/**
 * Silhouettes ajoutées après les trois styles historiques (round / sharp / drooping, restés dans
 * opening.ts) : chibi, angular, circle, triangle, diamond, diamond_v2, rounded_rect. Reçoit les
 * contrôles « amande » de base et renvoie ceux du style, ou `null` si `style` n'est pas l'un d'eux.
 * Pur et sans état : le comportement est celui qu'avait la chaîne de branches d'origine (vérifié par
 * les valeurs figées de `diamond` et par les empreintes exactes des scènes d'exemple).
 */
export function extendedStyle(style: EyeSpec['shape']['style'], c: Curves, x: StyleCtx): Curves | null {
  const { s, w, k, hUp, hLo, hEff, t, rIn, rOut } = x;
  let { pi, po, u1, u2, l1, l2 } = c;

  if (style === 'chibi') {
    const W = w * 1.22;
    const t0 = Math.tan(rad(6)) * (w / 2);
    ({ pi, po, u1, u2, l1, l2 } = place(CHIBI, pi.x, s, W, hEff, ((t - t0) * W) / w));
  } else if (style === 'angular') {
    // E2 : contour supérieur presque rectiligne (montée rapide puis pente quasi droite vers la
    // pointe), coin externe effilé (relevé, contrôles bas serrés), courbures plus tendues.
    po = { x: po.x, y: po.y - w * 0.03 };
    u1 = { x: pi.x + s * w * 0.3, y: pi.y - k * hUp };
    u2 = { x: po.x - s * w * 0.3, y: po.y - k * hUp * 0.55 };
    l1 = { x: po.x - s * w * 0.26, y: po.y + k * hLo * 0.62 };
    l2 = { x: pi.x + s * w * 0.18, y: pi.y + k * hLo };
  } else if (style === 'circle') {
    // Cercle (référence « Circle ») : demi-cercles de Bézier standard — contrôles à la verticale
    // des canthi, à 4/3 de la hauteur — donc AUCUN coin : le canthus est lissé comme tout le reste.
    u1 = { x: pi.x, y: pi.y - k * hUp };
    u2 = { x: po.x, y: po.y - k * hUp };
    l1 = { x: po.x, y: po.y + k * hLo };
    l2 = { x: pi.x, y: pi.y + k * hLo };
  } else if (style === 'triangle') {
    const W = w * 1.34; // œil prolongé de 34 % côté externe (18 % puis +16 % à la demande)
    const t0 = Math.tan(rad(6)) * (w / 2); // le tilt par défaut (6°) reproduit exactement le tracé
    ({ pi, po, u1, u2, l1, l2 } = place(TRIANGLE, pi.x, s, W, hEff, ((t - t0) * W) / w));
  } else if (style === 'diamond') {
    // Diamant / parallélogramme (référence « Diamond ») : les DEUX coins aigus (~66°) sont les canthi
    // — l'interne en bas, l'externe en haut. Chaque paupière est UNE cubique dont les contrôles
    // « collent » au coin obtus voisin (haut-interne TL pour la paupière haute, bas-externe BR pour la
    // basse) : côtés et dessus presque droits, coins obtus arrondis par la courbe elle-même.
    const halfH = hEff * 0.46;
    pi = { x: pi.x, y: t + halfH };
    po = { x: po.x, y: -t - halfH };
    const TL: Vec = { x: pi.x + s * w * 0.24, y: po.y + hEff * 0.03 };
    const BR: Vec = { x: po.x - s * w * 0.24, y: pi.y - hEff * 0.03 };
    u1 = lerp(TL, pi, 0.08);
    u2 = lerp(TL, po, 0.12);
    l1 = lerp(BR, po, 0.08);
    l2 = lerp(BR, pi, 0.12);
  } else if (style === 'diamond_v2') {
    // Double retravaillé de 'diamond' d'après le croquis (mesures prises sur la référence) :
    //  - plus LONG vers l'externe (+32 % de la largeur : 16 % puis +16 % à la demande) ;
    //  - les coins aigus (canthi) ne sont PAS les extrema : l'interne est à +0,40 H et l'externe à
    //    -0,36 H, les coins obtus arrondis (haut-interne, bas-externe) portent les extrema ±0,5 H ;
    //  - le dessous est POSÉ à l'horizontale (il descend très légèrement vers l'externe, comme le
    //    croquis) au lieu de remonter vers le coin haut-externe ;
    //  - le dessus part du coin haut-interne et redescend très doucement vers le canthus externe.
    const ext = w * 0.32;
    const W = w + ext;
    const H = hEff * 1.15;
    pi = { x: pi.x, y: t + H * 0.4 };
    po = { x: po.x + s * ext, y: -t - H * 0.36 };
    const mid: Vec = { x: (pi.x + po.x) / 2, y: (pi.y + po.y) / 2 };
    // Les coins obtus sont poussés de 22 % vers l'extérieur : la cubique « coupe » ~25 % du coin, la
    // courbe passe ainsi près du coin du croquis tout en restant arrondie.
    const out = (p: Vec, f: number): Vec => ({ x: mid.x + (p.x - mid.x) * f, y: mid.y + (p.y - mid.y) * f });
    const TL: Vec = out({ x: pi.x + s * W * 0.185, y: -H * 0.5 - t * 0.5 }, 1.22);
    const BR: Vec = out({ x: po.x - s * W * 0.235, y: H * 0.5 + t * 0.5 }, 1.22);
    u1 = lerp(TL, pi, 0.08);
    u2 = lerp(TL, po, 0.12);
    l1 = lerp(BR, po, 0.08);
    l2 = lerp(BR, pi, 0.12);
  } else if (style === 'rounded_rect') {
    // Rectangle à ANGLES ARRONDIS (jamais d'angle droit) : tangentes verticales aux canthi, dessus et
    // dessous aplatis (apex à 1,02 × la hauteur visée). Un léger dépassement `ov` des contrôles
    // redresse les côtés ; plus `canthi.*.roundness` est grand, plus il est faible (coin plus rond).
    const ovIn = w * (0.05 - 0.04 * rIn);
    const ovOut = w * (0.05 - 0.04 * rOut);
    const kA = k * 1.13;
    const hU = hUp * 0.9;
    const hL = hLo * 0.9;
    u1 = { x: pi.x - s * ovIn, y: pi.y - kA * hU };
    u2 = { x: po.x + s * ovOut, y: po.y - kA * hU };
    l1 = { x: po.x + s * ovOut, y: po.y + kA * hL };
    l2 = { x: pi.x - s * ovIn, y: pi.y + kA * hL };
  } else {
    return null;
  }
  return { pi, po, u1, u2, l1, l2 };
}

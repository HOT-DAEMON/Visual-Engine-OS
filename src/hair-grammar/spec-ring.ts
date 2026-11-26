import type { Blade } from './blade';
import { viewRayInHead, type View } from './head';
import type { Light, LockGeom } from './local-geometry';
import type { LockSpec } from './lock';
import { shadeSegments, type ShadeSegment } from './ring-shade';
import { dot, norm, add, type V2, type V3 } from './vec';

/**
 * REFLET TRANSVERSAL (« anneau ») — docs/HAIR-PASS6.md, étalonné sur la référence 60 (tutoriel « dessiner les reflets en suivant la direction des mèches »).
 * Le reflet de `paint-pro.ts` est LONGITUDINAL (ruban parallèle à l'axe, collé au bord éclairé). Le tutoriel enseigne autre chose : sur un ruban, un cylindre ou un éventail, le reflet est une bande
 * TRANSVERSE à la mèche, qui la coupe presque en entier, aux bords déchiquetés dans le sens du poil, suivie côté aval d'une zone sombre qui le fait ressortir. C'est aussi la physique : la bande se
 * place là où la normale du ruban est la plus proche du vecteur médian H = norm(lumière + vue) (Blinn-Phong ; équivalent, pour un poil qui épouse le crâne, au critère de Kajiya-Kay « tangente ⟂ H »).
 *
 * Constantes MESURÉES sur les panneaux A (ruban horizontal) et B (ruban vertical) de `references/hair/60.jpg` (pixels, seuil R>190 & G>55 pour le reflet), en fraction de la longueur L du ruban :
 *   centre du reflet  0,47 / 0,46 L      → PAS une constante : il suit l'argmax de N·H (ici il tombe au milieu parce que le ruban est cylindrique) ;
 *   étendue           0,047 / 0,071 L    → `extent` 0,06 (noyau ≥ 40 % : 0,035 L, soit 0,6 de l'étendue) ;
 *   couverture largeur 0,67 / 0,91       → `coverage` 0,8 ;
 *   dentelure σ        0,010–0,020 L     → `jag` 0,015 (écart-type de la position du bord, rangée par rangée) ;
 *   ombre aval         creux −34 / −36 % (A, B) et −33 % (éventail C), mi-retour à +0,28 / +0,27 L (C : +0,30 R), retour complet à +0,42 R (C) → `shoulderLen` 0,42 (passe 7 ; la passe 6 avait 0,2 : elle mesurait la seule poche sombre).
 *                      Les paliers [1 ; 0,65 ; 0,33] × 0,42 L font tomber le mi-niveau à 0,65 × 0,42 = 0,27 L du bord du reflet. Opacité : `ring-tone.ts` (creux relatif −33 % pour tout ton) ; `shoulderOpacity` n'est plus que la valeur historique (`SHOULDER_BASE`).
 * `minNH` / `fullNH` / `bodyWidth` ne sont PAS mesurés : seuils d'ingénierie (cos 38,7°, cos 14°, 40 % de la largeur maximale), à rejuger sur les artefacts. `bodyWidth` : le centre est cherché sur le CORPS de la mèche (largeur ≥ 40 % du
 * maximum) ; sur la sonde, 5 reflets sur 19 tombaient pile sur la pointe, où la bande était coupée en deux puis écrasée.
 * Un reflet spéculaire exige une surface ÉCLAIRÉE : N·H est donc multiplié par une porte sur N·L (`lit`, 0 sous 0,02, 1 au-delà de 0,3). Sans elle, une lumière derrière la tête donnait PLUS de reflets (normales vers le haut proches du médian
 * mais non éclairées) : défaut relevé par le test « lumière derrière la tête ».
 * `minCoverage` 0,3 (ingénierie, non mesuré) : seuil sous lequel la courbure interdit la bande.
 * Constantes chiffrées : `ring-measures.ts`. Limites assumées : trois panneaux mesurés (A, B, éventail C) ; leur rapport longueur/largeur est ~4,5 contre ~9 pour une mèche, et l'on ne sait pas si l'étendue du reflet se règle sur la longueur (choix retenu : elle
 * vient de la courbure le long de la mèche) ou sur la largeur. Les valeurs sont un ordre de grandeur de l'illustrateur, pas une loi.
 */
export const RING = { extent: 0.06, coverage: 0.8, jag: 0.015, minCoverage: 0.3, teeth: 9, shoulderLen: 0.42, shoulderSteps: [1, 0.65, 0.33], shoulderOpacity: 0.12, minNH: 0.78, fullNH: 0.97, bodyWidth: 0.4 } as const;

export interface RingBands {
  /** Position du centre le long de la mèche, 0 = racine, 1 = pointe. */
  readonly at: number;
  /** Force 0–1 : 0 à `minNH`, 1 à `fullNH` (N·H au centre). */
  readonly strength: number;
  /** Étendue réelle (fraction de la longueur), couverture réelle (fraction de la largeur). */
  readonly extent: number; readonly coverage: number;
  /** +1 : zone sombre côté pointe ; −1 : côté racine. */
  readonly side: 1 | -1;
  /** Vrai si le vrai maximum de N·H tombe hors du corps (racine ou pointe amincie) : le reflet est alors posé au meilleur point du corps, plus bas que le maximum. */
  readonly peakClamped: boolean;
  readonly highlight: V2[];
  /** Ombre aval en TROIS PALIERS à bords durs (passes 6–7), conservée pour le retour arrière (`ProStyle.shoulder.profile: 'steps'`) et les planches comparatives. */
  readonly shoulder: V2[][];
  /** Ombre aval LISSE (passe 8) : segments à dégradé suivant l'axe de la mèche, profil mesuré sur la référence 60 (`ring-shade.ts`). Même longueur et même côté que `shoulder`. */
  readonly shade: ShadeSegment[];
}

const hash2 = (a: number, b: number): number => { let h = (Math.imul(Math.round(a * 97) | 0, 374761393) ^ Math.imul(Math.round(b * 97) | 0, 668265263)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
const rng = (seed: number): (() => number) => { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/** Longueurs d'arc cumulées de la spine (pixels). */
function arcs(spine: readonly V2[]): number[] { const c = [0]; for (let i = 1; i < spine.length; i++) c.push((c[i - 1] as number) + Math.hypot((spine[i] as V2).x - (spine[i - 1] as V2).x, (spine[i] as V2).y - (spine[i - 1] as V2).y)); return c; }

/** Point de la lame à l'abscisse curviligne `s` (px) et à la position latérale u ∈ [−1, 1], par interpolation linéaire entre échantillons. */
function pointAt(b: Blade, g: LockGeom, cum: readonly number[], s: number, u: number): V2 {
  const n = cum.length; const ss = Math.max(0, Math.min(cum[n - 1] as number, s)); let i = 0; while (i < n - 2 && (cum[i + 1] as number) < ss) i++;
  const span = (cum[i + 1] as number) - (cum[i] as number) || 1; const f = (ss - (cum[i] as number)) / span; const lerp = (a: number, c: number): number => a + (c - a) * f;
  const p0 = b.spine[i] as V2; const p1 = b.spine[i + 1] as V2; const n0 = g.normal[i] as V2; const n1 = g.normal[i + 1] as V2;
  const w = lerp(b.half[i] as number, b.half[i + 1] as number); const nx = lerp(n0.x, n1.x); const ny = lerp(n0.y, n1.y);
  return { x: lerp(p0.x, p1.x) + nx * u * w, y: lerp(p0.y, p1.y) + ny * u * w };
}

/**
 * Bande transversale d'une mèche, ou `null` quand elle ne regarde pas le vecteur médian (N·H < `minNH` partout), quand elle est vue par le dessous, ou quand elle est trop courte pour porter un reflet.
 * Déterministe : le bruit des bords dépend de la seule position de la racine.
 */
export function ringBands(b: Blade, g: LockGeom, _L: LockSpec, view: View, light: Light, shoulderLen: number = RING.shoulderLen): RingBands | null {
  const n = Math.min(g.n, b.spine.length); if (n < 6) return null;
  const spine = b.spine.slice(0, n); const cum = arcs(spine); const total = cum[n - 1] as number; if (total < 6) return null;
  const hs = add(light.dir, viewRayInHead(view)); if (!(Math.hypot(hs.x, hs.y, hs.z) > 1e-6)) return null; // lumière exactement en face de la caméra : vecteur médian nul, pas de reflet
  const H = norm(hs);
  // Alignement ruban/médian à chaque échantillon : 0 sur le dessous, atténué sous un recouvrement.
  const lit = (i: number): number => { const t = Math.max(0, Math.min(1, (dot(g.normal3[i] as V3, light.dir) - 0.02) / 0.28)); return t * t * (3 - 2 * t); };
  const nh = (i: number): number => (g.backface[i] ? 0 : Math.max(0, dot(g.normal3[i] as V3, H)) * lit(i) * (1 - 0.5 * (g.occlusion[i] as number)));
  // Interpolation linéaire d'un tableau d'échantillons à l'abscisse curviligne `s` : les pas de la lame ne sont PAS équidistants (rapport 2 à 5 mesuré), une proportion d'indice se tromperait.
  const lerpAt = (arr: ArrayLike<number>, s: number): number => { const ss = Math.max(0, Math.min(total, s)); let i = 0; while (i < n - 2 && (cum[i + 1] as number) < ss) i++; const f = (ss - (cum[i] as number)) / (((cum[i + 1] as number) - (cum[i] as number)) || 1); return (arr[i] as number) * (1 - f) + (arr[i + 1] as number) * f; };
  const maxHalf = Math.max(...b.half.slice(0, n)); const body = (i: number): boolean => (b.half[i] as number) >= RING.bodyWidth * maxHalf;
  let k = -1; let g0 = 0; for (let i = 0; i < n; i++) { if (nh(i) > nh(g0)) g0 = i; if (body(i) && (k < 0 || nh(i) > nh(k))) k = i; }
  if (k < 0 || nh(k) < RING.minNH) return null;
  const peakClamped = !body(g0) && nh(g0) > nh(k) + 1e-9;
  const nhArr = Array.from({ length: n }, (_, i) => nh(i));
  // Affinage du centre par parabole sur les trois échantillons autour du maximum (position sous-échantillon).
  let s0 = cum[k] as number;
  if (k > 0 && k < n - 1) { const a = nh(k - 1); const c0 = nh(k); const d = nh(k + 1); const den = a - 2 * c0 + d; if (Math.abs(den) > 1e-9) { const off = (0.5 * (a - d)) / den; const run = off >= 0 ? (cum[k + 1] as number) - (cum[k] as number) : (cum[k] as number) - (cum[k - 1] as number); s0 += Math.max(-0.5, Math.min(0.5, off)) * run; } }
  // La bande entière doit tenir dans le corps de la mèche : centre borné à [début du corps + demi-bande, fin du corps − demi-bande].
  let iLo = 0; while (iLo < n && !body(iLo)) iLo++; let iHi = n - 1; while (iHi > 0 && !body(iHi)) iHi--;
  const halfMax = (RING.extent * 1.3 * total) / 2; // demi-bande maximale (force 1)
  if ((cum[iHi] as number) - (cum[iLo] as number) < 2 * halfMax) return null; // corps trop court pour porter une bande entière
  const strength = Math.max(0, Math.min(1, (lerpAt(nhArr, s0) - RING.minNH) / (RING.fullNH - RING.minNH)));
  const ext = RING.extent * (0.7 + 0.6 * strength); const half = (ext * total) / 2;
  s0 = Math.max((cum[iLo] as number) + half, Math.min((cum[iHi] as number) - half, s0));
  // Courbure : sur une lame large qui plie court, le bord intérieur du contour se REPLIE (|κ|·demi-largeur·u > 1) et les coins de la bande tombent hors du contour émis (défaut relevé par `verify-ring.ts` : 3 mèches « mass »
  // sur 57, lumière zénithale). Couverture bornée à 0,9 / (|κ|·w) sur l'étendue de la bande ; sous `minCoverage`, la bande n'est pas lisible sur un ruban plié : pas de reflet.
  let kw = 0; for (let i = 0; i < n; i++) if ((cum[i] as number) >= s0 - half - RING.jag * 1.7 * total && (cum[i] as number) <= s0 + half + RING.jag * 1.7 * total) kw = Math.max(kw, Math.abs(g.curvature[i] as number) * (b.half[i] as number));
  const cov = Math.min(RING.coverage, kw > 0 ? 0.9 / kw : RING.coverage); if (cov < RING.minCoverage) return null;
  const rnd = rng(hash2((spine[0] as V2).x, (spine[0] as V2).y)); const m = RING.teeth;
  const halfW = (b.half.slice(0, n).reduce((a, c) => a + c, 0) / n); const jag = Math.min(RING.jag * total, 0.3 * halfW); // le bruit des bords ne doit pas pencher la bande plus que la largeur de la mèche ne le permet
  const top: V2[] = []; const bot: V2[] = [];
  for (let j = 0; j <= m; j++) {
    const u = -cov + (2 * cov * j) / m; const edge = (j === 0 || j === m) ? 0.5 : 1; // dents plus courtes aux deux bouts : la bande s'éteint avant le bord de la mèche
    top.push(pointAt(b, g, cum, s0 - half + (rnd() * 2 - 1) * jag * 1.7 * edge, u)); bot.push(pointAt(b, g, cum, s0 + half + (rnd() * 2 - 1) * jag * 1.7 * edge, u));
  }
  const highlight = [...top, ...bot.reverse()];
  // Côté de l'ombre : celui où l'exposition à la lumière baisse le plus vite (l'ombre est du côté opposé à la source).
  const exAt = (s: number): number => lerpAt(g.exposure, s);
  const dl = shoulderLen * total; const side: 1 | -1 = exAt(s0 + dl) <= exAt(s0 - dl) ? 1 : -1;
  const shoulder = RING.shoulderSteps.map((f) => {
    const a = s0 + side * half; const e = s0 + side * (half + dl * f); const lo: V2[] = []; const hi: V2[] = [];
    for (let j = 0; j <= m; j++) { const u = -0.96 + (2 * 0.96 * j) / m; lo.push(pointAt(b, g, cum, a, u)); hi.push(pointAt(b, g, cum, e, u)); }
    return [...lo, ...hi.reverse()];
  });
  const shade = shadeSegments((s, u) => pointAt(b, g, cum, s, u), s0 + side * half, side, dl, total);
  return { at: s0 / total, strength, extent: ext, coverage: cov, side, peakClamped, highlight, shoulder, shade };
}

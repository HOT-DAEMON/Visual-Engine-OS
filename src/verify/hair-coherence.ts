import { faceLandmarks } from '../face';
import { hairGeometry, type HairGeometry } from '../face/hair';
import { distanceOutsideSkull } from '../face/hair/thickness';
import { REACH } from '../face/hair/reach';
import { TIE } from '../face/hair/tie';
import { VOCAB } from '../face/hair/vocab';
import { inPoly } from '../face/poly';
import { ROOT_BAND_MIN_RATIO, ROOT_MIN_RATIO, hairAppearance, rootColorOf, shellColorOf } from '../render/face/hair-look';
import { luminance } from '../core/color';
import type { RandomFace } from '../generation/random-face';
import { check, type Check } from './types';

/**
 * COHÉRENCE CHEVEUX ↔ TÊTE, étendue (`docs/HAIR-COHERENCE.md`) : ce que `hair-skull.ts` ne voyait pas. Lit la même `HairGeometry` que le rendu ;
 * `override` = géométrie à contrôler à la place de celle du visage (contrôles négatifs).
 *
 *  GÉOMÉTRIE  — l'enveloppe réelle tient dans la portée de la coiffure :
 *    `lock-envelope-bound`  ENVELOPPE (polygone, pas l'axe) de chaque mèche construite sous borne ≤ portée latérale de la coiffure (+ tolérance du vent) ;
 *    `lock-envelope-rise`   et sa montée au-dessus du sommet ≤ portée verticale ;
 *    `envelope-coverage`    aucune mèche libre n'échappe à la borne (un constructeur oublié se verrait ici) ;
 *    `crown-covered`        le dessus du crâne est couvert par les formes de cheveux (≥ 0,78, pire mesuré 0,79 sur 342 visages) : pas de trou dans la coque ;
 *  ANATOMIE   — attaches posées sur la tête :
 *    `tie-on-skull`         une attache latérale touche le contour du crâne (≤ 0,04 W) et ne flotte pas au-dessus du sommet ;
 *    `tie-above-ear`        chignon et queue latérale au-dessus du haut de l'oreille (sinon : casque audio) ;
 *    `bun-visible`          ≥ 25 % du disque d'un chignon dépasse de la silhouette du crâne (sinon : pas de chignon de face) ;
 *    `bun-radius-bound`     rayon ≤ 0,14 W (latéral) / 0,18 W (dessus) ;
 *    `tail-spread-bound`    éventail latéral de la queue ≤ borne de `tie.ts` ; `tail-length-bound` : pas sous le bas du cou rendu ;
 *    `braid-length-bound`   tresses ≤ bas du cou + 0,15 H (la largeur de queue reste couverte par `tail-spread-bound` : voir HAIR-COHERENCE-REMAINING) ;
 *    `temples-covered`      les deux extrémités de l'implantation sont couvertes (≥ 0,5 ; mesuré 1,00 hors coupe rase) ;
 *  STYLE      — la forme est lisible et homogène :
 *    `crown-tone-not-black` la sous-couche racine ≥ 0,42 × la luminance des cheveux ;
 *    `style-vocabulary`     aucune forme hors vocabulaire de la coiffure (épis rigides sur cheveux pendants ou attachés).
 */
type Style = Exclude<RandomFace['params']['hair']['style'], 'bald'>;
const mx = (a: readonly number[]): number => a.reduce((m, v) => (v > m ? v : m), -Infinity);
const mn = (a: readonly number[]): number => a.reduce((m, v) => (v < m ? v : m), Infinity);

export function checkHairCoherence(face: RandomFace, override?: HairGeometry): Check[] {
  const p = face.params;
  if (p.hair.style === 'bald') return [];
  const lm = faceLandmarks(p, face.width, face.height);
  const geo = override ?? hairGeometry(p, lm);
  if (!geo) return [];
  const { W, H } = lm, S = geo.boundary.skull, style = p.hair.style as Style, out: Check[] = [];
  const hang = style === 'bob' || style === 'long';
  const cranial = hang ? lm.hair.sideY : Infinity;
  const power = Math.min(1, Math.hypot(p.hair.wind.x, p.hair.wind.y) * p.hair.wind.flex);
  // Tolérance de l'enveloppe : le garde-visage (`guard.fit`) ré-écarte parfois un sommet de ≤ 0,015 W après la borne (mesuré : 0,075 W pour une portée de 0,06 W).
  const tol = 0.02;

  // --- géométrie : enveloppe réelle des mèches construites sous borne ---
  const bounded = geo.locks.filter((l) => l.bounded && l.layer !== 'over' && !l.sim);
  let away = 0, rise = 0;
  for (const l of bounded) for (const q of l.poly) {
    if (q.y <= cranial) away = Math.max(away, distanceOutsideSkull(S, q) / W);
    rise = Math.max(rise, (S.topY - q.y) / H);
  }
  out.push(check('geometry', 'lock-envelope-bound', '<=', away, REACH[style].side + 0.1 * power + tol, 'l\'enveloppe d\'une mèche s\'éloigne du crâne plus que la portée de la coiffure (axe borné, polygone non)'));
  out.push(check('geometry', 'lock-envelope-rise', '<=', rise, REACH[style].up + 0.08 * power + tol, 'l\'enveloppe d\'une mèche monte plus haut que la portée de la coiffure'));
  const tied = style === 'ponytail' || style === 'bun' || style === 'braids';
  const free = geo.locks.filter((l) => !l.sim && l.layer !== 'over' && !l.part && !l.bounded && !l.comb && (l.kind === undefined || ['lock', 'fringe', 'cone', 'wisp', 'flow'].includes(l.kind)));
  // Coiffures attachées : leurs mèches de corps convergent vers l'attache, hors portée par construction (contrôlées par les contrôles d'attache).
  out.push(check('geometry', 'envelope-coverage', '<=', tied || p.hair.sim.enabled ? 0 : free.length, 0, 'une mèche libre n\'est pas bornée par la portée de la coiffure (constructeur sans `reach`)'));

  if (!p.hair.sim.enabled && p.hair.thinning <= 0.03 && style !== 'buzz') {
    const polys = [...geo.base, ...geo.locks.filter((l) => l.layer !== 'back').map((l) => l.poly)];
    const yEnd = Math.min(geo.hairline[Math.floor(geo.hairline.length / 2)]?.y ?? lm.hair.sideY, lm.hair.sideY) - 0.02 * H;
    let tot = 0, cov = 0;
    for (let y = S.topY + 0.01 * H; y < yEnd; y += 0.02 * H) {
      const a = S.a(y);
      for (let x = -0.9 * a; x <= 0.9 * a; x += 0.03 * W) {
        // Au-dessous de la ligne d'implantation LOCALE c'est le front, pas le crâne chevelu (implantation en arche : plus haute sur les côtés qu'au milieu).
        const hy = geo.hairline.reduce((b, q) => (Math.abs(q.x - x) < Math.abs(b.x - x) ? q : b)).y;
        if (y > hy - 0.02 * H) continue;
        tot++;
        if (polys.some((q) => inPoly(q, x, y))) cov++;
      }
    }
    if (tot > 0) out.push(check('geometry', 'crown-covered', '>=', cov / tot, 0.78, 'un trou sépare les cheveux du dessus du crâne (fond ou peau visible)'));
  }

  // --- anatomie : attaches ---
  const earTop = Math.min(geo.boundary.marks.earTopY.left, geo.boundary.marks.earTopY.right);
  const side = geo.ties.filter((t) => Math.abs(t.at.x) >= 0.2 * W);
  if (side.length) {
    out.push(check('anatomy', 'tie-on-skull', '<=', mx(side.map((t) => distanceOutsideSkull(S, t.at) / W)), 0.04, 'une attache latérale flotte loin du contour du crâne'));
    out.push(check('anatomy', 'tie-above-ear', '<=', mx(side.map((t) => (t.at.y - earTop) / H)), -0.009, 'une attache latérale est au niveau de l\'oreille (casque audio) ou plus bas'));
  }
  if (geo.ties.length) out.push(check('anatomy', 'tie-above-skull-top', '>=', mn(geo.ties.map((t) => (t.at.y - S.topY) / H)), -0.06, 'une attache flotte au-dessus du sommet du crâne'));
  const discs = geo.locks.filter((l) => l.part === 'bun' && l.edge && l.rank === 'main' && l.poly.length === 48);
  if (style === 'bun' && discs.length) {
    const vis = discs.map((d) => d.poly.filter((q) => q.y < S.topY || Math.abs(q.x) > S.a(q.y)).length / d.poly.length);
    out.push(check('anatomy', 'bun-visible', '>=', mn(vis), 0.25, 'le chignon est presque entièrement caché par le crâne (de face, pas de chignon)'));
    const rad = discs.map((d) => ((mx(d.poly.map((q) => q.x)) - mn(d.poly.map((q) => q.x))) / 2 / W) - (Math.abs(d.poly.reduce((a, q) => a + q.x, 0) / d.poly.length) >= 0.2 * W ? TIE.bunRadiusSide : TIE.bunRadiusTop) * 1.06);
    out.push(check('anatomy', 'bun-radius-bound', '<=', mx(rad), 0, 'le chignon est plus large que la borne anatomique (disque sans rapport avec la tête)'));
  }
  const tails = geo.locks.filter((l) => l.part === 'tail' && l.spine);
  if (style === 'ponytail' && tails.length && geo.ties.length) {
    let spread = 0, low = -Infinity, sway = 0;
    for (const l of tails) {
      // Le vent est un levier (`wind.ts` : déplacement de la pointe ≤ 0,22 · flex · |x| · L) : l'éventail admis grandit d'autant.
      const sp = l.spine as { x: number; y: number }[];
      const len = sp.reduce((a, q, i) => (i ? a + Math.hypot(q.x - (sp[i - 1] as { x: number }).x, q.y - (sp[i - 1] as { y: number }).y) : 0), 0);
      sway = Math.max(sway, (0.22 * p.hair.wind.flex * Math.abs(p.hair.wind.x) * len) / W);
      const t = geo.ties.reduce((b, c) => (Math.abs(c.at.x - (l.spine as { x: number }[])[0]!.x) < Math.abs(b.at.x - (l.spine as { x: number }[])[0]!.x) ? c : b));
      const k = Math.abs(t.at.x) >= 0.2 * W || t.at.y > S.topY + 0.06 * H ? TIE.spreadSide : TIE.spreadTop;
      for (const q of l.spine!) spread = Math.max(spread, (Math.abs(q.x - t.at.x) - k * W) / W);
      low = Math.max(low, ...l.poly.map((q) => q.y));
    }
    out.push(check('anatomy', 'tail-spread-bound', '<=', spread, 0.05 + sway, 'l\'éventail latéral de la queue dépasse la borne (la gravité doit l\'emporter)'));
    out.push(check('anatomy', 'tail-length-bound', '<=', (low - lm.neck.bottomY) / H, 0.02, 'la queue passe sous le bas du cou rendu'));
  }
  const braids = geo.locks.filter((l) => l.part === 'braid' && l.rank === 'plait');
  if (style === 'braids' && braids.length) {
    // Mesuré (tie-measure) : le point le plus bas des tresses dépasse le bas du cou de ≤ 0,092 H (p95 −0,059 H) ; borne 0,15 H.
    out.push(check('anatomy', 'braid-length-bound', '<=', (mx(braids.flatMap((l) => l.poly.map((q) => q.y))) - lm.neck.bottomY) / H, 0.15, 'une tresse pend bien plus bas que le cou (longueur sans rapport avec la tête)'));
  }
  // Tempes : les extrémités de l'implantation sont couvertes (sinon : tempe nue, coque percée) ; mesuré 1,00 sur toutes les coiffures sauf la coupe rase (≥ 0,5).
  if (!p.hair.sim.enabled && p.hair.thinning <= 0.03 && style !== 'buzz' && geo.hairline.length >= 2) {
    const polys = [...geo.base, ...geo.locks.filter((l) => l.layer !== 'back').map((l) => l.poly)];
    const ends = [geo.hairline[0]!, geo.hairline[geo.hairline.length - 1]!];
    const cov = ends.filter((e) => polys.some((q) => inPoly(q, e.x * 0.97, e.y - 0.02 * H))).length / 2;
    out.push(check('anatomy', 'temples-covered', '>=', cov, 0.5, 'une tempe est nue (l\'implantation n\'est pas couverte)'));
  }

  // --- style ---
  const ra = hairAppearance(p.hair);
  const lum = luminance(ra.base);
  out.push(check('style', 'crown-tone-not-black', '>=', lum < 0.02 ? 1 : luminance(shellColorOf(ra)) / lum, ROOT_MIN_RATIO - 0.01, 'la sous-couche racine est un casque sombre sous des mèches claires'));
  out.push(check('style', 'root-band-not-black', '>=', lum < 0.02 ? 1 : luminance(rootColorOf(ra, p.hair)) / lum, ROOT_BAND_MIN_RATIO - 0.01, 'la repousse (bande au ras du crâne) est un trou noir sous des mèches claires'));
  out.push(check('style', 'style-vocabulary', '<=', VOCAB[style].cones ? 0 : geo.locks.filter((l) => l.kind === 'cone').length, 0, 'une forme hors du vocabulaire de la coiffure (épi rigide sur cheveux pendants ou attachés)'));
  return out;
}

import { faceLandmarks } from '../face';
import { hairGeometry, type HairGeometry } from '../face/hair';
import { inPoly } from '../face/poly';
import type { RandomFace } from '../generation/random-face';
import { check, type Check } from './types';

/**
 * VÉRIFICATION DES FORMES DE CHEVEUX PAR RAPPORT AU CRÂNE (3 couches), pour toute coiffure non chauve. Lit la même `HairGeometry` que le rendu.
 *  - géométrie : tout est fini ; l'enveloppe des cheveux reste proportionnée au crâne (largeur au-delà du contour, hauteur au-dessus du sommet) ;
 *    rien ne descend sous le bas du cou rendu (mèches parasites) ;
 *  - anatomie  : la peau du visage entre sourcils et bouche n'est pas recouverte par les mèches de dessous (les occlusions `over` sont voulues) ;
 *    la hauteur de front (implantation → sourcils) est celle d'un visage (≈ un tiers de visage) ;
 *  - style     : le bord de la frange est une suite de mèches à bout ROND (pas de dents aiguës en peigne) ; l'implantation n'a ni angle vif ni
 *    marche ; les pattes ont une racine étroite (pas de bout plat).
 * `override` : géométrie à contrôler à la place de celle du visage (contrôles négatifs).
 */
const SHARP = Math.PI * 0.42;
/** Max / min sans étaler le tableau en arguments (les coiffures longues portent des dizaines de milliers de sommets). */
const maxOf = (a: number[]): number => a.reduce((m, v) => (v > m ? v : m), -Infinity);

/** Angle intérieur (rad) au sommet b de a-b-c. */
const angleAt = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): number => {
  const u = { x: a.x - b.x, y: a.y - b.y }, v = { x: c.x - b.x, y: c.y - b.y };
  return Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / ((Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y)) || 1))));
};

/** Dents aiguës d'une polyligne : sommets dont l'angle intérieur est < 75° (échantillon rééchantillonné à pas fixe pour ignorer le bruit de maillage). */
export function sharpTeeth(pts: { x: number; y: number }[], step: number): number {
  const out: { x: number; y: number }[] = [];
  let acc = 0, last = pts[0];
  if (!last) return 0;
  out.push(last);
  for (const q of pts) { acc += Math.hypot(q.x - last.x, q.y - last.y); last = q; if (acc >= step) { out.push(q); acc = 0; } }
  let n = 0;
  for (let i = 1; i < out.length - 1; i++) if (angleAt(out[i - 1]!, out[i]!, out[i + 1]!) < SHARP) n++;
  return n;
}

export function checkHairShape(face: RandomFace, override?: HairGeometry): Check[] {
  const p = face.params;
  if (p.hair.style === 'bald') return [];
  const lm = faceLandmarks(p, face.width, face.height);
  const geo = override ?? hairGeometry(p, lm);
  if (!geo) return [];
  const { H, W } = lm, b = geo.boundary, S = b.skull, out: Check[] = [];
  const own = geo.locks.filter((l) => l.layer !== 'over');
  const pts = [...geo.front.flat(), ...geo.back.flat(), ...own.flatMap((l) => l.poly)];
  const wide = p.hair.style === 'afro' || p.hair.style === 'curly';

  // --- géométrie ---
  out.push(check('geometry', 'hair-shape-finite', '==', pts.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y)) ? 1 : 0, 1, 'un sommet de cheveux n\'est pas fini'));
  // Le chignon est une pièce ATTACHÉE qui dépasse du crâne par nature (rayon 0,10–0,20 W, centre sur le flanc haut où le contour est presque vertical) : ses bornes sont `bun-radius-bound`,
  // `bun-visible` et `tie-on-skull` (`hair-coherence.ts`). Ici il ne compte pas, sinon ce contrôle jugerait le chignon et non la coque / les mèches (`docs/HAIR-NATURAL.md`).
  const ptsBody = [...geo.front.flat(), ...(geo.backBase ? geo.backBase : []), ...own.filter((l) => l.part !== 'bun').flatMap((l) => l.poly)];
  const reach = maxOf(ptsBody.filter((q) => q.y < lm.jawY).map((q) => (Math.abs(q.x) - S.a(q.y)) / W));
  out.push(check('geometry', 'hair-reach-beyond-skull', '<=', reach, wide ? 0.6 : p.hair.style === 'long' || p.hair.style === 'bob' ? 1.0 : 0.42, 'les cheveux dépassent trop le contour du crâne (aile / cône hors de proportion)', 'warn'));
  const top = (S.topY + maxOf(pts.map((q) => -q.y))) / H;
  out.push(check('geometry', 'hair-height-above-skull', '<=', top, p.hair.style === 'spiky' || wide ? 0.6 : 0.38, 'les cheveux montent trop haut au-dessus du sommet du crâne', 'warn'));
  const below = (maxOf(pts.map((q) => q.y)) - lm.neck.bottomY) / H;
  // Les coiffures qui retombent sur les épaules (long : jusqu'à ≈ 0,4 H sous le bas du cou, bob, tresses) vont sous le bas du cou rendu — le contrôle n'y est qu'un garde-fou contre
  // une mèche emballée ; les autres (queue, chignon…) ne doivent jamais le faire.
  const hangs = p.hair.style === 'long' || p.hair.style === 'bob' || p.hair.style === 'braids';
  out.push(check('geometry', 'hair-not-below-neck', '<=', below, hangs ? 0.7 : 0.02, 'des mèches sortent sous le bas du cou rendu (mèches parasites)'));

  // --- anatomie ---
  // Seules les formes dessinées APRÈS la tête (`front`) peuvent la recouvrir : la masse arrière, la queue et les tresses sont derrière elle.
  const under = geo.front, gridN = 24;
  let skin = 0, hit = 0;
  for (let i = 0; i < gridN; i++) for (let j = 0; j < gridN; j++) {
    const x = (-0.4 + (0.8 * (i + 0.5)) / gridN) * W, y = lm.eyeY - 0.05 * H + (((lm.mouthY - lm.eyeY) + 0.1 * H) * (j + 0.5)) / gridN;
    if (!b.isFace(x, y) || Math.abs(x) > S.a(y) * 0.92) continue;
    skin++;
    if (under.some((q) => inPoly(q, x, y))) hit++;
  }
  out.push(check('anatomy', 'hair-covers-face-skin', '<=', skin ? hit / skin : 0, 0.02, 'des mèches de dessous recouvrent la peau entre yeux et bouche'));
  const fh = (lm.eyeY - lm.hair.centerY) / H;
  out.push(check('anatomy', 'hair-forehead-height', '>=', fh, 0.18, 'implantation trop basse : front écrasé', 'warn'));
  out.push(check('anatomy', 'hair-forehead-height-max', '<=', fh, 0.62, 'implantation trop haute : front démesuré', 'warn'));

  // --- style ---
  const fb = geo.fringeBottom;
  out.push(check('style', 'hair-fringe-no-comb', '<=', fb ? sharpTeeth(fb, 0.012 * H) : 0, 4, 'le bord de la frange est en dents de peigne (mèches aiguës)', 'warn'));
  out.push(check('style', 'hair-hairline-no-corner', '<=', sharpTeeth(geo.hairline, 0.012 * H), 0, 'l\'implantation a un angle vif ou une marche'));
  return out;
}

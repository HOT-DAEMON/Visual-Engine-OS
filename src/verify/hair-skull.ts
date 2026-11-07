import { faceLandmarks } from '../face';
import { hairGeometry, type HairGeometry } from '../face/hair';
import { backMassBottom, backMassCloseHeight, rowExtents } from '../face/hair/back-mass';
import { isBodyLock } from '../face/hair/body-lock';
import { distanceOutsideSkull, maxShell } from '../face/hair/thickness';
import { REACH } from '../face/hair/reach';
import { backMassColor, hairAppearance } from '../render/face/hair-look';
import { luminance } from '../core/color';
import type { RandomFace } from '../generation/random-face';
import { check, type Check } from './types';

/**
 * COHÉRENCE CRÂNE ↔ CHEVEUX, trois couches (`docs/HAIR-SKULL-VERIFY.md`). Lit la même `HairGeometry` que le rendu ; `override` = géométrie à
 * contrôler à la place de celle du visage (contrôles négatifs : un défaut injecté doit être vu).
 *
 *  GÉOMÉTRIE  — la forme est un volume lisible autour du crâne :
 *    `skull-shell-bound`      distance réelle de la coque au contour du crâne ≤ épaisseur maximale de la coiffure (elle ne s'envole pas), au-dessus de l'arche de l'oreille ;
 *    `skull-dome-bound`       dôme (sommet de la coque au-dessus du crâne) ≤ épaisseur maximale ;
 *    `back-mass-no-lid`       la masse arrière n'a pas de couvercle plat : sa largeur à 6 % sous le haut est < 0,75 du maximum ;
 *    `back-mass-no-bar`       elle n'est pas un rectangle : aire / boîte ≤ 0,92 ;
 *    `back-mass-closed-bottom` bas fermé (largeur à 3 % au-dessus du bas < 0,9 du maximum) ;
 *    `back-mass-inside-hair`  la masse reste dans l'étendue des mèches de corps + 0,05 W (ne dépasse pas ce qu'elle doit doubler) ;
 *  ANATOMIE   — la forme obéit à la tête :
 *    `back-mass-above-skull`  la masse arrière recouvre le crâne : aucun trou entre elle et la tête (demi-largeur ≥ 0,97 a(y) à chaque ligne, jusqu'à la mâchoire) ;
 *    `free-reach-bound`       aucune forme libre (cône, ruban, volute) ne monte au-dessus de la portée de la coiffure ;
 *    `body-reach-bound`       aucune mèche de corps dessinée (non simulée) ne monte au-dessus de la portée de la coiffure (mèches recourbées par-dessus le sommet) ;
 *    `free-dist-bound`        ni ne s'éloigne du crâne (distance réelle au contour) au-delà de la plus grande portée de la coiffure ;
 *  STYLE      — la forme est lisible et homogène :
 *    `back-mass-not-black`    la masse arrière n'est pas plus sombre que 0,5 × la luminance des cheveux (masse noire entre les mèches) ;
 *    `back-mass-tip-visible`  des pointes de mèches dépassent sous la masse (≥ 0,02 H) : pas de bord plat nu.
 */
type Style = Exclude<RandomFace['params']['hair']['style'], 'bald'>;
const mx = (a: readonly number[]): number => a.reduce((m, v) => (v > m ? v : m), -Infinity);
const mn = (a: readonly number[]): number => a.reduce((m, v) => (v < m ? v : m), Infinity);

export function checkHairSkull(face: RandomFace, override?: HairGeometry): Check[] {
  const p = face.params;
  if (p.hair.style === 'bald') return [];
  const lm = faceLandmarks(p, face.width, face.height);
  const geo = override ?? hairGeometry(p, lm);
  if (!geo) return [];
  const { W, H } = lm, S = geo.boundary.skull, style = p.hair.style as Style, out: Check[] = [];
  const maxT = maxShell(style, W);

  // --- géométrie ---
  const base = geo.base[0] ?? [];
  // L'arche de l'oreille (patte qui contourne l'oreille) sort du contour du crâne par construction : l'oreille dépasse de la face. La borne porte sur le crâne proprement dit, au-dessus de l'arche.
  const archY = Math.min(geo.boundary.marks.earTopY.left, geo.boundary.marks.earTopY.right) - 0.03 * H;
  const thick = mx(base.filter((q) => q.y < Math.min(lm.jawY, archY)).map((q) => distanceOutsideSkull(S, q)));
  out.push(check('geometry', 'skull-shell-bound', '<=', Math.max(0, thick), maxT + 0.5, 'la coque s\'éloigne du contour du crâne de plus que l\'épaisseur anatomique de la coiffure'));
  const dome = S.topY - mn(base.map((q) => q.y));
  out.push(check('geometry', 'skull-dome-bound', '<=', Math.max(0, dome), maxT + 0.5, 'le dôme de la coque dépasse l\'épaisseur anatomique de la coiffure'));

  const bb = geo.backBase;
  if (bb && bb.length > 4) {
    const ys = bb.map((q) => q.y), y0 = mn(ys), y1 = mx(ys), span = y1 - y0 || 1;
    // Largeur exacte à la ligne y (intersection des arêtes) : ne dépend pas de l'espacement des sommets.
    const widthAt = (y: number): number => { const e = rowExtents([bb], y, 1, 1); return Number.isFinite(e.lo[0]) ? (e.hi[0] as number) - (e.lo[0] as number) : 0; };
    const wmax = Math.max(1e-6, mx(Array.from({ length: 24 }, (_, i) => widthAt(y0 + (i / 23) * span))));
    out.push(check('geometry', 'back-mass-no-lid', '<=', widthAt(y0 + 0.06 * span) / wmax, 0.75, 'la masse arrière a un couvercle plat au niveau des tempes (« oreilles de chat »)'));
    let a = 0;
    for (let i = 0; i < bb.length; i++) { const u = bb[i]!, v = bb[(i + 1) % bb.length]!; a += u.x * v.y - v.x * u.y; }
    const xs = bb.map((q) => q.x);
    out.push(check('geometry', 'back-mass-no-bar', '<=', Math.abs(a / 2) / ((mx(xs) - mn(xs)) * span), 0.92, 'la masse arrière est un rectangle (aire / boîte trop proche de 1)'));
    out.push(check('geometry', 'back-mass-closed-bottom', '<=', widthAt(y1 - 0.03 * span) / wmax, 0.9, 'le bas de la masse arrière est plat (non fermé)'));
    // Étendue des mèches de corps (avant + arrière) : la masse ne doit pas dépasser ce qu'elle double.
    const body = geo.locks.filter((l) => l.layer !== 'over' && isBodyLock(l)).map((l) => l.poly);
    const n = 40, dy = span / (n - 1), ext = rowExtents(body, y0, dy, n);
    let over = 0;
    for (const q of bb) {
      const r = Math.min(n - 1, Math.max(0, Math.round((q.y - y0) / dy)));
      const e = Math.max(Math.abs(ext.lo[r] as number), Math.abs(ext.hi[r] as number));
      if (Number.isFinite(e)) over = Math.max(over, (Math.abs(q.x) - e) / W);
    }
    out.push(check('geometry', 'back-mass-inside-hair', '<=', over, 0.05, 'la masse arrière dépasse l\'étendue des mèches de corps'));

    // --- anatomie : la masse recouvre le crâne (aucun trou entre elle et la tête), largeur interpolée exactement à chaque ligne ---
    const rows = 48, dyR = span / (rows - 1), own = rowExtents([bb], y0, dyR, rows);
    let hole = 0;
    for (let r = 0; r < rows; r++) {
      const y = y0 + r * dyR;
      if (y < y0 + 0.08 * span || y > lm.jawY || y > y1 - backMassCloseHeight(lm, y1)) continue; // hors fermeture du bas (resserrée à dessein, cachée par le visage)
      const half = Math.min(own.hi[r] as number, -(own.lo[r] as number));
      if (Number.isFinite(half)) hole = Math.max(hole, (0.97 * S.a(y) - half) / W);
    }
    out.push(check('anatomy', 'back-mass-above-skull', '<=', Math.max(0, hole), 0.01, 'un trou sépare la masse arrière de la tête (fond visible entre eux)'));

    // --- style : teinte et pointes ---
    const ra = hairAppearance(p.hair);
    const ink = p.hair.sim.enabled && p.hair.sim.ink;
    // Cheveux déjà presque noirs (luminance < 0,02) : le rapport n'a pas de sens, aucune masse ne peut y être « plus sombre » que les mèches.
    const lumBase = luminance(ra.base);
    if (!ink) out.push(check('style', 'back-mass-not-black', '>=', lumBase < 0.02 ? 1 : luminance(backMassColor(ra)) / lumBase, 0.5, 'la masse arrière est une tache noire (≪ luminance des cheveux)', 'warn'));
    const tips = mx(geo.locks.filter((l) => l.layer === 'back' && isBodyLock(l)).flatMap((l) => l.poly.map((q) => q.y)));
    const bottom = backMassBottom(lm, geo.locks.filter((l) => l.layer === 'back' && isBodyLock(l)).map((l) => l.poly));
    if (bottom !== null) out.push(check('style', 'back-mass-tip-visible', '>=', (tips - mx(bb.map((q) => q.y))) / H, 0.02, 'aucune pointe ne dépasse sous la masse arrière (bord plat nu)', 'warn'));
  }

  // --- anatomie : formes libres bornées par la coiffure ---
  const free = geo.locks.filter((l) => l.layer !== 'over' && (l.kind === 'cone' || l.kind === 'wisp' || (l.kind === 'flow' && !l.sim)));
  const rise = free.length ? (S.topY - mn(free.flatMap((l) => l.poly.map((q) => q.y)))) / H : 0;
  out.push(check('anatomy', 'free-reach-bound', '<=', rise, REACH[style].up + 0.025, 'une forme libre monte plus haut que la portée de la coiffure', 'warn'));
  // Mèches tirées vers une attache (queue, chignon, tresses) : leur point de départ est l'attache, hors portée par construction : coiffures attachées exclues.
  const tied = style === 'ponytail' || style === 'bun' || style === 'braids';
  const body = geo.locks.filter((l) => l.layer !== 'over' && l.sim !== true && l.kind === 'lock' && !tied);
  const bodyRise = body.length ? (S.topY - mn(body.flatMap((l) => l.poly.map((q) => q.y)))) / H : 0;
  out.push(check('anatomy', 'body-reach-bound', '<=', bodyRise, REACH[style].up + 0.025, 'une mèche de corps monte plus haut que la portée de la coiffure (recourbée par-dessus le sommet)', 'warn'));
  let away = 0;
  for (const l of free) for (const q of l.poly) away = Math.max(away, distanceOutsideSkull(S, q));
  out.push(check('anatomy', 'free-dist-bound', '<=', away, Math.max(REACH[style].up * H, REACH[style].side * W) + 0.03 * W, 'une forme libre s\'éloigne du crâne (distance réelle) plus que la portée de la coiffure', 'warn'));
  return out;
}

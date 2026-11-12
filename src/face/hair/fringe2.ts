import { clamp } from '../../core/math';
import type { Vec } from '../../geometry/eye/primitives';
import { groupTips, layoutBlades, type BladeSpec } from './fringe-blades';
import { lockFrom, type HairCtx } from './flow';
import { pieceCtx, splitByAspect } from './fringe-split';
import type { HairLock } from './types';

/** Résultat du moteur de frange : mèches, bord inférieur (de droite à gauche). Jamais de masse pleine : le front reste visible entre les mèches. */
export interface FringeEngineResult {
  readonly locks: HairLock[];
  readonly bottom: Vec[];
}

/**
 * MOTEUR GÉNÉRIQUE de frange : un seul constructeur de mèche (`blade`) ; les modes ne font que choisir le nombre, la
 * largeur, la pointe, la longueur et la position du JOUR. Tout est relatif à la ligne d'implantation réelle et à la
 * limite des sourcils (`guard.yF`) : aucune mèche ne descend sous `yF`, quelle que soit la forme du front.
 */
export function engineFringe(ctx: HairCtx): FringeEngineResult | null {
  const { h, lm, hl, guard, rnd } = ctx;
  const fe = h.fringeEngine;
  if (fe.mode === 'off' || h.style === 'buzz' || h.style === 'bald') return null;
  const { H, W } = lm;
  const yF = guard.yF;
  const xF = guard.hw(yF) * 0.985;
  const side = fe.side >= 0 ? 1 : -1;
  const tone = (): number => -(0.04 + 0.3 * rnd()) * h.highlight;
  const blades: BladeSpec[] = [];
  /** Ordonnée de pointe : fraction `f` de l'espace disponible entre l'implantation (en x) et la limite des sourcils. */
  // Marge de 0,016 H au-dessus de la limite des sourcils : l'empreinte réelle d'un œil (cils, pli, sourcil) dépasse un peu la limite nominale.
  const yAt = (x: number, f: number): number => hl.yAt(x) + 0.012 * H + f * (yF - 0.016 * H - hl.yAt(x) - 0.012 * H);
  // Jour central : le front reste visible entre les mèches de part et d'autre (demi-largeur ∝ `gap`).
  const gc = (rnd() - 0.5) * 0.35 * xF;
  const gw = fe.gap * 0.34 * xF;

  if (fe.mode === 'sheer') {
    // Fils individuels : beaucoup de mèches fines, 2–4 fenêtres sans fils (la peau du front se voit).
    const n = fe.count || Math.round(70 + 40 * (1 - fe.gap));
    const holes = Array.from({ length: 2 + Math.floor(fe.gap * 3) }, () => ({ c: (rnd() * 2 - 1) * xF, w: (fe.gap * 0.5 * xF) / 2 }));
    for (let i = 0; i < n; i++) {
      const x = -xF + (2 * xF * (i + rnd())) / n;
      if (holes.some((q) => Math.abs(x - q.c) < q.w) && rnd() < 0.88) continue;
      const w0 = W * (0.0038 + 0.0042 * rnd());
      blades.push({ xRoot: x, xTip: x + (rnd() - 0.5) * 0.02 * W + side * 0.012 * W, yTip: yAt(x, 0.5 + 0.5 * rnd() ** 0.7), w0, rank: w0 < 0.0045 * W ? 'hairline' : 'fine', profile: 'ribbon', power: 1, fade: 0.55, ragged: 0, sharp: 0.85, rootW: 0.8 });
    }
  } else if (fe.mode === 'blades') {
    // Touffes continues (`docs/HAIR-BLADES.md`, `fringe-blades.ts`). Les valeurs `pre` de `rnd` sont tirées UNE fois, dans l'ordre d'avant ; ATTENTION : plus de touffes = plus de tirages dans `lockFrom`, le reste de la chevelure change à graine égale (`docs/HAIR-BLADES.md`).
    const n = fe.count || 5 + Math.floor(rnd() * 3);
    const pre = Array.from({ length: n }, () => ({ a: rnd(), b: rnd(), c: rnd() }));
    blades.push(...layoutBlades({ n, pre, xF, xW: W, gc, gw, side, seed: h.seed, yAt }));
  } else if (fe.mode === 'wispy') {
    // Mèches fines étagées, pointes très irrégulières.
    const n = fe.count || 26 + Math.floor(rnd() * 10);
    for (let i = 0; i < n; i++) {
      const x = -xF + (2 * xF * (i + rnd())) / n;
      if (Math.abs(x - gc) < gw * 0.6 && rnd() < 0.7) continue;
      blades.push({ xRoot: x, xTip: x + (rnd() - 0.5) * 0.05 * W, yTip: yAt(x, 0.3 + 0.7 * rnd()), w0: ((2 * xF) / n) * (1.8 + rnd()), rank: 'fine', profile: 'ribbon', power: 1, fade: 0.5, ragged: 0.1, sharp: 0.45, rootW: 1 });
    }
    // Les hauteurs de pointe étaient tirées une à une : un bord en scie (profondeur moyenne entre deux voisines ≠ la leur). Lissage [¼ ½ ¼] ×2 le long de x : les tirages ne changent pas.
    const ys = blades.map((b) => b.yTip);
    for (let pass = 0; pass < 2; pass++) { const c = ys.slice(); for (let i = 1; i < ys.length - 1; i++) ys[i] = 0.25 * (c[i - 1] as number) + 0.5 * (c[i] as number) + 0.25 * (c[i + 1] as number); }
    blades.forEach((b, i) => { blades[i] = { ...b, yTip: ys[i] as number }; });
  } else {
    // Frange asymétrique : de grandes mèches balayées jusqu'au sourcil du côté `side`, courtes de l'autre (front ouvert). MAJ (`docs/HAIR-FRINGE-CLUMPS.md`) : mèches en RUBAN effilé
    // (et non en cône large : un grand coin plat posé en diagonale sur le front), plus nombreuses et plus étroites, balayage moins transversal (la pointe ne traverse plus tout le front).
    const n = fe.count || 11;
    for (let i = 0; i < n; i++) {
      const long = i < Math.ceil(n / 2);
      const x = long ? -side * xF * (0.15 + 0.7 * rnd()) : side * xF * (0.1 + 0.8 * rnd());
      const xTip = long ? x + side * xF * (0.12 + 0.34 * rnd()) : x + side * 0.03 * W;
      blades.push({ xRoot: x, xTip, yTip: yAt(xTip, long ? 0.88 + 0.12 * rnd() : 0.25 + 0.3 * rnd()), w0: ((2 * xF) / n) * (1.1 + 0.5 * rnd()), rank: 'main', profile: 'ribbon', power: 1, fade: 0, ragged: 0.3, sharp: 0.7, rootW: 0.9 });
    }
    // Rubans voisins resserrés en touffes de 3 à 4 (pointe commune à 85 %) : 11 rubans indépendants faisaient 10 à 14 pointes distinctes (`docs/HAIR-NATURAL-FRINGE.md`).
    blades.splice(0, blades.length, ...groupTips(blades, gc, 3, 0.85));
  }

  const locks: HairLock[] = [];
  for (const [bi, b] of blades.entries()) {
    // Courbe quadratique racine → pointe : tangente de départ quasi verticale, la mèche « tombe » puis se rabat.
    const R = { x: b.xRoot, y: hl.yAt(b.xRoot) - 0.012 * H };
    const E = { x: b.xTip, y: b.yTip };
    const C = { x: b.xRoot + (b.xTip - b.xRoot) * 0.2, y: R.y + 0.6 * (E.y - R.y) };
    const c = Array.from({ length: 10 }, (_, j) => {
      const t = j / 9;
      return { x: (1 - t) ** 2 * R.x + 2 * (1 - t) * t * C.x + t * t * E.x, y: (1 - t) ** 2 * R.y + 2 * (1 - t) * t * C.y + t * t * E.y };
    });
    const tn = tone();
    splitByAspect(c, b.w0).forEach((pc, k) => locks.push(...lockFrom(pieceCtx(ctx, bi, k), pc.centre, { width: pc.width, rank: b.rank, tone: tn, layer: 'front', mode: 'fringe', raw: true, kind: 'fringe', profile: b.profile, power: b.power, sharp: b.sharp, root: b.rootW, fade: Math.max(b.fade, h.tips.fade), edgeFade: h.tips.edgeFade, ragged: Math.max(b.ragged, h.tips.irregular), flick: h.tips.flick * 0.5, reach: 'cranial' }).map((l): HairLock => ({ ...l, bang: true }))));
  }
  // Bord inférieur de droite à gauche : le point le plus bas des pointes proches de chaque abscisse (jamais sous yF).
  const bottom = Array.from({ length: 49 }, (_, i) => {
    const x = (1 - (2 * i) / 48) * xF;
    const near = blades.filter((b) => Math.abs(b.xTip - x) < xF / 12);
    return { x, y: clamp(near.length ? Math.max(...near.map((b) => b.yTip)) : hl.yAt(x) + 0.02 * H, hl.yAt(x), yF) };
  });
  return { locks, bottom };
}

import { clamp } from '../../core/math';
import type { Vec } from '../../geometry/eye/primitives';
import { lockFrom, type HairCtx } from './flow';
import type { HairLock, LockRank } from './types';

/** Résultat du moteur de frange : mèches, bord inférieur (de droite à gauche). Jamais de masse pleine : le front reste visible entre les mèches. */
export interface FringeEngineResult {
  readonly locks: HairLock[];
  readonly bottom: Vec[];
}

interface BladeSpec {
  readonly xRoot: number;
  readonly xTip: number;
  readonly yTip: number;
  readonly w0: number;
  readonly rank: LockRank;
  readonly profile: 'ribbon' | 'cone';
  readonly power: number;
  readonly fade: number;
  readonly ragged: number;
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
  const away = (x: number): number => (x < gc ? -1 : 1);

  if (fe.mode === 'sheer') {
    // Fils individuels : beaucoup de mèches fines, 2–4 fenêtres sans fils (la peau du front se voit).
    const n = fe.count || Math.round(70 + 40 * (1 - fe.gap));
    const holes = Array.from({ length: 2 + Math.floor(fe.gap * 3) }, () => ({ c: (rnd() * 2 - 1) * xF, w: (fe.gap * 0.5 * xF) / 2 }));
    for (let i = 0; i < n; i++) {
      const x = -xF + (2 * xF * (i + rnd())) / n;
      if (holes.some((q) => Math.abs(x - q.c) < q.w) && rnd() < 0.88) continue;
      const w0 = W * (0.0038 + 0.0042 * rnd());
      blades.push({ xRoot: x, xTip: x + (rnd() - 0.5) * 0.02 * W + side * 0.012 * W, yTip: yAt(x, 0.5 + 0.5 * rnd() ** 0.7), w0, rank: w0 < 0.0045 * W ? 'hairline' : 'fine', profile: 'ribbon', power: 1, fade: 0.55, ragged: 0 });
    }
  } else if (fe.mode === 'blades') {
    // Quelques grandes mèches triangulaires pointues ; le côté `side` descend jusqu'au sourcil, l'autre reste plus court.
    const n = fe.count || 5 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      let x = -xF + (2 * xF * (i + 0.5)) / n;
      if (Math.abs(x - gc) < gw) x = gc + away(x) * gw; // une racine ne reste pas dans le jour : elle se range au bord
      const long = Math.sign(x) === side;
      blades.push({ xRoot: x, xTip: x + away(x) * (0.04 + 0.12 * rnd()) * xF, yTip: yAt(x, long ? 0.9 + 0.1 * rnd() : 0.5 + 0.3 * rnd()), w0: ((2 * xF) / n) * (1.3 + 0.4 * rnd()), rank: 'main', profile: 'cone', power: 1.05, fade: 0, ragged: 0 });
    }
  } else if (fe.mode === 'wispy') {
    // Mèches fines étagées, pointes très irrégulières.
    const n = fe.count || 26 + Math.floor(rnd() * 10);
    for (let i = 0; i < n; i++) {
      const x = -xF + (2 * xF * (i + rnd())) / n;
      if (Math.abs(x - gc) < gw * 0.6 && rnd() < 0.7) continue;
      blades.push({ xRoot: x, xTip: x + (rnd() - 0.5) * 0.05 * W, yTip: yAt(x, 0.3 + 0.7 * rnd()), w0: ((2 * xF) / n) * (1.8 + rnd()), rank: 'fine', profile: 'cone', power: 1.3, fade: 0.5, ragged: 0.8 });
    }
  } else {
    // Frange asymétrique : de grandes mèches balayées jusqu'au sourcil du côté `side`, courtes de l'autre (front ouvert).
    const n = fe.count || 7;
    for (let i = 0; i < n; i++) {
      const long = i < Math.ceil(n / 2);
      const x = long ? -side * xF * (0.15 + 0.7 * rnd()) : side * xF * (0.1 + 0.8 * rnd());
      const xTip = long ? side * xF * (0.15 + 0.6 * rnd()) : x + side * 0.03 * W;
      blades.push({ xRoot: x, xTip, yTip: yAt(xTip, long ? 0.88 + 0.12 * rnd() : 0.25 + 0.3 * rnd()), w0: ((2 * xF) / n) * (1.5 + 0.5 * rnd()), rank: 'main', profile: 'cone', power: 1.1, fade: 0, ragged: 0.3 });
    }
  }

  const locks: HairLock[] = [];
  for (const b of blades) {
    // Courbe quadratique racine → pointe : tangente de départ quasi verticale, la mèche « tombe » puis se rabat.
    const R = { x: b.xRoot, y: hl.yAt(b.xRoot) - 0.012 * H };
    const E = { x: b.xTip, y: b.yTip };
    const C = { x: b.xRoot + (b.xTip - b.xRoot) * 0.2, y: R.y + 0.6 * (E.y - R.y) };
    const c = Array.from({ length: 10 }, (_, j) => {
      const t = j / 9;
      return { x: (1 - t) ** 2 * R.x + 2 * (1 - t) * t * C.x + t * t * E.x, y: (1 - t) ** 2 * R.y + 2 * (1 - t) * t * C.y + t * t * E.y };
    });
    locks.push(...lockFrom(ctx, c, { width: b.w0, rank: b.rank, tone: tone(), layer: 'front', mode: 'fringe', raw: true, kind: 'fringe', profile: b.profile, power: b.power, sharp: 0.85, fade: Math.max(b.fade, h.tips.fade), edgeFade: h.tips.edgeFade, ragged: Math.max(b.ragged, h.tips.irregular), flick: h.tips.flick * 0.5 }));
  }
  // Bord inférieur de droite à gauche : le point le plus bas des pointes proches de chaque abscisse (jamais sous yF).
  const bottom = Array.from({ length: 49 }, (_, i) => {
    const x = (1 - (2 * i) / 48) * xF;
    const near = blades.filter((b) => Math.abs(b.xTip - x) < xF / 12);
    return { x, y: clamp(near.length ? Math.max(...near.map((b) => b.yTip)) : hl.yAt(x) + 0.02 * H, hl.yAt(x), yF) };
  });
  return { locks, bottom };
}

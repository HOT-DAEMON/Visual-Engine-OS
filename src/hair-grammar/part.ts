import type { HeadSpec, View } from './head';
import type { LockSpec } from './lock';
import { observeStructure } from './observe-structure';
import { headEllipse, referenceFromPainted } from './reference-fit';
import { paintLock } from './paint';
import type { HairProfile } from './grammar';
import { clamp, norm, rad, v3 } from './vec';

/**
 * RAIE — une ligne de crâne à découvert, le long de la calotte, à la position latérale `x` (unités H, repère de TÊTE : 0 = milieu, ±rx = bord), de part et d'autre de
 * laquelle les mèches s'écartent. Deux effets coordonnés, sur les mèches du dessus (élévation de racine ≥ 40°) :
 *  1. COULOIR : une racine dont la position latérale (rx·cos(él)·sin(az)) tombe à moins de `gap` de la raie est repoussée au bord du couloir, de son côté ;
 *  2. ÉCOULEMENT : le cap reçoit une composante latérale (1,2 contre la raie, décroissant en e^(−d/0,25) jusqu’à 0,6) qui s'éloigne de la raie (cheveux de gauche vers la gauche, de droite vers la droite).
 * Les mèches filles, programmées ou arrière ne sont pas touchées (leur racine est imposée par leur mère). Mesure : `measureArt(...).part` (observation de la calotte rendue).
 */
export function applyPart(h: HeadSpec, specs: readonly LockSpec[], x: number, gap = 0.05): LockSpec[] {
  const xp = clamp(x, -0.7 * h.rx, 0.7 * h.rx);
  return specs.map((L) => {
    if (L.parent || L.program || L.shellRoot || L.layer === 'back' || L.root.el < 40) return L;
    const cosEl = Math.cos(rad(L.root.el)); const xr = h.rx * cosEl * Math.sin(rad(L.root.az)); const side = xr >= xp ? 1 : -1;
    let az = L.root.az;
    // Le couloir est mesuré sur la LAME : une mèche large (masse de 0,3 H) dégage la raie de sa demi-largeur, pas d'une valeur fixe.
    const g = Math.max(gap, 0.4 * L.width + 0.01);
    if (Math.abs(xr - xp) < g) { const target = xp + side * g; az = (Math.asin(clamp(target / (h.rx * cosEl), -1, 1)) * 180) / Math.PI; }
    return { ...L, root: { el: L.root.el, az }, aim: norm(v3(L.aim.x + (0.6 + 0.6 * Math.exp(-Math.abs(xr - xp) / 0.25)) * side, L.aim.y, L.aim.z)) };
  });
}

export interface ArtMeasure { readonly fringe: number; readonly part: { readonly u: number; readonly clarity: number }; readonly tips: number; readonly gloss: number }

/** Mesures des axes d'art direction sur une coiffure rendue (lecture de la même observation structurée que pour une référence). */
export function measureArt(P: HairProfile, specs: readonly LockSpec[], view: View, size = { w: 156, h: 150 }): ArtMeasure {
  const E = headEllipse(P, view); const R = referenceFromPainted(specs.map((L) => paintLock(P.head, L, view)), size.w, size.h, E); const S = observeStructure(R, E); // le crâne cache les mèches arrière : sans cela elles comblent le sillon
  const roots = specs.filter((s) => !s.parent).length; const kids = specs.filter((s) => s.parent && s.width < 0.5 * (specs.find((m) => m.id === s.parent?.id)?.width ?? 1) && s.strands === 0).length;
  return { fringe: S.fringe, part: S.part, tips: roots ? kids / roots : 0, gloss: S.gloss.share };
}

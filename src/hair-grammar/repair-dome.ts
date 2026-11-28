import { bladeOutline } from './blade';
import { fillPoly, makeGrid, type Grid } from './compose-grid';
import { domeMask } from './dome';
import { familyOf, sampleLock, type HairProfile } from './grammar';
import { aimOnShell, type View } from './head';
import { defectCost, lockDefects, visibleMarks } from './lock-check';
import type { LockSpec } from './lock';
import { paintLock } from './paint';
import { PART_HALF, crossesPart, partLinePoints } from './part-line';
import { norm, prng, v3, type V2 } from './vec';

export { PART_HALF };

/**
 * REMPLISSAGE DE CALOTTE — `anat.dome` est un défaut GLOBAL : aucune mèche n'est fautive, il en MANQUE une. Le cycle de réparation ne traitait que les défauts
 * portés par une mèche, si bien que ce défaut restait tel quel (mesuré : avec une raie à −0,3, 9 cas sur 42 en dessous de 0,70, jusqu'à 36 %).
 * Cause trouvée sur les rendus : `applyPart` pousse TOUTES les mèches du dessus de côté, la frange comprise, qui glisse alors autour du crâne au lieu de
 * retomber sur le front ; les racines se concentrent au sommet et tout le front reste nu. Un coiffeur n'y laisserait que la raie.
 * Réparation : on prend la plus grande zone nue de la calotte, on pose AU-DESSUS d'elle (là où sa mèche naît) une mèche de la famille dominante dont le cap
 * descend à travers la zone, et on garde, parmi des dizaines de candidats évalués sur la trame (≈ 1 ms chacun), celui qui comble le plus de cellules nues.
 * Garde-fous : jamais sur un œil, le nez ou la bouche (mêmes prédicats que le solveur local) ; couloir de la raie demandée INTERDIT, pour que la raie
 * reste une ligne de crâne à découvert entre deux rideaux et non un trou. Le seuil de couverture n'est PAS touché.
 */
export interface DomeFill { readonly spec: LockSpec; readonly gain: number; readonly corridor: number; readonly tried: number; readonly root: { readonly el: number; readonly az: number }; readonly lat: number }

/** Couloir de la raie en repère image : la ligne `x = xp` sur la calotte (élévation 30°–89°, `partLinePoints`) épaissie de ±`half` H, rasterisée sur la trame de la vue. */
export function partCorridor(P: HairProfile, view: View, xp: number, g: Grid, half = PART_HALF): Uint8Array {
  const T = makeGrid(g.nx * g.cell, g.ny * g.cell, g.cell); const pts: V2[] = partLinePoints(P.head, view, xp);
  const w = half * view.s; fillPoly(T, [...pts.map((p) => ({ x: p.x - w, y: p.y })), ...[...pts].reverse().map((p) => ({ x: p.x + w, y: p.y }))], 1);
  return T.data;
}

/** Plus grande composante connexe (4-voisinage) de cellules nues de la calotte : ses cellules et sa boîte (indices de cellule). */
function largestBare(g: Grid, bare: (i: number) => boolean): { cells: number; x0: number; x1: number; y0: number; y1: number } | null {
  const seen = new Uint8Array(g.data.length); let best: { cells: number; x0: number; x1: number; y0: number; y1: number } | null = null;
  for (let s = 0; s < g.data.length; s++) {
    if (seen[s] || !bare(s)) continue;
    const st = [s]; seen[s] = 1; let n = 0; let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
    while (st.length) {
      const i = st.pop() as number; const x = i % g.nx; const y = (i / g.nx) | 0; n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const xx = x + dx; const yy = y + dy; if (xx < 0 || yy < 0 || xx >= g.nx || yy >= g.ny) continue; const j = yy * g.nx + xx; if (!seen[j] && bare(j)) { seen[j] = 1; st.push(j); } }
    }
    if (!best || n > best.cells) best = { cells: n, x0, x1, y0, y1 };
  }
  return best;
}

/** Cap latéral (ajouté à `aim.x`) essayé pour chaque racine : la mèche peut retomber droit ou s'écarter d'un côté ou de l'autre. */
const LATERAL = [-0.5, -0.25, 0, 0.25, 0.5] as const;
/** Longueurs essayées (unités H) en plus de celle tirée par la famille : une zone nue haute demande une mèche plus longue que la moyenne de la famille. */
const LENGTHS = [0, 0.5, 0.65] as const;

/**
 * Propose UNE mèche qui comble la plus grande zone nue de la calotte, ou `null` (aucune zone ≥ 4 cellules, aucun candidat qui gagne sans recouvrir un repère).
 * `g` est la trame de la vue actuelle (`Composition.grid`) ; `family` la famille dominante (`Composition.masses[0]`) ; `k` l'indice de l'ajout (graine, identifiant).
 */
export function proposeDomeFill(P: HairProfile, specs: readonly LockSpec[], view: View, g: Grid, family: string, seed: number, k: number, partX?: number): DomeFill | null {
  const h = P.head; const F = familyOf(P, family); if (!F) return null;
  const mask = domeMask(h, view, g); const bare = (i: number): boolean => mask[i] === 1 && !g.data[i];
  const zone = largestBare(g, bare); if (!zone || zone.cells < 4) return null;
  const corridor = partX === undefined ? null : partCorridor(P, view, partX, g); const dome = domeMask(h, view, g);
  const marks = visibleMarks(h, view); const base = sampleLock(P, F, 300 + k, prng(seed * 131 + k * 17 + 5));
  const used = new Set(specs.map((s) => s.id)); let id = `${F.id}-dome${k}`; for (let n = 0; used.has(id); n++) id = `${F.id}-dome${k}x${n}`;
  const cx = (i: number): number => (i + 0.5) * g.cell;
  let best: DomeFill | null = null; let tried = 0;
  // Racines : cinq abscisses dans la largeur de la zone, trois hauteurs AU-DESSUS de sa première rangée (la mèche naît dans la chevelure et traverse la zone).
  for (const fx of [0.15, 0.35, 0.5, 0.65, 0.85]) for (const up of [0, 2, 5]) {
    const x = cx(zone.x0 + (zone.x1 - zone.x0) * fx); const y = cx(zone.y0) - up * g.cell;
    const at = aimOnShell(h, view, x, y, 0.03); if (!at || at.el < 15) continue;
    for (const lat of LATERAL) for (const len of LENGTHS) {
      const cand: LockSpec = { ...base, id, root: { el: at.el, az: at.az }, aim: norm(v3(base.aim.x + lat, base.aim.y, base.aim.z)), length: len || base.length };
      const p = paintLock(h, cand, view); tried++;
      // Test EXACT du couloir (la trame à 3 px ne voit pas une lame qui mord le bord de la ligne : mesuré, des mèches de remplissage la recouvraient).
      if (partX !== undefined && crossesPart(h, view, p, partX) > 0) continue;
      if (defectCost(lockDefects(h, view, p, marks, undefined, 0.03 * view.s)) > 0) continue; // ni œil, ni nez, ni bouche, ni axe qui se coupe
      const T = makeGrid(g.nx * g.cell, g.ny * g.cell, g.cell); fillPoly(T, bladeOutline(p.blade), 1);
      let gain = 0; let over = 0;
      for (let i = 0; i < T.data.length; i++) { if (!T.data[i]) continue; if (bare(i)) gain++; if (corridor && corridor[i] && dome[i]) over++; }
      // Chaque cellule du couloir recouverte coûte 4 cellules de gain : la raie prime sur la couverture d'une cellule isolée.
      // Le couloir de la raie est une contrainte DURE : une mèche qui le traverse est refusée (la raie reste une ligne de crâne à découvert entre deux rideaux).
      if (over > 0 || gain < 4 || gain <= (best?.gain ?? 0)) continue;
      best = { spec: cand, gain, corridor: over, tried, root: at, lat };
    }
  }
  return best ? { ...best, tried } : null;
}

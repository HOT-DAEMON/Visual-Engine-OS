import { domePredicate } from './dome';
import { familyOf, sampleLock, type HairProfile } from './grammar';
import { aimOnShell, type View } from './head';
import { defectCost, lockDefects, visibleMarks, type Marks } from './lock-check';
import type { LockSpec } from './lock';
import { paintLock } from './paint';
import { PART_HALF, crossesPart, partLinePoints, partTangent, partOpenness, partSamples, summarize, withLock, type PartLine } from './part-line';
import { awayEdits, sideOf, type PartEdit } from './part-edits';
import { localCost, refreshChildren } from './repair-local';
import { clamp, norm, prng, v3, type V2 } from './vec';

/**
 * FAÇONNER LA RAIE — la raie demandée doit être un SILLON : un couloir à découvert (aucune lame dessus) entre deux rideaux de mèches qui se rejoignent près de lui. `applyPart` ne fait que pousser les racines
 * et le cap ; mesuré sur la génération brute (6 graines × 3 positions), il laissait 16 cas sur 18 avec une FENÊTRE chauve (0,24–0,59 rx de large) et non un sillon : l'ancienne mesure lisait la colonne la plus vide
 * et prenait cette fenêtre pour une raie. Deux étapes, dans cet ordre :
 *  1. DÉGAGER : chaque mèche qui recouvre le couloir reçoit l'édition la moins chère (cap latéral, racine, largeur, longueur — du côté où elle naît) qui le libère, à condition de ne créer aucun défaut
 *     d'œil, de nez ou de bouche (`localCost`) ;
 *  2. REFERMER LES FLANCS : tant que l'ouverture moyenne diminue et que la netteté est sous la cible, on ajoute un rideau de la famille dominante, né
 *     près de la ligne, sans jamais recouvrir le couloir (évaluation exacte et incrémentale, `part-line.ts`).
 * Les mêmes briques servent à la réparation (`repair.ts`) : la raie reste un sillon après le cycle, pas seulement à la génération.
 */
export type { PartEdit };
export interface PartShape { readonly specs: LockSpec[]; readonly moved: number; readonly added: number; readonly before: PartLine; readonly after: PartLine }

/** Cible de netteté à la génération (la vérification exige 0,6 : la marge absorbe les retouches du cycle de réparation). */
export const PART_TARGET = 0.8;
const MAX_FLANK_LOCKS = 8;

/** Mèche de la famille dominante parmi celles du dessus (racine ≥ 40°, ni filles ni arrière) : c'est elle qui forme les rideaux. */
export function curtainFamilies(specs: readonly LockSpec[]): string[] {
  const n = new Map<string, number>(); for (const L of specs) if (!L.parent && L.layer !== 'back' && L.root.el >= 40) n.set(L.family, (n.get(L.family) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f);
}
/** Famille dominante des mèches de dessus (celle qui donne son style au rideau) ; `null` sans mèche. */
export const curtainFamily = (specs: readonly LockSpec[]): string | null => curtainFamilies(specs)[0] ?? null;
/** Familles essayées par tour de `closeFlanks` : la dominante ne suffit pas (« mass » tire des mèches de 0,33 H qui ne laissent aucun gain), on essaie les plus fréquentes et on garde le meilleur. */
const CURTAIN_FAMILIES = 3;

/** Étape 1 : libère le couloir. Renvoie les mèches (éditées) et le nombre de mèches déplacées. */
export function clearCorridor(P: HairProfile, specs: readonly LockSpec[], view: View, xp: number, marks: Marks = visibleMarks(P.head, view)): { specs: LockSpec[]; moved: number } {
  let cur = [...specs]; let moved = 0;
  const ids = partOpenness(P.head, view, cur.map((L) => paintLock(P.head, L, view)), xp).covering.map((c) => c.id);
  for (const id of ids) {
    const idx = cur.findIndex((s) => s.id === id); const L = cur[idx]; if (!L || L.parent) continue;
    const parent = undefined; const base = localCost(P, L, view, marks, parent); let best: { S: LockSpec; n: number } | null = null; const n0 = crossesPart(P.head, view, paintLock(P.head, L, view), xp);
    for (const e of awayEdits(sideOf(P.head, L, xp))) {
      const S = e.apply(L); if (S === L) continue;
      if (localCost(P, S, view, marks, parent) > base + 1e-9) continue; // pas de nouvel œil / nez / bouche recouvert
      const n = crossesPart(P.head, view, paintLock(P.head, S, view), xp);
      if (n < (best?.n ?? n0)) best = { S, n };
      if (n === 0) break;
    }
    if (best) { cur = refreshChildren(P, cur.map((s, i) => (i === idx ? (best as { S: LockSpec }).S : s)), id); moved++; }
  }
  return { specs: cur, moved };
}

/**
 * Paramètres des rideaux candidats : rang de la racine depuis le sommet de la ligne, largeur de mèche (unités H, bornée par celle de la famille — la famille « mass » tire des mèches de 0,45 H, qui ne peuvent pas
 * longer un couloir de 0,07 H), marge entre le bord du couloir et le bord intérieur du rideau (la distance de racine en découle : `PART_HALF` + largeur / 2 + marge), cap latéral, longueur.
 */
const CURTAIN_RANK = [0, 2, 4, 6, 8] as const; const CURTAIN_WIDTH = [0.12, 0.2, 0.3] as const; const CURTAIN_MARGIN = [0, 0.015] as const; const CURTAIN_LAT = [-0.3, 0, 0.3] as const; const CURTAIN_LEN = [0, 0.6] as const;
/** But de la recherche : l'EXCÈS au-dessus du plafond de sillon (ce qui fait échouer un échantillon) domine, l'ouverture moyenne départage et guide tant qu'un côté manque encore. */
const goalOf = (l: PartLine): number => 10 * l.excess + l.meanOpen;
const MIN_GAIN = 0.0015;
/** Élévation de la racine au-dessus de l'échantillon visé (unités H) : une racine posée À l'échantillon le plus haut laisse l'ouverture du sommet de la calotte intacte (la lame naît là et descend). */
const CURTAIN_RISE = [0, 0.04, 0.08] as const;

/**
 * Étape 2 : ferme les flancs. À chaque tour : lecture exacte de la raie, puis, pour chaque côté, des rideaux candidats nés près de la ligne (distance, hauteur, cap, longueur) ; on garde celui qui
 * RÉDUIT le plus l'excès d'ouverture (`goalOf`) sans recouvrir le couloir ni un repère du visage (évaluation incrémentale : `withLock`). On s'arrête à la netteté cible, au plafond, ou faute de gain ≥ `MIN_GAIN` H.
 */
export function closeFlanks(P: HairProfile, specs: readonly LockSpec[], view: View, xp: number, seed: number, target = PART_TARGET, max = MAX_FLANK_LOCKS): { specs: LockSpec[]; added: number } {
  const h = P.head; const marks = visibleMarks(h, view); let cur = [...specs]; let added = 0;
  const top = partLinePoints(h, view, xp).filter((q) => domePredicate(h, view)(q.x, q.y)).sort((a, b) => a.y - b.y); if (!top.length) return { specs: cur, added };
  for (let k = 0; k < max; k++) {
    const S = partSamples(h, view, cur.map((L) => paintLock(h, L, view)), xp); const line = summarize(S); if (line.clarity >= target) break;
    const fams = curtainFamilies(cur).slice(0, CURTAIN_FAMILIES).map((id) => familyOf(P, id)).filter((f): f is NonNullable<typeof f> => !!f); if (!fams.length) break;
    const used = new Set(cur.map((s) => s.id)); let best: { spec: LockSpec; goal: number } | null = null;
    for (const F of fams) {
      const base = sampleLock(P, F, 400 + k, prng(seed * 131 + k * 17 + 9)); let id = `${F.id}-part${k}`; for (let n = 0; used.has(id); n++) id = `${F.id}-part${k}x${n}`;
      for (const side of [-1, 1] as const) for (const rank of CURTAIN_RANK) {
        const q = top[Math.min(rank, top.length - 1)] as V2;
        for (const rise of CURTAIN_RISE) for (const wid of CURTAIN_WIDTH) for (const m of CURTAIN_MARGIN) {
          const w = Math.min(wid, base.width); const at = aimOnShell(h, view, q.x + side * (PART_HALF + w / 2 + m) * view.s, q.y - rise * view.s, 0.03); if (!at || at.el < 15) continue;
          const tan = partTangent(h, xp, at.el); // le rideau longe la ligne, vers le front : son cap est la tangente 3D de la raie
          for (const lat of CURTAIN_LAT) for (const len of CURTAIN_LEN) {
            const spec: LockSpec = { ...base, id, width: w, root: { el: at.el, az: at.az }, aim: norm(v3(tan.x + lat, tan.y, tan.z)), length: len || base.length };
            const p = paintLock(h, spec, view); if (defectCost(lockDefects(h, view, p, marks, undefined, 0.03 * view.s)) > 0) continue;
            const a = summarize(withLock(S, p)); if (a.bare < line.bare - 1e-9) continue; // jamais sur le couloir
            const goal = goalOf(a); if (!best || goal < best.goal) best = { spec, goal };
          }
        }
      }
    }
    if (!best || best.goal > goalOf(line) - MIN_GAIN) break;
    cur = [...cur, best.spec]; added++;
  }
  return { specs: cur, added };
}

/** Raie demandée → mèches : dégager le couloir, puis fermer les flancs. `xp` : position latérale, unités H, repère de tête. */
export function shapePart(P: HairProfile, specs: readonly LockSpec[], view: View, xp: number, seed: number): PartShape {
  const xc = clamp(xp, -0.7 * P.head.rx, 0.7 * P.head.rx); const line = (s: readonly LockSpec[]): PartLine => partOpenness(P.head, view, s.map((L) => paintLock(P.head, L, view)), xc);
  const before = line(specs); const a = clearCorridor(P, specs, view, xc); const b = closeFlanks(P, a.specs, view, xc, seed);
  return { specs: b.specs, moved: a.moved, added: b.added, before, after: line(b.specs) };
}

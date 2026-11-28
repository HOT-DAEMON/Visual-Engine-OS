import { landmarks, project, type HeadSpec, type View } from './head';
import { rootShell, walk, type LockSpec } from './lock';
import { relationsOf } from './occlusion';
import { paintLock, type PaintedLock } from './paint';
import type { Check, Report } from './verify';
import type { V2 } from './vec';

/**
 * COUCHE DE VÉRIFICATION DES ATTACHES (chignon, queue, tresse) — s'ajoute à `verifyComposed` (mèches, calotte, hiérarchie) pour ce que celui-ci ne voit pas : une attache est un OBJET
 * posé sur le crâne. Trois couches, mêmes `Report` que le reste du moteur ; sans attache dans la coiffure, le rapport est vide (ok). Seuils issus de `scripts/hair-grammar/measure-buns.py`
 * (réf. 04 : diamètre d'un chignon ≈ 0,40 Hc ± 0,05, centre au niveau du sommet du crâne) et de la contrainte anatomique de `docs/HAIR-TIE.md` (attache AU-DESSUS de l'oreille, jamais sur le visage).
 *   géométrie : le chignon est borné (largeur 0,28–0,62 H) ; la queue est ancrée sur la coque et descend (pointe ≥ 0,3 H sous la racine) ;
 *   anatomie  : le centre du chignon est ≥ 0,25 H au-dessus de la ligne des yeux et de l'oreille ; le nœud est derrière le plan des oreilles pour la queue (|azimut| ≥ 150°) ;
 *   style     : le chignon est ROND (rapport hauteur / largeur 0,55–1,3) ; chaque tresse a ≥ 2 croisements francs entre ses brins (mesuré : 2 à 3 de face pour 3 brins, 4 périodes ; le seuil 3, essayé d'abord, rejetait la tresse droite dont l'oscillation est en partie dans l'axe de profondeur).
 */
const chk = (name: string, value: number, min: number, max: number): Check => ({ name, value, min, max, ok: Number.isFinite(value) && value >= min && value <= max });
const rep = (layer: Report['layer'], checks: Check[]): Report => ({ layer, checks, ok: checks.every((c) => c.ok) });

/** Boîte image (en H) de l'ensemble des lames des mèches `specs`. */
function boxOf(painted: readonly PaintedLock[], pred: (L: LockSpec) => boolean, s: number): { w: number; h: number; cx: number; cy: number } | null {
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  for (const p of painted) if (pred(p.spec)) for (const q of [...p.blade.left, ...p.blade.right] as V2[]) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
  return Number.isFinite(x0) ? { w: (x1 - x0) / s, h: (y1 - y0) / s, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 } : null;
}

export function verifyAttach(h: HeadSpec, specs: readonly LockSpec[], view: View, painted: readonly PaintedLock[] = specs.map((L) => paintLock(h, L, view))): Report[] {
  const G: Check[] = []; const A: Check[] = []; const S: Check[] = [];
  const lm = landmarks(h); const eyeY = project(view, lm.eyeR).y; const earY = project(view, lm.earR).y;
  // ── Chignons : une boîte par côté (familles `bun…L` / `bun…R`) ou une seule (`bun`).
  const sides = [['L', /^bun(L|Body)?$|^bunL/], ['R', /^bunR/]] as const;
  const hasBun = specs.some((L) => L.family.startsWith('bun'));
  if (hasBun) {
    const groups = specs.some((L) => L.family.startsWith('bunL') || L.family.startsWith('bunR')) ? sides.map(([n, re]) => [n, (L: LockSpec): boolean => re.test(L.family)] as const) : ([['', (L: LockSpec): boolean => L.family.startsWith('bun')]] as const);
    for (const [n, pred] of groups) {
      const b = boxOf(painted, pred, view.s); if (!b) continue;
      G.push(chk(`chignon ${n}: largeur (H)`.replace(' :', ':'), b.w, 0.28, 0.62));
      A.push(chk(`chignon ${n}: centre au-dessus de la ligne des yeux (H)`, (eyeY - b.cy) / view.s, 0.25, 2), chk(`chignon ${n}: centre au-dessus de l'oreille (H)`, (earY - b.cy) / view.s, 0.25, 2));
      S.push(chk(`chignon ${n}: rondeur (hauteur / largeur)`, b.h / b.w, 0.55, 1.3));
    }
  }
  // ── Queue : racine derrière l'oreille, ancrée sur la coque, qui descend.
  const tail = specs.filter((L) => L.family === 'tail');
  if (tail.length) {
    const azs = tail.map((L) => Math.abs((rootShell(h, L).az * 180) / Math.PI)); const drops = tail.map((L) => { const w = walk(h, L, 20); return (w.at(-1)?.p.y ?? 0) - (w[0]?.p.y ?? 0); });
    A.push(chk('queue : azimut de la racine, min |°| (derrière l\'oreille)', Math.min(...azs), 150, 180));
    G.push(chk('queue : descente de la pointe sous la racine, min (H)', Math.min(...drops), 0.3, 2));
  }
  // ── Tresses : groupes `weave` ; croisements francs entre brins d'un MÊME groupe.
  const groups = [...new Set(specs.filter((L) => L.weave).map((L) => L.weave as string))];
  if (groups.length) {
    const rel = relationsOf(painted).filter((r) => r.kind === 'cross');
    for (const g of groups) { const n = rel.filter((r) => (painted[r.a] as PaintedLock).spec.weave === g && (painted[r.b] as PaintedLock).spec.weave === g).length; S.push(chk(`tresse ${g}: croisements francs entre brins`, n, 2, 60)); }
  }
  return [rep('geometry', G), rep('anatomy', A), rep('style', S)];
}

export const attachOk = (r: readonly Report[]): boolean => r.every((x) => x.ok);

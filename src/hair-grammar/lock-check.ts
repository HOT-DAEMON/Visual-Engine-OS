import { bladeOutline } from './blade';
import { emergenceContinuity } from './emerge';
import { facing, landmarks, project, type HeadSpec, type View } from './head';
import type { LockSpec } from './lock';
import type { PaintedLock } from './paint';
import type { Report } from './verify';
import { inPoly } from '../face/poly';
import type { V2 } from './vec';

/**
 * CONTRÔLES LOCAUX D'UNE MÈCHE — les prédicats de géométrie et d'anatomie qui ne dépendent QUE de la mèche (et de sa mère), extraits de
 * `compose-verify.ts` pour être partagés : la vérification globale les applique à toute la coiffure, le solveur local (`repair-local.ts`) à un seul
 * candidat (≈ 1 ms contre ≈ 120 ms pour une vérification globale). Un défaut local ne dépend d'aucune autre mèche : le corriger sur la mèche seule est exact.
 */
export interface Defect {
  readonly code: string; readonly layer: Report['layer']; readonly lock?: string; readonly family?: string; readonly severity: number; readonly detail: string;
  /** Part (0–1) de la lame réellement visible (ordre de peinture : tête, mèches de devant). Absente tant que la visibilité n'a pas été mesurée (`visibility.ts`). */
  readonly visible?: number;
}

/** Seuil de visibilité d'un repère : en dessous, la tête le cache (mesuré : sans ce filtre, `anat.eye` passait de 0,75 à 2 défauts par coiffure entre 0° et 75°). */
export const SEEN = 0.2;

export const segHit = (a: V2, b: V2, c: V2, d: V2): boolean => { const o = (p: V2, q: V2, r: V2): number => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };

/** Nombre de croisements de l'axe avec lui-même (segments non adjacents). */
export function spineCrossings(sp: readonly V2[]): number {
  let x = 0;
  for (let i = 0; i < sp.length - 1; i++) for (let j = i + 2; j < sp.length - 1; j++) if (segHit(sp[i] as V2, sp[i + 1] as V2, sp[j] as V2, sp[j + 1] as V2)) x++;
  return x;
}

/** Repères du visage VISIBLES sous la vue, projetés dans l'image : centres des yeux, bout du nez, centre de la bouche. */
export interface Marks { readonly eyes: readonly V2[]; readonly face: readonly { readonly name: string; readonly q: V2 }[] }
export function visibleMarks(h: HeadSpec, view: View): Marks {
  const lm = landmarks(h);
  return {
    eyes: [lm.eyeR, lm.eyeL].filter((e) => facing(h, view, e) > SEEN).map((e) => project(view, e) as V2),
    face: ([['le bout du nez', lm.noseTip], ['la bouche', lm.mouth]] as const).filter(([, m]) => facing(h, view, m) > SEEN).map(([name, m]) => ({ name, q: project(view, m) as V2 })),
  };
}

/** Une mèche recouvre un repère si sa lame le contient ; les mèches `back` (derrière la tête) ne comptent ni pour les yeux (famille) ni pour le visage (couche). */
export const coversEye = (p: PaintedLock, e: V2, clear = 0): boolean => p.spec.family !== 'back' && covers(p, e, clear);
export const coversFace = (p: PaintedLock, q: V2, clear = 0): boolean => p.layer !== 'back' && covers(p, q, clear);
/** `clear` > 0 : le repère est un petit disque de rayon `clear` (px) — centre et quatre points cardinaux. La vérification globale reste au centre (`clear` = 0). */
function covers(p: PaintedLock, q: V2, clear: number): boolean {
  const o = bladeOutline(p.blade);
  if (inPoly(o, q.x, q.y)) return true;
  return clear > 0 && (inPoly(o, q.x + clear, q.y) || inPoly(o, q.x - clear, q.y) || inPoly(o, q.x, q.y + clear) || inPoly(o, q.x, q.y - clear));
}

/**
 * Croisements de l'axe AUTORISÉS : une mèche sans programme n'en a aucun ; un programme sans boucle garde l'exemption historique (entrelacs, ondes) ;
 * un programme à boucles en autorise 2 par tour (une boucle fermée coupe son axe une fois, un enroulement de n tours n fois ou n+1).
 */
export function allowedCrossings(L: LockSpec): number {
  if (!L.program) return 0;
  const loops = L.program.filter((s) => s.kind === 'loop');
  return loops.length ? loops.reduce((a, s) => a + 2 * Math.ceil(s.turns ?? 1), 0) : Infinity;
}

/** Défauts LOCAUX d'une mèche : finitude, lame dégénérée, auto-intersection de l'axe, émergence (si la mère est fournie), yeux, nez et bouche recouverts. */
export function lockDefects(h: HeadSpec, view: View, p: PaintedLock, marks: Marks, parent?: LockSpec, clear = 0): Defect[] {
  const D: Defect[] = []; const id = p.spec.id; const family = p.spec.family;
  const pts = [...p.blade.spine, ...p.blade.left, ...p.blade.right];
  if (pts.some((q) => !Number.isFinite(q.x) || !Number.isFinite(q.y))) return [{ code: 'geom.finite', layer: 'geometry', lock: id, family, severity: 3, detail: 'point non fini' }];
  const first = p.blade.spine[0] as V2; const last = p.blade.spine.at(-1) as V2;
  if (Math.hypot(last.x - first.x, last.y - first.y) < 0.05 * view.s) D.push({ code: 'geom.degenerate', layer: 'geometry', lock: id, family, severity: 2, detail: 'axe plus court que 5 % de la hauteur de tête' });
  const x = spineCrossings(p.blade.spine);
  if (x > allowedCrossings(p.spec)) D.push({ code: 'geom.self', layer: 'geometry', lock: id, family, severity: p.layer === 'back' ? 0.25 : 1, detail: `${x} auto-intersection(s) de l'axe` });
  if (parent) { const c = emergenceContinuity(h, parent, p.spec); if (c.gap > 0.01 || c.angleDeg > 12 || c.widthRatio > 0.5) D.push({ code: 'geom.emerge', layer: 'geometry', lock: id, family, severity: 2, detail: `jonction : écart ${c.gap.toFixed(3)}, angle ${c.angleDeg.toFixed(0)}°, largeur ${c.widthRatio.toFixed(2)}` }); }
  for (const e of marks.eyes) if (coversEye(p, e, clear)) D.push({ code: 'anat.eye', layer: 'anatomy', lock: id, family, severity: 2, detail: 'recouvre le centre d\'un œil' });
  for (const m of marks.face) if (coversFace(p, m.q, clear)) D.push({ code: 'anat.face', layer: 'anatomy', lock: id, family, severity: 2, detail: `recouvre ${m.name}` });
  return D;
}

export const defectCost = (d: readonly Defect[]): number => d.reduce((s, x) => s + x.severity, 0);

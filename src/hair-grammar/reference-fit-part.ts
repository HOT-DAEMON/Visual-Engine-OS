import { project, viewRayInHead, type View } from './head';
import type { HairProfile } from './grammar';
import { observePart, type PartObservation } from './observe-part';
import type { Reference } from './observe';
import { paintLock } from './paint';
import { applyPart } from './part';
import { shapePart } from './part-shape';
import { fitFromReference, headEllipse, referenceFromPainted, type FitOptions, type ReferenceFit } from './reference-fit';
import { clamp, rad } from './vec';

/**
 * RAIE LUE SUR UNE RÉFÉRENCE → INTENTION `part` (docs/HAIR-PASS6.md). L'observateur de sillon (`observe-part.ts`) existait depuis la passe 5, mais
 * rien ne lui faisait nourrir l'ajustement : `fitFromReference` ignorait la raie de la référence. Ici :
 *  1. on lit le sillon de la référence ; il n'est retenu que s'il est NET (`groove` et netteté ≥ `PART_READ_MIN`) — un sillon incertain ne doit pas inventer une raie ;
 *  2. sa position image est convertie en position de CRÂNE (repère de tête) par inversion exacte de la projection, valable à tout lacet (à 0°, l'identité) ;
 *  3. la raie est appliquée À CHAQUE TOUR de l'ajustement (`applyPart` puis `shapePart`) : elle change l'espace négatif mesuré, donc le poids estimé ;
 *  4. la même position est transmise à la vérification et à la réparation, pour que le couloir reste libre après le cycle.
 * Option de l'appelant (`part: 'auto' | nombre | false`) : par défaut `'auto'` ici ; `fitFromReference` seul reste inchangé au bit près.
 */
export const PART_READ_MIN = 0.5;
/** Élévation de crâne (°) où la raie est lue. À 47° la ligne x = xp existe jusqu'à ±0,68 rx (rx·cos 47°), presque toute la plage permise ±0,7 rx ; à 60° elle saturait à ±0,5 rx. */
const READ_EL = 47;

/** Raie lue (unités rx, repère image) → position de crâne (unités H, repère de tête) : `undefined` si le sillon n'est pas net. */
export function partFromObservation(o: PartObservation, P: HairProfile, view: View): number | undefined {
  if (!o.groove || o.clarity < PART_READ_MIN) return undefined;
  return imageUToSkull(P, view, o.u);
}

/**
 * Inversion de la projection : x image = cx + u·rx  →  xp tel que la ligne de crâne x = xp passe par ce point à l'élévation `READ_EL`.
 * Balayage fin (pas de 2·10⁻⁴ H) restreint aux points TOURNÉS VERS LA CAMÉRA (normale de l'ellipsoïde · rayon de vue > 0) : à fort lacet la projection de la
 * ligne n'est plus monotone (la calotte s'enroule) et une bissection se tromperait de branche. Sans point visible : repli sur l'identité u·rx.
 */
export function imageUToSkull(P: HairProfile, view: View, u: number): number {
  const h = P.head; const c = Math.cos(rad(READ_EL)); const s = Math.sin(rad(READ_EL)); const ray = viewRayInHead(view);
  const cx = project(view, { x: 0, y: 0, z: h.cz }).x; const target = cx + u * h.rx * view.s;
  const lim = Math.min(0.7 * h.rx, 0.999 * h.rx * c); const N = 1400; let best = Infinity; let bx = clamp(u, -0.7, 0.7) * h.rx;
  for (let i = 0; i <= N; i++) {
    const xp = -lim + (2 * lim * i) / N; const az = Math.asin(clamp(xp / (h.rx * c), -1, 1));
    const p = { x: h.rx * c * Math.sin(az), y: -h.ry * s, z: h.cz + h.rz * c * Math.cos(az) };
    const nx = p.x / (h.rx * h.rx); const ny = p.y / (h.ry * h.ry); const nz = (p.z - h.cz) / (h.rz * h.rz); const m = Math.hypot(nx, ny, nz) || 1;
    if ((nx * ray.x + ny * ray.y + nz * ray.z) / m <= 0) continue;
    const d = Math.abs(project(view, p).x - target); if (d < best) { best = d; bx = xp; }
  }
  return bx;
}

export interface PartFit extends ReferenceFit {
  /** Lecture de la raie : sillon observé sur la référence, position retenue (repère de tête, unités H) ou `undefined`, sillon observé sur le résultat. */
  readonly partRead: { readonly observed: PartObservation; readonly part: number | undefined; readonly final: PartObservation };
}

export interface PartFitOptions extends Omit<FitOptions, 'shape' | 'part'> {
  /** `'auto'` (défaut) : lire la raie sur la référence ; un nombre : position imposée en demi-largeurs de tête (convention d'`Intent.part`, ±0,7 max) ; `false` : aucune raie. */
  readonly part?: 'auto' | number | false;
}

export function fitFromReferencePart(P: HairProfile, R: Reference, view: View, o: PartFitOptions = {}): PartFit {
  const seed = o.seed ?? 1; const E = headEllipse(P, view); const observed = observePart(R, E);
  const mode = o.part ?? 'auto';
  const part = mode === false ? undefined : typeof mode === 'number' ? clamp(mode, -0.7, 0.7) * P.head.rx : partFromObservation(observed, P, view);
  const { part: _drop, ...rest } = o; void _drop;
  const fit = fitFromReference(P, R, view, {
    ...rest,
    ...(part !== undefined ? { part, shape: (specs: Parameters<NonNullable<FitOptions['shape']>>[0], profile: HairProfile) => shapePart(profile, applyPart(profile.head, specs, part), view, part, seed).specs } : {}),
  });
  const final = observePart(referenceFromPainted(fit.specs.map((L) => paintLock(P.head, L, view)), R.w, R.h, E), E);
  // `Intent.part` est en demi-largeurs de tête (× rx) : c'est la même convention que `generateIntended`.
  return { ...fit, intent: part !== undefined ? { ...fit.intent, part: part / P.head.rx } : fit.intent, partRead: { observed, part, final } };
}

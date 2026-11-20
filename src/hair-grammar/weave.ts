import type { HeadSpec } from './head';
import { rootShell, rotAbout, type LockSpec } from './lock';
import { shellNormal, shellPoint, toShell } from './shell';
import { add, clamp, cross, dot, mul, norm, sub, type V3 } from './vec';

/**
 * AUTEUR D'ENTRELACS (`weaveStrands`) — pose UN GROUPE de brins qui se croisent en alternance (deux brins en torsade, trois en tresse…),
 * produits par le moteur lui-même et non fabriqués à la main. Chaque brin porte un programme à UN segment `weave` :
 *  - cap : θ(u) = amp·(cos 2π(f·u+φ) − cos 2πφ), avec la direction de départ tournée de α = amp·cos 2πφ autour de la normale de racine, de sorte
 *    que le cap ABSOLU est amp·cos 2π(f·u+φ) : un déplacement latéral y(u) = Y·sin 2π(f·u+φ) CENTRÉ sur l'axe du groupe (Y = amp·L / 2πf) ;
 *  - racine : décalée latéralement de y(0) = Y·sin 2πφ, pour que chaque brin parte de SA position dans l'entrelacs ;
 *  - décollement : `lift·cos 2π(f·u+φ)` (même phase que le cap) — au croisement de deux brins, celui qui monte passe devant : l'alternance
 *    de profondeur est ainsi ÉCRITE dans la géométrie, là où `occlusion.ts` la lit (une onde `wave` seule ne le fait pas : elle dérive d'un côté).
 * Les brins du groupe portent la même étiquette `weave` : seuls ceux-là imposent un ordre local (`imposes`).
 * Phases : φ_k = k/n (n = 2 → 0 et ½, croisement à chaque demi-période ; n = 3 → tresse classique).
 */
export interface WeaveOpts {
  /** Nombre de brins (2–5, défaut 2). */
  readonly strands?: number;
  /** Amplitude latérale Y (unités H) : demi-largeur de l'entrelacs. */
  readonly spread: number;
  /** Nombre de périodes sur la longueur (défaut 2 → 3 croisements pour 2 brins). */
  readonly freq?: number;
  /** Oscillation de décollement (unités H, défaut 0,03 — au-dessus du seuil `GAP_MIN` d'un croisement franc). */
  readonly lift?: number;
  /** Étiquette du groupe (défaut `<id>-weave`). */
  readonly group?: string;
  /** Écart de ton entre brins voisins (défaut 0 : l'appelant colore). */
  readonly toneStep?: number;
}

export function weaveStrands(h: HeadSpec, base: LockSpec, o: WeaveOpts): LockSpec[] {
  const n = clamp(Math.round(o.strands ?? 2), 2, 5); const f = o.freq ?? 2; const lift = o.lift ?? 0.03; const group = o.group ?? `${base.id}-weave`;
  const amp = clamp((2 * Math.PI * f * o.spread) / Math.max(1e-6, base.length), 0, 1.1);
  const r0 = rootShell(h, base); const n0 = shellNormal(h, r0.y, r0.az); const ref0 = norm(sub(base.aim, mul(n0, dot(base.aim, n0)))); const lat = norm(cross(n0, ref0));
  const P0 = shellPoint(h, r0.y, r0.az);
  return Array.from({ length: n }, (_, k): LockSpec => {
    const phase = k / n; const y0 = o.spread * Math.sin(2 * Math.PI * phase); const alpha = amp * Math.cos(2 * Math.PI * phase);
    const root: V3 = add(P0, mul(lat, y0)); const sh = toShell(h, root);
    return {
      ...base, id: `${base.id}-s${k}`, weave: group, shellRoot: sh, aim: rotAbout(ref0, n0, alpha), tone: clamp(base.tone + (k - (n - 1) / 2) * (o.toneStep ?? 0), -1, 1),
      // Racine assez haute pour que le décollement oscillant (±lift) ne rentre jamais dans le crâne.
      lift0: Math.max(base.lift0, lift + 0.01), lift1: Math.max(base.lift1, lift + 0.01),
      program: [{ kind: 'weave', len: 1, amp, freq: f, phase, lift }],
    };
  });
}

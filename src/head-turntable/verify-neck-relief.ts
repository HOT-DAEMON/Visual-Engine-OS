import { markColor, neckReliefOf, neckMark } from './engines/neck-relief';
import { paletteOf } from './face-tex';
import { neckSection } from './engines/neck3d';
import { REGION, type HeadTurnSpec, type TurnRender } from './types';
import { check, type Check } from './verify-types';

/** Angles ψ (rad, côté x > 0, 0 = face antérieure, π = nuque) des points marqués sur la rangée y du cou : même paramétrisation que `neck/geometry.sectionPoint`. */
function marked(spec: HeadTurnSpec, y: number): number[] {
  const e = spec.engine!, s = neckSection(e, y, spec.neck.y1), out: number[] = [];
  for (let i = 1; i <= 150; i++) { const psi = (i / 150) * Math.PI; if (neckMark(spec, { x: s.a * Math.sin(psi), y, z: s.zc + s.b * Math.cos(psi) })) out.push(psi); }
  return out;
}

/**
 * Contrôles ANATOMIQUES des reliefs du cou 3D (SCM, platysma, clavicule : `engines/neck-relief.ts`, lus du moteur de cou). Seule la LECTURE du moteur est vérifiée, jamais une géométrie recopiée :
 *  - l'insertion basse du SCM est près du creux sus-sternal (manubrium) : ξ ∈ [0,06 ; 0,6] sur la rangée au-dessus de la base ;
 *  - son attache haute est LATÉRALE (apophyse mastoïde, derrière et sous l'oreille) : ξ ≥ 0,45 sur la rangée haute, et ne remonte pas au-dessus du lobe ;
 *  - couverture : ni vide quand le moteur en prévoit, ni invasive (< 12 % de la face antérieure) ;
 *  - rendu : des pixels marqués existent réellement dans l'image à 0° (la lecture arrive jusqu'au pixel).
 */
export function neckReliefChecks(spec: HeadTurnSpec, r0: TurnRender): Check[] {
  const e = spec.engine, A = 'anatomy' as const, c: Check[] = [];
  if (!e || !e.p.neck.visible) return c;
  const R = neckReliefOf(e), n = spec.neck, hasScm = R.scm > 0.03;
  if (hasScm) {
    const rows = Array.from({ length: 40 }, (_, j) => n.y0 + ((n.y1 - n.y0) * (j + 0.5)) / 40), lateral = (psi: number): boolean => psi > 0.4 * Math.PI;
    const lo = marked(spec, n.y1 - 0.1).filter((p) => p < 0.45 * Math.PI), top = rows.find((y) => marked(spec, y).some(lateral));
    c.push(check(A, 'head.neck.scm.insertion', 'Insertion basse du SCM : ψ/π du premier creux au-dessus de la base (antérieure, près du creux sus-sternal : 0,03–0,3)', lo.length ? lo[0]! / Math.PI : 9, 0.03, 0.3));
    c.push(check(A, 'head.neck.scm.mastoid', 'Attache haute du SCM : ψ/π du creux le plus postéro-latéral (apophyse mastoïde : ≥ 0,45)', Math.max(0, ...rows.flatMap((y) => marked(spec, y))) / Math.PI, 0.45, 1));
    c.push(check(A, 'head.neck.scm.below-ear', 'Le SCM n\'apparaît pas au-dessus du lobe de l\'oreille : y du premier creux latéral − y du lobe (U)', top === undefined ? 9 : top - spec.ear.y1, -0.12, 0.45));
  }
  // Couverture de la face antérieure : échantillon régulier.
  let tot = 0, hit = 0;
  for (let j = 0; j < 40; j++) { const y = n.y0 + ((n.y1 - n.y0) * (j + 0.5)) / 40, m = marked(spec, y).length; tot += 99; hit += m; }
  const cov = hit / tot;
  c.push(check(A, 'head.neck.relief.coverage', 'Reliefs du cou : part de la face antérieure marquée (ni vide quand le moteur en prévoit, ni invasive)', cov, hasScm || R.clavicle > 0.05 ? 0.002 : 0, 0.12));
  // Rendu : pixels de creux dans l'image du cou à 0°.
  const mc = markColor(paletteOf(spec));
  let px = 0;
  for (let i = 0; i < r0.w * r0.h; i++) if (r0.regions[i] === REGION.neck && Math.hypot(r0.rgba[4 * i]! - mc[0], r0.rgba[4 * i + 1]! - mc[1], r0.rgba[4 * i + 2]! - mc[2]) < 8) px++;
  c.push(check(A, 'head.neck.relief.pixels', 'Reliefs du cou : pixels de creux dans le rendu à 0° (la lecture du moteur atteint l\'image)', px, hasScm || R.clavicle > 0.05 ? 30 : 0, 1e6));
  return c;
}

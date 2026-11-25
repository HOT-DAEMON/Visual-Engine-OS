import type { HeadSpec, View } from './head';
import type { Light } from './local-geometry';
import { INK_PRO, type ProLock, type ProStyle } from './paint-pro';
import { fillOf } from './paint';
import { area, bladeArea, edgeCos, finite, outsideShare } from './ring-check';
import { MEASURED } from './ring-measures';
import { shoulderDip, shoulderOpacityFor } from './ring-tone';
import { RING, ringBands, type RingBands } from './spec-ring';
import type { Check, Report } from './verify';

/**
 * VÉRIFICATION DU REFLET TRANSVERSAL (docs/HAIR-PASS6.md) — les trois couches de `verify.ts`, appliquées aux anneaux de `spec-ring.ts`.
 * Chaque contrôle relit la bande ÉMISE (sommets) et la compare à la lame et à la géométrie locale, au lieu de relire les constantes qui l'ont construite :
 *  - GÉOMÉTRIQUE : sommets finis ; la bande reste dans le contour émis de la lame ; elle est TRANSVERSE (bord ⟂ tangente) ;
 *  - ANATOMIQUE  : le reflet est sur une face éclairée et tournée vers la caméra (exposition ≥ 0,5, jamais sur le dessous) ; l'ombre aval est du côté opposé à la lumière ;
 *  - STYLE       : la part de mèches portant un reflet n'est ni « mat » ni « plastique » ; étendue et couverture dans la plage MESURÉE sur la référence 60 ; trois paliers d'ombre ;
 *    la bande n'occupe qu'une fraction de la lame.
 * Les plages mesurées sont celles de `ring-measures.ts` (étendue 0,048–0,069 L ; couverture 0,67–0,91 sur rubans droits, réduite sur les lames pliées ; creux d'ombre −0,34 ; part d'aire du reflet 0,9–2,7 % de l'aire des cheveux, 1,4 % sur la tête illustrée) ; les bornes de part de mèches (15–85 %) et d'aire par mèche (≤ 35 %) sont des seuils d'ingénierie.
 * `ringDefects` rend les fautes en `Defect` localisés (mèche, famille, sévérité) comme `lock-check.ts` : un reflet fautif est identifié, et `paintLockPro` ne le dessine pas (garde de rendu).
 * Une scène sans mèche assez nombreuse (< `MIN_LOCKS`) n'est pas jugée sur la part : un seul reflet ne dit rien de la proportion.
 */
export const MIN_LOCKS = 8;
const chk = (name: string, value: number, min: number, max: number): Check => ({ name, value, min, max, ok: Number.isFinite(value) && value >= min && value <= max });
const rep = (layer: Report['layer'], checks: Check[]): Report => ({ layer, checks, ok: checks.every((c) => c.ok) });

/** Les trois rapports (géométrie, anatomie, style) des reflets transversaux d'une coiffure peinte. `painted` : sortie de `paintLockPro`/`paintHairPro`. */
export function verifyRing(_h: HeadSpec, view: View, painted: readonly ProLock[], light: Light, st: ProStyle = INK_PRO): Report[] {
  const rings = painted.map((l) => ({ l, r: ringBands(l.blade, l.geom, l.spec, view, light) })).filter((x): x is { l: ProLock; r: RingBands } => x.r !== null);
  const nonFinite = rings.filter(({ r }) => !finite(r)).length;
  const worstOut = rings.reduce((m, { l, r }) => Math.max(m, outsideShare(l, r)), 0);
  const worstCos = rings.reduce((m, { l, r }) => Math.max(m, edgeCos(l, r)), 0);
  const geometry = rep('geometry', [chk('reflets : sommets non finis', nonFinite, 0, 0), chk('reflets : part de sommets hors du contour de la lame', worstOut, 0, 0), chk('reflets : |cos| bord/tangente max (transverse)', worstCos, 0, 0.43)]);

  const exposure = (l: ProLock, r: RingBands): number => { const n = Math.min(l.geom.n, l.blade.spine.length); return l.geom.exposure[Math.min(n - 1, Math.round(r.at * (n - 1)))] as number; };
  const minExp = rings.length ? Math.min(...rings.map(({ l, r }) => exposure(l, r))) : 1;
  const backfaced = rings.filter(({ l, r }) => { const n = Math.min(l.geom.n, l.blade.spine.length); return l.geom.backface[Math.min(n - 1, Math.round(r.at * (n - 1)))]; }).length;
  const anatomy = rep('anatomy', [chk('reflets sur le dessous du ruban', backfaced, 0, 0), chk('exposition minimale au centre du reflet (demi-Lambert)', minExp, 0.5, 1)]);

  const share = painted.length ? rings.length / painted.length : 0;
  const judged = painted.length >= MIN_LOCKS;
  const ext = rings.map(({ r }) => r.extent); const cov = rings.map(({ r }) => r.coverage);
  const areaShare = rings.length ? Math.max(...rings.map(({ l, r }) => area(r.highlight) / Math.max(1e-6, area(bladeArea(l))))) : 0;
  // Part d'aire de TOUS les reflets / aire de TOUTES les mèches : comparable à la tête illustrée de la référence (1,4 %) et aux panneaux (0,9–2,7 %). Bornes ×0,25 et ×4 de la tête : un ordre de grandeur, pas une loi.
  const totalArea = painted.reduce((a, l) => a + area(bladeArea(l)), 0); const hlArea = rings.reduce((a, { r }) => a + area(r.highlight), 0);
  const globalShare = totalArea > 0 ? hlArea / totalArea : 0;
  // Creux relatif de l'ombre aval : seulement les tons où elle est dessinée (un remplissage plus sombre que l'ombre n'en porte pas).
  const dips = rings.map(({ l }) => { const f = fillOf(l.spec.tone, st); const a = shoulderOpacityFor(f, st.shadow); return a > 0 ? shoulderDip(f, st.shadow, a) : null; }).filter((x): x is number => x !== null);
  const style = rep('style', [
    chk('part de mèches à reflet (ni mat, ni plastique)', judged ? share : 0.5, 0.15, 0.85),
    chk('étendue du reflet / longueur (mesurée 0,047–0,071)', ext.length ? Math.max(...ext) : RING.extent, 0.035, 0.08),
    chk('couverture moyenne en largeur (mesurée 0,67–0,91 sur rubans droits ; réduite par la courbure)', cov.length ? cov.reduce((a, c) => a + c, 0) / cov.length : RING.coverage, 0.6, 0.91),
    chk('paliers d\'ombre aval (3)', rings.length ? Math.min(...rings.map(({ r }) => r.shoulder.length)) : RING.shoulderSteps.length, RING.shoulderSteps.length, RING.shoulderSteps.length),
    chk('aire max du reflet / aire de la lame', areaShare, 0, 0.35),
    chk(`part d'aire des reflets / aire des mèches (tête illustrée ${MEASURED.headHighlightShare})`, judged ? globalShare : MEASURED.headHighlightShare, MEASURED.headHighlightShare * 0.25, MEASURED.headHighlightShare * 4),
    chk('creux relatif de l\'ombre aval (mesuré −0,34 à −0,36)', dips.length ? dips.reduce((a, c) => a + c, 0) / dips.length : MEASURED.dip.C, -0.38, -0.30),
  ]);
  return [geometry, anatomy, style];
}

import { cubicAt, type Vec } from './primitives';
import type { Curves } from './opening-styles';

/**
 * CONTRAT DE HAUTEUR d'une enveloppe : la hauteur demandée (`shape.height × openness`, répartie par `upperFraction`) est la hauteur OBTENUE.
 * `sharp` et `drooping` posent leurs contrôles à la main (flick borné par la largeur, `hUp × 0,55`, `k × hLo × 0,75`…) : sans ce contrôle ils livraient 25 à 26 % de
 * hauteur en moins (docs/EYES-REFS-4.md § 4, mesuré sur 48 combinaisons : −19 % à −35 %). Une cubique de Bézier est invariante par affinité : mettre à l'échelle
 * le décalage des contrôles PAR RAPPORT À LA CORDE des canthi met à l'échelle exactement le décalage de la courbe, donc son apex. La FORME (flick, pointe, tombant)
 * est conservée, seule son amplitude est recalée.
 */
const N = 96;

/** Apex (écart maximal à la corde, ≥ 0) des deux paupières, dans le repère de la corde pi → po (unités du dessin). */
export function apexHeights(c: Curves): { readonly up: number; readonly lo: number; readonly chord: number } {
  const dx = c.po.x - c.pi.x; const dy = c.po.y - c.pi.y; const W = Math.hypot(dx, dy) || 1; const d = { x: dx / W, y: dy / W };
  // CORRECTION (passe 10) : la normale pointe toujours VERS LE BAS (n.y > 0), quel que soit le côté de l'œil. Avec n = (−dy, dx) seul, un œil gauche (corde orientée vers la gauche, dx < 0) avait n.y < 0 :
  // les deux apex valaient 0, `enforceApexHeights` rendait les courbes inchangées et sharp / drooping n'avaient AUCUN contrat de hauteur côté gauche (−25 % de hauteur mesurés).
  const sg = d.x >= 0 ? 1 : -1; const n = { x: -d.y * sg, y: d.x * sg };
  const off = (p: Vec): number => (p.x - c.pi.x) * n.x + (p.y - c.pi.y) * n.y;
  let up = 0; let lo = 0;
  for (let i = 0; i <= N; i++) { up = Math.max(up, -off(cubicAt(c.pi, c.u1, c.u2, c.po, i / N))); lo = Math.max(lo, off(cubicAt(c.po, c.l1, c.l2, c.pi, i / N))); }
  return { up, lo, chord: W };
}

/**
 * Recale l'amplitude des contrôles EXTERNES (u2 haut, l1 bas) pour que les apex valent `wantedUp` et `wantedLo` × (corde / `width`) — la corde peut être un peu plus longue que la
 * largeur nominale quand le style déplace le canthus externe (le profil mesuré divise par la corde, pas par la largeur). Le canthus INTERNE (pi, u1, l2) n'est JAMAIS touché :
 * il est identique pour almond / sharp / drooping (tests/eye-shape-style.test.ts). L'apex est monotone en l'écart du contrôle externe : bissection (facteur dans [0,25 ; 8]).
 */
export function enforceApexHeights(c: Curves, width: number, wantedUp: number, wantedLo: number): Curves {
  const a0 = apexHeights(c); if (a0.up < 1e-9 || a0.lo < 1e-9) return c;
  const s = a0.chord / width;
  const dx = c.po.x - c.pi.x; const dy = c.po.y - c.pi.y; const d = { x: dx / a0.chord, y: dy / a0.chord }; const n = { x: -d.y, y: d.x };
  const scale = (p: Vec, f: number): Vec => { const rx = p.x - c.pi.x; const ry = p.y - c.pi.y; const t = rx * d.x + ry * d.y; const o = rx * n.x + ry * n.y; return { x: c.pi.x + d.x * t + n.x * o * f, y: c.pi.y + d.y * t + n.y * o * f }; };
  const solve = (target: number, apexOf: (f: number) => number): number => { let lo = 0.25; let hi = 8; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (apexOf(mid) < target) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  const fu = solve(wantedUp * s, (f) => apexHeights({ ...c, u2: scale(c.u2, f) }).up);
  const fl = solve(wantedLo * s, (f) => apexHeights({ ...c, l1: scale(c.l1, f) }).lo);
  return { pi: c.pi, po: c.po, u1: c.u1, u2: scale(c.u2, fu), l1: scale(c.l1, fl), l2: c.l2 };
}

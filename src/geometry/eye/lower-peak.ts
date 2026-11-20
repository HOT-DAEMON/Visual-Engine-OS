import { cubicAt, type Vec } from './primitives';
import { apexHeights, enforceApexHeights } from './height-contract';
import type { Curves } from './opening-styles';

/**
 * POSITION DU CREUX DE LA PAUPIÈRE BASSE (`shape.lowerPeak`, passe 10). Mesurée sur les références, la position du creux le long de l'axe des canthi (0 = interne, 1 = externe)
 * varie de 0,40 à 0,65 d'un œil à l'autre (docs/EYES-PASS-9.md § 5 : huit facteurs fixes ne peuvent pas la suivre ; 04, 07 et 11 de face : 0,45–0,65 ; 03 : 0,40 ; 05 : 0,45).
 * Le paramètre la rend libre : les deux contrôles de la paupière basse sont décalés ENSEMBLE le long de la corde (pi -> po) d'un écart `d` trouvé par bissection (le creux est monotone en `d`),
 * puis l'apex bas est recalé sur sa valeur D'ORIGINE (`enforceApexHeights`, le canthus interne pi reste en place, l'apex haut est conservé) : la hauteur de chaque style est celle qu'il avait sans le paramètre (un recalage sur la hauteur demandée changeait celle de round / chibi / triangle).
 */
const N = 192;

/** Position (0..1 le long de la corde) du point de la paupière basse le plus éloigné de la corde. */
export function lowerPeakPosition(c: Curves): number {
  const dx = c.po.x - c.pi.x; const dy = c.po.y - c.pi.y; const W = Math.hypot(dx, dy) || 1; const d = { x: dx / W, y: dy / W }; const sg = d.x >= 0 ? 1 : -1; const n = { x: -d.y * sg, y: d.x * sg };   // normale vers le bas pour les deux côtés (cf. height-contract.ts)
  let best = -1; let at = 0;
  for (let i = 0; i <= N; i++) { const p = cubicAt(c.po, c.l1, c.l2, c.pi, i / N); const o = (p.x - c.pi.x) * n.x + (p.y - c.pi.y) * n.y; if (o > best) { best = o; at = ((p.x - c.pi.x) * d.x + (p.y - c.pi.y) * d.y) / W; } }
  return at;
}

export function placeLowerPeak(c: Curves, width: number, target: number): Curves {
  const a0 = apexHeights(c); const s = a0.chord / width; const dx = c.po.x - c.pi.x; const dy = c.po.y - c.pi.y; const d: Vec = { x: dx / a0.chord, y: dy / a0.chord };
  const at = (shift: number): Curves => {
    const moved: Curves = { ...c, l1: { x: c.l1.x + d.x * shift, y: c.l1.y + d.y * shift }, l2: { x: c.l2.x + d.x * shift, y: c.l2.y + d.y * shift } };
    return enforceApexHeights(moved, width, a0.up / s, a0.lo / s);   // apex haut ET bas ACTUELS conservés : seul le creux se déplace (un recalage sur `hLo` changerait la hauteur native de round / chibi / triangle)
  };
  let lo = -0.45 * a0.chord; let hi = 0.45 * a0.chord;
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (lowerPeakPosition(at(mid)) < target) lo = mid; else hi = mid; }
  return at((lo + hi) / 2);
}

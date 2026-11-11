import type { BrowSpec, HeadTurnSpec, HostBrow, HostEye, HostEyes } from '../types';

const span = (e: HostEye): { x0: number; x1: number; top: number; bot: number } => {
  const xs = [...e.upper, ...e.lower].map((q) => q.x);
  return { x0: Math.min(...xs), x1: Math.max(...xs), top: Math.min(...e.upper.map((q) => q.y)), bot: Math.max(...e.lower.map((q) => q.y)) };
};

/** Sourcils des deux côtés → `BrowSpec` (moyenne droite / gauche : tête, queue, point haut de l'arcade, demi-épaisseur) ; `null` si un côté n'a pas de sourcil. */
function browSpecOf(a: HostBrow | undefined, b: HostBrow | undefined): BrowSpec | null {
  if (!a || !b) return null;
  const m = (f: (q: HostBrow) => number): number => (f(a) + f(b)) / 2, xs = (q: HostBrow): number[] => q.line.map((p) => p.x);
  return { xIn: m((q) => Math.min(...xs(q))), xOut: m((q) => Math.max(...xs(q))), yIn: m((q) => q.line[0]!.y), yMid: m((q) => Math.min(...q.line.map((p) => p.y))), yOut: m((q) => q.line[q.line.length - 1]!.y), thick: m((q) => q.widths.reduce((u, v) => u + v, 0) / q.widths.length / 2) };
}

/**
 * Pose les yeux de l'hôte sur la spec : le peintre lit `eyeHost` (forme, iris, regard), et `eye` (largeur, hauteurs, rayon d'iris) prend la MOYENNE des deux côtés pour que les contrôles
 * (ligne des yeux, relations avec l'oreille et le nez) lisent la taille réelle et non celle de la planche. Le sourcil de l'hôte (`HostEye.brow`) met aussi à jour `brow` (point haut, tête, queue). Les doublons sont évités : aucune autre géométrie d'œil n'est créée.
 */
export function withHostEyes(spec: HeadTurnSpec, E: HostEyes): HeadTurnSpec {
  const a = span(E.right), b = span(E.left), w = (a.x1 - a.x0 + (b.x1 - b.x0)) / 2, cy = spec.eye.y;
  const eye = { ...spec.eye, w, x: (a.x0 + b.x0) / 2 + w / 2, hUp: cy - (a.top + b.top) / 2, hLo: (a.bot + b.bot) / 2 - cy, irisR: (E.right.iris.rx + E.left.iris.rx) / 2 };
  const brow = browSpecOf(E.right.brow, E.left.brow) ?? spec.brow;   // les relations (oreille ↔ sourcil, nez ↔ sourcil) lisent le vrai sourcil ; sans sourcil d'hôte, celui de la planche reste la référence
  return { ...spec, eye, brow, eyeHost: E };
}

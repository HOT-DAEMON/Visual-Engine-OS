import type { HeadTurnSpec, HostEye, HostEyes } from '../types';

const span = (e: HostEye): { x0: number; x1: number; top: number; bot: number } => {
  const xs = [...e.upper, ...e.lower].map((q) => q.x);
  return { x0: Math.min(...xs), x1: Math.max(...xs), top: Math.min(...e.upper.map((q) => q.y)), bot: Math.max(...e.lower.map((q) => q.y)) };
};

/**
 * Pose les yeux de l'hôte sur la spec : le peintre lit `eyeHost` (forme, iris, regard), et `eye` (largeur, hauteurs, rayon d'iris) prend la MOYENNE des deux côtés pour que les contrôles
 * (ligne des yeux, relations avec l'oreille et le nez) lisent la taille réelle et non celle de la planche. Les doublons sont évités : aucune autre géométrie d'œil n'est créée.
 */
export function withHostEyes(spec: HeadTurnSpec, E: HostEyes): HeadTurnSpec {
  const a = span(E.right), b = span(E.left), w = (a.x1 - a.x0 + (b.x1 - b.x0)) / 2, cy = spec.eye.y;
  const eye = { ...spec.eye, w, x: (a.x0 + b.x0) / 2 + w / 2, hUp: cy - (a.top + b.top) / 2, hLo: (a.bot + b.bot) / 2 - cy, irisR: (E.right.iris.rx + E.left.iris.rx) / 2 };
  return { ...spec, eye, eyeHost: E };
}
